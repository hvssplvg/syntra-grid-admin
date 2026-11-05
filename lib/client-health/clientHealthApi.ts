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
  activeIncidentCount: number;
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

// Beyond this age with zero recorded checks, "awaiting first check" (normal,
// expected) becomes "configuration issue" (the scheduled poller should have
// had at least one opportunity by now, even on a once-daily cadence — see
// app/api/cron/health-check/route.ts's own doc comment). 36h gives a full
// day-cycle margin for where in the day the endpoint was added relative to
// the cron's fixed UTC slot, plus scheduling jitter — never flags a
// genuinely-just-added endpoint, only one that's gone unexpectedly long
// without ever being polled (e.g. CRON_SECRET missing in production).
const CONFIG_ISSUE_THRESHOLD_HOURS = 36;

export type EndpointDisplayState = "operational" | "failure" | "awaiting_first_check" | "configuration_issue";

/** One of 4 states the dashboard must visibly distinguish — never conflate
 *  "never checked yet, still within normal expectation" with "never
 *  checked yet, and the scheduler itself looks broken". */
export function deriveEndpointDisplayState(endpoint: Pick<MonitoredEndpointRecord, "createdAt" | "healthChecks">): EndpointDisplayState {
  const latest = endpoint.healthChecks[0];
  if (!latest) {
    const ageHours = (Date.now() - new Date(endpoint.createdAt).getTime()) / 3_600_000;
    return ageHours >= CONFIG_ISSUE_THRESHOLD_HOURS ? "configuration_issue" : "awaiting_first_check";
  }
  return latest.status === "HEALTHY" ? "operational" : "failure";
}

export type IncidentRecord = {
  id: string;
  monitoredEndpointId: string | null;
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

export async function fetchClientHealthList(
  filters: { status?: ClientHealthStatus; dimension?: HealthDimension; priority?: string; search?: string; clientId?: string },
  signal?: AbortSignal,
): Promise<ClientHealthItem[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.dimension) params.set("dimension", filters.dimension);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.search) params.set("search", filters.search);
  if (filters.clientId) params.set("clientId", filters.clientId);

  const query = params.toString();
  const result = await apiRequest<{ items: ClientHealthItem[] }>(`${query ? `?${query}` : ""}`, { signal });
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

export type CheckNowResult = {
  ok: true;
  check: { status: string; healthy: boolean; statusCode: number | null; responseTimeMs: number; message: string | null };
  incidentAction: "opened" | "escalated" | "resolved" | "none";
};

/** Throws ClientHealthApiError with the server's message on 409 (already
 *  checking) / 429 (rate-limited) / 403 (cross-client) — callers should
 *  surface that message directly rather than a generic failure. */
export async function checkEndpointNowApi(id: string): Promise<CheckNowResult> {
  return apiRequest<CheckNowResult>(`/endpoints/${id}/check-now`, { method: "POST" });
}

export type EndpointHistoryRange = "24h" | "7d" | "30d";

export type EndpointHistoryCheck = { status: string; healthy: boolean; responseTimeMs: number | null; statusCode: number | null; checkedAt: string };

export type EndpointHistoryResult = {
  ok: true;
  endpoint: { id: string; label: string; url: string; checkIntervalMinutes: number };
  range: EndpointHistoryRange;
  checks: EndpointHistoryCheck[];
  totalChecks: number;
  uptimePercent: number | null;
  insufficientData: boolean;
};

export async function fetchEndpointHistoryApi(id: string, range: EndpointHistoryRange): Promise<EndpointHistoryResult> {
  return apiRequest<EndpointHistoryResult>(`/endpoints/${id}/history?range=${range}`);
}

export async function acknowledgeIncidentApi(id: string): Promise<void> {
  await apiRequest(`/incidents/${id}/acknowledge`, { method: "POST" });
}

export async function resolveIncidentApi(id: string): Promise<void> {
  await apiRequest(`/incidents/${id}/resolve`, { method: "POST" });
}

export { ApiError as ClientHealthApiError };
