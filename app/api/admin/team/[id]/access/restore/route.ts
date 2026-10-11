import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  AuthenticationError,
  AuthorisationError,
  requireTeamManager,
} from '@/lib/auth/current-admin';
import { EmployeeStatus } from '@/app/generated/prisma/enums';

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
        status: true,
        adminUser: { select: { id: true, active: true } },
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

    if (employee.status === EmployeeStatus.FORMER) {
      return NextResponse.json(
        { ok: false, error: 'This employee has been offboarded. Re-onboard them before restoring access.' },
        { status: 409 },
      );
    }

    const adminUserId = employee.adminUser.id;

    await prisma.adminUser.update({
      where: { id: adminUserId },
      data: { active: true },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'ACCESS_RESTORED',
        entityType: 'Employee',
        entityId: employee.id,
        metadata: { adminUserId },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/admin/team/[id]/access/restore failed:', error);

    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, 'Could not restore dashboard access.') },
      { status: getErrorStatus(error) },
    );
  }
}
