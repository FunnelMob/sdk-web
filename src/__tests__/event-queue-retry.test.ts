import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventQueue } from '../internal/event-queue';
import { NetworkClient, NetworkError } from '../internal/network-client';
import { FunnelMobConfiguration, LogLevel } from '../configuration';
import type { Event } from '../internal/event';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

function makeEvent(name: string): Event {
  return {
    eventId: `evt-${name}`,
    eventName: name,
    timestamp: new Date().toISOString(),
  };
}

function makeConfig() {
  return new FunnelMobConfiguration({
    apiKey: 'fm_test_key',
    logLevel: LogLevel.None,
    maxBatchSize: 100,
  });
}

describe('EventQueue flush retry semantics', () => {
  let queue: EventQueue;
  let client: NetworkClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    queue = new EventQueue();
    client = new NetworkClient();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('on success: events are removed from the queue', async () => {
    queue.enqueue(makeEvent('A'));
    queue.enqueue(makeEvent('B'));
    expect(queue.count).toBe(2);

    vi.spyOn(client, 'sendEvents').mockResolvedValueOnce(undefined);

    await queue.flush(client, makeConfig(), 'device-1', null);

    expect(queue.count).toBe(0);
  });

  it('on retryable NetworkError (5xx): batch is re-queued, queue size unchanged', async () => {
    queue.enqueue(makeEvent('A'));
    queue.enqueue(makeEvent('B'));
    expect(queue.count).toBe(2);

    vi.spyOn(client, 'sendEvents').mockRejectedValueOnce(
      new NetworkError('Server error', 'server_error')
    );

    await queue.flush(client, makeConfig(), 'device-1', null);

    expect(queue.count).toBe(2);
  });

  it('on retryable NetworkError (rate limited): batch is re-queued', async () => {
    queue.enqueue(makeEvent('A'));
    expect(queue.count).toBe(1);

    vi.spyOn(client, 'sendEvents').mockRejectedValueOnce(
      new NetworkError('Rate limited', 'rate_limited')
    );

    await queue.flush(client, makeConfig(), 'device-1', null);

    expect(queue.count).toBe(1);
  });

  it('on non-retryable NetworkError (401): batch is dropped, queue is empty', async () => {
    queue.enqueue(makeEvent('A'));
    queue.enqueue(makeEvent('B'));
    expect(queue.count).toBe(2);

    vi.spyOn(client, 'sendEvents').mockRejectedValueOnce(
      new NetworkError('Unauthorized', 'unauthorized')
    );

    await queue.flush(client, makeConfig(), 'device-1', null);

    // Critical: events must be DROPPED, not re-queued — otherwise a bad
    // API key would loop forever hammering the backend.
    expect(queue.count).toBe(0);
  });

  it('on non-retryable NetworkError (4xx): batch is dropped', async () => {
    queue.enqueue(makeEvent('A'));
    expect(queue.count).toBe(1);

    vi.spyOn(client, 'sendEvents').mockRejectedValueOnce(
      new NetworkError('Bad request', 'client_error')
    );

    await queue.flush(client, makeConfig(), 'device-1', null);

    expect(queue.count).toBe(0);
  });

  it('on generic Error (fetch network failure): batch is re-queued', async () => {
    queue.enqueue(makeEvent('A'));
    expect(queue.count).toBe(1);

    // fetch() throws a generic TypeError on actual network failure
    // (no response received). Not a NetworkError instance — should default
    // to retryable.
    vi.spyOn(client, 'sendEvents').mockRejectedValueOnce(
      new TypeError('Failed to fetch')
    );

    await queue.flush(client, makeConfig(), 'device-1', null);

    expect(queue.count).toBe(1);
  });

  it('order is preserved across retry: failed batch comes back to front of queue', async () => {
    // Enqueue A, B, C
    queue.enqueue(makeEvent('A'));
    queue.enqueue(makeEvent('B'));
    queue.enqueue(makeEvent('C'));

    // First flush fails (retryable) — A, B, C re-queued
    vi.spyOn(client, 'sendEvents').mockRejectedValueOnce(
      new NetworkError('Server error', 'server_error')
    );
    await queue.flush(client, makeConfig(), 'device-1', null);

    // Now host tracks D, E while A/B/C are re-queued at the front
    queue.enqueue(makeEvent('D'));
    queue.enqueue(makeEvent('E'));

    // Capture what gets sent on the next flush
    let sentBatch: Event[] = [];
    vi.spyOn(client, 'sendEvents').mockImplementationOnce(
      async (events: Event[]) => {
        sentBatch = events;
      }
    );
    await queue.flush(client, makeConfig(), 'device-1', null);

    // Backend should receive A, B, C, D, E in that exact order
    expect(sentBatch.map((e) => e.eventName)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(queue.count).toBe(0);
  });

  it('requeue persists to localStorage so events survive page reload', async () => {
    queue.enqueue(makeEvent('A'));
    expect(queue.count).toBe(1);

    vi.spyOn(client, 'sendEvents').mockRejectedValueOnce(
      new NetworkError('Server error', 'server_error')
    );
    await queue.flush(client, makeConfig(), 'device-1', null);

    // Simulate a page reload: new EventQueue instance reads from localStorage
    const reloadedQueue = new EventQueue();
    expect(reloadedQueue.count).toBe(1);
  });

  it('NetworkError.isRetryable correctly classifies all status codes', () => {
    expect(new NetworkError('', 'server_error').isRetryable).toBe(true);
    expect(new NetworkError('', 'rate_limited').isRetryable).toBe(true);
    expect(new NetworkError('', 'unknown').isRetryable).toBe(true);
    expect(new NetworkError('', 'unauthorized').isRetryable).toBe(false);
    expect(new NetworkError('', 'client_error').isRetryable).toBe(false);
  });
});
