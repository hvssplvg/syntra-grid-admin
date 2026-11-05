// lib/validation/url.ts
//
// Basic input-hygiene validation for reference/display URLs — e.g.
// ManagedSystem.productionUrl/stagingUrl/repositoryUrl and
// Deployment.deploymentUrl. These are NEVER fetched server-side (unlike
// MonitoredEndpoint.url, which IS polled and goes through
// lib/monitoring/safeFetch.ts's full SSRF/DNS-resolution guard for exactly
// that reason) — this is just "is this a well-formed http(s) link",
// rejecting javascript:/data:/malformed input before it's ever stored and
// later rendered as a clickable link.

const MAX_URL_LENGTH = 2048;

export class InvalidDisplayUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDisplayUrlError";
  }
}

/** Returns a trimmed, validated URL, or null if the raw input was empty/
 *  absent. Throws InvalidDisplayUrlError if the raw input was non-empty
 *  but not a well-formed http(s) URL — never silently drops something an
 *  admin actually typed. */
export function cleanDisplayUrl(raw: unknown, fieldName: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.length > MAX_URL_LENGTH) {
    throw new InvalidDisplayUrlError(`${fieldName} is too long.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidDisplayUrlError(`${fieldName} must be a valid URL.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidDisplayUrlError(`${fieldName} must use http or https.`);
  }

  return trimmed;
}
