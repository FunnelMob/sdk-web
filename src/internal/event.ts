/**
 * Internal event representation
 */
export interface Event {
  eventId: string;
  eventName: string;
  timestamp: string;
  revenue?: EventRevenue;
  parameters?: Record<string, string | number | boolean>;
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

  return serialized;
}
