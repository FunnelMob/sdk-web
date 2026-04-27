/**
 * Meta `_fbp` / `_fbc` cookie helpers, matching the Pixel cookie spec.
 *
 * Format: `fb.<subdomain_index>.<creation_ts_ms>.<value>`
 *  - subdomain_index = 1 (we always set on the host's apex domain via Path=/)
 *  - creation_ts_ms = milliseconds since epoch when the cookie was first written
 *  - value = random number for `_fbp`, the URL `fbclid` for `_fbc`
 *
 * Cookie attributes:
 *  - Path: `/`
 *  - Max-Age: 90 days (matches Meta Pixel)
 *  - SameSite: `Lax`
 *  - Secure: `true` only on HTTPS pages (Meta Pixel sets it the same way)
 *  - HttpOnly: false (must be readable from JS)
 */

const FB_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90; // 90 days

export interface CookieWriteOptions {
  maxAgeSec?: number;
  sameSite?: 'Lax' | 'Strict' | 'None';
  secure?: boolean;
}

/**
 * Read a cookie value by name. Returns `null` if `document.cookie` is
 * unavailable (SSR, sandboxed environments) or the cookie is absent.
 */
export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  const prefix = `${name}=`;
  for (const c of cookies) {
    if (c.startsWith(prefix)) {
      return decodeURIComponent(c.slice(prefix.length));
    }
  }
  return null;
}

/**
 * Write a cookie. No-op when `document` is unavailable (SSR). `secure`
 * defaults to whether the page is loaded over HTTPS.
 */
export function writeCookie(
  name: string,
  value: string,
  opts: CookieWriteOptions = {}
): void {
  if (typeof document === 'undefined') return;
  const maxAge = opts.maxAgeSec ?? FB_COOKIE_MAX_AGE_SEC;
  const sameSite = opts.sameSite ?? 'Lax';
  const secure =
    opts.secure ??
    (typeof window !== 'undefined' &&
      window.location?.protocol === 'https:');
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
  ];
  if (secure) parts.push('Secure');
  document.cookie = parts.join('; ');
}

/**
 * Generate a fresh `_fbp` cookie value: `fb.1.<now_ms>.<random>`.
 *
 * Meta's spec calls for a random number; we use `crypto.getRandomValues`
 * when available and fall back to `Math.random()` for older runtimes.
 */
export function generateFbp(): string {
  return `fb.1.${Date.now()}.${randomDigits()}`;
}

/**
 * Build an `_fbc` cookie value from a `fbclid` URL parameter:
 * `fb.1.<now_ms>.<fbclid>`.
 */
export function buildFbc(fbclid: string): string {
  return `fb.1.${Date.now()}.${fbclid}`;
}

/**
 * Read the `?fbclid=` parameter from a URL search string. Returns `null`
 * if absent or if the page has no `window.location`.
 */
export function readUrlParam(name: string): string | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  return value && value.length > 0 ? value : null;
}

function randomDigits(): string {
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
  ) {
    const buf = new Uint32Array(2);
    globalThis.crypto.getRandomValues(buf);
    return `${buf[0]}${buf[1]}`;
  }
  // Fallback — concatenate two non-zero pseudo-random integers.
  const a = Math.floor(Math.random() * 1_000_000_000) + 1;
  const b = Math.floor(Math.random() * 1_000_000_000) + 1;
  return `${a}${b}`;
}
