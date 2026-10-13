// app/components/admin/account/api.ts
//
// Typed client for the self-service "My Account" endpoints
// (app/api/admin/me/**) — profile/employment, personal-info edits,
// avatar, and notification preferences.

export type NotificationPreferences = {
  soundEnabled: boolean;
  inAppEnabled: boolean;
  messagesEnabled: boolean;
  tasksEnabled: boolean;
  approvalsEnabled: boolean;
  campaignsEnabled: boolean;
  socialMediaEnabled: boolean;
  leaveEnabled: boolean;
};

export type MyProfile = {
  id: string;
  email: string;
  role: string;
  restrictedAccess: boolean;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  fullName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: { id: string; name: string } | null;
  employeeId: string | null;
  hasEmployeeRecord: boolean;
  phone: string | null;
  city: string | null;
  country: string | null;
  employmentType: string | null;
  startDate: string | null;
  lengthOfService: string | null;
  reportsTo: string | null;
  workLocation: string | null;
  accountStatus: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;

  const response = await fetch(`/api/admin/me${path}`, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: isFormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Request failed (${response.status}).`);
  }

  return payload as T;
}

export async function fetchMyProfile(): Promise<MyProfile> {
  const payload = await request<{ profile: MyProfile }>("");
  return payload.profile;
}

export async function updateMyProfile(patch: {
  preferredName?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
}): Promise<MyProfile> {
  const payload = await request<{ profile: MyProfile }>("", { method: "PATCH", body: JSON.stringify(patch) });
  return payload.profile;
}

export async function uploadMyAvatar(file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);
  return request("/avatar", { method: "POST", body: formData });
}

export async function removeMyAvatar(): Promise<void> {
  await request("/avatar", { method: "DELETE" });
}

export async function fetchMyNotificationPreferences(): Promise<NotificationPreferences> {
  const payload = await request<{ preferences: NotificationPreferences }>("/preferences");
  return payload.preferences;
}

export async function updateMyNotificationPreferences(
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const payload = await request<{ preferences: NotificationPreferences }>("/preferences", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return payload.preferences;
}
