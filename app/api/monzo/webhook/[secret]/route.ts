// app/api/monzo/webhook/[secret]/route.ts
//
// Monzo POSTs here when a transaction is created. There is no signature to
// verify — Monzo does not sign webhooks — so the secret in the path is the
// only gate.
//
// Rather than parsing the payload and writing it directly, this triggers the
// normal incremental sync. Slightly more work per event, but one code path
// writes MonzoTransaction rows, so webhook and manual sync can never disagree.

import { NextRequest, NextResponse } from 'next/server';

import { getValidAccessToken } from '@/lib/monzo/connection';
import { syncMonzoTransactions } from '@/lib/transactions';
import { isValidWebhookSecret } from '@/lib/monzo/webhooks';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WebhookBody = {
  type?: string;
  data?: { account_id?: string; id?: string };
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params;

  if (!isValidWebhookSecret(secret)) {
    // Deliberately vague — do not confirm the endpoint exists.
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  let body: WebhookBody;

  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  if (body.type !== 'transaction.created') {
    // Acknowledge anything else so Monzo does not retry.
    return NextResponse.json({ ignored: true });
  }

  const accountId = body.data?.account_id;

  if (!accountId) {
    return NextResponse.json({ ignored: true });
  }

  try {
    const connection = await prisma.monzoConnection.findFirst({
      where: { accountId, active: true },
      select: {
        id: true,
        accountId: true,
        encryptedAccessToken: true,
        encryptedRefreshToken: true,
        accessTokenExpiresAt: true,
      },
    });

    if (!connection?.accountId) {
      return NextResponse.json({ ignored: true });
    }

    const accessToken = await getValidAccessToken(connection);

    await syncMonzoTransactions({
      accessToken,
      accountId: connection.accountId,
      connectionId: connection.id,
    });

    await prisma.monzoConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date(), lastSuccessfulAt: new Date() },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Monzo webhook handling failed:', error);

    // 200 on purpose. Monzo retries on failure, and a retry storm will not fix
    // a bad token — the cron job will catch anything missed.
    return NextResponse.json({ received: true, deferred: true });
  }
}