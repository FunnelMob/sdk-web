import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FunnelMob } from '../funnelmob';
import { FunnelMobConfiguration, LogLevel } from '../configuration';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
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

describe('FunnelMob Identify', () => {
  let sdk: FunnelMob;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Reset singleton
    // @ts-expect-error accessing private static
    FunnelMob.instance = null;
    sdk = FunnelMob.shared;

    // Mock all fetch calls by default (session + identify)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        session_id: 'test-session',
        server_timestamp: new Date().toISOString(),
      }),
    });

    const config = new FunnelMobConfiguration({
      apiKey: 'test-api-key',
      logLevel: LogLevel.None,
    });
    sdk.initialize(config);
  });

  afterEach(() => {
    sdk.destroy();
  });

  it('should send identify request when setUserId is called', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });

    sdk.setUserId('alice');

    // Wait for async identify
    await new Promise((r) => setTimeout(r, 50));

    // Find the identify call (not the session call)
    const identifyCalls = mockFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('/identify')
    );

    expect(identifyCalls.length).toBe(1);
    const body = JSON.parse(identifyCalls[0][1].body);
    expect(body.user_id).toBe('alice');
    expect(body.platform).toBe('web');
    expect(body.device_id).toBeTruthy();
  });

  it('should persist userId to localStorage', () => {
    sdk.setUserId('bob');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('fm_user_id', 'bob');
  });

  it('should clear userId and properties on clearUserId', () => {
    sdk.setUserId('charlie');
    sdk.clearUserId();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('fm_user_id');
  });

  it('should not send identify if userId is empty', async () => {
    const fetchCallsBefore = mockFetch.mock.calls.length;
    sdk.setUserId('');

    await new Promise((r) => setTimeout(r, 50));

    const identifyCalls = mockFetch.mock.calls
      .slice(fetchCallsBefore)
      .filter((call) => typeof call[0] === 'string' && call[0].includes('/identify'));
    expect(identifyCalls.length).toBe(0);
  });

  it('should send user_properties with identify', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });

    sdk.setUserId('diana');
    await new Promise((r) => setTimeout(r, 50));

    sdk.setUserProperties({ plan: 'pro', age: 30 });
    await new Promise((r) => setTimeout(r, 50));

    const identifyCalls = mockFetch.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('/identify')
    );

    // Should have 2 identify calls: one from setUserId, one from setUserProperties
    expect(identifyCalls.length).toBe(2);

    const lastBody = JSON.parse(identifyCalls[1][1].body);
    expect(lastBody.user_properties).toEqual({ plan: 'pro', age: 30 });
  });

  it('should not allow setUserProperties without setUserId', async () => {
    const fetchCallsBefore = mockFetch.mock.calls.length;
    sdk.setUserProperties({ plan: 'pro' });

    await new Promise((r) => setTimeout(r, 50));

    const identifyCalls = mockFetch.mock.calls
      .slice(fetchCallsBefore)
      .filter((call) => typeof call[0] === 'string' && call[0].includes('/identify'));
    expect(identifyCalls.length).toBe(0);
  });
});
