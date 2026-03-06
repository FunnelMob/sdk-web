import { FunnelMobConfiguration } from '../configuration';
import { Event, serializeEvent } from './event';
import { Logger } from './logger';
import { NetworkClient } from './network-client';

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
   * Add event to queue
   */
  enqueue(event: Event): void {
    this.events.push(event);
    this.persistEvents();
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
      // Re-queue events on failure
      this.events = [...batch, ...this.events];
      this.persistEvents();
      Logger.error(`Failed to send events: ${error}`);
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
