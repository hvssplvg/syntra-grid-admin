// lib/systems/server.ts
//
// Data-fetching + orchestration for the Technology Operations systems
// inventory — mirrors lib/client-health/server.ts's shape. Deployments
// and incidents are deliberately NOT a direct ManagedSystem relation;
// they're derived through its own projectId (Deployment.projectId /
// Incident.projectId already exist and are the real join keys), so this
// never duplicates data Project already owns. A system's monitoring
// status is derived from its linked MonitoredEndpoint rows using the
// exact same lib/client-health/compute.ts logic Client Health itself
// uses — never a second, parallel "is this healthy" computation.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { ManagedSystemLifecycleStatus, ManagedSystemType } from "@/app/generated/prisma/enums";
import { computeMonitoring, type HealthReason } from "@/lib/client-health/compute";

export type ManagedSystemListFilters = {
  clientId?: string;
  /** CLIENT-scope restriction (see systemsClientScopeFilter in
   *  lib/systems/permissions.ts) — when set, results are narrowed to
   *  exactly these client ids regardless of what `clientId` above
   *  requests. Undefined for full-access/ALL-scope callers. */
  allowedClientIds?: string[];
  systemType?: ManagedSystemType;
  lifecycleStatus?: ManagedSystemLifecycleStatus;
  search?: string;
};

const MANAGED_SYSTEM_SELECT = {
  id: true,
  clientId: true,
  projectId: true,
  name: true,
  description: true,
  systemType: true,
  lifecycleStatus: true,
  hostingProvider: true,
  repositoryUrl: true,
  techStack: true,
  productionUrl: true,
  stagingUrl: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, displayName: true, logoUrl: true } },
  project: { select: { id: true, name: true } },
  monitoredEndpoints: {
    select: {
      id: true,
      label: true,
      url: true,
      healthChecks: { orderBy: { checkedAt: "desc" as const }, take: 1, select: { status: true, healthy: true, checkedAt: true, responseTimeMs: true } },
    },
  },
} satisfies Prisma.ManagedSystemSelect;

type ManagedSystemRow = Prisma.ManagedSystemGetPayload<{ select: typeof MANAGED_SYSTEM_SELECT }>;

export type ManagedSystemSummary = {
  id: string;
  clientId: string | null;
  projectId: string | null;
  name: string;
  description: string | null;
  systemType: ManagedSystemType;
  lifecycleStatus: ManagedSystemLifecycleStatus;
  hostingProvider: string | null;
  repositoryUrl: string | null;
  techStack: string[];
  productionUrl: string | null;
  stagingUrl: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; displayName: string | null; logoUrl: string | null } | null;
  project: { id: string; name: string } | null;
  monitoredEndpointCount: number;
  monitoring: { applicable: boolean; reasons: HealthReason[] };
};

function toSummary(system: ManagedSystemRow): ManagedSystemSummary {
  const monitoring = computeMonitoring(
    system.monitoredEndpoints.map((endpoint) => ({
      id: endpoint.id,
      label: endpoint.label,
      latestCheckStatus: endpoint.healthChecks[0]?.status ?? null,
      latestCheckAt: endpoint.healthChecks[0]?.checkedAt ?? null,
    })),
  );

  return {
    id: system.id,
    clientId: system.clientId,
    projectId: system.projectId,
    name: system.name,
    description: system.description,
    systemType: system.systemType,
    lifecycleStatus: system.lifecycleStatus,
    hostingProvider: system.hostingProvider,
    repositoryUrl: system.repositoryUrl,
    techStack: system.techStack,
    productionUrl: system.productionUrl,
    stagingUrl: system.stagingUrl,
    createdAt: system.createdAt.toISOString(),
    updatedAt: system.updatedAt.toISOString(),
    client: system.client,
    project: system.project,
    monitoredEndpointCount: system.monitoredEndpoints.length,
    monitoring,
  };
}

export async function listManagedSystems(filters: ManagedSystemListFilters = {}): Promise<ManagedSystemSummary[]> {
  const clientIdWhere = filters.allowedClientIds
    ? filters.clientId
      ? filters.allowedClientIds.includes(filters.clientId)
        ? filters.clientId
        : "__unresolvable__"
      : { in: filters.allowedClientIds }
    : filters.clientId;

  const systems = await prisma.managedSystem.findMany({
    where: {
      ...(clientIdWhere !== undefined ? { clientId: clientIdWhere } : {}),
      ...(filters.systemType ? { systemType: filters.systemType } : {}),
      ...(filters.lifecycleStatus ? { lifecycleStatus: filters.lifecycleStatus } : {}),
      ...(filters.search
        ? { name: { contains: filters.search, mode: "insensitive" as const } }
        : {}),
    },
    select: MANAGED_SYSTEM_SELECT,
    orderBy: { name: "asc" },
  });

  return systems.map(toSummary);
}

export type ManagedSystemDetail = ManagedSystemSummary & {
  monitoredEndpoints: Array<{
    id: string;
    label: string;
    url: string;
    latestCheck: { status: string; healthy: boolean; checkedAt: string; responseTimeMs: number | null } | null;
  }>;
  deployments: Array<{ id: string; environment: string | null; status: string; branch: string | null; commitHash: string | null; createdAt: string; finishedAt: string | null }>;
  incidents: Array<{ id: string; title: string; severity: string; category: string | null; status: string; resolved: boolean; startedAt: string }>;
};

export async function getManagedSystemDetail(id: string): Promise<ManagedSystemDetail | null> {
  const system = await prisma.managedSystem.findUnique({ where: { id }, select: MANAGED_SYSTEM_SELECT });
  if (!system) return null;

  const summary = toSummary(system);

  // Deployments/incidents are derived via projectId — this system owns no
  // direct relation to either, by design (see this file's own doc
  // comment). Honest empty arrays, not an error, when projectId is null.
  const [deployments, incidents] = system.projectId
    ? await Promise.all([
        prisma.deployment.findMany({
          where: { projectId: system.projectId },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, environment: true, status: true, branch: true, commitHash: true, createdAt: true, finishedAt: true },
        }),
        prisma.incident.findMany({
          where: { projectId: system.projectId },
          orderBy: { startedAt: "desc" },
          take: 20,
          select: { id: true, title: true, severity: true, category: true, status: true, resolved: true, startedAt: true },
        }),
      ])
    : [[], []];

  return {
    ...summary,
    monitoredEndpoints: system.monitoredEndpoints.map((endpoint) => ({
      id: endpoint.id,
      label: endpoint.label,
      url: endpoint.url,
      latestCheck: endpoint.healthChecks[0]
        ? {
            status: endpoint.healthChecks[0].status,
            healthy: endpoint.healthChecks[0].healthy,
            checkedAt: endpoint.healthChecks[0].checkedAt.toISOString(),
            responseTimeMs: endpoint.healthChecks[0].responseTimeMs,
          }
        : null,
    })),
    deployments: deployments.map((deployment) => ({
      id: deployment.id,
      environment: deployment.environment,
      status: deployment.status,
      branch: deployment.branch,
      commitHash: deployment.commitHash,
      createdAt: deployment.createdAt.toISOString(),
      finishedAt: deployment.finishedAt ? deployment.finishedAt.toISOString() : null,
    })),
    incidents: incidents.map((incident) => ({
      id: incident.id,
      title: incident.title,
      severity: incident.severity,
      category: incident.category,
      status: incident.status,
      resolved: incident.resolved,
      startedAt: incident.startedAt.toISOString(),
    })),
  };
}
