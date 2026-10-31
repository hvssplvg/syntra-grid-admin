// lib/client-health/clientHealthApi.ts
//
// Client-side fetch helpers for /api/admin/client-health — mirrors
// lib/clients/clientsApi.ts / lib/workspaces/workspacesApi.ts's shape.

export type ClientHealthStatus = "HEALTHY" | "NEEDS_ATTENTION" | "AT_RISK" | "UNKNOWN";
export type HealthDimension = "monitoring" | "support" | "delivery" | "commercial";
export type HealthReasonSeverity = "info" | "attention" | "risk";

export type HealthReason = {
  dimension: HealthDimension;
  severity: HealthReasonSeverity;
  summary: string;
};

export type ClientHealthItem = {
  client: {
    id: string;
    name: string;
    displayName: string | null;
    logoUrl: string | null;
    status: string;
    priority: "STANDARD" | "IMPORTANT" | "STRATEGIC";
  };
  health: {
    status: ClientHealthStatus;
    reasons: HealthReason[];
    applicableDimensions: HealthDimension[];
  };
  openTicketCount: number;
  overdueTicketCount: number;
  monitoredEndpointCount: number;
  lastCheckedAt: string | null;
  nextRenewalAt: string | null;
  outstandingAmount: number;
};

export type MonitoredEndpointRecord = {
  id: string;
  label: string;
  url: string;
  method: string;
  enabled: boolean;
  checkIntervalMinutes: number;
  createdAt: string;
  healthChecks: Array<{ status: string; healthy: boolean; responseTimeMs: number | null; statusCode: number | null; message: string | null; checkedAt: string }>;
};

export type IncidentRecord = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  category: string | null;
  status: string;
  resolved: boolean;
  acknowledgedAt: string | null;
  startedAt: string;
  resolvedAt: string | null;
};

export type ClientHealthDetail = ClientHealthItem & {
  monitoredEndpoints: MonitoredEndpointRecord[];
  incidents: IncidentRecord[];
  tickets: Array<{ id: string; title: string; status: string; priority: string; createdAt: string }>;
  projects: Array<{ status: string }>;
  contracts: Array<{ status: string; renewalAt: string | null; endDate: string | null; autoRenew: boolean }>;
  invoices: Array<{ status: string; balance: number; dueAt: string | null }>;
};

class ApiError extends Error {}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/client-health${path}`, {
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

export async function fetchClientHealthList(filters: { status?: ClientHealthStatus; dimension?: HealthDimension; priority?: string; search?: string; clientId?: string }): Promise<ClientHealthItem[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.dimension) params.set("dimension", filters.dimension);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.search) params.set("search", filters.search);
  if (filters.clientId) params.set("clientId", filters.clientId);

  const query = params.toString();
  const result = await apiRequest<{ items: ClientHealthItem[] }>(`${query ? `?${query}` : ""}`);
  return result.items;
}

export async function fetchClientHealthDetail(clientId: string): Promise<ClientHealthDetail> {
  const result = await apiRequest<{ detail: ClientHealthDetail }>(`/${clientId}`);
  return result.detail;
}

export async function addMonitoredEndpointApi(input: { clientId: string; projectId?: string | null; label: string; url: string; method?: "GET" | "HEAD"; checkIntervalMinutes?: number }): Promise<MonitoredEndpointRecord> {
  const result = await apiRequest<{ endpoint: MonitoredEndpointRecord }>("/endpoints", { method: "POST", body: JSON.stringify(input) });
  return result.endpoint;
}

export async function deleteMonitoredEndpointApi(id: string): Promise<void> {
  await apiRequest(`/endpoints/${id}`, { method: "DELETE" });
}

export async function acknowledgeIncidentApi(id: string): Promise<void> {
  await apiRequest(`/incidents/${id}/acknowledge`, { method: "POST" });
}

export async function resolveIncidentApi(id: string): Promise<void> {
  await apiRequest(`/incidents/${id}/resolve`, { method: "POST" });
}

export { ApiError as ClientHealthApiError };
