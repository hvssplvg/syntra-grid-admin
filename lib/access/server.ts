// lib/access/server.ts
//
// Shared helpers for the employee dashboard access/permissions system.
// Grant/change/suspend/restore/revoke routes and the invite-claim flow all
// import from here rather than duplicating this logic.

import crypto from 'node:crypto';

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/app/generated/prisma/client';

export {
  mergeRoleTemplateGrants,
  mergeManualGrantsWithTemplates,
  type RoleTemplateGrantInput,
} from '@/lib/access/roleTemplateGrants';

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

/**
 * Reconciles an AdminUser's ClientAssignment rows to exactly the
 * submitted set — creates what's missing, deletes what's no longer
 * there, leaves everything else untouched. Used by the Grant/Change
 * Dashboard Access routes whenever the submitted grants include a
 * CLIENT-scoped one, so "assigned clients" always matches what the
 * administrator just configured, never a stale superset or subset.
 */
export async function reconcileClientAssignments(
  tx: Prisma.TransactionClient,
  adminUserId: string,
  clientIds: string[],
  assignedById: string,
): Promise<{ added: string[]; removed: string[] }> {
  const existing = await tx.clientAssignment.findMany({
    where: { adminUserId },
    select: { clientId: true },
  });

  const existingIds = new Set(existing.map((row) => row.clientId));
  const targetIds = new Set(clientIds);

  const added = clientIds.filter((id) => !existingIds.has(id));
  const removed = [...existingIds].filter((id) => !targetIds.has(id));

  if (removed.length > 0) {
    await tx.clientAssignment.deleteMany({
      where: { adminUserId, clientId: { in: removed } },
    });
  }

  if (added.length > 0) {
    await tx.clientAssignment.createMany({
      data: added.map((clientId) => ({ adminUserId, clientId, assignedById })),
    });
  }

  return { added, removed };
}

/**
 * Reconciles an AdminUser's AdminUserRoleTemplate rows to exactly the
 * submitted set of template ids — same create-missing/delete-removed
 * shape as reconcileClientAssignments. This is provenance/display only
 * (see AdminUserRoleTemplate's own doc comment); the actual enforced
 * permissions are the PermissionGrant rows written alongside it from the
 * already-resolved `grants` the caller submits.
 */
export async function reconcileRoleTemplateAssignments(
  tx: Prisma.TransactionClient,
  adminUserId: string,
  roleTemplateIds: string[],
  assignedById: string,
): Promise<{ added: string[]; removed: string[] }> {
  const existing = await tx.adminUserRoleTemplate.findMany({
    where: { adminUserId },
    select: { roleTemplateId: true },
  });

  const existingIds = new Set(existing.map((row) => row.roleTemplateId));
  const targetIds = new Set(roleTemplateIds);

  const added = roleTemplateIds.filter((id) => !existingIds.has(id));
  const removed = [...existingIds].filter((id) => !targetIds.has(id));

  if (removed.length > 0) {
    await tx.adminUserRoleTemplate.deleteMany({
      where: { adminUserId, roleTemplateId: { in: removed } },
    });
  }

  if (added.length > 0) {
    await tx.adminUserRoleTemplate.createMany({
      data: added.map((roleTemplateId) => ({ adminUserId, roleTemplateId, assignedById })),
    });
  }

  return { added, removed };
}
