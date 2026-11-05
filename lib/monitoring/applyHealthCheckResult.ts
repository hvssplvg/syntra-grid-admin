// lib/monitoring/applyHealthCheckResult.ts
//
// One shared incident/HealthCheck state machine, called by BOTH the cron
// poller (runDueHealthChecks.ts) and the manual Check Now route — so
// there is exactly one place that decides "does this result open, escalate,
// or resolve an incident," not two hand-maintained copies that could drift.
//
// Debounce: a single non-healthy result no longer opens a new incident —
// it only increments MonitoredEndpoint.consecutiveFailureCount. A new
// incident opens only once that count reaches the threshold (default
// DEFAULT_CONSECUTIVE_FAILURE_THRESHOLD, overridable per endpoint via
// consecutiveFailureThreshold). This never blocks ESCALATING an incident
// that's already open for this endpoint's dedupeKey — only opening a brand
// new one — so dedupeKey still guarantees at most one open incident per
// endpoint. Recovery (a healthy result) stays immediate: it resets the
// counter to 0 and resolves any open incident right away, so admins/
// clients see recovery as fast as possible, and a flapping endpoint never
// accumulates toward the threshold either.

import { prisma } from "@/lib/prisma";
import type { MonitoringCheckResult, MonitoringCheckStatus } from "@/lib/monitoring/safeFetch";
import { HealthStatus } from "@/app/generated/prisma/enums";

export const DEFAULT_CONSECUTIVE_FAILURE_THRESHOLD = 2;

export type EndpointForIncidentLogic = {
  id: string;
  clientId: string;
  projectId: string | null;
  label: string;
  consecutiveFailureCount: number;
  consecutiveFailureThreshold: number | null;
};

export type ApplyHealthCheckResultOutcome = {
  incidentAction: "opened" | "escalated" | "resolved" | "none";
};

function incidentCategoryFor(status: MonitoringCheckStatus): "MONITORING_OUTAGE" | "MONITORING_DEGRADED" | null {
  if (status === "OFFLINE") return "MONITORING_OUTAGE";
  if (status === "DEGRADED") return "MONITORING_DEGRADED";
  return null;
}

/** Persists the HealthCheck row and applies the incident state machine for
 *  one endpoint's result. Always writes the HealthCheck row, regardless of
 *  whether the failure threshold is reached. */
export async function applyHealthCheckResult(
  endpoint: EndpointForIncidentLogic,
  check: MonitoringCheckResult,
  options?: { trigger?: "scheduled" | "manual"; triggeredBy?: string | null },
): Promise<ApplyHealthCheckResultOutcome> {
  await prisma.healthCheck.create({
    data: {
      monitoredEndpointId: endpoint.id,
      status: check.status as HealthStatus,
      healthy: check.healthy,
      responseTimeMs: check.responseTimeMs,
      statusCode: check.statusCode,
      message: check.message,
      metadata: {
        trigger: options?.trigger ?? "scheduled",
        triggeredBy: options?.triggeredBy ?? null,
      },
    },
  });

  const category = incidentCategoryFor(check.status);
  const dedupeKey = `monitored-endpoint:${endpoint.id}`;

  const newFailureCount = category ? endpoint.consecutiveFailureCount + 1 : 0;
  await prisma.monitoredEndpoint.update({
    where: { id: endpoint.id },
    data: { consecutiveFailureCount: newFailureCount },
  });

  const openIncident = await prisma.incident.findFirst({
    where: { dedupeKey, resolved: false },
  });

  if (category) {
    const threshold = endpoint.consecutiveFailureThreshold ?? DEFAULT_CONSECUTIVE_FAILURE_THRESHOLD;
    const title = `${endpoint.label} is ${category === "MONITORING_OUTAGE" ? "unreachable" : "degraded"}`;
    const severity = category === "MONITORING_OUTAGE" ? "critical" : "warning";

    if (openIncident) {
      if (openIncident.category !== category) {
        // Already open for this ongoing issue — escalating/updating it is
        // never gated by the threshold, only opening a NEW one is.
        await prisma.incident.update({
          where: { id: openIncident.id },
          data: { title, description: check.message, severity, category },
        });
        return { incidentAction: "escalated" };
      }
      return { incidentAction: "none" };
    }

    if (newFailureCount >= threshold) {
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
      return { incidentAction: "opened" };
    }

    // Below threshold — recorded, debounced, no incident yet.
    return { incidentAction: "none" };
  }

  if (openIncident) {
    await prisma.incident.update({
      where: { id: openIncident.id },
      data: { resolved: true, resolvedAt: new Date(), status: "RESOLVED" },
    });
    return { incidentAction: "resolved" };
  }

  return { incidentAction: "none" };
}
