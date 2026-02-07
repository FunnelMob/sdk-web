/**
 * Server options
 */
export enum Server {
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
  /** API key for authentication */
  readonly apiKey: string;

  /** Server (production or sandbox) */
  readonly server: Server;

  /** Log level for debugging */
  readonly logLevel: LogLevel;

  /** Interval between automatic event flushes (in milliseconds) */
  readonly flushIntervalMs: number;

  /** Maximum number of events per batch */
  readonly maxBatchSize: number;

  constructor(options: {
    apiKey: string;
    server?: Server;
    logLevel?: LogLevel;
    flushIntervalMs?: number;
    maxBatchSize?: number;
  }) {
    this.apiKey = options.apiKey;
    this.server = options.server ?? Server.Production;
    this.logLevel = options.logLevel ?? LogLevel.None;
    this.flushIntervalMs = Math.max(1000, options.flushIntervalMs ?? 30000);
    this.maxBatchSize = Math.min(100, Math.max(1, options.maxBatchSize ?? 100));
  }

  /**
   * Get the base URL for the API
   */
  get baseUrl(): string {
    switch (this.server) {
      case Server.Production:
        return 'https://api.funnelmob.com/v1';
      case Server.Sandbox:
        return 'https://sandbox.funnelmob.com/v1';
    }
  }
}
