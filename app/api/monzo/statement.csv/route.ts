// app/api/monzo/statement.csv/route.ts
//
// GET /api/monzo/statement.csv?month=2026-07
//
// Downloads a month as CSV. Amounts are signed decimals rather than minor
// units, because this is going to a human or an accounting package.

import { NextRequest } from 'next/server';

import { requireFinanceAdmin } from '@/lib/auth/current-admin';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function monthRange(month: string | null) {
  const now = new Date();
  const parsed = month?.match(/^(\d{4})-(\d{2})$/);

  const year = parsed ? Number(parsed[1]) : now.getFullYear();
  const index = parsed ? Number(parsed[2]) - 1 : now.getMonth();

  return {
    start: new Date(year, index, 1),
    end: new Date(year, index + 1, 1),
    key: `${year}-${String(index + 1).padStart(2, '0')}`,
  };
}

/** Wrap every field — descriptions routinely contain commas. */
function cell(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const admin = await requireFinanceAdmin();

  const connection = await prisma.monzoConnection.findUnique({
    where: { adminUserId: admin.id },
    select: { id: true },
  });

  if (!connection) {
    return new Response('No Monzo account connected.', { status: 400 });
  }

  const { start, end, key } = monthRange(request.nextUrl.searchParams.get('month'));

  const rows = await prisma.monzoTransaction.findMany({
    where: {
      monzoConnectionId: connection.id,
      createdAtMonzo: { gte: start, lt: end },
    },
    orderBy: { createdAtMonzo: 'asc' },
    select: {
      createdAtMonzo: true,
      settledAt: true,
      direction: true,
      amountMinor: true,
      currency: true,
      description: true,
      merchantName: true,
      counterpartyName: true,
      category: true,
      status: true,
      notes: true,
      matchStatus: true,
      matchedInvoice: { select: { invoiceRef: true } },
    },
  });

  const header = [
    'Date',
    'Settled',
    'Name',
    'Description',
    'Category',
    'Amount',
    'Currency',
    'Status',
    'Notes',
    'Matched invoice',
  ];

  const body = rows.map((row) => {
    // Signed so a spreadsheet sums the column correctly.
    const amount =
      (row.direction === 'DEBIT' ? -1 : 1) * (Number(row.amountMinor) / 100);

    return [
      cell(row.createdAtMonzo.toISOString()),
      cell(row.settledAt?.toISOString() ?? ''),
      cell(row.merchantName || row.counterpartyName || ''),
      cell(row.description ?? ''),
      cell(row.category ?? ''),
      cell(amount.toFixed(2)),
      cell(row.currency),
      cell(row.status),
      cell(row.notes ?? ''),
      cell(row.matchedInvoice?.invoiceRef ?? ''),
    ].join(',');
  });

  // BOM so Excel opens UTF-8 correctly — merchant names carry accents.
  const csv = '\uFEFF' + [header.map(cell).join(','), ...body].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="syntragrid-statement-${key}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}