/**
 * Environment options
 */
export enum Environment {
  Production = 'production',
  Sandbox = 'sandbox',
}

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
  /** Application identifier */
  readonly appId: string;

  /** API key for authentication */
  readonly apiKey: string;

  /** Environment (production or sandbox) */
  readonly environment: Environment;

  /** Log level for debugging */
  readonly logLevel: LogLevel;

  /** Interval between automatic event flushes (in milliseconds) */
  readonly flushIntervalMs: number;

  /** Maximum number of events per batch */
  readonly maxBatchSize: number;

  constructor(options: {
    appId: string;
    apiKey: string;
    environment?: Environment;
    logLevel?: LogLevel;
    flushIntervalMs?: number;
    maxBatchSize?: number;
  }) {
    this.appId = options.appId;
    this.apiKey = options.apiKey;
    this.environment = options.environment ?? Environment.Production;
    this.logLevel = options.logLevel ?? LogLevel.None;
    this.flushIntervalMs = Math.max(1000, options.flushIntervalMs ?? 30000);
    this.maxBatchSize = Math.min(100, Math.max(1, options.maxBatchSize ?? 100));
  }

  /**
   * Get the base URL for the API
   */
  get baseUrl(): string {
    switch (this.environment) {
      case Environment.Production:
        return 'https://api.funnelmob.com/v1';
      case Environment.Sandbox:
        return 'https://sandbox.funnelmob.com/v1';
    }
  }
}
