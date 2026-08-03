// lib/monzo/webhooks.ts
//
// Monzo pushes transaction.created events to a URL you register per account.
//
// Monzo does NOT sign webhook payloads, so the only protection is that the URL
// itself is unguessable. MONZO_WEBHOOK_SECRET forms part of the path and must
// be a long random string:
//
//   openssl rand -hex 32
//
// Treat it like a password. If it leaks, rotate it and re-register.

const MONZO_API_URL = 'https://api.monzo.com';

export type MonzoWebhook = {
  id: string;
  account_id: string;
  url: string;
};

function webhookSecret(): string {
  const secret = process.env.MONZO_WEBHOOK_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error(
      'MONZO_WEBHOOK_SECRET must be set to a random string of at least 32 characters.',
    );
  }

  return secret;
}

/** The public URL Monzo will POST to. Must be https and publicly reachable. */
export function webhookUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');

  if (!base) {
    throw new Error('NEXT_PUBLIC_APP_URL is not configured.');
  }

  return `${base}/api/monzo/webhook/${webhookSecret()}`;
}

export function isValidWebhookSecret(candidate: string): boolean {
  const expected = webhookSecret();

  // Constant-time-ish: compare full length regardless of where they diverge.
  if (candidate.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
  }

  return mismatch === 0;
}

async function monzoJson<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${fallback} Monzo returned invalid JSON.`);
  }

  if (!response.ok) {
    const error = parsed as { message?: string; error_description?: string };
    throw new Error(error.error_description || error.message || fallback);
  }

  return parsed as T;
}

export async function listMonzoWebhooks(
  accessToken: string,
  accountId: string,
): Promise<MonzoWebhook[]> {
  const url = new URL(`${MONZO_API_URL}/webhooks`);
  url.searchParams.set('account_id', accountId);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  const result = await monzoJson<{ webhooks: MonzoWebhook[] }>(
    response,
    'Unable to list Monzo webhooks.',
  );

  return result.webhooks ?? [];
}

export async function deleteMonzoWebhook(accessToken: string, webhookId: string) {
  await fetch(`${MONZO_API_URL}/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
}

/**
 * Registers the webhook, removing any stale ones pointing at this app first.
 * Monzo happily accepts duplicates and will then deliver each event twice.
 */
export async function ensureMonzoWebhook(
  accessToken: string,
  accountId: string,
): Promise<MonzoWebhook> {
  const target = webhookUrl();
  const existing = await listMonzoWebhooks(accessToken, accountId);

  const alreadyCorrect = existing.find((hook) => hook.url === target);
  if (alreadyCorrect) return alreadyCorrect;

  // Clear out webhooks from an old deployment URL or a rotated secret.
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ?? '';

  for (const hook of existing) {
    if (hook.url.startsWith(`${base}/api/monzo/webhook/`)) {
      await deleteMonzoWebhook(accessToken, hook.id);
    }
  }

  const body = new URLSearchParams({ account_id: accountId, url: target });

  const response = await fetch(`${MONZO_API_URL}/webhooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });

  const result = await monzoJson<{ webhook: MonzoWebhook }>(
    response,
    'Unable to register the Monzo webhook.',
  );

  return result.webhook;
}