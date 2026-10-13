// app/components/admin/messaging/api.ts
//
// Typed client for app/api/admin/chat/** — mirrors the apiRequest/
// ApiRequestError pattern used by SocialMediaTab.tsx so errors surface
// the server's real message, not a generic failure.

const API_BASE = "/api/admin/chat";

export class ChatApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: isFormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new ChatApiError(payload?.error || `Request failed (${response.status}).`, payload?.code);
  }

  return payload as T;
}

export type ChatUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl?: string | null;
  // Employee.avatarUrl/jobTitle take precedence over the fields above —
  // same source of truth as /api/admin/me and the admin header.
  employee?: { avatarUrl: string | null; jobTitle: string | null; department: { name: string } | null } | null;
};

/** The most "professional" single-line label for a user — job title if
 *  they have one (most specific), else their department, else null.
 *  Never the raw AdminRole enum (that's an access-control concept, not
 *  a job title). */
export function userRoleLabel(user: ChatUser): string | null {
  return user.employee?.jobTitle?.trim() || user.employee?.department?.name?.trim() || null;
}

export type ChatMember = {
  adminUserId: string;
  role: "MEMBER" | "ADMIN";
  joinedAt: string;
  leftAt: string | null;
  adminUser: ChatUser;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: ChatUser;
  attachments: { id: string; originalFilename: string; mimeType: string; size: number }[];
};

export type ChatConversation = {
  id: string;
  type: "DIRECT" | "GROUP";
  name: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  members: ChatMember[];
  messages?: ChatMessage[];
  unreadCount?: number;
};

export function conversationTitle(conversation: ChatConversation, selfId: string): string {
  if (conversation.type === "GROUP") return conversation.name ?? "Group";
  const other = conversation.members.find((member) => member.adminUserId !== selfId)?.adminUser;
  if (!other) return "Conversation";
  return [other.firstName, other.lastName].filter(Boolean).join(" ") || other.email;
}

export function userDisplayName(user: ChatUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

export async function fetchConversations(cursor?: string | null): Promise<{ conversations: ChatConversation[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  return apiRequest(`/conversations${params.toString() ? `?${params}` : ""}`);
}

export async function fetchConversation(id: string): Promise<{ conversation: ChatConversation }> {
  return apiRequest(`/conversations/${id}`);
}

export async function createDirectConversation(otherAdminUserId: string): Promise<{ conversation: ChatConversation }> {
  return apiRequest("/conversations", { method: "POST", body: JSON.stringify({ type: "DIRECT", otherAdminUserId }) });
}

export async function createGroupConversation(name: string, memberIds: string[]): Promise<{ conversation: ChatConversation }> {
  return apiRequest("/conversations", { method: "POST", body: JSON.stringify({ type: "GROUP", name, memberIds }) });
}

export async function renameConversation(id: string, name: string): Promise<{ conversation: ChatConversation }> {
  return apiRequest(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ name }) });
}

export async function fetchMessages(conversationId: string, cursor?: string | null): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  return apiRequest(`/conversations/${conversationId}/messages${params.toString() ? `?${params}` : ""}`);
}

export async function sendMessage(conversationId: string, body: string, attachmentIds?: string[]): Promise<{ message: ChatMessage }> {
  return apiRequest(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body, attachmentIds: attachmentIds ?? [] }),
  });
}

export async function editMessage(id: string, body: string): Promise<{ message: ChatMessage }> {
  return apiRequest(`/messages/${id}`, { method: "PATCH", body: JSON.stringify({ body }) });
}

export async function deleteMessage(id: string): Promise<{ message: ChatMessage }> {
  return apiRequest(`/messages/${id}`, { method: "DELETE" });
}

export async function markConversationRead(id: string): Promise<void> {
  await apiRequest(`/conversations/${id}/read`, { method: "POST" });
}

export async function addGroupMember(conversationId: string, adminUserId: string): Promise<{ conversation: ChatConversation }> {
  return apiRequest(`/conversations/${conversationId}/members`, { method: "POST", body: JSON.stringify({ adminUserId }) });
}

export async function removeGroupMember(conversationId: string, adminUserId: string): Promise<void> {
  await apiRequest(`/conversations/${conversationId}/members/${adminUserId}`, { method: "DELETE" });
}

export async function searchUsers(query: string): Promise<{ users: ChatUser[] }> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  return apiRequest(`/users${params.toString() ? `?${params}` : ""}`);
}

export async function fetchUnreadCount(): Promise<{ unreadConversations: number; unreadMessages: number }> {
  return apiRequest("/unread-count");
}

export async function uploadAttachment(file: File): Promise<{ attachment: { id: string; originalFilename: string; mimeType: string; size: number } }> {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest("/attachments", { method: "POST", body: formData });
}

export async function discardAttachment(id: string): Promise<void> {
  await apiRequest(`/attachments/${id}`, { method: "DELETE" });
}

export function attachmentDownloadUrl(id: string): string {
  return `${API_BASE}/attachments/${id}`;
}
