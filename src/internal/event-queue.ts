import { FunnelMobConfiguration } from '../configuration';
import { Event, serializeEvent } from './event';
import { Logger } from './logger';
import { NetworkClient, NetworkError } from './network-client';

const STORAGE_KEY = 'funnelmob_events';

/**
 * Hard cap on the number of events held in memory + persistence. When
 * `enqueue()` would exceed this, the OLDEST event is dropped (FIFO
 * eviction) so a sustained backend outage can't grow the queue
 * unboundedly. Same cap applies after a `requeue()` prepends a failed
 * batch — events at the tail are dropped first.
 */
const MAX_QUEUE_SIZE = 1000;

/**
 * Maximum number of times a batch may be re-queued before it's dropped.
 * Protects against poison-pill events that fail every retry forever.
 * Kept low because the SDK has no per-event-id dedup; ten retries of a
 * silently-succeeding POST would be ten duplicate rows.
 */
const MAX_RETRY_ATTEMPTS = 5;

/** Hard cap on backoff sleep between retries (ms). */
const MAX_BACKOFF_MS = 60_000;

/** Random jitter added to every backoff (0…this ms). */
const MAX_JITTER_MS = 1000;

/**
 * Event queue with localStorage persistence
 */
export class EventQueue {
  private events: Event[] = [];

  /**
   * In-flight guard so two near-simultaneous flush triggers (timer +
   * lifecycle hook) don't dequeue / re-queue overlapping batches and
   * scramble ordering. Mirrors `FunnelMob.isReFireInFlight` in funnelmob.ts.
   */
  private isFlushInFlight = false;

  /**
   * Earliest wall-clock time (`Date.now()` ms) at which the next flush
   * may run. Bumped on every retryable failure to implement exponential
   * backoff. `0` = no wait pending.
   */
  private nextFlushAllowedAt = 0;

  constructor() {
    this.loadPersistedEvents();
  }

  /**
   * Add event to queue. Returns the new queue size. When the cap is
   * exceeded the oldest event is dropped (FIFO).
   */
  enqueue(event: Event): number {
    const eventWithCounter: Event =
      event.attemptCount === undefined ? { ...event, attemptCount: 0 } : event;
    this.events.push(eventWithCounter);
    if (this.events.length > MAX_QUEUE_SIZE) {
      const dropped = this.events.length - MAX_QUEUE_SIZE;
      this.events.splice(0, dropped);
      Logger.warning(
        `Queue size exceeded ${MAX_QUEUE_SIZE}; dropped ${dropped} oldest event(s)`
      );
    }
    this.persistEvents();
    return this.events.length;
  }

  /**
   * Snapshot all queued events without removing them. Used for sendBeacon
   * unload paths where we cannot await an async response and re-queue on failure.
   */
  drainAll(): Event[] {
    const batch = this.events.slice();
    this.events = [];
    this.persistEvents();
    return batch;
  }

  /**
   * Get and remove events for sending
   */
  dequeue(maxCount: number): Event[] {
    const count = Math.min(maxCount, this.events.length);
    const batch = this.events.splice(0, count);
    this.persistEvents();
    return batch;
  }

  /**
   * Current queue count
   */
  get count(): number {
    return this.events.length;
  }

