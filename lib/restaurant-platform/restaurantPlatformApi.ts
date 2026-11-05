// lib/restaurant-platform/restaurantPlatformApi.ts
//
// Client-side fetch helpers for /api/admin/restaurant-platform — mirrors
// lib/systems/systemsApi.ts's shape.

export type ProvisioningState = "PENDING" | "PROVISIONED" | "FAILED";
export type RemoteRestaurantStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type RestaurantListItem = {
  id: string;
  name: string;
  createdAt: string;
  client: { id: string; name: string; displayName: string | null; logoUrl: string | null } | null;
  provisioningState: ProvisioningState;
  provisioningError: string | null;
  remoteStatus: RemoteRestaurantStatus | null;
  externalSlug: string | null;
};

export type RestaurantInvitation = {
  id: string;
  email: string;
  role: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
};

export type RestaurantDetail = {
  managedSystemId: string;
  client: { id: string; name: string; displayName: string | null; logoUrl: string | null } | null;
  provisioningState: ProvisioningState;
  provisioningError: string | null;
  remote: {
    id: string;
    name: string;
    slug: string;
    status: RemoteRestaurantStatus;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    timezone: string;
    currency: string;
    logoUrl: string | null;
    coverImageUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    dashboardTheme: string;
    createdAt: string;
    updatedAt: string;
    enabledModules: string[];
    disabledModules: string[];
  } | null;
  invitations: RestaurantInvitation[];
};

export type CreateRestaurantInput = {
  name: string;
  ownerEmail: string;
  currency: string;
  timezone: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  /** Optional-module keys to disable — applied atomically with creation. */
  disabledModuleKeys?: string[];
  /** Theme id — applied atomically with creation, defaults to
   *  'contemporary' server-side when omitted. */
  dashboardTheme?: string;
  clientId?: string;
  newClient?: { name: string };
};

export type ModuleDefinition = {
  key: string;
  label: string;
  description: string;
  group: string;
  optional: boolean;
};

export type ThemeDefinition = {
  id: string;
  label: string;
  description: string;
  suitedFor: string;
  isDark: boolean;
  tokens: Record<string, string>;
};

export class RestaurantPlatformApiError extends Error {
  code?: string;
  retryable?: boolean;
  managedSystemId?: string;

  constructor(message: string, opts?: { code?: string; retryable?: boolean; managedSystemId?: string }) {
    super(message);
    this.code = opts?.code;
    this.retryable = opts?.retryable;
    this.managedSystemId = opts?.managedSystemId;
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/restaurant-platform${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new RestaurantPlatformApiError(payload?.error ?? "Something went wrong.", {
      code: payload?.code,
      retryable: payload?.retryable,
      managedSystemId: payload?.managedSystemId,
    });
  }

  return payload as T;
}

export async function fetchRestaurantsList(filters: { clientId?: string } = {}): Promise<RestaurantListItem[]> {
  const params = new URLSearchParams();
  if (filters.clientId) params.set("clientId", filters.clientId);
  const query = params.toString();
  const result = await apiRequest<{ items: RestaurantListItem[] }>(`/restaurants${query ? `?${query}` : ""}`);
  return result.items;
}

export async function fetchRestaurantDetail(id: string): Promise<RestaurantDetail> {
  return apiRequest<RestaurantDetail>(`/restaurants/${id}`);
}

export async function fetchModuleRegistry(): Promise<ModuleDefinition[]> {
  const result = await apiRequest<{ items: ModuleDefinition[] }>(`/modules`);
  return result.items;
}

export async function fetchThemeRegistry(): Promise<ThemeDefinition[]> {
  const result = await apiRequest<{ items: ThemeDefinition[] }>(`/themes`);
  return result.items;
}

export async function createRestaurantApi(input: CreateRestaurantInput): Promise<{
  managedSystemId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  /** Null if this request id had already been provisioned by an earlier attempt. */
  inviteLink: string | null;
}> {
  return apiRequest(`/restaurants`, { method: "POST", body: JSON.stringify(input) });
}

export async function retryProvisioningApi(managedSystemId: string): Promise<{ restaurantId: string; inviteLink: string | null }> {
  return apiRequest(`/restaurants/${managedSystemId}/retry`, { method: "POST" });
}

export async function setRestaurantStatusApi(managedSystemId: string, status: RemoteRestaurantStatus): Promise<void> {
  await apiRequest(`/restaurants/${managedSystemId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

export async function setModuleEnabledApi(managedSystemId: string, moduleKey: string, enabled: boolean): Promise<void> {
  await apiRequest(`/restaurants/${managedSystemId}/modules/${moduleKey}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
}

export async function setDashboardThemeApi(managedSystemId: string, theme: string): Promise<void> {
  await apiRequest(`/restaurants/${managedSystemId}/theme`, { method: "PATCH", body: JSON.stringify({ theme }) });
}

export async function issueOwnerInvitationApi(managedSystemId: string, ownerEmail: string): Promise<{ invitationId: string; inviteLink: string }> {
  return apiRequest(`/restaurants/${managedSystemId}/invitations`, { method: "POST", body: JSON.stringify({ ownerEmail }) });
}
