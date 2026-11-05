// lib/systems/systemsApi.ts
//
// Client-side fetch helpers for /api/admin/systems — mirrors
// lib/client-health/clientHealthApi.ts's shape.

export type ManagedSystemType = "WEBSITE" | "WEB_APP" | "MOBILE_APP" | "API" | "BACKEND_SERVICE" | "INFRASTRUCTURE" | "RESTAURANT_TENANT";
export type ManagedSystemLifecycleStatus = "PLANNED" | "ACTIVE" | "MAINTENANCE" | "DEPRECATED" | "RETIRED";

export type HealthReason = { dimension: string; severity: "info" | "attention" | "risk"; summary: string };

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

export type ManagedSystemDetail = ManagedSystemSummary & {
  monitoredEndpoints: Array<{ id: string; label: string; url: string; latestCheck: { status: string; healthy: boolean; checkedAt: string; responseTimeMs: number | null } | null }>;
  deployments: Array<{ id: string; environment: string | null; status: string; branch: string | null; commitHash: string | null; createdAt: string; finishedAt: string | null }>;
  incidents: Array<{ id: string; title: string; severity: string; category: string | null; status: string; resolved: boolean; startedAt: string }>;
};

class ApiError extends Error {}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/systems${path}`, {
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

export async function fetchSystemsList(filters: { clientId?: string; systemType?: string; lifecycleStatus?: string; search?: string }): Promise<ManagedSystemSummary[]> {
  const params = new URLSearchParams();
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.systemType) params.set("systemType", filters.systemType);
  if (filters.lifecycleStatus) params.set("lifecycleStatus", filters.lifecycleStatus);
  if (filters.search) params.set("search", filters.search);

  const query = params.toString();
  const result = await apiRequest<{ items: ManagedSystemSummary[] }>(`${query ? `?${query}` : ""}`);
  return result.items;
}

export async function fetchSystemDetail(id: string): Promise<ManagedSystemDetail> {
  const result = await apiRequest<{ system: ManagedSystemDetail }>(`/${id}`);
  return result.system;
}

export type CreateSystemInput = {
  clientId: string | null;
  projectId?: string | null;
  name: string;
  description?: string | null;
  systemType: ManagedSystemType;
  lifecycleStatus?: ManagedSystemLifecycleStatus;
  hostingProvider?: string | null;
  repositoryUrl?: string | null;
  techStack?: string[];
  productionUrl?: string | null;
  stagingUrl?: string | null;
};

export async function createSystemApi(input: CreateSystemInput): Promise<ManagedSystemSummary> {
  const result = await apiRequest<{ system: ManagedSystemSummary }>("", { method: "POST", body: JSON.stringify(input) });
  return result.system;
}

export async function updateSystemApi(id: string, input: Partial<CreateSystemInput>): Promise<ManagedSystemSummary> {
  const result = await apiRequest<{ system: ManagedSystemSummary }>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  return result.system;
}

export async function deleteSystemApi(id: string): Promise<void> {
  await apiRequest(`/${id}`, { method: "DELETE" });
}

export async function linkEndpointToSystemApi(systemId: string, monitoredEndpointId: string): Promise<void> {
  await apiRequest(`/${systemId}/endpoints`, { method: "POST", body: JSON.stringify({ monitoredEndpointId }) });
}

export { ApiError as SystemsApiError };
