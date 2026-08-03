// lib/monzo/connection.ts
//
// One place that knows how to get a usable Monzo access token.
//
// Monzo access tokens are short-lived (roughly 6 hours). Every route that
// calls the API needs a fresh one, and refreshing invalidates the old token —
// so this must be the only place that does it.

import { decryptSecret, encryptSecret } from '@/lib/encryption';
import { refreshMonzoAccessToken } from '@/lib/monzo';
import { prisma } from '@/lib/prisma';

/** Refresh this long before actual expiry, so a slow request can't race it. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export class MonzoNotConnectedError extends Error {
  constructor(message = 'Monzo is not connected.') {
    super(message);
    this.name = 'MonzoNotConnectedError';
  }
}

export class MonzoReauthorisationRequiredError extends Error {
  constructor(
    message = 'The Monzo connection has expired. Reconnect to continue.',
  ) {
    super(message);
    this.name = 'MonzoReauthorisationRequiredError';
  }
}

export async function getMonzoConnection(adminUserId: string) {
  return prisma.monzoConnection.findUnique({
    where: { adminUserId },
  });
}

/**
 * Returns a valid access token, refreshing it first if it is close to expiry.
 * Throws MonzoReauthorisationRequiredError when the refresh fails — the only
 * cure for that is sending the admin back through OAuth.
 */
export async function getValidAccessToken(connection: {
  id: string;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  accessTokenExpiresAt: Date;
}): Promise<string> {
  const expiresSoon =
    connection.accessTokenExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;

  if (!expiresSoon) {
    return decryptSecret(connection.encryptedAccessToken);
  }

  if (!connection.encryptedRefreshToken) {
    // Non-confidential Monzo clients get no refresh token at all.
    await markReauthorisationRequired(connection.id);
    throw new MonzoReauthorisationRequiredError();
  }

  try {
    const refreshed = await refreshMonzoAccessToken(
      decryptSecret(connection.encryptedRefreshToken),
    );

    await prisma.monzoConnection.update({
      where: { id: connection.id },
      data: {
        encryptedAccessToken: encryptSecret(refreshed.access_token),
        encryptedRefreshToken: encryptSecret(refreshed.refresh_token),
        accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        lastError: null,
        lastErrorAt: null,
      },
    });

    return refreshed.access_token;
  } catch (error) {
    console.error('Monzo token refresh failed:', error);
    await markReauthorisationRequired(connection.id);
    throw new MonzoReauthorisationRequiredError();
  }
}

async function markReauthorisationRequired(connectionId: string) {
  await prisma.monzoConnection
    .update({
      where: { id: connectionId },
      data: {
        syncStatus: 'FAILED',
        lastError: 'The Monzo connection expired and must be reauthorised.',
        lastErrorAt: new Date(),
      },
    })
    .catch(() => undefined);
}

/**
 * Monzo returns 403 until the user taps approve in the Monzo app. That is a
 * different problem from a bad token, so it gets its own message.
 */
export function describeMonzoError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/forbidden|insufficient|permission/i.test(message)) {
    return 'Monzo has not been approved yet. Open the Monzo app, approve the Syntra Grid request, then try again.';
  }

  return message || 'The Monzo request failed.';
}