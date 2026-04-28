import { FunnelMobConfiguration } from '../configuration';
import { Event, serializeEvent } from './event';
import { Logger } from './logger';
import { NetworkClient, NetworkError } from './network-client';

const STORAGE_KEY = 'funnelmob_events';

/**
 * Event queue with localStorage persistence
 */
export class EventQueue {
  private events: Event[] = [];

  constructor() {
    this.loadPersistedEvents();
  }

  /**
   * Add event to queue. Returns the new queue size.
   */
  enqueue(event: Event): number {
    this.events.push(event);
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
   * retryable send failure. Preserves event ordering: the failed
   * batch retries first, before any newer events tracked while the
   * in-flight POST was outstanding.
   */
  requeue(batch: Event[]): void {
    this.events = [...batch, ...this.events];
    this.persistEvents();
  }

  /**
   * Flush all events
   */
  async flush(
    client: NetworkClient,
    configuration: FunnelMobConfiguration,
    deviceId: string,
    userId?: string | null
  ): Promise<void> {
    const batch = this.dequeue(configuration.maxBatchSize);
    if (batch.length === 0) return;

    Logger.debug(`Flushing ${batch.length} events`);

    try {
      await client.sendEvents(batch, deviceId, configuration, userId);
      Logger.debug(`Successfully sent ${batch.length} events`);
    } catch (error) {
      // Generic Errors (fetch network failures with no response) are
      // always retryable; classified NetworkErrors check isRetryable.
      const retryable = !(error instanceof NetworkError) || error.isRetryable;
      if (retryable) {
        this.requeue(batch);
        Logger.warning(`Re-queued ${batch.length} events: ${error}`);
      } else {
        Logger.error(`Dropped ${batch.length} events (non-retryable): ${error}`);
      }
    }
  }

  // MARK: - Persistence

  private persistEvents(): void {
    try {
      if (typeof localStorage === 'undefined') return;

      const serialized = this.events.map(serializeEvent);
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
      }));

      Logger.debug(`Loaded ${this.events.length} persisted events`);
    } catch (error) {
      Logger.warning(`Failed to load persisted events: ${error}`);
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}
