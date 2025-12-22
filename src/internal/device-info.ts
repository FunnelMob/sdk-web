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

  /**
   * Get device context for API requests
   */
  toContext(): DeviceContext {
    return {
      userAgent: this.userAgent,
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
  language: string;
  timezone: string;
  screenWidth: number;
  screenHeight: number;
  pageUrl: string;
  referrer: string;
}
