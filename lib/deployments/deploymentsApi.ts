// lib/deployments/deploymentsApi.ts
//
// Client-side fetch helpers for /api/admin/deployments.

export type DeploymentStatus = "SUCCESS" | "FAILED" | "IN_PROGRESS" | "ROLLED_BACK";

export type DeploymentSummary = {
  id: string;
  projectId: string;
  project: { id: string; name: string };
  client: { id: string; name: string; displayName: string | null } | null;
  provider: string | null;
  environment: string | null;
  status: string;
  branch: string | null;
  commitHash: string | null;
  commitTitle: string | null;
  deploymentUrl: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  durationMs: number | null;
};

export type DeploymentCorrelation = {
  hasPossibleCorrelation: boolean;
  failingChecks: Array<{ id: string; status: string; checkedAt: string; monitoredEndpointLabel: string }>;
};

export type DeploymentDetail = DeploymentSummary & { correlation: DeploymentCorrelation };

class ApiError extends Error {}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/deployments${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new ApiError(payload?.error ?? "Something went wrong.");
  }

  return payload as T;
}

export async function fetchDeploymentsList(filters: { projectId?: string; clientId?: string; status?: string; environment?: string }): Promise<DeploymentSummary[]> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.status) params.set("status", filters.status);
  if (filters.environment) params.set("environment", filters.environment);

  const query = params.toString();
  const result = await apiRequest<{ items: DeploymentSummary[] }>(`${query ? `?${query}` : ""}`);
  return result.items;
}

export async function fetchDeploymentDetail(id: string): Promise<DeploymentDetail> {
  const result = await apiRequest<{ deployment: DeploymentDetail }>(`/${id}`);
  return result.deployment;
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
  startedAt?: string | null;
  finishedAt?: string | null;
};

/** Records that a deployment happened — never triggers one. */
export async function recordDeploymentApi(input: RecordDeploymentInput): Promise<DeploymentSummary> {
  const result = await apiRequest<{ deployment: DeploymentSummary }>("", { method: "POST", body: JSON.stringify(input) });
  return result.deployment;
}

export { ApiError as DeploymentsApiError };
