// lib/ai/rateLimit.ts
//
// A small, dependency-free, in-memory sliding-window limiter per admin
// user. No generic rate-limiter exists elsewhere in this codebase to
// reuse (confirmed), and adding a Redis/DB-backed one is out of scope
// for an internal, low-volume admin tool.
//
// Known limitation, stated plainly: this is per-process memory. It
// resets on a cold start and is not shared across concurrent serverless
// instances, so it is a soft safeguard against accidental rapid-fire
// clicking/scripting, not a hard guarantee under real concurrent load.

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

const requestLog = new Map<string, number[]>();

export function checkRateLimit(adminUserId: string): { allowed: boolean; retryAfterMs?: number } {
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
