// lib/incidents/server.ts
//
// Technical-incidents view — a READ-ONLY filter over the existing
// Incident model. Never a second write path: acknowledge/resolve stay on
// the existing app/api/admin/client-health/incidents/[id]/{acknowledge,
// resolve}/route.ts routes, unchanged, so a given Incident row has one
// consistent lifecycle regardless of which tab it's viewed from.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

// Single source of truth — reused by the route and by tests. Includes
// the two existing monitoring categories plus two new ones this phase
// introduces; Incident.category is free-text/app-validated (confirmed,
// not a DB enum), so adding these needs zero schema change.
export const TECHNICAL_INCIDENT_CATEGORIES = [
  "MONITORING_OUTAGE",
  "MONITORING_DEGRADED",
  "DEPLOYMENT_FAILURE",
  "INFRASTRUCTURE_INCIDENT",
] as const;

export type TechnicalIncidentCategory = (typeof TECHNICAL_INCIDENT_CATEGORIES)[number];

export type TechnicalIncidentListFilters = {
  clientId?: string;
  allowedClientIds?: string[];
  category?: string;
  severity?: string;
  resolved?: boolean;
};

const INCIDENT_SELECT = {
  id: true,
  projectId: true,
  clientId: true,
  monitoredEndpointId: true,
  title: true,
  description: true,
  severity: true,
  category: true,
  status: true,
  resolved: true,
  acknowledgedAt: true,
  startedAt: true,
  resolvedAt: true,
  client: { select: { id: true, name: true, displayName: true } },
  project: { select: { id: true, name: true } },
  monitoredEndpoint: { select: { id: true, label: true } },
} satisfies Prisma.IncidentSelect;

type IncidentRow = Prisma.IncidentGetPayload<{ select: typeof INCIDENT_SELECT }>;

function toTechnicalIncidentSummary(incident: IncidentRow) {
  return {
    id: incident.id,
    projectId: incident.projectId,
    clientId: incident.clientId,
    monitoredEndpointId: incident.monitoredEndpointId,
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    category: incident.category,
    status: incident.status,
    resolved: incident.resolved,
    acknowledgedAt: incident.acknowledgedAt ? incident.acknowledgedAt.toISOString() : null,
    startedAt: incident.startedAt.toISOString(),
    resolvedAt: incident.resolvedAt ? incident.resolvedAt.toISOString() : null,
    client: incident.client,
    project: incident.project,
    monitoredEndpoint: incident.monitoredEndpoint,
  };
}

export async function listTechnicalIncidents(filters: TechnicalIncidentListFilters = {}) {
  const clientIdWhere = filters.allowedClientIds
    ? filters.clientId
      ? filters.allowedClientIds.includes(filters.clientId)
        ? filters.clientId
        : "__unresolvable__"
      : { in: filters.allowedClientIds }
    : filters.clientId;

  const incidents = await prisma.incident.findMany({
    where: {
      category: { in: filters.category ? [filters.category] : [...TECHNICAL_INCIDENT_CATEGORIES] },
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...(filters.resolved !== undefined ? { resolved: filters.resolved } : {}),
      ...(clientIdWhere !== undefined ? { clientId: clientIdWhere } : {}),
    },
    select: INCIDENT_SELECT,
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  return incidents.map(toTechnicalIncidentSummary);
}

export type CreateManualIncidentInput = {
  title: string;
  description?: string | null;
  severity: string;
  category: "INFRASTRUCTURE_INCIDENT" | "DEPLOYMENT_FAILURE";
  clientId?: string | null;
  projectId?: string | null;
};

/** For ad hoc infra issues with no monitored endpoint behind them —
 *  everything else (monitoring-triggered incidents) still comes only
 *  from lib/monitoring/applyHealthCheckResult.ts. */
export async function createManualTechnicalIncident(input: CreateManualIncidentInput) {
  return prisma.incident.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      severity: input.severity,
      category: input.category,
      status: "OPEN",
      clientId: input.clientId ?? null,
      projectId: input.projectId ?? null,
    },
    select: INCIDENT_SELECT,
  }).then(toTechnicalIncidentSummary);
}