  /**
   * Drop every queued event from memory and persistent storage.
   * Used when the user revokes consent — GDPR requires the SDK to
   * stop processing further data, including data already in flight
   * to the network layer.
   */
  clear(): void {
    this.events = [];
    this.nextFlushAllowedAt = 0;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Prepend a previously-dequeued batch back to the queue after a
   * retryable send failure. Preserves event ordering: the failed batch
   * retries first, before any newer events tracked while the in-flight
   * POST was outstanding.
   *
   * Re-serializes the entire queue to localStorage on every call (O(n));
   * bounded by MAX_QUEUE_SIZE so the cost is capped, but worth knowing
   * if MAX_QUEUE_SIZE is ever raised.
   */
  requeue(batch: Event[]): void {
    this.events = [...batch, ...this.events];
    if (this.events.length > MAX_QUEUE_SIZE) {
      const dropped = this.events.length - MAX_QUEUE_SIZE;
      // Drop the TAIL: the re-queued failed batch keeps retry priority,
      // newer events arriving after it lose first.
      this.events.length = MAX_QUEUE_SIZE;
      Logger.warning(
        `Queue size exceeded ${MAX_QUEUE_SIZE} after requeue; dropped ${dropped} newest event(s)`
      );
    }
    this.persistEvents();
  }

  /**
   * Flush all events. Returns immediately when (a) another flush is in
   * flight, or (b) we're inside an active backoff window from a prior
   * retryable failure.
   */
  async flush(
    client: NetworkClient,
    configuration: FunnelMobConfiguration,
    deviceId: string,
    userId?: string | null
  ): Promise<void> {
    if (this.isFlushInFlight) {
      Logger.debug('flush() skipped: another flush is already in flight');
      return;
    }
    const now = Date.now();
    if (now < this.nextFlushAllowedAt) {
      Logger.debug(
        `flush() skipped: backoff active for ${this.nextFlushAllowedAt - now}ms more`
      );
      return;
    }

    const batch = this.dequeue(configuration.maxBatchSize);
    if (batch.length === 0) return;

    this.isFlushInFlight = true;
    Logger.debug(`Flushing ${batch.length} events`);

    try {
      await client.sendEvents(batch, deviceId, configuration, userId);
      Logger.debug(`Successfully sent ${batch.length} events`);
      // Successful flush clears any prior backoff.
      this.nextFlushAllowedAt = 0;
    } catch (error) {
      // Generic Errors (fetch network failures with no response) are
      // always retryable; classified NetworkErrors check isRetryable.
      const retryable = !(error instanceof NetworkError) || error.isRetryable;
      if (!retryable) {
        Logger.error(`Dropped ${batch.length} events (non-retryable): ${error}`);
        return;
      }
      // Retry queue is gated behind a config flag because the backend
      // `events` table lacks `event_id` dedup. With dedup off, retrying a
      // POST whose response was lost duplicates rows. Default off.
      if (!configuration.enableRetryQueue) {
        Logger.error(
          `Dropped ${batch.length} events (retryable, but enableRetryQueue=false): ${error}`
        );
        return;
      }

      // Bump every event's attemptCount; if any has now exceeded the
      // cap, the whole batch is poison and gets dropped.
      const bumped = batch.map((e) => ({
        ...e,
        attemptCount: (e.attemptCount ?? 0) + 1,
      }));
      const maxAttempts = bumped.reduce(
        (m, e) => Math.max(m, e.attemptCount ?? 0),
        0
      );
      if (maxAttempts > MAX_RETRY_ATTEMPTS) {
        Logger.error(
          `Dropped ${bumped.length} events (max retries ${MAX_RETRY_ATTEMPTS} exceeded): ${error}`
        );
        return;
      }

      this.requeue(bumped);
      this.nextFlushAllowedAt = computeNextFlushAt(maxAttempts);
      Logger.warning(
        `Re-queued ${bumped.length} events (attempt ${maxAttempts}/${MAX_RETRY_ATTEMPTS}); ` +
          `next flush allowed in ${this.nextFlushAllowedAt - Date.now()}ms: ${error}`
      );
    } finally {
      this.isFlushInFlight = false;
    }
  }

  // MARK: - Persistence

  private persistEvents(): void {
    try {
      if (typeof localStorage === 'undefined') return;

      const serialized = this.events.map((e) => ({
        ...serializeEvent(e),
        attempt_count: e.attemptCount ?? 0,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
      Logger.warning(`Failed to persist events: ${error}`);
    }
  }

  private loadPersistedEvents(): void {
    try {
      if (typeof localStorage === 'undefined') return;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;

      this.events = parsed.map((e) => ({
        eventId: e.event_id,
        eventName: e.event_name,
        timestamp: e.timestamp,
        revenue: e.revenue,
        parameters: e.parameters,
        attemptCount: typeof e.attempt_count === 'number' ? e.attempt_count : 0,
      }));

      Logger.debug(`Loaded ${this.events.length} persisted events`);
    } catch (error) {
      Logger.warning(`Failed to load persisted events: ${error}`);
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

/**
 * Exponential backoff with jitter: 2^n * 1s capped at MAX_BACKOFF_MS,
 * plus a random 0-1s jitter to spread the thundering herd. Returned
 * value is an absolute `Date.now()`-style timestamp in ms.
 */
function computeNextFlushAt(attemptCount: number): number {
  const base = Math.min(2 ** attemptCount * 1000, MAX_BACKOFF_MS);
  const jitter = Math.floor(Math.random() * MAX_JITTER_MS);
  return Date.now() + base + jitter;
}
