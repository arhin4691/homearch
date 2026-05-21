/**
 * Shared WebAuthn helpers — resolves rpId and allowed origins correctly
 * for localhost, Vercel preview deployments, and custom production domains.
 */

/** Return the rpId (hostname only) for the current environment */
export function getRpId(requestUrl?: string): string {
  // 1. Explicit env override always wins
  if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID;

  // 2. Derive from the inbound request origin (Vercel previews change every deploy)
  if (requestUrl) {
    try {
      return new URL(requestUrl).hostname;
    } catch { /* fall through */ }
  }

  // 3. Fall back to NEXT_PUBLIC_APP_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      return new URL(appUrl).hostname;
    } catch { /* fall through */ }
  }

  return "localhost";
}

/**
 * Return the list of accepted origins.
 * Includes NEXT_PUBLIC_APP_URL + any WEBAUTHN_ADDITIONAL_ORIGINS (comma-sep).
 */
export function getExpectedOrigins(requestUrl?: string): string[] {
  const origins = new Set<string>();

  // Always add localhost for dev
  origins.add("http://localhost:3000");
  origins.add("https://localhost:3000");

  // Derive from inbound request
  if (requestUrl) {
    try {
      const u = new URL(requestUrl);
      origins.add(`${u.protocol}//${u.host}`);
    } catch { /* ignore */ }
  }

  // NEXT_PUBLIC_APP_URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.add(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""));
  }

  // Extra origins (e.g., vercel preview URLs)
  if (process.env.WEBAUTHN_ADDITIONAL_ORIGINS) {
    for (const o of process.env.WEBAUTHN_ADDITIONAL_ORIGINS.split(",")) {
      const trimmed = o.trim().replace(/\/$/, "");
      if (trimmed) origins.add(trimmed);
    }
  }

  // VERCEL_URL is set automatically on Vercel (without protocol)
  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL}`);
  }

  return [...origins];
}

/** Returns the primary expected origin for single-origin verification */
export function getPrimaryOrigin(requestUrl?: string): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (requestUrl) {
    try {
      const u = new URL(requestUrl);
      return `${u.protocol}//${u.host}`;
    } catch { /* ignore */ }
  }
  return "http://localhost:3000";
}
