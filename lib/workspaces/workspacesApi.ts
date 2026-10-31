/*
  Shared SWR key + fetcher for GET /api/admin/workspaces.

  Mirrors lib/clients/clientsApi.ts's shape exactly — same reasoning,
  different endpoint. AdminHeader is the only reader today.
*/

export const WORKSPACES_ENDPOINT = "/api/admin/workspaces";

export type WorkspaceApiRecord = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  colour: string | null;
  sectionKeys: string[];
};

export type WorkspacesApiPayload = {
  ok: true;
  workspaces: WorkspaceApiRecord[];
};

export async function fetchWorkspacesPayload(url: string): Promise<WorkspacesApiPayload> {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  const payload = (await response.json().catch(() => ({ ok: false }))) as WorkspacesApiPayload | { ok: false; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error((!payload.ok && payload.error) || "Workspaces could not be loaded.");
  }

  return payload;
}
