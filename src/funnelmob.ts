import { FunnelMobConfiguration } from './configuration';
import { FunnelMobEventParameters } from './event-parameters';
import { FunnelMobRevenue } from './revenue';
import { EventQueue } from './internal/event-queue';
import { NetworkClient } from './internal/network-client';
import { DeviceInfo } from './internal/device-info';
import { Logger } from './internal/logger';
import type { Event, AttributionResult, IdentifyRequest } from './internal/event';

const ATTRIBUTION_STORAGE_KEY = 'fm_attribution';
const USER_ID_STORAGE_KEY = 'fm_user_id';
const REMOTE_CONFIG_STORAGE_KEY = 'fm_remote_config';
const REMOTE_CONFIG_TS_KEY = 'fm_remote_config_ts';
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Callback type for attribution results
 */
export type AttributionCallback = (result: AttributionResult | null) => void;

/**
 * Callback type for remote config loaded events
 */
export type ConfigLoadedCallback = (config: Record<string, unknown>) => void;

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
  private _visibilityHandler: (() => void) | null = null;
  private _pagehideHandler: (() => void) | null = null;
  private attributionId: string | null = null;
  private attributionCallbacks: AttributionCallback[] = [];
  private userId: string | null = null;
  private userProperties: Record<string, string | number | boolean> | null = null;
  private remoteConfig: Record<string, unknown> | null = null;
  private configCallbacks: ConfigLoadedCallback[] = [];

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
    Logger.info('FunnelMob initialized');

    // Restore persisted userId
    this.restoreUserId();

    this.startFlushTimer();
    this.registerVisibilityListeners();
    this.startSession();
    this.loadCachedConfig();
    this.fetchRemoteConfig();
  }

  /**
   * Register a callback for attribution results.
   * If attribution has already completed, the callback fires immediately.
   */
  onAttribution(callback: AttributionCallback): void {
    this.attributionCallbacks.push(callback);

    // If we already have a stored result, fire immediately
    const stored = this.loadAttribution();
    if (stored !== null) {
      callback(stored);
    }
  }

  // MARK: - Remote Config

  /**
   * Get a single remote config value.
   * Returns the value if found, or the defaultValue if not.
   */
  getConfig<T = unknown>(key: string, defaultValue?: T): T {
    if (!this.remoteConfig || !(key in this.remoteConfig)) {
      return defaultValue as T;
    }
    return this.remoteConfig[key] as T;
  }

  /**
   * Get all remote config values as a copy.
   */
  getAllConfig(): Record<string, unknown> {
    return { ...this.remoteConfig };
  }

  /**
   * Register a callback that fires when remote config is loaded.
   * If config has already been loaded, the callback fires immediately.
   */
  onConfigLoaded(callback: ConfigLoadedCallback): void {
    this.configCallbacks.push(callback);

    if (this.remoteConfig !== null) {
      callback({ ...this.remoteConfig });
    }
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
      attributionId: this.attributionId ?? undefined,
    };

    const queueSize = this.eventQueue.enqueue(event);
    Logger.debug(`Event queued: ${name}`);

    if (this.configuration && queueSize >= this.configuration.maxBatchSize) {
      void this.flush();
    }
  }

  // MARK: - Standard Event Methods

  /** Meta only — fires on every page load */
  trackPageView(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('PageView', parameters);
  }

  /** Meta + TikTok — visit to a product detail, landing, or content page */
  trackViewContent(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('ViewContent', parameters);
  }

  /** Meta + TikTok — search performed on your site or app */
  trackSearch(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('Search', parameters);
  }

  /** Meta + TikTok — item added to shopping cart */
  trackAddToCart(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('AddToCart', parameters);
  }

  /** Meta + TikTok — item added to wishlist */
  trackAddToWishlist(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('AddToWishlist', parameters);
  }

  /** Meta + TikTok — start of checkout process */
  trackInitiateCheckout(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('InitiateCheckout', parameters);
  }

  /** Meta + TikTok — payment info entered during checkout */
  trackAddPaymentInfo(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('AddPaymentInfo', parameters);
  }

  /** Meta + TikTok — purchase completed; value and currency are required */
  trackPurchase(value: number, currency: string, parameters?: FunnelMobEventParameters): void {
    this.trackStandard('Purchase', new FunnelMobRevenue(value, currency), parameters);
  }

  /** Meta + TikTok — user submits contact information */
  trackLead(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('Lead', parameters);
  }

  /** Meta + TikTok — user completes a registration or sign-up flow */
  trackCompleteRegistration(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('CompleteRegistration', parameters);
  }

  /** Meta + TikTok — any contact initiated between user and business */
  trackContact(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('Contact', parameters);
  }

  /** Meta + TikTok — user books an appointment or reservation */
  trackSchedule(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('Schedule', parameters);
  }

  /** Meta + TikTok — user searches for a physical business location */
  trackFindLocation(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('FindLocation', parameters);
  }

  /** Meta + TikTok — user customizes a product */
  trackCustomizeProduct(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('CustomizeProduct', parameters);
  }

  /** Meta only — donation completed; value and currency are required */
  trackDonate(value: number, currency: string, parameters?: FunnelMobEventParameters): void {
    this.trackStandard('Donate', new FunnelMobRevenue(value, currency), parameters);
  }

  /** Meta + TikTok — user submits an application */
  trackSubmitApplication(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('SubmitApplication', parameters);
  }

  /** TikTok only — application previously submitted is approved */
  trackApplicationApproval(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('ApplicationApproval', parameters);
  }

  /** TikTok only — user downloads a file or asset */
  trackDownload(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('Download', parameters);
  }

  /** TikTok legacy — use trackLead() for new implementations */
  trackSubmitForm(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('SubmitForm', parameters);
  }

  /** Meta + TikTok — user begins a free trial; value and currency are required */
  trackStartTrial(value: number, currency: string, parameters?: FunnelMobEventParameters): void {
    this.trackStandard('StartTrial', new FunnelMobRevenue(value, currency), parameters);
  }

  /** Meta + TikTok — user starts a paid subscription; value and currency are required */
  trackSubscribe(value: number, currency: string, parameters?: FunnelMobEventParameters): void {
    this.trackStandard('Subscribe', new FunnelMobRevenue(value, currency), parameters);
  }

  /** Meta only — user reaches a level in your app or game */
  trackAchieveLevel(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('AchieveLevel', parameters);
  }

  /** Meta only — user completes a rewarded action or milestone */
  trackUnlockAchievement(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('UnlockAchievement', parameters);
  }

  /**
   * Meta only — user spends in-app credits or virtual currency; value is required.
   * Note: value is passed as a parameter (not revenue) because SpentCredits uses
   * virtual currency, which has no ISO 4217 currency code.
   */
  trackSpentCredits(value: number, parameters?: FunnelMobEventParameters): void {
    const params = new FunnelMobEventParameters();
    params.set('value', value);
    if (parameters) {
      const obj = parameters.toObject();
      if (obj) {
        for (const [k, v] of Object.entries(obj)) {
          params.set(k, v);
        }
      }
    }
    this.trackStandard('SpentCredits', params);
  }

  /** Meta only — user submits a rating */
  trackRate(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('Rate', parameters);
  }

  /** Meta only — user completes an in-app tutorial */
  trackCompleteTutorial(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('CompleteTutorial', parameters);
  }

  /** Meta only — app launch or open */
  trackActivateApp(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('ActivateApp', parameters);
  }

  /** Meta only — in-app ad clicked by user */
  trackInAppAdClick(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('InAppAdClick', parameters);
  }

  /** Meta only — in-app ad appeared on-screen */
  trackInAppAdImpression(parameters?: FunnelMobEventParameters): void {
    this.trackStandard('InAppAdImpression', parameters);
  }

  /**
   * Force send queued events immediately
   */
  flush(): void {
    if (!this.configuration) return;
    this.eventQueue.flush(this.networkClient, this.configuration, this.deviceInfo.deviceId, this.userId);
  }

  /**
   * Enable or disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    Logger.info(`Tracking ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set the user ID for identified users.
   * This sends an identify request to the server and attaches
   * the user ID to all subsequent events.
   */
  setUserId(userId: string): void {
    if (!userId || userId.length === 0) {
      Logger.error('setUserId: userId cannot be empty');
      return;
    }

    this.userId = userId;
    this.persistUserId(userId);
    Logger.info(`User ID set: ${userId}`);
    this.sendIdentify();
  }

  /**
   * Set user properties for the current identified user.
   * Properties are merged with existing properties.
   * Requires setUserId() to be called first.
   */
  setUserProperties(properties: Record<string, string | number | boolean>): void {
    if (!this.userId) {
      Logger.error('setUserProperties: call setUserId() first');
      return;
    }

    this.userProperties = { ...this.userProperties, ...properties };
    Logger.debug('User properties updated');
    this.sendIdentify();
  }

  /**
   * Clear the current user ID (e.g., on logout).
   * Subsequent events will not include a user_id.
   */
  clearUserId(): void {
    this.userId = null;
    this.userProperties = null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(USER_ID_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    Logger.info('User ID cleared');
  }

  /**
   * Stop the SDK and cleanup resources
   */
  destroy(): void {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    if (typeof document !== 'undefined' && this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
    if (typeof window !== 'undefined' && this._pagehideHandler) {
      window.removeEventListener('pagehide', this._pagehideHandler);
      this._pagehideHandler = null;
    }
    this.flush();
    this.configuration = null;
    this.remoteConfig = null;
    this.configCallbacks = [];
    Logger.info('FunnelMob destroyed');
  }

  // MARK: - Private

  private trackStandard(name: string, params?: FunnelMobEventParameters): void;
  private trackStandard(
    name: string,
    revenue: FunnelMobRevenue,
    params?: FunnelMobEventParameters
  ): void;
  private trackStandard(
    name: string,
    revenueOrParams?: FunnelMobRevenue | FunnelMobEventParameters,
    params?: FunnelMobEventParameters
  ): void {
    if (revenueOrParams instanceof FunnelMobRevenue) {
      params
        ? this.trackEvent(name, revenueOrParams, params)
        : this.trackEvent(name, revenueOrParams);
    } else if (revenueOrParams) {
      this.trackEvent(name, revenueOrParams);
    } else {
      this.trackEvent(name);
    }
  }

  private startSession(): void {
    // Check for existing attribution
    const stored = this.loadAttribution();
    if (stored) {
      this.attributionId = stored.attribution_id;
      Logger.debug('Loaded existing attribution');
      this.notifyCallbacks(stored);
      return;
    }

    // First session — request attribution from server
    this.requestAttribution();
  }

  private async requestAttribution(): Promise<void> {
    const config = this.configuration;
    if (!config) return;

    try {
      const context = this.deviceInfo.toContext();
      const response = await this.networkClient.sendSession(
        {
          device_id: this.deviceInfo.deviceId,
          session_id: this.generateUUID(),
          platform: 'web',
          timestamp: new Date().toISOString(),
          is_first_session: true,
          context: {
            user_agent: context.userAgent,
            language: context.language,
            timezone: context.timezone,
            screen_width: context.screenWidth,
            screen_height: context.screenHeight,
          },
        },
        config
      );

      if (response.attribution) {
        this.attributionId = response.attribution.attribution_id;
        this.saveAttribution(response.attribution);
        Logger.info('Attribution received');
      }

      this.notifyCallbacks(response.attribution ?? null);
    } catch (error) {
      Logger.error(`Attribution request failed: ${error}`);
      this.notifyCallbacks(null);
    }
  }

  private notifyCallbacks(result: AttributionResult | null): void {
    for (const callback of this.attributionCallbacks) {
      try {
        callback(result);
      } catch (error) {
        Logger.error(`Attribution callback error: ${error}`);
      }
    }
  }

  private loadAttribution(): AttributionResult | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const stored = localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored) as AttributionResult;
    } catch {
      return null;
    }
  }

  private saveAttribution(result: AttributionResult): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(result));
    } catch (error) {
      Logger.warning(`Failed to save attribution: ${error}`);
    }
  }

  private startFlushTimer(): void {
    if (!this.configuration) return;

    this._flushTimer = setInterval(() => {
      this.flush();
    }, this.configuration.flushIntervalMs);
  }

  private registerVisibilityListeners(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    this._visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        this.flushOnUnload();
      } else if (document.visibilityState === 'visible') {
        void this.flush();
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);

    this._pagehideHandler = () => {
      this.flushOnUnload();
    };
    window.addEventListener('pagehide', this._pagehideHandler);
  }

  private flushOnUnload(): void {
    if (!this.configuration) return;
    const events = this.eventQueue.drainAll();
    if (events.length === 0) return;
    this.networkClient.sendEventsOnUnload(
      events,
      this.deviceInfo.deviceId,
      this.configuration,
      this.userId
    );
  }

  private validateEventName(name: string): string | null {
    if (!name || name.length === 0) return null;
    if (name.length > 100) return null;

    const pattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
    if (!pattern.test(name)) return null;

    return name;
  }

  private async sendIdentify(): Promise<void> {
    const config = this.configuration;
    if (!config || !this.userId) return;

    try {
      const context = this.deviceInfo.toContext();
      const request: IdentifyRequest = {
        device_id: this.deviceInfo.deviceId,
        user_id: this.userId,
        platform: 'web',
        timestamp: new Date().toISOString(),
        user_properties: this.userProperties ?? undefined,
        context: {
          user_agent: context.userAgent,
          language: context.language,
          timezone: context.timezone,
          screen_width: context.screenWidth,
          screen_height: context.screenHeight,
        },
      };

      await this.networkClient.sendIdentify(request, config);
      Logger.debug('Identify request sent');
    } catch (error) {
      Logger.error(`Identify request failed: ${error}`);
    }
  }

  private persistUserId(userId: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    } catch {
      // ignore
    }
  }

  private restoreUserId(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const stored = localStorage.getItem(USER_ID_STORAGE_KEY);
      if (stored) {
        this.userId = stored;
        Logger.debug(`Restored user ID: ${stored}`);
      }
    } catch {
      // ignore
    }
  }

  private async fetchRemoteConfig(): Promise<void> {
    const config = this.configuration;
    if (!config) return;

    try {
      const result = await this.networkClient.fetchConfig(config);
      this.remoteConfig = result;
      this.saveCachedConfig(result);
      Logger.debug('Remote config loaded');
      this.notifyConfigCallbacks(result);
    } catch (error) {
      Logger.error(`Failed to fetch remote config: ${error}`);
      // Keep any cached config as fallback
    }
  }

  private loadCachedConfig(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const tsStr = localStorage.getItem(REMOTE_CONFIG_TS_KEY);
      if (!tsStr) return;
      const ts = parseInt(tsStr, 10);
      if (Date.now() - ts > CONFIG_CACHE_TTL_MS) return;
      const stored = localStorage.getItem(REMOTE_CONFIG_STORAGE_KEY);
      if (!stored) return;
      this.remoteConfig = JSON.parse(stored) as Record<string, unknown>;
      Logger.debug('Loaded cached remote config');
    } catch {
      // ignore
    }
  }

  private saveCachedConfig(config: Record<string, unknown>): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(REMOTE_CONFIG_STORAGE_KEY, JSON.stringify(config));
      localStorage.setItem(REMOTE_CONFIG_TS_KEY, Date.now().toString());
    } catch {
      // ignore
    }
  }

  private notifyConfigCallbacks(config: Record<string, unknown>): void {
    for (const callback of this.configCallbacks) {
      try {
        callback({ ...config });
      } catch (error) {
        Logger.error(`Config callback error: ${error}`);
      }
    }
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
