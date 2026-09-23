import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/current-admin';

import { DepartmentStatus } from '@/app/generated/prisma/enums';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();

    const [people, departments] =
      await prisma.$transaction([
        prisma.adminUser.findMany({
          where: {
            active: true,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            role: true,
            departmentId: true,
          },
          orderBy: [
            {
              firstName: 'asc',
            },
            {
              lastName: 'asc',
            },
            {
              email: 'asc',
            },
          ],
        }),

        prisma.department.findMany({
          where: {
            status: {
              not:
                DepartmentStatus.ARCHIVED,
            },
          },
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            status: true,
            parentId: true,
            displayOrder: true,
          },
          orderBy: [
            {
              displayOrder: 'asc',
            },
            {
              name: 'asc',
            },
          ],
        }),
      ]);

    return NextResponse.json({
      ok: true,

      leads: people,

      departments,

      statuses: Object.values(
        DepartmentStatus,
      ),
    });
  } catch (error) {
    console.error(
      'GET /api/admin/departments/options failed:',
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : 'Could not load department options.';

    const status =
      message.toLowerCase().includes('unauthorized')
        ? 401
        : message.toLowerCase().includes('forbidden')
          ? 403
          : 500;

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status },
    );
  }
}