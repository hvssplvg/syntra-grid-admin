import { NextResponse } from "next/server";

import {
  ClientStatus,
  DepartmentStatus,
  EmployeeStatus,
  ProjectStatus,
  WorkloadAllocationMode,
  WorkloadAllocationStatus,
  WorkloadAllocationType,
  WorkloadPriority,
  type Prisma,
} from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  requireWorkloadIdentity,
  workloadApiError,
} from "@/lib/workload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =============================================================================
 * GET /api/admin/workload/options
 * =============================================================================
 *
 * Provides everything required by the Workload UI:
 *
 * - employees
 * - departments
 * - clients
 * - projects
 * - allocation types
 * - allocation statuses
 * - priorities
 * - allocation modes
 *
 * OWNER / ADMIN:
 * - can see all eligible employees
 *
 * Other users:
 * - only receive themselves as an employee option
 * =============================================================================
 */

export async function GET() {
  try {
    const identity =
      await requireWorkloadIdentity();

    /* =========================================================================
     * EMPLOYEE VISIBILITY
     * =========================================================================
     */

    const employeeWhere: Prisma.EmployeeWhereInput =
      identity.isWorkloadManager
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
            id: identity.employee.id,
          };

    /* =========================================================================
     * LOAD OPTIONS
     * =========================================================================
     */

    const [
      employees,
      departments,
      clients,
      projects,
    ] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,

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
            firstName: "asc",
          },
          {
            lastName: "asc",
          },
        ],
      }),

      prisma.department.findMany({
        where: {
          status: DepartmentStatus.ACTIVE,
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
            displayOrder: "asc",
          },
          {
            name: "asc",
          },
        ],
      }),

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
          name: "asc",
        },
      }),

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
              name: "asc",
            },
          },
          {
            name: "asc",
          },
        ],
      }),
    ]);

    /* =========================================================================
     * RESPONSE
     * =========================================================================
     */

    return NextResponse.json({
      viewer: {
        adminId:
          identity.admin.id,

        employeeId:
          identity.employee.id,

        role:
          identity.admin.role,

        isWorkloadManager:
          identity.isWorkloadManager,
      },

      employees:
        employees.map((employee) => {
          const preferredName =
            employee.preferredName?.trim();

          const fullName =
            [
              employee.firstName,
              employee.lastName,
            ]
              .filter(Boolean)
              .join(" ")
              .trim();

          return {
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
              preferredName ||
              fullName,

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
              employee.department
                ? {
                    id:
                      employee.department.id,

                    name:
                      employee.department.name,

                    colour:
                      employee.department.colour,
                  }
                : null,
          };
        }),

      departments:
        departments.map((department) => ({
          id:
            department.id,

          name:
            department.name,

          slug:
            department.slug,

          code:
            department.code,

          colour:
            department.colour,
        })),

      clients:
        clients.map((client) => ({
          id:
            client.id,

          name:
            client.name,

          displayName:
            client.displayName,

          clientRef:
            client.clientRef,

          logoUrl:
            client.logoUrl,

          status:
            client.status,

          priority:
            client.priority,
        })),

      projects:
        projects.map((project) => ({
          id:
            project.id,

          clientId:
            project.clientId,

          name:
            project.name,

          slug:
            project.slug,

          category:
            project.category,

          status:
            project.status,

          client:
            project.client,
        })),

      enums: {
        allocationTypes:
          Object.values(
            WorkloadAllocationType,
          ),

        allocationStatuses:
          Object.values(
            WorkloadAllocationStatus,
          ),

        priorities:
          Object.values(
            WorkloadPriority,
          ),

        allocationModes:
          Object.values(
            WorkloadAllocationMode,
          ),
      },
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/workload/options]",
      error,
    );

    const result =
      workloadApiError(error);

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