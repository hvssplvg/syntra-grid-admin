import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  ClientStatus,
  EmployeeStatus,
  ProjectStatus,
  TimesheetEntryType,
  TimesheetStatus,
  WorkloadAllocationStatus,
} from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  requireTimesheetIdentity,
  timesheetApiError,
} from "@/lib/timesheets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =============================================================================
 * GET /api/admin/timesheets/options
 * =============================================================================
 *
 * Supplies everything required by Timesheets forms and filters:
 *
 * - employees
 * - departments
 * - clients
 * - projects
 * - workload allocations
 * - timesheet statuses
 * - entry types
 *
 * Optional:
 *
 * ?employeeId=...
 *
 * When employeeId is supplied, workload allocations are restricted to that
 * employee.
 * =============================================================================
 */

export async function GET(
  request: NextRequest,
) {
  try {
    const identity =
      await requireTimesheetIdentity();

    const searchParams =
      request.nextUrl.searchParams;

    const requestedEmployeeId =
      cleanOptionalParam(
        searchParams.get(
          "employeeId",
        ),
      );

    /*
     * Normal employees can only retrieve options for themselves.
     *
     * OWNER / ADMIN can retrieve options for any employee.
     */
    const allocationEmployeeId =
      identity.isTimesheetManager
        ? requestedEmployeeId
        : identity.employee.id;

    const employeeWhere =
      identity.isTimesheetManager
        ? {
            status: {
              in: [
                EmployeeStatus.ONBOARDING,
                EmployeeStatus.ACTIVE,
                EmployeeStatus.ON_LEAVE,
              ],
            },
          }
        : {
            id:
              identity.employee.id,
          };

    const [
      employees,
      departments,
      clients,
      projects,
      allocations,
    ] =
      await Promise.all([
        /* =====================================================================
         * EMPLOYEES
         * =====================================================================
         */

        prisma.employee.findMany({
          where:
            employeeWhere,

          select: {
            id: true,
            employeeRef: true,

            firstName: true,
            lastName: true,
            preferredName: true,

            avatarUrl: true,
            jobTitle: true,

            status: true,
            employmentType: true,

            departmentId: true,

            department: {
              select: {
                id: true,
                name: true,
                colour: true,
              },
            },
          },

          orderBy: [
            {
              firstName:
                "asc",
            },
            {
              lastName:
                "asc",
            },
          ],
        }),

        /* =====================================================================
         * DEPARTMENTS
         * =====================================================================
         */

        prisma.department.findMany({
          where: {
            status:
              "ACTIVE",
          },

          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            colour: true,
          },

          orderBy: [
            {
              displayOrder:
                "asc",
            },
            {
              name:
                "asc",
            },
          ],
        }),

        /* =====================================================================
         * CLIENTS
         * =====================================================================
         */

        prisma.client.findMany({
          where: {
            status: {
              in: [
                ClientStatus.ONBOARDING,
                ClientStatus.ACTIVE,
              ],
            },
          },

          select: {
            id: true,
            name: true,
            displayName: true,
            clientRef: true,
            logoUrl: true,
            status: true,
            priority: true,
          },

          orderBy: {
            name:
              "asc",
          },
        }),

        /* =====================================================================
         * PROJECTS
         * =====================================================================
         */

        prisma.project.findMany({
          where: {
            status: {
              in: [
                ProjectStatus.DEVELOPMENT,
                ProjectStatus.TESTING,
                ProjectStatus.ACTIVE,
                ProjectStatus.MAINTENANCE,
              ],
            },
          },

          select: {
            id: true,
            clientId: true,

            name: true,
            slug: true,

            category: true,
            status: true,

            client: {
              select: {
                id: true,
                name: true,
                displayName: true,
              },
            },
          },

          orderBy: [
            {
              client: {
                name:
                  "asc",
              },
            },
            {
              name:
                "asc",
            },
          ],
        }),

        /* =====================================================================
         * WORKLOAD ALLOCATIONS
         * =====================================================================
         */

        prisma.workloadAllocation.findMany({
          where: {
            ...(allocationEmployeeId
              ? {
                  employeeId:
                    allocationEmployeeId,
                }
              : {}),

            status: {
              in: [
                WorkloadAllocationStatus.PLANNED,
                WorkloadAllocationStatus.CONFIRMED,
                WorkloadAllocationStatus.ACTIVE,
                WorkloadAllocationStatus.ON_HOLD,
              ],
            },
          },

          select: {
            id: true,

            employeeId: true,

            departmentId: true,
            clientId: true,
            projectId: true,

            title: true,
            description: true,

            type: true,
            status: true,
            priority: true,

            startDate: true,
            endDate: true,

            allocationMode:
              true,

            hoursPerWeek:
              true,

            allocationPercent:
              true,

            budgetHours:
              true,

            billable: true,

            employee: {
              select: {
                id: true,

                firstName:
                  true,

                lastName:
                  true,

                preferredName:
                  true,
              },
            },

            client: {
              select: {
                id: true,
                name: true,
                displayName:
                  true,
              },
            },

            project: {
              select: {
                id: true,
                name: true,
                clientId: true,
              },
            },
          },

          orderBy: [
            {
              startDate:
                "desc",
            },
            {
              title:
                "asc",
            },
          ],
        }),
      ]);

    return NextResponse.json({
      viewer: {
        adminId:
          identity.admin.id,

        employeeId:
          identity.employee.id,

        role:
          identity.admin.role,

        isTimesheetManager:
          identity.isTimesheetManager,
      },

      employees:
        employees.map(
          (employee) => ({
            id:
              employee.id,

            employeeRef:
              employee.employeeRef,

            firstName:
              employee.firstName,

            lastName:
              employee.lastName,

            preferredName:
              employee.preferredName,

            name:
              employee.preferredName?.trim() ||
              [
                employee.firstName,
                employee.lastName,
              ]
                .filter(Boolean)
                .join(" ")
                .trim(),

            avatarUrl:
              employee.avatarUrl,

            jobTitle:
              employee.jobTitle,

            status:
              employee.status,

            employmentType:
              employee.employmentType,

            departmentId:
              employee.departmentId,

            department:
              employee.department,
          }),
        ),

      departments,

      clients,

      projects,

      allocations:
        allocations.map(
          (allocation) => ({
            id:
              allocation.id,

            employeeId:
              allocation.employeeId,

            employee: {
              id:
                allocation.employee.id,

              name:
                allocation.employee.preferredName?.trim() ||
                [
                  allocation.employee.firstName,
                  allocation.employee.lastName,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .trim(),
            },

            departmentId:
              allocation.departmentId,

            clientId:
              allocation.clientId,

            projectId:
              allocation.projectId,

            title:
              allocation.title,

            description:
              allocation.description,

            type:
              allocation.type,

            status:
              allocation.status,

            priority:
              allocation.priority,

            startDate:
              allocation.startDate.toISOString(),

            endDate:
              allocation.endDate.toISOString(),

            allocationMode:
              allocation.allocationMode,

            hoursPerWeek:
              allocation.hoursPerWeek ===
              null
                ? null
                : Number(
                    allocation.hoursPerWeek,
                  ),

            allocationPercent:
              allocation.allocationPercent ===
              null
                ? null
                : Number(
                    allocation.allocationPercent,
                  ),

            budgetHours:
              allocation.budgetHours ===
              null
                ? null
                : Number(
                    allocation.budgetHours,
                  ),

            billable:
              allocation.billable,

            client:
              allocation.client,

            project:
              allocation.project,
          }),
        ),

      enums: {
        statuses:
          Object.values(
            TimesheetStatus,
          ),

        entryTypes:
          Object.values(
            TimesheetEntryType,
          ),
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/timesheets/options]",
      error,
    );

    const result =
      timesheetApiError(
        error,
      );

    return NextResponse.json(
      {
        error:
          result.message,
      },
      {
        status:
          result.status,
      },
    );
  }
}

/* =============================================================================
 * HELPERS
 * =============================================================================
 */

function cleanOptionalParam(
  value: string | null,
): string | null {
  const result =
    value?.trim();

  return result || null;
}