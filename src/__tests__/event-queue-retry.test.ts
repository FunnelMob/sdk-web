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

function makeConfig(overrides: { enableRetryQueue?: boolean } = {}) {
  return new FunnelMobConfiguration({
    apiKey: 'fm_test_key',
    logLevel: LogLevel.None,
    maxBatchSize: 100,
    // Retry behavior is gated behind a config flag (default off) until
    // backend event-id dedup ships. These tests exercise the retry path
    // explicitly, so opt in.
    enableRetryQueue: overrides.enableRetryQueue ?? true,
  });
}

/**
 * Bypass the backoff window so a follow-up flush in the same test
 * doesn't have to wait the real 2-60s. Reaches into the private field
 * intentionally — production code never resets this.
 */
function clearBackoff(q: EventQueue): void {
  // @ts-expect-error access private for test
  q.nextFlushAllowedAt = 0;
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

    // Skip past the backoff window before the next flush. The backoff
    // is `2^attempt * 1000ms + jitter` and would otherwise gate the
    // second flush.
    clearBackoff(queue);

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

  it('with enableRetryQueue=false (default), retryable failures DROP the batch', async () => {
    queue.enqueue(makeEvent('A'));
    queue.enqueue(makeEvent('B'));
    expect(queue.count).toBe(2);

    vi.spyOn(client, 'sendEvents').mockRejectedValueOnce(
      new NetworkError('Server error', 'server_error')
    );

    // Default-off config: retryable error logs at error level but events drop.
    await queue.flush(client, makeConfig({ enableRetryQueue: false }), 'device-1', null);

    // Batch must be DROPPED, not re-queued — protects against duplicate
    // revenue events while backend events table lacks event_id dedup.
    expect(queue.count).toBe(0);
  });

  it('NetworkError.isRetryable correctly classifies all status codes', () => {
    expect(new NetworkError('', 'server_error').isRetryable).toBe(true);
    expect(new NetworkError('', 'rate_limited').isRetryable).toBe(true);
    expect(new NetworkError('', 'unknown').isRetryable).toBe(true);
    expect(new NetworkError('', 'unauthorized').isRetryable).toBe(false);
    expect(new NetworkError('', 'client_error').isRetryable).toBe(false);
  });
});

describe('EventQueue resilience caps', () => {
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

  it('enqueue drops oldest events when MAX_QUEUE_SIZE is exceeded', () => {
    // MAX_QUEUE_SIZE is 1000 in event-queue.ts. Push 1005 and verify
    // the queue holds 1000 with the FIRST five evicted.
    for (let i = 0; i < 1005; i += 1) {
      queue.enqueue(makeEvent(`E${i}`));
    }
    expect(queue.count).toBe(1000);

    // First remaining event should be E5 (E0..E4 evicted).
    const batch = queue.dequeue(1);
    expect(batch[0].eventName).toBe('E5');
  });

  it('drops the batch after MAX_RETRY_ATTEMPTS retryable failures', async () => {
    queue.enqueue(makeEvent('A'));

    // Each failed flush bumps attemptCount on the re-queued events. Five
    // attempts is the cap; the sixth must drop.
    for (let i = 0; i < 6; i += 1) {
      vi.spyOn(client, 'sendEvents').mockRejectedValueOnce(
        new NetworkError('Server error', 'server_error')
      );
      clearBackoff(queue);
      await queue.flush(client, makeConfig(), 'device-1', null);
    }

    // After the 6th attempt the batch is dropped.
    expect(queue.count).toBe(0);
  });

  it('successful flush resets attemptCount via clean dequeue', async () => {
    queue.enqueue(makeEvent('A'));

    // Two failures bump attemptCount to 2.
    for (let i = 0; i < 2; i += 1) {
      vi.spyOn(client, 'sendEvents').mockRejectedValueOnce(
        new NetworkError('Server error', 'server_error')
      );
      clearBackoff(queue);
      await queue.flush(client, makeConfig(), 'device-1', null);
    }
    expect(queue.count).toBe(1);

    // Now succeed; queue empties cleanly.
    vi.spyOn(client, 'sendEvents').mockResolvedValueOnce(undefined);
    clearBackoff(queue);
    await queue.flush(client, makeConfig(), 'device-1', null);
    expect(queue.count).toBe(0);
  });

  it('flush is single-flighted: concurrent calls do not double-dequeue', async () => {
    queue.enqueue(makeEvent('A'));
    queue.enqueue(makeEvent('B'));

    // Slow-resolving send; first flush is in flight, second must skip.
    let resolveSend: (() => void) | null = null;
    vi.spyOn(client, 'sendEvents').mockImplementation(
      () => new Promise<void>((resolve) => { resolveSend = () => resolve(); })
    );

    const first = queue.flush(client, makeConfig(), 'device-1', null);
    const second = queue.flush(client, makeConfig(), 'device-1', null);

    // Both promises resolve, but the second is a no-op (returns immediately).
    expect(resolveSend).not.toBeNull();
    resolveSend!();
    await Promise.all([first, second]);

    // sendEvents was called exactly once even though we called flush twice.
    expect((client.sendEvents as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
  });

  it('after a retryable failure, flush() inside the backoff window is a no-op', async () => {
    queue.enqueue(makeEvent('A'));

    // First flush: retryable failure → backoff set
    vi.spyOn(client, 'sendEvents').mockRejectedValueOnce(
      new NetworkError('Server error', 'server_error')
    );
    await queue.flush(client, makeConfig(), 'device-1', null);
    expect(queue.count).toBe(1);

    // Immediate second flush: must skip without calling the network.
    const sendSpy = vi.spyOn(client, 'sendEvents');
    sendSpy.mockClear();
    await queue.flush(client, makeConfig(), 'device-1', null);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(queue.count).toBe(1);
  });

  it('successful flush clears the backoff', async () => {
    queue.enqueue(makeEvent('A'));

    // First: retryable failure → backoff active.
    vi.spyOn(client, 'sendEvents').mockRejectedValueOnce(
      new NetworkError('Server error', 'server_error')
    );
    await queue.flush(client, makeConfig(), 'device-1', null);

    // Bypass backoff and succeed.
    clearBackoff(queue);
    queue.enqueue(makeEvent('B'));
    vi.spyOn(client, 'sendEvents').mockResolvedValueOnce(undefined);
    await queue.flush(client, makeConfig(), 'device-1', null);

    // After success a fresh enqueue + flush should NOT be gated.
    queue.enqueue(makeEvent('C'));
    const sendSpy = vi.spyOn(client, 'sendEvents').mockResolvedValueOnce(undefined);
    await queue.flush(client, makeConfig(), 'device-1', null);
    expect(sendSpy).toHaveBeenCalled();
    expect(queue.count).toBe(0);
  });
});
