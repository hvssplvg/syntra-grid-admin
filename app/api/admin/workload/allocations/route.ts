import { NextRequest, NextResponse } from "next/server";

import {
  WorkloadAllocationMode,
  WorkloadAllocationStatus,
  WorkloadAllocationType,
  WorkloadPriority,
  type Prisma,
} from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  assertCanManageWorkload,
  requireWorkloadEmployee,
  requireWorkloadIdentity,
  resolveWorkloadContext,
  validateAllocationValues,
  workloadApiError,
} from "@/lib/workload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type CreateAllocationBody = {
  employeeId?: unknown;

  departmentId?: unknown;
  clientId?: unknown;
  projectId?: unknown;

  title?: unknown;
  description?: unknown;

  type?: unknown;
  status?: unknown;
  priority?: unknown;

  startDate?: unknown;
  endDate?: unknown;

  allocationMode?: unknown;

  hoursPerWeek?: unknown;
  allocationPercent?: unknown;

  budgetHours?: unknown;

  billable?: unknown;

  notes?: unknown;
};

/* =============================================================================
 * GET /api/admin/workload/allocations
 * =============================================================================
 */

export async function GET(request: NextRequest) {
  try {
    const identity = await requireWorkloadIdentity();

    const params = request.nextUrl.searchParams;

    const requestedEmployeeId = cleanString(
      params.get("employeeId"),
    );

    const departmentId = cleanString(
      params.get("departmentId"),
    );

    const clientId = cleanString(
      params.get("clientId"),
    );

    const projectId = cleanString(
      params.get("projectId"),
    );

    const status = optionalEnum(
      params.get("status"),
      WorkloadAllocationStatus,
      "Allocation status",
    );

    const type = optionalEnum(
      params.get("type"),
      WorkloadAllocationType,
      "Allocation type",
    );

    const priority = optionalEnum(
      params.get("priority"),
      WorkloadPriority,
      "Priority",
    );

    const start = optionalDateQuery(
      params.get("start"),
      "Start date",
    );

    const endExclusive = optionalDateQuery(
      params.get("end"),
      "End date",
    );

    if (
      start &&
      endExclusive &&
      endExclusive <= start
    ) {
      throw new Error(
        "The end date must be after the start date.",
      );
    }

    /*
     * Non-managers only receive their own allocations.
     */
    const employeeId = identity.isWorkloadManager
      ? requestedEmployeeId
      : identity.employee.id;

    const where: Prisma.WorkloadAllocationWhereInput = {
      ...(employeeId
        ? {
            employeeId,
          }
        : {}),

      ...(departmentId
        ? {
            departmentId,
          }
        : {}),

      ...(clientId
        ? {
            clientId,
          }
        : {}),

      ...(projectId
        ? {
            projectId,
          }
        : {}),

      ...(status
        ? {
            status,
          }
        : {}),

      ...(type
        ? {
            type,
          }
        : {}),

      ...(priority
        ? {
            priority,
          }
        : {}),

      /*
       * Allocation dates are inclusive.
       *
       * API filter end is exclusive.
       */
      ...(start || endExclusive
        ? {
            AND: [
              ...(endExclusive
                ? [
                    {
                      startDate: {
                        lt: endExclusive,
                      },
                    },
                  ]
                : []),

              ...(start
                ? [
                    {
                      endDate: {
                        gte: start,
                      },
                    },
                  ]
                : []),
            ],
          }
        : {}),
    };

    const allocations =
      await prisma.workloadAllocation.findMany({
        where,

        include: {
          employee: {
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
                  colour: true,
                },
              },
            },
          },

          department: {
            select: {
              id: true,
              name: true,
              colour: true,
            },
          },

          client: {
            select: {
              id: true,
              name: true,
              displayName: true,
              clientRef: true,
              logoUrl: true,
            },
          },

          project: {
            select: {
              id: true,
              clientId: true,
              name: true,
              slug: true,
              category: true,
              status: true,
            },
          },

          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },

          updatedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },

          timesheetEntries: {
            ...(start || endExclusive
              ? {
                  where: {
                    ...(start || endExclusive
                      ? {
                          workDate: {
                            ...(start
                              ? {
                                  gte: start,
                                }
                              : {}),

                            ...(endExclusive
                              ? {
                                  lt: endExclusive,
                                }
                              : {}),
                          },
                        }
                      : {}),
                  },
                }
              : {}),

            select: {
              hours: true,
              billable: true,
            },
          },
        },

        orderBy: [
          {
            startDate: "asc",
          },
          {
            priority: "desc",
          },
          {
            title: "asc",
          },
        ],
      });

    return NextResponse.json({
      viewer: {
        adminId: identity.admin.id,
        employeeId: identity.employee.id,
        role: identity.admin.role,
        isWorkloadManager: identity.isWorkloadManager,
      },

      allocations: allocations.map((allocation) =>
        serialiseAllocation(
          allocation,
          identity.isWorkloadManager,
        ),
      ),
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/workload/allocations]",
      error,
    );

    const result = workloadApiError(error);

    return NextResponse.json(
      {
        error: result.message,
      },
      {
        status: result.status,
      },
    );
  }
}

