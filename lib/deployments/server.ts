// lib/deployments/server.ts
//
// First real data layer for the Deployment model — confirmed this session
// that it has zero write call sites anywhere in the app before this.
// Manual recording only (no automated provider integration exists), per
// the task's own instruction — this never triggers a real deployment, it
// only records that one happened.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export type DeploymentStatus = "SUCCESS" | "FAILED" | "IN_PROGRESS" | "ROLLED_BACK";
export const DEPLOYMENT_STATUSES: DeploymentStatus[] = ["SUCCESS", "FAILED", "IN_PROGRESS", "ROLLED_BACK"];

export type DeploymentListFilters = {
  projectId?: string;
  clientId?: string;
  allowedClientIds?: string[];
  status?: string;
  environment?: string;
};

const DEPLOYMENT_SELECT = {
  id: true,
  projectId: true,
  provider: true,
  environment: true,
  status: true,
  branch: true,
  commitHash: true,
  commitTitle: true,
  deploymentUrl: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  project: { select: { id: true, name: true, clientId: true, client: { select: { id: true, name: true, displayName: true } } } },
} satisfies Prisma.DeploymentSelect;

type DeploymentRow = Prisma.DeploymentGetPayload<{ select: typeof DEPLOYMENT_SELECT }>;

function toDeploymentSummary(deployment: DeploymentRow) {
  const durationMs =
    deployment.startedAt && deployment.finishedAt ? deployment.finishedAt.getTime() - deployment.startedAt.getTime() : null;

  return {
    id: deployment.id,
    projectId: deployment.projectId,
    project: { id: deployment.project.id, name: deployment.project.name },
    client: deployment.project.client,
    provider: deployment.provider,
    environment: deployment.environment,
    status: deployment.status,
    branch: deployment.branch,
    commitHash: deployment.commitHash,
    commitTitle: deployment.commitTitle,
    deploymentUrl: deployment.deploymentUrl,
    startedAt: deployment.startedAt ? deployment.startedAt.toISOString() : null,
    finishedAt: deployment.finishedAt ? deployment.finishedAt.toISOString() : null,
    createdAt: deployment.createdAt.toISOString(),
    // Honest: null when either timestamp is missing — never guessed.
    durationMs,
  };
}

export type DeploymentSummary = ReturnType<typeof toDeploymentSummary>;

export async function listDeployments(filters: DeploymentListFilters = {}): Promise<DeploymentSummary[]> {
  const clientIdWhere = filters.allowedClientIds
    ? filters.clientId
      ? filters.allowedClientIds.includes(filters.clientId)
        ? filters.clientId
        : "__unresolvable__"
      : { in: filters.allowedClientIds }
    : filters.clientId;

  const deployments = await prisma.deployment.findMany({
    where: {
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.environment ? { environment: filters.environment } : {}),
      ...(clientIdWhere !== undefined ? { project: { clientId: clientIdWhere } } : {}),
    },
    select: DEPLOYMENT_SELECT,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return deployments.map(toDeploymentSummary);
}

export async function getDeploymentDetail(id: string) {
  const deployment = await prisma.deployment.findUnique({ where: { id }, select: DEPLOYMENT_SELECT });
  if (!deployment) return null;

  return { ...toDeploymentSummary(deployment), correlation: await getDeploymentCorrelation(deployment) };
}

// Heuristic only — a non-healthy HealthCheck shortly after a deployment
// finished is a POSSIBLE correlation, never proof of causation. Callers
// must present it as a hint, not a verdict (see DeploymentsTab.tsx /
// SystemsTab.tsx's copy).
export const CORRELATION_WINDOW_MINUTES = 120;

export type DeploymentCorrelation = {
  hasPossibleCorrelation: boolean;
  failingChecks: Array<{ id: string; status: string; checkedAt: string; monitoredEndpointLabel: string }>;
};

export async function getDeploymentCorrelation(deployment: { projectId: string; finishedAt: Date | null }): Promise<DeploymentCorrelation> {
  // Never fabricate a correlation against a deployment that hasn't
  // actually finished yet — there's nothing to correlate against.
  if (!deployment.finishedAt) {
    return { hasPossibleCorrelation: false, failingChecks: [] };
  }

  const windowEnd = new Date(deployment.finishedAt.getTime() + CORRELATION_WINDOW_MINUTES * 60_000);

  const failingChecks = await prisma.healthCheck.findMany({
    where: {
      healthy: false,
      checkedAt: { gte: deployment.finishedAt, lte: windowEnd },
      monitoredEndpoint: { projectId: deployment.projectId },
    },
    orderBy: { checkedAt: "asc" },
    take: 20,
    select: { id: true, status: true, checkedAt: true, monitoredEndpoint: { select: { label: true } } },
  });

  return {
    hasPossibleCorrelation: failingChecks.length > 0,
    failingChecks: failingChecks.map((check) => ({
      id: check.id,
      status: check.status,
      checkedAt: check.checkedAt.toISOString(),
      monitoredEndpointLabel: check.monitoredEndpoint?.label ?? "Unknown endpoint",
    })),
  };
}

export type RecordDeploymentInput = {
  projectId: string;
  provider?: string | null;
  environment?: string | null;
  status: DeploymentStatus;
  branch?: string | null;
  commitHash?: string | null;
  commitTitle?: string | null;
  deploymentUrl?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

/** Pure record-keeping — never triggers a real deployment. On a FAILED
 *  status, opens exactly one Incident (dedupeKey keyed to this specific
 *  deployment row, so re-recording/updating never duplicates it),
 *  mirroring lib/monitoring/applyHealthCheckResult.ts's dedupe
 *  convention. */
export async function recordDeployment(input: RecordDeploymentInput, createdClientId: string | null) {
  const deployment = await prisma.deployment.create({
    data: {
      projectId: input.projectId,
      provider: input.provider ?? null,
      environment: input.environment ?? null,
      status: input.status,
      branch: input.branch ?? null,
      commitHash: input.commitHash ?? null,
      commitTitle: input.commitTitle ?? null,
      deploymentUrl: input.deploymentUrl ?? null,
      startedAt: input.startedAt ?? null,
      finishedAt: input.finishedAt ?? null,
    },
  });

  if (input.status === "FAILED") {
    const dedupeKey = `deployment:${deployment.id}`;
    const existing = await prisma.incident.findFirst({ where: { dedupeKey, resolved: false } });
    if (!existing) {
      await prisma.incident.create({
        data: {
          projectId: input.projectId,
          clientId: createdClientId,
          title: `Deployment failed${input.environment ? ` (${input.environment})` : ""}`,
          description: input.commitTitle ? `Commit: ${input.commitTitle}` : null,
          severity: "critical",
          category: "DEPLOYMENT_FAILURE",
          status: "OPEN",
          dedupeKey,
        },
      });
    }
  }

  return deployment;
}
