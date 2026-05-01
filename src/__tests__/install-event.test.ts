import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FunnelMob } from '../funnelmob';
import { FunnelMobConfiguration, LogLevel } from '../configuration';

const mockFetch = vi.fn();
global.fetch = mockFetch;

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

async function flushAndCaptureEvents(): Promise<Record<string, unknown>[]> {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  await new Promise((r) => setTimeout(r, 30));
  const eventsCalls = mockFetch.mock.calls.filter(
    (call) => typeof call[0] === 'string' && (call[0] as string).includes('/events')
  );
  return eventsCalls.flatMap((call) => {
    const body = JSON.parse((call[1] as { body: string }).body);
    return (body.events ?? []) as Record<string, unknown>[];
  });
}

function resetSdkSingleton(): void {
  // @ts-expect-error accessing private static for test reset
  FunnelMob.instance = null;
}

describe('Install event (first-launch parity with iOS/Android)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    resetSdkSingleton();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: 'test', server_timestamp: new Date().toISOString() }),
    });
  });

  afterEach(() => {
    FunnelMob.shared.destroy();
    resetSdkSingleton();
  });

  it('fires Install exactly once on first launch, before ActivateApp', async () => {
    const sdk = FunnelMob.shared;
    sdk.initialize(new FunnelMobConfiguration({ apiKey: 'test-key', logLevel: LogLevel.None }));

    sdk.flush();
    const events = await flushAndCaptureEvents();

    const installs = events.filter((e) => e.event_name === 'Install');
    const activates = events.filter((e) => e.event_name === 'ActivateApp');

    expect(installs.length).toBe(1);
    expect(activates.length).toBe(1);

    // Ordering: Install must precede ActivateApp(first) so postback
    // consumers see the install signal first.
    const installIdx = events.findIndex((e) => e.event_name === 'Install');
    const activateIdx = events.findIndex((e) => e.event_name === 'ActivateApp');
    expect(installIdx).toBeLessThan(activateIdx);

    // First-launch ActivateApp carries is_first_session=true.
    const firstActivate = activates[0] as { parameters?: Record<string, unknown> };
    expect(firstActivate.parameters?.is_first_session).toBe(true);
  });

  it('does not fire Install on subsequent launches', async () => {
    // First launch: prime the marker by initializing once and flushing.
    {
      const sdk = FunnelMob.shared;
      sdk.initialize(new FunnelMobConfiguration({ apiKey: 'test-key', logLevel: LogLevel.None }));
      sdk.flush();
      await new Promise((r) => setTimeout(r, 30));
      sdk.destroy();
      resetSdkSingleton();
      vi.clearAllMocks();
    }

    // Second launch: marker is already set in localStorage, so isFirstLaunch=false.
    const sdk = FunnelMob.shared;
    sdk.initialize(new FunnelMobConfiguration({ apiKey: 'test-key', logLevel: LogLevel.None }));
    sdk.flush();
    const events = await flushAndCaptureEvents();

    const installs = events.filter((e) => e.event_name === 'Install');
    const activates = events.filter((e) => e.event_name === 'ActivateApp');

    expect(installs.length).toBe(0);
    expect(activates.length).toBe(1);

    // Subsequent ActivateApp must NOT carry is_first_session=true.
    const activate = activates[0] as { parameters?: Record<string, unknown> };
    expect(activate.parameters?.is_first_session).toBeUndefined();
  });
});
