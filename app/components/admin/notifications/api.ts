// app/components/admin/notifications/api.ts
//
// Typed client for the real notification endpoints (extends the existing
// app/api/admin/overview/notifications/** family — see lib/notifications/server.ts).

export type NotificationItem = {
  id: string;
  recipientAdminUserId: string;
  actorId: string | null;
  type: string;
  title: string;
  body: string | null;
  module: string;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/overview/notifications${path}`, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Request failed (${response.status}).`);
  }

  return payload as T;
}

export async function fetchNotifications(options?: {
  limit?: number;
  cursor?: string | null;
  filter?: "all" | "unread";
}): Promise<{ items: NotificationItem[]; unreadCount: number; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.cursor) params.set("cursor", options.cursor);
  if (options?.filter) params.set("filter", options.filter);

  return request(params.toString() ? `?${params}` : "");
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const payload = await request<{ unreadCount: number }>("/unread-count");
  return payload.unreadCount;
}

export async function markNotificationRead(id: string): Promise<void> {
  await request(`/${id}`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await request("/read-all", { method: "POST" });
}

export async function dismissNotification(id: string): Promise<void> {
  await request(`/${id}`, { method: "DELETE" });
}
