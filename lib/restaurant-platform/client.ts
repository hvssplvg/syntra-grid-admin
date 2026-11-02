import "server-only";
import crypto from "node:crypto";

/**
 * Server-only client for Restaurant Admin's Restaurant Management API
 * (syntragrid-restaurant-admin's app/api/platform-mgmt/). Holds its own
 * signing credential (RESTAURANT_MGMT_KEY_ID / RESTAURANT_MGMT_SECRET) —
 * never a Supabase service-role key, which stays exclusively in
 * Restaurant Admin's own environment. Every exported function here
 * assumes the caller has ALREADY checked
 * requireRestaurantPlatformPermission() — this module performs no
 * authorization of its own, the same separation of concerns as
 * lib/platform/service.ts on the Restaurant Admin side.
 *
 * Signing matches that app's lib/platform-mgmt/auth.ts exactly:
 * HMAC-SHA256 over `METHOD\nPATH\nTIMESTAMP\nNONCE\nSHA256(BODY)`, where
 * PATH is pathname + query string with no host, headers
 * X-PlatformMgmt-{KeyId,Timestamp,Nonce,Signature}.
 */

export type ManagementApiError = {
  code: string;
  message: string;
};

export class RestaurantManagementApiError extends Error {
  code: string;
  status: number;

  constructor(error: ManagementApiError, status: number) {
    super(error.message);
    this.code = error.code;
    this.status = status;
  }
}

function getConfig() {
  const baseUrl = process.env.RESTAURANT_ADMIN_BASE_URL;
  const keyId = process.env.RESTAURANT_MGMT_KEY_ID;
  const secret = process.env.RESTAURANT_MGMT_SECRET;

  if (!baseUrl || !keyId || !secret) {
    throw new Error(
      "Restaurant Management API is not configured: RESTAURANT_ADMIN_BASE_URL, " +
        "RESTAURANT_MGMT_KEY_ID and RESTAURANT_MGMT_SECRET must all be set."
    );
  }

  return { baseUrl, keyId, secret };
}

function sign(params: { method: string; path: string; timestamp: string; nonce: string; rawBody: string; secret: string }): string {
  const bodyHash = crypto.createHash("sha256").update(params.rawBody).digest("hex");
  const canonical = [params.method.toUpperCase(), params.path, params.timestamp, params.nonce, bodyHash].join("\n");
  return crypto.createHmac("sha256", params.secret).update(canonical).digest("hex");
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { baseUrl, keyId, secret } = getConfig();
  const rawBody = body === undefined ? "" : JSON.stringify(body);
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();
  const signature = sign({ method, path, timestamp, nonce, rawBody, secret });

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-PlatformMgmt-KeyId": keyId,
      "X-PlatformMgmt-Timestamp": timestamp,
      "X-PlatformMgmt-Nonce": nonce,
      "X-PlatformMgmt-Signature": signature,
    },
    body: rawBody || undefined,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error: ManagementApiError = payload?.error ?? { code: "INTERNAL", message: "Restaurant Management API request failed." };
    throw new RestaurantManagementApiError(error, response.status);
  }

  return (payload?.data ?? payload) as T;
}

export type RemoteRestaurantStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type RemoteRestaurantSummary = {
  id: string;
  name: string;
  slug: string;
  status: RemoteRestaurantStatus;
  city: string | null;
  country: string | null;
  createdAt: string;
};

export type RemoteRestaurantDetail = RemoteRestaurantSummary & {
  email: string | null;
  phone: string | null;
  address: string | null;
  timezone: string;
  currency: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  updatedAt: string;
  enabledModules: string[];
  disabledModules: string[];
};

export type RemoteInvitation = {
  id: string;
  email: string;
  role: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
};

export type CreateRemoteRestaurantInput = {
  requestId: string;
  name: string;
  ownerEmail: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  currency: string;
  timezone: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
};

export type CreateRemoteRestaurantResult = {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string;
  /** Null when `replay` is true — see the field below. */
  inviteLink: string | null;
  /**
   * True when this call reused an existing provisioningRequestId from an
   * earlier, already-committed attempt rather than creating a new
   * restaurant — the atomic RPC's idempotent-replay path. No new
   * invitation token exists to return in that case; the caller already
   * has (or has lost) the one from the original attempt, and must use
   * the explicit reissue endpoint for a fresh link.
   */
  replay: boolean;
};

export async function listRemoteRestaurants(filters: {
  status?: RemoteRestaurantStatus;
  cursorCreatedAt?: string;
  cursorId?: string;
  limit?: number;
}): Promise<{ items: RemoteRestaurantSummary[]; nextCursor: { createdAt: string; id: string } | null }> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.cursorCreatedAt) params.set("cursorCreatedAt", filters.cursorCreatedAt);
  if (filters.cursorId) params.set("cursorId", filters.cursorId);
  if (filters.limit) params.set("limit", String(filters.limit));

  const query = params.toString();
  return request(
    "GET",
    `/api/platform-mgmt/restaurants${query ? `?${query}` : ""}`
  );
}

export async function getRemoteRestaurantDetail(restaurantId: string): Promise<RemoteRestaurantDetail> {
  return request("GET", `/api/platform-mgmt/restaurants/${encodeURIComponent(restaurantId)}`);
}

export async function createRemoteRestaurant(input: CreateRemoteRestaurantInput): Promise<CreateRemoteRestaurantResult> {
  return request("POST", "/api/platform-mgmt/restaurants", input);
}

export async function setRemoteRestaurantStatus(restaurantId: string, status: RemoteRestaurantStatus): Promise<{ restaurantId: string }> {
  return request("PATCH", `/api/platform-mgmt/restaurants/${encodeURIComponent(restaurantId)}/status`, { status });
}

export async function setRemoteModuleEnabled(restaurantId: string, moduleKey: string, enabled: boolean): Promise<{ restaurantId: string }> {
  return request(
    "PATCH",
    `/api/platform-mgmt/restaurants/${encodeURIComponent(restaurantId)}/modules/${encodeURIComponent(moduleKey)}`,
    { enabled }
  );
}

export async function listRemoteInvitations(restaurantId: string): Promise<{ items: RemoteInvitation[] }> {
  return request("GET", `/api/platform-mgmt/restaurants/${encodeURIComponent(restaurantId)}/invitations`);
}

export async function issueRemoteOwnerInvitation(restaurantId: string, ownerEmail: string): Promise<{ invitationId: string; inviteLink: string }> {
  return request("POST", `/api/platform-mgmt/restaurants/${encodeURIComponent(restaurantId)}/invitations`, { ownerEmail });
}
