// lib/monitoring/safeFetch.ts
//
// SSRF-safe HTTP check for Client Health's uptime monitoring
// (MonitoredEndpoint). This is the one place in the codebase that
// fetches a client-supplied URL from the server, so the guard here has
// to be airtight — nothing elsewhere in this app does this.
//
// Guards:
// - http/https only (no file:, no data:, no gopher: etc.).
// - The hostname is resolved via real DNS (node:dns/promises), and the
//   RESOLVED IP addresses are what get checked against private/loopback/
//   link-local/carrier-NAT/ULA ranges — not the hostname string. A name
//   that merely *looks* external but resolves to an internal address
//   (DNS rebinding) is rejected just the same as "http://localhost".
// - Re-validated on every call, not just once at creation time — DNS can
//   change between when an endpoint is added and when it's next polled.
// - redirect: "manual" — a redirect is reported as its own result and
//   never followed, which avoids the entire redirect-based SSRF bypass
//   class outright rather than trying to re-validate each hop.
// - AbortController timeout on every request.

import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEGRADED_RESPONSE_TIME_MS = 3_000;

/** Throws UnsafeUrlError if the URL is not eligible for the monitoring
 *  poller to fetch. Called both when an admin adds a MonitoredEndpoint
 *  (reject bad input immediately, before it's ever stored) and again by
 *  performMonitoringCheck on every poll. */
export async function assertSafeMonitoringUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("Not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs can be monitored.");
  }

  // new URL() parses a literal IP (v4 or bracketed v6) into `hostname`
  // the same as a DNS name — dns.lookup() handles both cases correctly
  // (a literal IP short-circuits without a real query), so one code path
  // covers both.
  let addresses: string[];
  try {
    const records = await dns.lookup(url.hostname, { all: true, verbatim: true });
    addresses = records.map((record) => record.address);
  } catch {
    throw new UnsafeUrlError("Could not resolve this hostname.");
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError("Could not resolve this hostname.");
  }

  for (const address of addresses) {
    if (isDisallowedAddress(address)) {
      throw new UnsafeUrlError("This URL resolves to a private or internal network address and cannot be monitored.");
    }
  }

  return url;
}

/** ipaddr.js's range() returns "unicast" for an ordinary public address
 *  and a specific name (private/loopback/linkLocal/carrierGradeNat/
 *  uniqueLocal/reserved/multicast/...) for everything else — "unicast"
 *  is the only range allowed through. Fails closed on anything
 *  unparseable. */
function isDisallowedAddress(address: string): boolean {
  let parsed;
  try {
    parsed = ipaddr.process(address);
  } catch {
    return true;
  }
  return parsed.range() !== "unicast";
}

export type MonitoringCheckStatus = "HEALTHY" | "DEGRADED" | "OFFLINE";

export type MonitoringCheckResult = {
  healthy: boolean;
  status: MonitoringCheckStatus;
  statusCode: number | null;
  responseTimeMs: number;
  message: string | null;
};

/** Performs one monitoring check end to end: validate, fetch, classify.
 *  Never throws — a failed validation or request is itself a result
 *  (OFFLINE), exactly like any other failed check, so callers always get
 *  something to write to HealthCheck. */
export async function performMonitoringCheck(
  rawUrl: string,
  options: { method?: "GET" | "HEAD"; timeoutMs?: number } = {},
): Promise<MonitoringCheckResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();

  let url: URL;
  try {
    url = await assertSafeMonitoringUrl(rawUrl);
  } catch (error) {
    return {
      healthy: false,
      status: "OFFLINE",
      statusCode: null,
      responseTimeMs: Date.now() - start,
      message: error instanceof Error ? error.message : "URL failed safety validation.",
    };
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "SyntraGridClientHealth/1.0 (+https://syntragrid.com)" },
    });

    const responseTimeMs = Date.now() - start;

    if (response.status >= 300 && response.status < 400) {
      return {
        healthy: false,
        status: "DEGRADED",
        statusCode: response.status,
        responseTimeMs,
        message: `Redirected (${response.status}) — redirects are reported, never followed.`,
      };
    }

    if (!response.ok) {
      return {
        healthy: false,
        status: "OFFLINE",
        statusCode: response.status,
        responseTimeMs,
        message: `HTTP ${response.status}.`,
      };
    }

    const slow = responseTimeMs > DEGRADED_RESPONSE_TIME_MS;
    return {
      healthy: true,
      status: slow ? "DEGRADED" : "HEALTHY",
      statusCode: response.status,
      responseTimeMs,
      message: slow ? `Slow response (${responseTimeMs}ms).` : null,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - start;
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      healthy: false,
      status: "OFFLINE",
      statusCode: null,
      responseTimeMs,
      message: timedOut ? `Timed out after ${timeoutMs}ms.` : error instanceof Error ? error.message : "Request failed.",
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
