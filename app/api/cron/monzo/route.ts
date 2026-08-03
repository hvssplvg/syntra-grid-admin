// app/api/cron/monzo/route.ts
//
// Scheduled by Vercel Cron. Covers what webhooks cannot:
//   - balance changes with no transaction (pot transfers, interest)
//   - transactions that settle or decline after creation
//   - any webhook Monzo failed to deliver
//
// Add to vercel.json:
//   { "crons": [{ "path": "/api/cron/monzo", "schedule": "0 * * * *" }] }
//
// Note: Vercel's Hobby plan allows one cron run per day. Hourly needs Pro.

import { NextRequest, NextResponse } from 'next/server';

import { getMonzoBalance } from '@/lib/monzo';
import { getValidAccessToken } from '@/lib/monzo/connection';
import { syncMonzoTransactions } from '@/lib/transactions';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Vercel sends this header on scheduled invocations. Without the check the
  // route is a public endpoint anyone can hammer.
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 });
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const connections = await prisma.monzoConnection.findMany({
    where: { active: true, syncEnabled: true, accountId: { not: null } },
    select: {
      id: true,
      accountId: true,
      encryptedAccessToken: true,
      encryptedRefreshToken: true,
      accessTokenExpiresAt: true,
    },
  });

  const results: { id: string; ok: boolean; imported?: number; error?: string }[] = [];

  for (const connection of connections) {
    try {
      const accessToken = await getValidAccessToken(connection);
      const accountId = connection.accountId as string;

      const [balance, sync] = await Promise.all([
        getMonzoBalance(accessToken, accountId),
        syncMonzoTransactions({
          accessToken,
          accountId,
          connectionId: connection.id,
        }),
      ]);

      const now = new Date();

      await prisma.monzoConnection.update({
        where: { id: connection.id },
        data: {
          availableBalanceMinor: BigInt(balance.balance),
          totalBalanceMinor: BigInt(balance.total_balance),
          currency: balance.currency,
          balanceUpdatedAt: now,
          lastSyncedAt: now,
          lastSuccessfulAt: now,
          syncStatus: 'SUCCESS',
          lastError: null,
          lastErrorAt: null,
        },
      });

      results.push({ id: connection.id, ok: true, imported: sync.imported });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Scheduled Monzo sync failed.';

      console.error(`Cron sync failed for connection ${connection.id}:`, error);

      await prisma.monzoConnection
        .update({
          where: { id: connection.id },
          data: {
            syncStatus: 'FAILED',
            lastError: message,
            lastErrorAt: new Date(),
          },
        })
        .catch(() => undefined);

      results.push({ id: connection.id, ok: false, error: message });
    }
  }

  return NextResponse.json({ ran: connections.length, results });
}