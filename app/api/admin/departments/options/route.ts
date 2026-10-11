import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/current-admin';

import {
  DepartmentStatus,
  EmployeeStatus,
} from '@/app/generated/prisma/enums';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();

    const [people, departments] =
      await prisma.$transaction([
        // Department leads are chosen from employees, not dashboard
        // (AdminUser) accounts, so a lead can be assigned whether or not
        // they ever sign in to Syntra Grid.
        prisma.employee.findMany({
          where: {
            status: {
              notIn: [
                EmployeeStatus.FORMER,
                EmployeeStatus.OFFBOARDING,
              ],
            },
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            preferredName: true,
            workEmail: true,
            avatarUrl: true,
            jobTitle: true,
            status: true,
            departmentId: true,
          },
          orderBy: [
            {
              firstName: 'asc',
            },
            {
              lastName: 'asc',
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