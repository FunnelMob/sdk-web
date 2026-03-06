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

describe('FunnelMob Remote Config', () => {
  let sdk: FunnelMob;

  const mockConfigResponse = {
    dark_mode: true,
    max_retries: 3,
    welcome_message: 'Hello!',
    feature_flags: { beta: true },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // Reset singleton
    // @ts-expect-error accessing private static
    FunnelMob.instance = null;
    sdk = FunnelMob.shared;

    // Mock fetch: session response first, then config response
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session',
          server_timestamp: new Date().toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockConfigResponse,
      });
  });

  afterEach(() => {
    sdk.destroy();
  });

  function initSdk() {
    const config = new FunnelMobConfiguration({
      apiKey: 'fm_test_key',
      logLevel: LogLevel.None,
    });
    sdk.initialize(config);
  }

  it('should return default value when config not loaded', () => {
    // Don't initialize - no config loaded
    expect(sdk.getConfig('dark_mode', false)).toBe(false);
    expect(sdk.getConfig('missing_key')).toBeUndefined();
  });

  it('should return empty object from getAllConfig when not loaded', () => {
    expect(sdk.getAllConfig()).toEqual({});
  });

  it('should fetch config on initialize and make values available', async () => {
    initSdk();

    // Wait for config to actually be set (fetch + json parsing)
    await vi.waitFor(() => {
      expect(sdk.getConfig('dark_mode')).toBe(true);
    });

    // Verify config fetch was called with correct URL and headers
    const configCall = mockFetch.mock.calls[1];
    expect(configCall[0]).toContain('/config');
    expect(configCall[1].headers['X-FM-API-Key']).toBe('fm_test_key');

    expect(sdk.getConfig('max_retries')).toBe(3);
    expect(sdk.getConfig('welcome_message')).toBe('Hello!');
    expect(sdk.getConfig('feature_flags')).toEqual({ beta: true });
  });

  it('should return default value for missing key', async () => {
    initSdk();

    await vi.waitFor(() => {
      expect(sdk.getConfig('dark_mode')).toBe(true);
    });

    expect(sdk.getConfig('nonexistent', 'default')).toBe('default');
  });

  it('should return all config values as a copy', async () => {
    initSdk();

    await vi.waitFor(() => {
      expect(sdk.getConfig('dark_mode')).toBe(true);
    });

    const all = sdk.getAllConfig();
    expect(all).toEqual(mockConfigResponse);

    // Verify it's a copy, not a reference
    all.dark_mode = false;
    expect(sdk.getConfig('dark_mode')).toBe(true);
  });

  it('should fire onConfigLoaded callback when config arrives', async () => {
    const callback = vi.fn();

    initSdk();
    sdk.onConfigLoaded(callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });

    expect(callback).toHaveBeenCalledWith(mockConfigResponse);
  });

  it('should fire onConfigLoaded immediately if already loaded', async () => {
    initSdk();

    await vi.waitFor(() => {
      expect(sdk.getConfig('dark_mode')).toBe(true);
    });

    const callback = vi.fn();
    sdk.onConfigLoaded(callback);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(mockConfigResponse);
  });

  it('should cache config in localStorage', async () => {
    initSdk();

    await vi.waitFor(() => {
      expect(sdk.getConfig('dark_mode')).toBe(true);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'fm_remote_config',
      JSON.stringify(mockConfigResponse),
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'fm_remote_config_ts',
      expect.any(String),
    );
  });

  it('should load cached config on initialize', () => {
    // Pre-populate localStorage with cached config
    const cachedConfig = { cached_key: 'cached_value' };
    localStorageMock.setItem('fm_remote_config', JSON.stringify(cachedConfig));
    localStorageMock.setItem('fm_remote_config_ts', Date.now().toString());

    initSdk();

    // Cached config should be available immediately (before fetch completes)
    expect(sdk.getConfig('cached_key')).toBe('cached_value');
  });

  it('should not load expired cache', () => {
    const cachedConfig = { old_key: 'old_value' };
    localStorageMock.setItem('fm_remote_config', JSON.stringify(cachedConfig));
    // Set timestamp to 10 minutes ago (expired)
    localStorageMock.setItem(
      'fm_remote_config_ts',
      (Date.now() - 10 * 60 * 1000).toString(),
    );

    initSdk();

    expect(sdk.getConfig('old_key')).toBeUndefined();
  });

  it('should handle fetch failure gracefully', async () => {
    // Reset mocks
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test-session',
          server_timestamp: new Date().toISOString(),
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

    initSdk();

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // Should not throw, just return defaults
    expect(sdk.getConfig('any_key', 'fallback')).toBe('fallback');
  });

  it('should clean up on destroy', async () => {
    initSdk();

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    sdk.destroy();

    expect(sdk.getConfig('dark_mode')).toBeUndefined();
    expect(sdk.getAllConfig()).toEqual({});
  });
});