/* =============================================================================
 * POST /api/admin/workload/allocations
 * =============================================================================
 */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireWorkloadIdentity();

    assertCanManageWorkload(identity);

    const body =
      (await request.json()) as CreateAllocationBody;

    /* =========================================================================
     * EMPLOYEE
     * =========================================================================
     */

    const employeeId = requiredString(
      body.employeeId,
      "Employee",
    );

    const employee =
      await requireWorkloadEmployee(employeeId);

    /* =========================================================================
     * CORE FIELDS
     * =========================================================================
     */

    const title = requiredString(
      body.title,
      "Title",
    );

    const description = nullableString(
      body.description,
      "Description",
    );

    const type = enumValue(
      body.type ?? WorkloadAllocationType.PROJECT,
      WorkloadAllocationType,
      "Allocation type",
    );

    const status = enumValue(
      body.status ?? WorkloadAllocationStatus.PLANNED,
      WorkloadAllocationStatus,
      "Allocation status",
    );

    const priority = enumValue(
      body.priority ?? WorkloadPriority.NORMAL,
      WorkloadPriority,
      "Priority",
    );

    const allocationMode = enumValue(
      body.allocationMode ?? WorkloadAllocationMode.HOURS,
      WorkloadAllocationMode,
      "Allocation mode",
    );

    /* =========================================================================
     * DATES
     * =========================================================================
     */

    const startDate = requiredDate(
      body.startDate,
      "Start date",
    );

    const endDate = requiredDate(
      body.endDate,
      "End date",
    );

    if (endDate < startDate) {
      throw new Error(
        "The allocation end date cannot be before its start date.",
      );
    }

    /* =========================================================================
     * CONTEXT
     * =========================================================================
     */

    const context = await resolveWorkloadContext({
      departmentId: nullableId(body.departmentId),
      clientId: nullableId(body.clientId),
      projectId: nullableId(body.projectId),
    });

    /*
     * If no department was explicitly supplied, use the employee's
     * current department. This keeps departmental workload reporting useful.
     */
    const resolvedDepartmentId =
      context.departmentId ?? employee.departmentId ?? null;

    /* =========================================================================
     * ALLOCATION VALUES
     * =========================================================================
     */

    const values = validateAllocationValues({
      allocationMode,

      hoursPerWeek: nullableNumber(
        body.hoursPerWeek,
        "Hours per week",
      ),

      allocationPercent: nullableNumber(
        body.allocationPercent,
        "Allocation percentage",
      ),

      budgetHours: nullableNumber(
        body.budgetHours,
        "Budget hours",
      ),
    });

    const billable =
      body.billable === undefined
        ? true
        : booleanValue(
            body.billable,
            "Billable",
          );

    const notes = nullableString(
      body.notes,
      "Notes",
    );

    /* =========================================================================
     * CREATE
     * =========================================================================
     */

    const allocation =
      await prisma.workloadAllocation.create({
        data: {
          employeeId,

          departmentId: resolvedDepartmentId,

          clientId: context.clientId,
          projectId: context.projectId,

          title,
          description,

          type,
          status,
          priority,

          startDate,
          endDate,

          allocationMode,

          hoursPerWeek: values.hoursPerWeek,
          allocationPercent: values.allocationPercent,

          budgetHours: values.budgetHours,

          billable,

          notes,

          createdById: identity.admin.id,
          updatedById: identity.admin.id,
        },

        include: allocationInclude(),
      });

    return NextResponse.json(
      {
        message:
          "Workload allocation created successfully.",

        allocation: serialiseAllocation(
          allocation,
          true,
        ),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "[POST /api/admin/workload/allocations]",
      error,
    );

    const result = workloadApiError(error);

    return NextResponse.json(
      {
        error: result.message,
      },
      {
        status: result.status,
      },
    );
  }
}

