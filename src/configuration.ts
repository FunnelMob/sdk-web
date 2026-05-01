/**
 * Default base URL for the FunnelMob API. Used when no `baseUrl` override
 * is supplied on the Configuration. The SDK appends `/v1/<endpoint>` to
 * this root for every request.
 */
const DEFAULT_BASE_URL = 'https://api.funnelmob.com';

/**
 * Log level options
 */
export enum LogLevel {
  None = 0,
  Error = 1,
  Warning = 2,
  Info = 3,
  Debug = 4,
  Verbose = 5,
}

/**
 * Configuration options for the FunnelMob SDK
 */
export class FunnelMobConfiguration {
  /** API key for authentication */
  readonly apiKey: string;

  /**
   * Base URL for API calls. Defaults to the production endpoint
   * (`https://api.funnelmob.com`). The SDK appends `/v1/<endpoint>`
   * itself, so pass the host root only (e.g. `http://localhost:3080`
   * for local development). Trailing slashes are trimmed.
   */
  readonly baseUrl: string;

  /** Log level for debugging */
  readonly logLevel: LogLevel;

  /** Interval between automatic event flushes (in milliseconds) */
  readonly flushIntervalMs: number;

  /** Maximum number of events per batch */
  readonly maxBatchSize: number;

  /**
   * Whether the SDK starts its active components (attribution session,
   * flush timer, visibility/pagehide listeners, automatic ActivateApp event,
   * remote config fetch) immediately when `initialize()` is called.
   *
   * Defaults to `true`. Set to `false` when you need to defer the SDK's
   * network and event activity until you have obtained user consent
   * (e.g. GDPR). When `false`, you must call `FunnelMob.shared.start()`
   * after consent is granted.
   *
   * By calling `start()` you represent that you have obtained any user
   * consent required by applicable law.
   */
  readonly autoStart: boolean;

  /**
   * Whether the SDK automatically writes the Meta `_fbp` cookie and parses
   * `_fbc` from the URL `?fbclid=` parameter on `start()`. Defaults to
   * `true` — matches Meta Pixel's behavior.
   *
   * Set to `false` when the host application manages cookies itself (e.g.
   * a custom consent stack that needs to gate cookie writes after the user
   * accepts a banner). When false, the host should call
   * `FunnelMob.shared.setBrowserIdentifiers({ fbp, fbc })` after consent
   * to supply the values.
   */
  readonly autoCollectBrowserIds: boolean;

  /**
   * Whether the EventQueue re-queues a batch on retryable send failures
   * (5xx, 429, generic network errors) instead of dropping it. Defaults to
   * `false`.
   *
   * Why default-off: the backend `events` table is currently a plain
   * `MergeTree` (no `event_id` dedup). Until it migrates to
   * `ReplacingMergeTree(inserted_at)` keyed on `event_id`, a successful
   * POST whose response is lost (TCP RST after server commit, gateway
   * timeout) becomes a duplicate row on retry — and revenue events would
   * be double-counted. Set to `true` only in environments where you
   * accept duplicates, or once backend dedup ships.
   */
  readonly enableRetryQueue: boolean;

  constructor(options: {
    apiKey: string;
    baseUrl?: string;
    logLevel?: LogLevel;
    flushIntervalMs?: number;
    maxBatchSize?: number;
    autoStart?: boolean;
    autoCollectBrowserIds?: boolean;
    enableRetryQueue?: boolean;
  }) {
    this.apiKey = options.apiKey;
    this.baseUrl = normalizeBaseUrl(options.baseUrl) ?? DEFAULT_BASE_URL;
    this.logLevel = options.logLevel ?? LogLevel.None;
    this.flushIntervalMs = Math.max(1000, options.flushIntervalMs ?? 30000);
    this.maxBatchSize = Math.min(100, Math.max(1, options.maxBatchSize ?? 100));
    this.autoStart = options.autoStart ?? true;
    this.autoCollectBrowserIds = options.autoCollectBrowserIds ?? true;
    this.enableRetryQueue = options.enableRetryQueue ?? false;
  }
}

function normalizeBaseUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  // Strip surrounding whitespace and any trailing slashes; treat the result
  // as "no override" if nothing meaningful is left.
  const trimmed = url.trim().replace(/\/+$/, '');
  return trimmed.length === 0 ? undefined : trimmed;
}
