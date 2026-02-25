import { FunnelMobConfiguration } from '../configuration';
import { Event, EventBatch, serializeEvent } from './event';

/**
 * HTTP client for sending events to the FunnelMob API
 */
export class NetworkClient {
  /**
   * Send events to the API
   */
  async sendEvents(
    events: Event[],
    deviceId: string,
    configuration: FunnelMobConfiguration
  ): Promise<void> {
    const batch: EventBatch = {
      platform: 'web',
      device_id: deviceId,
      events: events.map(serializeEvent),
    };

    const url = `${configuration.baseUrl}/events`;

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
