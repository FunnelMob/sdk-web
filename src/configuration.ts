/**
 * Default base URL for the FunnelMob API. Used when no `baseUrl` override
 * is supplied on the Configuration.
 */
const DEFAULT_BASE_URL = 'https://api.funnelmob.com/v1';

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
   * Base URL for API calls. Defaults to the production endpoint. Override
   * only for local development against a non-production backend.
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
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.logLevel = options.logLevel ?? LogLevel.None;
    this.flushIntervalMs = Math.max(1000, options.flushIntervalMs ?? 30000);
    this.maxBatchSize = Math.min(100, Math.max(1, options.maxBatchSize ?? 100));
  }
}
