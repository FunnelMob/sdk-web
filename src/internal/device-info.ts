const STORAGE_KEY = 'funnelmob_device_id';

/**
 * Device information collector
 */
export class DeviceInfo {
  /**
   * Unique device identifier
   */
  get deviceId(): string {
    return this.getOrCreateDeviceId();
  }

  /**
   * Browser user agent
   */
  get userAgent(): string {
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  }

  /**
   * Operating system name.
   */
  get osName(): string {
    const uaData = this.userAgentData;
    if (uaData?.platform) {
      return normalizePlatform(uaData.platform);
    }
    return parseUserAgent(this.userAgent).osName;
  }

  /**
   * Operating system version, when visible to the browser.
   */
  get osVersion(): string | undefined {
    return parseUserAgent(this.userAgent).osVersion;
  }

  /**
   * Device model, when visible to the browser.
   */
  get deviceModel(): string | undefined {
    return parseUserAgent(this.userAgent).deviceModel;
  }

  /**
   * Browser language
   */
  get language(): string {
    return typeof navigator !== 'undefined' ? navigator.language : 'en';
  }

  /**
   * Timezone
   */
  get timezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }

  /**
   * Screen width
   */
  get screenWidth(): number {
    return typeof screen !== 'undefined' ? screen.width : 0;
  }

  /**
   * Screen height
   */
  get screenHeight(): number {
    return typeof screen !== 'undefined' ? screen.height : 0;
  }

  /**
   * Page URL (without query params)
   */
  get pageUrl(): string {
    if (typeof window === 'undefined') return '';
    return window.location.origin + window.location.pathname;
  }

  /**
   * Referrer URL
   */
  get referrer(): string {
    return typeof document !== 'undefined' ? document.referrer : '';
  }

  // MARK: - Private

  private getOrCreateDeviceId(): string {
    try {
      if (typeof localStorage === 'undefined') {
        return this.generateUUID();
      }

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;

      const newId = this.generateUUID();
      localStorage.setItem(STORAGE_KEY, newId);
      return newId;
    } catch {
      return this.generateUUID();
    }
  }

  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private get userAgentData(): NavigatorWithUserAgentData['userAgentData'] {
    return typeof navigator !== 'undefined'
      ? (navigator as NavigatorWithUserAgentData).userAgentData
      : undefined;
  }

  /**
   * Get device context for API requests
   */
  toContext(): DeviceContext {
    return {
      userAgent: this.userAgent,
      osName: this.osName,
      osVersion: this.osVersion,
      deviceModel: this.deviceModel,
      language: this.language,
      timezone: this.timezone,
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
      pageUrl: this.pageUrl,
      referrer: this.referrer,
    };
  }
}

export interface DeviceContext {
  userAgent: string;
  osName: string;
  osVersion?: string;
  deviceModel?: string;
  language: string;
  timezone: string;
  screenWidth: number;
  screenHeight: number;
  pageUrl: string;
  referrer: string;
}

interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: {
    platform?: string;
  };
}

interface ParsedUserAgent {
  osName: string;
  osVersion?: string;
  deviceModel?: string;
}

function normalizePlatform(platform: string): string {
  const lower = platform.toLowerCase();
  if (lower.includes('ios')) return 'iOS';
  if (lower.includes('android')) return 'Android';
  if (lower.includes('mac')) return 'macOS';
  if (lower.includes('win')) return 'Windows';
  if (lower.includes('linux')) return 'Linux';
  if (lower.includes('chrome os')) return 'ChromeOS';
  return 'Web';
}

function parseUserAgent(userAgent: string): ParsedUserAgent {
  const ua = userAgent || '';

  if (/(iPhone|iPad|iPod)/.test(ua)) {
    const version = ua.match(/(?:CPU (?:iPhone )?OS|iPhone OS)\s+([0-9_]+)/)?.[1];
    return {
      osName: 'iOS',
      osVersion: version?.replace(/_/g, '.'),
      deviceModel: ua.match(/iPad/) ? 'iPad' : ua.match(/iPod/) ? 'iPod' : 'iPhone',
    };
  }

  const android = ua.match(/Android\s+([0-9.]+)/);
  if (android) {
    const model = ua
      .slice((android.index ?? 0) + android[0].length)
      .match(/;\s*([^;)]+)/)?.[1]
      ?.replace(/\s+Build\/.*$/, '')
      .trim();
    return {
      osName: 'Android',
      osVersion: model === 'K' ? undefined : android[1],
      deviceModel: model && model !== 'K' ? model : undefined,
    };
  }

  const windows = ua.match(/Windows NT\s+([0-9.]+)/);
  if (windows) {
    return { osName: 'Windows', osVersion: windows[1] };
  }

  const mac = ua.match(/Mac OS X\s+([0-9_]+)/);
  if (mac) {
    return { osName: 'macOS', osVersion: mac[1].replace(/_/g, '.') };
  }

  if (/CrOS/.test(ua)) {
    const version = ua.match(/CrOS [^ ]+ ([0-9.]+)/)?.[1];
    return { osName: 'ChromeOS', osVersion: version };
  }

  if (/Linux/.test(ua)) {
    return { osName: 'Linux' };
  }

  return { osName: 'Web' };
}
