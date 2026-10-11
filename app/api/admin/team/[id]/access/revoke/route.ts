import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  AuthenticationError,
  AuthorisationError,
  requireTeamManager,
} from '@/lib/auth/current-admin';
import { assertNotLastOwner } from '@/lib/access/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getErrorStatus(error: unknown): number {
  if (error instanceof AuthenticationError) return 401;
  if (error instanceof AuthorisationError) return 403;
  return 500;
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireTeamManager();
    const { id } = await context.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        adminUser: { select: { id: true, role: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ ok: false, error: 'Employee not found.' }, { status: 404 });
    }

    if (!employee.adminUser) {
      return NextResponse.json(
        { ok: false, error: 'This employee does not have dashboard access.' },
        { status: 409 },
      );
    }

    const adminUserId = employee.adminUser.id;

    // Hard block, independent of the last-owner count: this endpoint never
    // revokes an Owner's access. A role change away from OWNER (which does
    // apply the last-owner guard) must happen first, deliberately, via
    // Change Permissions.
    if (employee.adminUser.role === 'OWNER') {
      return NextResponse.json(
        { ok: false, error: 'An owner\'s access cannot be revoked here.' },
        { status: 403 },
      );
    }

    await assertNotLastOwner(adminUserId);

    await prisma.$transaction([
      prisma.employee.update({
        where: { id },
        data: { adminUser: { disconnect: true } },
      }),
      prisma.adminUser.update({
        where: { id: adminUserId },
        data: { active: false },
      }),
      prisma.permissionGrant.deleteMany({ where: { adminUserId } }),
      prisma.accessInvite.deleteMany({ where: { adminUserId } }),
    ]);

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'ACCESS_REVOKED',
        entityType: 'Employee',
        entityId: employee.id,
        metadata: { adminUserId },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/admin/team/[id]/access/revoke failed:', error);

    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, 'Could not revoke dashboard access.') },
      { status: getErrorStatus(error) },
    );
  }
}
