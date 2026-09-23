import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  EmployeeStatus,
  EmploymentType,
  WorkArrangement,
} from '@/app/generated/prisma/enums';

import {
  requireAdmin,
} from '@/lib/auth/current-admin';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/* ============================================================================
   HELPERS
============================================================================ */

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

function getErrorStatus(
  error: unknown,
): number {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : '';

  if (
    message.includes(
      'unauthorized',
    )
  ) {
    return 401;
  }

  if (
    message.includes(
      'forbidden',
    )
  ) {
    return 403;
  }

  return 500;
}

/* ============================================================================
   GET /api/admin/team/options

   Provides browser-safe option data used by the Team UI for:
   - departments
   - managers
   - available admin/system accounts
   - employee statuses
   - employment types
   - work arrangements
============================================================================ */

export async function GET(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _request: NextRequest,
) {
  try {
    await requireAdmin();

    /*
     * First find AdminUser accounts that are already attached
     * to an Employee.
     *
     * We intentionally query Employee directly rather than relying
     * on the reverse AdminUser.employee relation in a filter.
     *
     * This keeps this endpoint simple and avoids coupling the query
     * to reverse relation naming.
     */
    const linkedEmployees =
      await prisma.employee.findMany({
        where: {
          adminUserId: {
            not: null,
          },
        },

        select: {
          adminUserId: true,
        },
      });

    const linkedAdminUserIds =
      linkedEmployees
        .map(
          (employee) =>
            employee.adminUserId,
        )
        .filter(
          (
            id,
          ): id is string =>
            Boolean(id),
        );

    const [
      departments,
      managers,
      adminUsers,
    ] =
      await prisma.$transaction([
        /* --------------------------------------------------------------------
           DEPARTMENTS
        -------------------------------------------------------------------- */

        prisma.department.findMany({
          where: {
            status: {
              not: 'ARCHIVED',
            },
          },

          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            icon: true,
            colour: true,
            status: true,
          },

          orderBy: [
            {
              displayOrder:
                'asc',
            },
            {
              name: 'asc',
            },
          ],
        }),

        /* --------------------------------------------------------------------
           MANAGERS
        -------------------------------------------------------------------- */

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
            employeeRef: true,

            firstName: true,
            lastName: true,
            preferredName: true,

            avatarUrl: true,

            jobTitle: true,
            status: true,

            department: {
              select: {
                id: true,
                name: true,
                slug: true,
                colour: true,
              },
            },
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

        /* --------------------------------------------------------------------
           AVAILABLE SYSTEM ACCOUNTS

           Only active AdminUser records that are not already attached
           to an Employee are returned.

           When there are no linked AdminUsers, we omit the id filter.
        -------------------------------------------------------------------- */

        prisma.adminUser.findMany({
          where: {
            active: true,

            ...(linkedAdminUserIds.length
              ? {
                  id: {
                    notIn:
                      linkedAdminUserIds,
                  },
                }
              : {}),
          },

          select: {
            id: true,
            email: true,

            firstName: true,
            lastName: true,

            avatarUrl: true,

            role: true,
            active: true,
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
      ]);

    /* ------------------------------------------------------------------------
       RESPONSE
    ------------------------------------------------------------------------ */

    return NextResponse.json({
      ok: true,

      departments,
      managers,
      adminUsers,

      enums: {
        employeeStatuses:
          Object.values(
            EmployeeStatus,
          ),

        employmentTypes:
          Object.values(
            EmploymentType,
          ),

        workArrangements:
          Object.values(
            WorkArrangement,
          ),
      },

      counts: {
        departments:
          departments.length,

        managers:
          managers.length,

        availableAdminUsers:
          adminUsers.length,
      },
    });
  } catch (error) {
    console.error(
      'GET /api/admin/team/options failed:',
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          getErrorMessage(
            error,
            'Could not load team options.',
          ),
      },
      {
        status:
          getErrorStatus(
            error,
          ),
      },
    );
  }
}