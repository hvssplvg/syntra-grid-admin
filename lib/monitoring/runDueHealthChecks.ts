// lib/monitoring/runDueHealthChecks.ts
//
// Polls every enabled MonitoredEndpoint whose last check is at least
// checkIntervalMinutes old (or has never been checked), writes a real
// HealthCheck row via the SSRF-safe lib/monitoring/safeFetch.ts, and
// applies the shared incident state machine in
// lib/monitoring/applyHealthCheckResult.ts (never a duplicate incident for
// the same ongoing issue — see dedupeKey there). Called by
// app/api/cron/health-check — see that route's own doc comment for the
// real cron-frequency constraint (Vercel Hobby plan: at most daily,
// regardless of checkIntervalMinutes).
//
// Shares a `checkInProgressAt` lock with the manual Check Now route
// (app/api/admin/client-health/endpoints/[id]/check-now/route.ts) so the
// cron and a manual check can never race the same endpoint — a stale
// (>STALE_LOCK_MS) lock self-heals rather than permanently stranding an
// endpoint if a check ever crashes mid-flight.

import { prisma } from "@/lib/prisma";
import { performMonitoringCheck } from "@/lib/monitoring/safeFetch";
import { applyHealthCheckResult } from "@/lib/monitoring/applyHealthCheckResult";

// Enforced here too, not just at the UI/API layer that accepts the
// requested value — never trust a stored value alone for something this
// consequential (how aggressively we poll a third party's URL).
const MIN_CHECK_INTERVAL_MINUTES = 5;

/** Longer than safeFetch's own request timeout (10s) plus margin, so a
 *  crashed/killed check self-heals instead of permanently locking the
 *  endpoint out of future checks. */
const STALE_LOCK_MS = 20_000;

function isDue(checkIntervalMinutes: number, lastCheckedAt: Date | null): boolean {
  if (!lastCheckedAt) return true;
  const intervalMs = Math.max(checkIntervalMinutes, MIN_CHECK_INTERVAL_MINUTES) * 60 * 1000;
  return Date.now() - lastCheckedAt.getTime() >= intervalMs;
}

export type RunDueHealthChecksResult = {
  checked: number;
  skippedLocked: number;
  failed: number;
  incidentsOpened: number;
  incidentsEscalated: number;
  incidentsResolved: number;
};

export async function runDueHealthChecks(): Promise<RunDueHealthChecksResult> {
  const endpoints = await prisma.monitoredEndpoint.findMany({
    where: { enabled: true },
    include: { healthChecks: { orderBy: { checkedAt: "desc" }, take: 1 } },
  });

  const result: RunDueHealthChecksResult = {
    checked: 0,
    skippedLocked: 0,
    failed: 0,
    incidentsOpened: 0,
    incidentsEscalated: 0,
    incidentsResolved: 0,
  };

  for (const endpoint of endpoints) {
    const lastCheckedAt = endpoint.healthChecks[0]?.checkedAt ?? null;
    if (!isDue(endpoint.checkIntervalMinutes, lastCheckedAt)) continue;

    const lock = await prisma.monitoredEndpoint.updateMany({
      where: {
        id: endpoint.id,
        OR: [{ checkInProgressAt: null }, { checkInProgressAt: { lt: new Date(Date.now() - STALE_LOCK_MS) } }],
      },
      data: { checkInProgressAt: new Date() },
    });

    if (lock.count === 0) {
      // A manual Check Now (or another poller run) is already in flight
      // for this endpoint — skip it this cycle rather than racing it.
      result.skippedLocked += 1;
      continue;
    }

    try {
      // performMonitoringCheck itself never throws (a failed fetch/DNS/SSRF
      // check becomes an OFFLINE result, see safeFetch.ts) — this try/catch
      // is specifically for applyHealthCheckResult's own DB writes. One
      // endpoint's transient DB error must not abort every OTHER endpoint
      // still waiting in this run; a single Vercel Hobby daily slot is too
      // precious to lose entirely over one bad write.
      const check = await performMonitoringCheck(endpoint.url, {
        method: endpoint.method === "HEAD" ? "HEAD" : "GET",
      });
      result.checked += 1;

      const outcome = await applyHealthCheckResult(
        {
          id: endpoint.id,
          clientId: endpoint.clientId,
          projectId: endpoint.projectId,
          label: endpoint.label,
          consecutiveFailureCount: endpoint.consecutiveFailureCount,
          consecutiveFailureThreshold: endpoint.consecutiveFailureThreshold,
        },
        check,
        { trigger: "scheduled" },
      );

      if (outcome.incidentAction === "opened") result.incidentsOpened += 1;
      else if (outcome.incidentAction === "escalated") result.incidentsEscalated += 1;
      else if (outcome.incidentAction === "resolved") result.incidentsResolved += 1;
    } catch (error) {
      result.failed += 1;
      console.error(`health-check: endpoint ${endpoint.id} failed`, error);
    } finally {
      await prisma.monitoredEndpoint.update({
        where: { id: endpoint.id },
        data: { checkInProgressAt: null },
      });
    }
  }

  return result;
}
