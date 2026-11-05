// lib/incidents/incidentsApi.ts
//
// Client-side fetch helpers for the technical-incidents view
// (/api/admin/incidents). Acknowledge/resolve are deliberately re-exported
// straight from lib/client-health/clientHealthApi.ts — same endpoints,
// not reimplemented — so an incident acted on from this tab hits the
// exact same route as from Client Health.

export { acknowledgeIncidentApi, resolveIncidentApi, ClientHealthApiError } from "@/lib/client-health/clientHealthApi";

export type TechnicalIncidentRecord = {
  id: string;
  projectId: string | null;
  clientId: string | null;
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
  client: { id: string; name: string; displayName: string | null } | null;
  project: { id: string; name: string } | null;
  monitoredEndpoint: { id: string; label: string } | null;
};

class ApiError extends Error {}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/incidents${path}`, {
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

export async function fetchTechnicalIncidentsList(filters: { clientId?: string; category?: string; severity?: string; resolved?: boolean }): Promise<TechnicalIncidentRecord[]> {
  const params = new URLSearchParams();
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.category) params.set("category", filters.category);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.resolved !== undefined) params.set("resolved", String(filters.resolved));

  const query = params.toString();
  const result = await apiRequest<{ items: TechnicalIncidentRecord[] }>(`${query ? `?${query}` : ""}`);
  return result.items;
}

export type CreateManualIncidentInput = {
  title: string;
  description?: string | null;
  severity: string;
  category: "INFRASTRUCTURE_INCIDENT" | "DEPLOYMENT_FAILURE";
  clientId?: string | null;
  projectId?: string | null;
};

export async function createManualIncidentApi(input: CreateManualIncidentInput): Promise<TechnicalIncidentRecord> {
  const result = await apiRequest<{ incident: TechnicalIncidentRecord }>("", { method: "POST", body: JSON.stringify(input) });
  return result.incident;
}

export { ApiError as IncidentsApiError };
