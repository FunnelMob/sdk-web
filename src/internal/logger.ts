import { LogLevel } from '../configuration';

const PREFIX = '[FunnelMob]';

/**
 * Internal logger for FunnelMob SDK
 */
export const Logger = {
  logLevel: LogLevel.None,

  error(message: string): void {
    if (this.logLevel >= LogLevel.Error) {
      console.error(`${PREFIX} ERROR: ${message}`);
    }
  },

  warning(message: string): void {
    if (this.logLevel >= LogLevel.Warning) {
      console.warn(`${PREFIX} WARN: ${message}`);
    }
  },

  info(message: string): void {
    if (this.logLevel >= LogLevel.Info) {
      console.info(`${PREFIX} INFO: ${message}`);
    }
  },

  debug(message: string): void {
    if (this.logLevel >= LogLevel.Debug) {
      console.debug(`${PREFIX} DEBUG: ${message}`);
    }
  },

  verbose(message: string): void {
    if (this.logLevel >= LogLevel.Verbose) {
      console.log(`${PREFIX} VERBOSE: ${message}`);
    }
  },
};
