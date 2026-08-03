import { NextResponse } from 'next/server';

import { requireFinanceAdmin } from '@/lib/auth/current-admin';
import { decryptSecret } from '@/lib/encryption';
import { getMonzoBalance } from '@/lib/monzo';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  let connectionId: string | undefined;

  try {
    const admin = await requireFinanceAdmin();

    const connection = await prisma.monzoConnection.findUnique({
      where: {
        adminUserId: admin.id,
      },
      select: {
        id: true,
        accountId: true,
        encryptedAccessToken: true,
        active: true,
      },
    });

    if (!connection?.active) {
      return NextResponse.json(
        {
          error: 'Monzo is not connected.',
        },
        {
          status: 400,
        },
      );
    }

    if (!connection.accountId) {
      return NextResponse.json(
        {
          error: 'Select the Syntra Grid Monzo Business account first.',
          needsAccountSelection: true,
        },
        {
          status: 400,
        },
      );
    }

    connectionId = connection.id;

    await prisma.monzoConnection.update({
      where: {
        id: connection.id,
      },
      data: {
        syncStatus: 'SYNCING',
      },
    });

    const accessToken = decryptSecret(
      connection.encryptedAccessToken,
    );

    const balance = await getMonzoBalance(
      accessToken,
      connection.accountId,
    );

    const now = new Date();

    await prisma.monzoConnection.update({
      where: {
        id: connection.id,
      },
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

    return NextResponse.json({
      success: true,
      balance: {
        availableBalanceMinor: balance.balance.toString(),
        totalBalanceMinor: balance.total_balance.toString(),
        currency: balance.currency,
        spendTodayMinor: balance.spend_today.toString(),
      },
    });
  } catch (error) {
    console.error('Unable to synchronise Monzo:', error);

    if (connectionId) {
      await prisma.monzoConnection
        .update({
          where: {
            id: connectionId,
          },
          data: {
            syncStatus: 'FAILED',
            lastError:
              error instanceof Error
                ? error.message
                : 'Monzo synchronisation failed.',
            lastErrorAt: new Date(),
          },
        })
        .catch(() => undefined);
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to synchronise Monzo.',
      },
      {
        status: 500,
      },
    );
  }
}