/* =============================================================================
 * PRISMA INCLUDE
 * =============================================================================
 */

function allocationInclude() {
  return {
    employee: {
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
            colour: true,
          },
        },
      },
    },

    department: {
      select: {
        id: true,
        name: true,
        colour: true,
      },
    },

    client: {
      select: {
        id: true,
        name: true,
        displayName: true,
        clientRef: true,
        logoUrl: true,
      },
    },

    project: {
      select: {
        id: true,
        clientId: true,
        name: true,
        slug: true,
        category: true,
        status: true,
      },
    },

    createdBy: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    },

    updatedBy: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    },

    timesheetEntries: {
      select: {
        hours: true,
        billable: true,
      },
    },
  } satisfies Prisma.WorkloadAllocationInclude;
}

/* =============================================================================
 * SERIALISER
 * =============================================================================
 */

type AllocationForSerialisation =
  Prisma.WorkloadAllocationGetPayload<{
    include: {
      employee: {
        select: {
          id: true;
          employeeRef: true;
          firstName: true;
          lastName: true;
          preferredName: true;
          avatarUrl: true;
          jobTitle: true;
          status: true;

          department: {
            select: {
              id: true;
              name: true;
              colour: true;
            };
          };
        };
      };

      department: {
        select: {
          id: true;
          name: true;
          colour: true;
        };
      };

      client: {
        select: {
          id: true;
          name: true;
          displayName: true;
          clientRef: true;
          logoUrl: true;
        };
      };

      project: {
        select: {
          id: true;
          clientId: true;
          name: true;
          slug: true;
          category: true;
          status: true;
        };
      };

      createdBy: {
        select: {
          id: true;
          firstName: true;
          lastName: true;
          email: true;
        };
      };

      updatedBy: {
        select: {
          id: true;
          firstName: true;
          lastName: true;
          email: true;
        };
      };

      timesheetEntries: {
        select: {
          hours: true;
          billable: true;
        };
      };
    };
  }>;

