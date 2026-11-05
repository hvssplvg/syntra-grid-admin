// lib/monitoring/checkNowRateLimit.ts
//
// Per-admin sliding-window limiter for the manual Check Now action —
// mirrors lib/ai/rateLimit.ts's shape exactly (same known limitation:
// per-process memory, a soft safeguard against rapid-fire clicking, not a
// hard guarantee under concurrent serverless instances). A second, separate
// per-endpoint minimum-gap check lives in the check-now route itself
// (derived from the endpoint's own last HealthCheck, no new state needed).

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;

const requestLog = new Map<string, number[]>();

export function checkNowRateLimit(adminUserId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const existing = (requestLog.get(adminUserId) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);

  if (existing.length >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = WINDOW_MS - (now - existing[0]);
    requestLog.set(adminUserId, existing);
    return { allowed: false, retryAfterMs };
  }

  existing.push(now);
  requestLog.set(adminUserId, existing);
  return { allowed: true };
}
