import { FunnelMobConfiguration } from '../configuration';
import {
  Event,
  EventBatch,
  IdentifyRequest,
  IdentifyResponse,
  SessionRequest,
  SessionResponse,
  serializeEvent,
} from './event';

/**
 * HTTP client for sending events to the FunnelMob API
 */
export class NetworkClient {
  /**
   * Send a session request and receive attribution result
   */
  async sendSession(
    request: SessionRequest,
    configuration: FunnelMobConfiguration
  ): Promise<SessionResponse> {
    const url = `${configuration.baseUrl}/v1/session`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FM-API-Key': configuration.apiKey,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }

    return response.json();
  }

  /**
   * Send an identify request to the API
   */
  async sendIdentify(
    request: IdentifyRequest,
    configuration: FunnelMobConfiguration
  ): Promise<IdentifyResponse> {
    const url = `${configuration.baseUrl}/v1/identify`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FM-API-Key': configuration.apiKey,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }

    return response.json();
  }

  /**
   * Send events to the API
   */
  async sendEvents(
    events: Event[],
    deviceId: string,
    configuration: FunnelMobConfiguration,
    userId?: string | null
  ): Promise<void> {
    const batch: EventBatch = {
      platform: 'web',
      device_id: deviceId,
      events: events.map(serializeEvent),
    };

    if (userId) {
      batch.user_id = userId;
    }

    const url = `${configuration.baseUrl}/v1/events`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FM-API-Key': configuration.apiKey,
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }
  }

  /**
   * Fire-and-forget event send for page-unload paths. Uses fetch with
   * keepalive (custom headers preserved, survives unload) and falls back
   * to navigator.sendBeacon when keepalive is unavailable.
   */
  sendEventsOnUnload(
    events: Event[],
    deviceId: string,
    configuration: FunnelMobConfiguration,
    userId?: string | null
  ): void {
    if (events.length === 0) return;

    const batch: EventBatch = {
      platform: 'web',
      device_id: deviceId,
      events: events.map(serializeEvent),
    };

    if (userId) {
      batch.user_id = userId;
    }

    const url = `${configuration.baseUrl}/v1/events`;
    const body = JSON.stringify(batch);

    try {
      void fetch(url, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'X-FM-API-Key': configuration.apiKey,
        },
        body,
      });
    } catch {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      }
    }
  }

  /**
   * Fetch remote config from the API
   */
  async fetchConfig(
    configuration: FunnelMobConfiguration
  ): Promise<Record<string, unknown>> {
    const url = `${configuration.baseUrl}/v1/config`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-FM-API-Key': configuration.apiKey,
      },
    });

    if (!response.ok) {
      const error = await this.parseError(response);
      throw error;
    }

    return response.json();
  }

  private async parseError(response: Response): Promise<NetworkError> {
    switch (response.status) {
      case 401:
        return new NetworkError('Unauthorized', 'unauthorized');
      case 429:
        return new NetworkError('Rate limited', 'rate_limited');
      default:
        if (response.status >= 400 && response.status < 500) {
          return new NetworkError(`Client error: ${response.status}`, 'client_error');
        }
        if (response.status >= 500) {
          return new NetworkError(`Server error: ${response.status}`, 'server_error');
        }
        return new NetworkError(`Unknown error: ${response.status}`, 'unknown');
    }
  }
}

/**
 * Network error
 */
export class NetworkError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'NetworkError';
    this.code = code;
  }
}
