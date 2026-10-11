// lib/access/server.ts
//
// Shared helpers for the employee dashboard access/permissions system.
// Grant/change/suspend/restore/revoke routes and the invite-claim flow all
// import from here rather than duplicating this logic.

import crypto from 'node:crypto';

import { prisma } from '@/lib/prisma';

/** Refuse to leave the account with nobody able to manage it. Ported from
 * app/(dashboard)/team/actions.ts so both the legacy and the new access
 * flows apply the exact same "last owner" guard. */
export async function assertNotLastOwner(adminUserId: string) {
  const target = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  });

  if (target?.role !== 'OWNER') return;

  const owners = await prisma.adminUser.count({
    where: { role: 'OWNER', active: true },
  });

  if (owners <= 1) {
    throw new Error('There must always be at least one active owner.');
  }
}

/**
 * One-time invite tokens. The raw token is only ever returned once, in the
 * Grant Access response, and is never persisted anywhere — only its SHA-256
 * hash is stored, so a database read alone can never recover a usable link.
 */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
