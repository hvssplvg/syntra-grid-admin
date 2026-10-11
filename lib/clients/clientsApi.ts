/*
  Shared SWR key + fetcher for GET /api/admin/clients.

  AdminHeader (workspace switcher) and ClientsTab both read this endpoint.
  Using the same key + fetcher here lets SWR dedupe and share one cached
  response between them instead of each firing its own request.
*/

export const CLIENTS_ENDPOINT = '/api/admin/clients';

export type ClientsListMeta = {
  total: number;
  active: number;
  onboarding: number;
  archived: number;
};

export type ClientsApiPayload = {
  ok: true;
  clients: Array<Record<string, unknown>>;
  meta: ClientsListMeta;
};

export async function fetchClientsPayload(url: string): Promise<ClientsApiPayload> {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  const payload = (await response.json().catch(() => ({ ok: false }))) as
    | ClientsApiPayload
    | { ok: false; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(
      (!payload.ok && payload.error) || 'Clients could not be loaded.',
    );
  }

  return payload;
}
