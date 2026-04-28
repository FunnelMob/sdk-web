/**
 * Per-user consent state for GDPR / DMA compliance.
 *
 * Pass to `FunnelMob.shared.setConsent(...)` to inform the SDK and
 * backend of the user's consent decisions. The four fields mirror Google
 * Consent Mode v2 and AppsFlyer's `AppsFlyerConsent` so values map 1:1
 * to ad network requirements.
 *
 * When `isUserSubjectToGDPR === true` and `hasConsentForDataUsage === false`,
 * the SDK stops dispatching new events and clears any pending queue. When
 * `isUserSubjectToGDPR === false`, the per-dimension fields are advisory
 * only; the SDK tracks normally.
 *
 * The SDK does NOT persist consent state itself — the host's consent
 * management platform / cookie banner is expected to call `setConsent` on
 * each page load. (This is the industry standard: AppsFlyer, Adjust,
 * Segment, and Amplitude all defer persistence to the CMP.)
 */
export interface FunnelMobConsent {
  /**
   * Whether the user is subject to GDPR (typically true for EEA users).
   * When `false`, the SDK ignores the per-dimension flags and tracks
   * normally.
   */
  isUserSubjectToGDPR: boolean;

  /**
   * Whether the user granted consent for data usage (analytics,
   * attribution). When `false` and `isUserSubjectToGDPR === true`, the
   * SDK stops sending events and clears the local queue.
   */
  hasConsentForDataUsage?: boolean;

  /**
   * Whether the user granted consent for personalized ads. Forwarded to
   * ad networks (Google `ad_personalization`). Does not gate dispatch.
   */
  hasConsentForAdsPersonalization?: boolean;

  /**
   * Whether the user granted consent for ad-related storage (cookies,
   * identifiers used for ads). Forwarded to ad networks (Google
   * `ad_storage`). Does not gate dispatch.
   */
  hasConsentForAdStorage?: boolean;
}

/**
 * True when the SDK must stop dispatching: GDPR applies and the user has
 * affirmatively denied data-usage consent. `undefined` data-usage is
 * treated as "not yet answered" and does not block dispatch.
 */
export function consentBlocksDispatch(consent: FunnelMobConsent | null): boolean {
  if (!consent) return false;
  return consent.isUserSubjectToGDPR && consent.hasConsentForDataUsage === false;
}
