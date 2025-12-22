import { FunnelMobConfiguration } from './configuration';
import { FunnelMobEventParameters } from './event-parameters';
import { FunnelMobRevenue } from './revenue';
import { EventQueue } from './internal/event-queue';
import { NetworkClient } from './internal/network-client';
import { DeviceInfo } from './internal/device-info';
import { Logger } from './internal/logger';
import type { Event } from './internal/event';

/**
 * Main entry point for the FunnelMob SDK
 */
export class FunnelMob {
  private static instance: FunnelMob | null = null;

  private configuration: FunnelMobConfiguration | null = null;
  private isEnabled = true;
  private eventQueue: EventQueue;
  private networkClient: NetworkClient;
  private deviceInfo: DeviceInfo;
  private _flushTimer: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    this.eventQueue = new EventQueue();
    this.networkClient = new NetworkClient();
    this.deviceInfo = new DeviceInfo();
  }

  /**
   * Get the shared singleton instance
   */
  static get shared(): FunnelMob {
    if (!FunnelMob.instance) {
      FunnelMob.instance = new FunnelMob();
    }
    return FunnelMob.instance;
  }

  /**
   * Initialize the SDK with configuration
   */
  initialize(configuration: FunnelMobConfiguration): void {
    if (this.configuration) {
      Logger.warning('FunnelMob already initialized');
      return;
    }

    this.configuration = configuration;
    Logger.logLevel = configuration.logLevel;
    Logger.info(`FunnelMob initialized for app: ${configuration.appId}`);

    this.startFlushTimer();
    this.startSession();
  }

  /**
   * Track a custom event
   */
  trackEvent(name: string): void;
  trackEvent(name: string, parameters: FunnelMobEventParameters): void;
  trackEvent(name: string, revenue: FunnelMobRevenue): void;
  trackEvent(
    name: string,
    revenue: FunnelMobRevenue,
    parameters: FunnelMobEventParameters
  ): void;
  trackEvent(
    name: string,
    revenueOrParams?: FunnelMobRevenue | FunnelMobEventParameters,
    parameters?: FunnelMobEventParameters
  ): void {
    if (!this.isEnabled) {
      Logger.debug(`Tracking disabled, ignoring event: ${name}`);
      return;
    }

    if (!this.configuration) {
      Logger.error('FunnelMob not initialized. Call initialize() first.');
      return;
    }

    // Parse overloaded arguments
    let revenue: FunnelMobRevenue | undefined;
    let params: FunnelMobEventParameters | undefined;

    if (revenueOrParams instanceof FunnelMobRevenue) {
      revenue = revenueOrParams;
      params = parameters;
    } else if (revenueOrParams instanceof FunnelMobEventParameters) {
      params = revenueOrParams;
    }

    // Validate event name
    const validatedName = this.validateEventName(name);
    if (!validatedName) {
      Logger.error(`Invalid event name: ${name}`);
      return;
    }

    const event: Event = {
      eventId: this.generateUUID(),
      eventName: validatedName,
      timestamp: new Date().toISOString(),
      revenue: revenue?.toEventRevenue(),
      parameters: params?.toObject(),
    };

    this.eventQueue.enqueue(event);
    Logger.debug(`Event queued: ${name}`);
  }

  /**
   * Force send queued events immediately
   */
  flush(): void {
    if (!this.configuration) return;
    this.eventQueue.flush(this.networkClient, this.configuration, this.deviceInfo.deviceId);
  }

  /**
   * Enable or disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    Logger.info(`Tracking ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Stop the SDK and cleanup resources
   */
  destroy(): void {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    this.flush();
    this.configuration = null;
    Logger.info('FunnelMob destroyed');
  }

  // MARK: - Private

  private startSession(): void {
    // TODO: Implement session tracking
    Logger.debug('Session started');
  }

  private startFlushTimer(): void {
    if (!this.configuration) return;

    this._flushTimer = setInterval(() => {
      this.flush();
    }, this.configuration.flushIntervalMs);
  }

  private validateEventName(name: string): string | null {
    if (!name || name.length === 0) return null;
    if (name.length > 100) return null;

    const pattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    if (!pattern.test(name)) return null;

    return name;
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