function serialiseAllocation(
  allocation: AllocationForSerialisation,
  editable: boolean,
) {
  let actualHours = 0;
  let actualBillableHours = 0;

  for (const entry of allocation.timesheetEntries) {
    const hours = Number(entry.hours);

    if (!Number.isFinite(hours)) {
      continue;
    }

    actualHours += hours;

    if (entry.billable) {
      actualBillableHours += hours;
    }
  }

  actualHours = roundHours(actualHours);

  actualBillableHours = roundHours(
    actualBillableHours,
  );

  return {
    id: allocation.id,

    employeeId: allocation.employeeId,

    employee: {
      id: allocation.employee.id,

      employeeRef: allocation.employee.employeeRef,

      firstName: allocation.employee.firstName,
      lastName: allocation.employee.lastName,
      preferredName: allocation.employee.preferredName,

      name:
        allocation.employee.preferredName?.trim() ||
        [
          allocation.employee.firstName,
          allocation.employee.lastName,
        ]
          .filter(Boolean)
          .join(" ")
          .trim(),

      avatarUrl: allocation.employee.avatarUrl,
      jobTitle: allocation.employee.jobTitle,
      status: allocation.employee.status,

      department: allocation.employee.department,
    },

    departmentId: allocation.departmentId,
    clientId: allocation.clientId,
    projectId: allocation.projectId,

    department: allocation.department,

    client: allocation.client,

    project: allocation.project,

    title: allocation.title,
    description: allocation.description,

    type: allocation.type,
    status: allocation.status,
    priority: allocation.priority,

    startDate: allocation.startDate.toISOString(),
    endDate: allocation.endDate.toISOString(),

    allocationMode: allocation.allocationMode,

    hoursPerWeek:
      allocation.hoursPerWeek === null
        ? null
        : Number(allocation.hoursPerWeek),

    allocationPercent:
      allocation.allocationPercent === null
        ? null
        : Number(allocation.allocationPercent),

    budgetHours:
      allocation.budgetHours === null
        ? null
        : Number(allocation.budgetHours),

    billable: allocation.billable,

    notes: allocation.notes,

    actualHours,
    actualBillableHours,

    createdBy: allocation.createdBy
      ? serialiseAdmin(allocation.createdBy)
      : null,

    updatedBy: allocation.updatedBy
      ? serialiseAdmin(allocation.updatedBy)
      : null,

    createdAt: allocation.createdAt.toISOString(),
    updatedAt: allocation.updatedAt.toISOString(),

    editable,
    deletable: editable,
  };
}

function serialiseAdmin(admin: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const name = [
    admin.firstName,
    admin.lastName,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" &&
        value.trim().length > 0,
    )
    .map((value) => value.trim())
    .join(" ");

  return {
    id: admin.id,
    firstName: admin.firstName,
    lastName: admin.lastName,
    name: name || admin.email,
    email: admin.email,
  };
}

/* =============================================================================
 * HELPERS
 * =============================================================================
 */

function cleanString(
  value: string | null,
): string | null {
  const cleaned = value?.trim();

  return cleaned || null;
}

function requiredString(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function nullableString(
  value: unknown,
  label: string,
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(
      `${label} must be valid text.`,
    );
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function nullableId(
  value: unknown,
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(
      "Invalid related record identifier.",
    );
  }

  return value.trim() || null;
}

function nullableNumber(
  value: unknown,
  label: string,
): number | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `${label} must be a valid number.`,
    );
  }

  return parsed;
}

function booleanValue(
  value: unknown,
  label: string,
): boolean {
  if (typeof value !== "boolean") {
    throw new Error(
      `${label} must be true or false.`,
    );
  }

  return value;
}

function requiredDate(
  value: unknown,
  label: string,
): Date {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(`${label} is required.`);
  }

  return parseDateOnly(
    value,
    label,
  );
}

function optionalDateQuery(
  value: string | null,
  label: string,
): Date | null {
  if (!value?.trim()) {
    return null;
  }

  return parseDateOnly(
    value,
    label,
  );
}

function parseDateOnly(
  value: string,
  label: string,
): Date {
  const source =
    /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T00:00:00.000Z`
      : value;

  const parsed = new Date(source);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `${label} must be a valid date.`,
    );
  }

  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

function enumValue<
  T extends Record<string, string>,
>(
  value: unknown,
  values: T,
  label: string,
): T[keyof T] {
  if (
    typeof value !== "string" ||
    !Object.values(values).includes(value)
  ) {
    throw new Error(
      `${label} is invalid.`,
    );
  }

  return value as T[keyof T];
}

function optionalEnum<
  T extends Record<string, string>,
>(
  value: string | null,
  values: T,
  label: string,
): T[keyof T] | null {
  if (!value) {
    return null;
  }

  return enumValue(
    value,
    values,
    label,
  );
}

function roundHours(
  value: number,
): number {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}