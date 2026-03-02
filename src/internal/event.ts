/**
 * Internal event representation
 */
export interface Event {
  eventId: string;
  eventName: string;
  timestamp: string;
  revenue?: EventRevenue;
  parameters?: Record<string, string | number | boolean>;
  attributionId?: string;
}

/**
 * Internal revenue representation
 */
export interface EventRevenue {
  amount: string;
  currency: string;
}

/**
 * Event batch for API requests
 */
export interface EventBatch {
  platform: string;
  device_id: string;
  session_id?: string;
  events: SerializedEvent[];
}

/**
 * Serialized event for API requests
 */
export interface SerializedEvent {
  event_id: string;
  event_name: string;
  timestamp: string;
  revenue?: EventRevenue;
  parameters?: Record<string, string | number | boolean>;
  attribution_id?: string;
}

/**
 * Attribution result from the server
 */
export interface AttributionResult {
  attribution_id: string;
  attributed: boolean;
  method: string;
  campaign_id?: string;
  ad_network?: string;
  ad_group_id?: string;
  ad_id?: string;
  keyword?: string;
  confidence: number;
}

/**
 * Device context for session requests
 */
export interface DeviceContext {
  user_agent?: string;
  language?: string;
  timezone?: string;
  screen_width?: number;
  screen_height?: number;
}

/**
 * Session request payload
 */
export interface SessionRequest {
  device_id: string;
  session_id: string;
  platform: string;
  timestamp: string;
  is_first_session: boolean;
  referrer_token?: string;
  context?: DeviceContext;
}

/**
 * Session response from the server
 */
export interface SessionResponse {
  session_id: string;
  server_timestamp: string;
  attribution?: AttributionResult;
}

/**
 * Serialize an event for API transmission
 */
export function serializeEvent(event: Event): SerializedEvent {
  const serialized: SerializedEvent = {
    event_id: event.eventId,
    event_name: event.eventName,
    timestamp: event.timestamp,
  };

  if (event.revenue) {
    serialized.revenue = event.revenue;
  }

  if (event.parameters && Object.keys(event.parameters).length > 0) {
    serialized.parameters = event.parameters;
  }

  if (event.attributionId) {
    serialized.attribution_id = event.attributionId;
  }

  return serialized;
}
