// lib/monitoring/runDueHealthChecks.ts
//
// Polls every enabled MonitoredEndpoint whose last check is at least
// checkIntervalMinutes old (or has never been checked), writes a real
// HealthCheck row via the SSRF-safe lib/monitoring/safeFetch.ts, and
// opens/escalates/auto-resolves a MonitoredEndpoint-scoped Incident on a
// status transition — never a duplicate for the same ongoing issue (see
// the dedupeKey check below). Called by app/api/cron/health-check — see
// that route's own doc comment for the real cron-frequency constraint
// (Vercel Hobby plan: at most daily, regardless of checkIntervalMinutes).

import { prisma } from "@/lib/prisma";
import { performMonitoringCheck, type MonitoringCheckStatus } from "@/lib/monitoring/safeFetch";
import { HealthStatus } from "@/app/generated/prisma/enums";

// Enforced here too, not just at the UI/API layer that accepts the
// requested value — never trust a stored value alone for something this
// consequential (how aggressively we poll a third party's URL).
const MIN_CHECK_INTERVAL_MINUTES = 5;

function isDue(checkIntervalMinutes: number, lastCheckedAt: Date | null): boolean {
  if (!lastCheckedAt) return true;
  const intervalMs = Math.max(checkIntervalMinutes, MIN_CHECK_INTERVAL_MINUTES) * 60 * 1000;
  return Date.now() - lastCheckedAt.getTime() >= intervalMs;
}

function incidentCategoryFor(status: MonitoringCheckStatus): "MONITORING_OUTAGE" | "MONITORING_DEGRADED" | null {
  if (status === "OFFLINE") return "MONITORING_OUTAGE";
  if (status === "DEGRADED") return "MONITORING_DEGRADED";
  return null;
}

export type RunDueHealthChecksResult = {
  checked: number;
  incidentsOpened: number;
  incidentsEscalated: number;
  incidentsResolved: number;
};

export async function runDueHealthChecks(): Promise<RunDueHealthChecksResult> {
  const endpoints = await prisma.monitoredEndpoint.findMany({
    where: { enabled: true },
    include: { healthChecks: { orderBy: { checkedAt: "desc" }, take: 1 } },
  });

  const result: RunDueHealthChecksResult = { checked: 0, incidentsOpened: 0, incidentsEscalated: 0, incidentsResolved: 0 };

  for (const endpoint of endpoints) {
    const lastCheckedAt = endpoint.healthChecks[0]?.checkedAt ?? null;
    if (!isDue(endpoint.checkIntervalMinutes, lastCheckedAt)) continue;

    const check = await performMonitoringCheck(endpoint.url, {
      method: endpoint.method === "HEAD" ? "HEAD" : "GET",
    });
    result.checked += 1;

    await prisma.healthCheck.create({
      data: {
        monitoredEndpointId: endpoint.id,
        status: check.status as HealthStatus,
        healthy: check.healthy,
        responseTimeMs: check.responseTimeMs,
        statusCode: check.statusCode,
        message: check.message,
      },
    });

    const dedupeKey = `monitored-endpoint:${endpoint.id}`;
    const category = incidentCategoryFor(check.status);

    const openIncident = await prisma.incident.findFirst({
      where: { dedupeKey, resolved: false },
    });

    if (category) {
      const title = `${endpoint.label} is ${category === "MONITORING_OUTAGE" ? "unreachable" : "degraded"}`;
      const severity = category === "MONITORING_OUTAGE" ? "critical" : "warning";

      if (!openIncident) {
        await prisma.incident.create({
          data: {
            clientId: endpoint.clientId,
            projectId: endpoint.projectId,
            monitoredEndpointId: endpoint.id,
            title,
            description: check.message,
            severity,
            category,
            status: "OPEN",
            dedupeKey,
          },
        });
        result.incidentsOpened += 1;
      } else if (openIncident.category !== category) {
        // Degraded -> outage or outage -> degraded for the same ongoing
        // issue: update the existing incident in place rather than
        // opening a second one for the same dedupeKey.
        await prisma.incident.update({
          where: { id: openIncident.id },
          data: { title, description: check.message, severity, category },
        });
        result.incidentsEscalated += 1;
      }
    } else if (openIncident) {
      await prisma.incident.update({
        where: { id: openIncident.id },
        data: { resolved: true, resolvedAt: new Date(), status: "RESOLVED" },
      });
      result.incidentsResolved += 1;
    }
  }

  return result;
}
