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

  constructor(options: {
    apiKey: string;
    baseUrl?: string;
    logLevel?: LogLevel;
    flushIntervalMs?: number;
    maxBatchSize?: number;
  }) {
    this.apiKey = options.apiKey;
    this.baseUrl = normalizeBaseUrl(options.baseUrl) ?? DEFAULT_BASE_URL;
    this.logLevel = options.logLevel ?? LogLevel.None;
    this.flushIntervalMs = Math.max(1000, options.flushIntervalMs ?? 30000);
    this.maxBatchSize = Math.min(100, Math.max(1, options.maxBatchSize ?? 100));
  }
}

function normalizeBaseUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  // Strip surrounding whitespace and any trailing slashes; treat the result
  // as "no override" if nothing meaningful is left.
  const trimmed = url.trim().replace(/\/+$/, '');
  return trimmed.length === 0 ? undefined : trimmed;
}
