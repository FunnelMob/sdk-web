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
  /**
   * How many times this event's batch has failed and been re-queued.
   * Set to 0 on enqueue, incremented on every retryable failure. Once
   * any event in a batch exceeds [`MAX_RETRY_ATTEMPTS`], the whole
   * batch is dropped to keep a poison-pill from looping forever.
   */
  attemptCount?: number;
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
  user_id?: string;
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
  /**
   * IDFA — never set on web (iOS-only). Field exists for cross-platform
   * payload symmetry; backend ignores it for web requests.
   */
  idfa?: string;
  /** GAID — never set on web (Android-only). */
  gaid?: string;
  /**
   * Meta browser cookie `_fbp`. Auto-collected by the SDK on `start()`
   * when `Configuration.autoCollectBrowserIds` is true (the default), or
   * supplied explicitly via `setBrowserIdentifiers`.
   */
  fbp?: string;
  /** Meta click cookie `_fbc`. Auto-built from `?fbclid=` URL param on `start()`. */
  fbc?: string;
  /**
   * SHA256-hex of normalized email (lowercase + trim, then SHA256).
   * The SDK never sees raw PII — the host is responsible for hashing.
   */
  email_sha256?: string;
  /** SHA256-hex of normalized phone (E.164 format pre-hash). */
  phone_sha256?: string;
  /** SHA256-hex of an external user identifier (CRM ID, auth user ID). */
  external_id_sha256?: string;
  /** iOS ATT status — never set on web. */
  att_status?: string;
  /**
   * Per-user consent state (GDPR / DMA). Optional — when absent, the host
   * has not configured consent and the backend should treat the session
   * as non-EEA / no-restriction.
   */
  consent?: ConsentPayload;
}

/**
 * Wire-format consent payload attached to session requests. Mirrors
 * `FunnelMobConsent` with snake_case field names.
 */
export interface ConsentPayload {
  is_user_subject_to_gdpr: boolean;
  has_consent_for_data_usage?: boolean;
  has_consent_for_ads_personalization?: boolean;
  has_consent_for_ad_storage?: boolean;
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
 * Identify request payload
 */
export interface IdentifyRequest {
  device_id: string;
  user_id: string;
  platform: string;
  timestamp: string;
  user_properties?: Record<string, string | number | boolean>;
  context?: DeviceContext;
}

/**
 * Identify response from the server
 */
export interface IdentifyResponse {
  status: string;
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
