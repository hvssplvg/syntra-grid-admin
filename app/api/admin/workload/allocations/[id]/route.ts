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

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateAllocationBody = {
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
 * GET
 * =============================================================================
 */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireWorkloadIdentity();

    const { id } =
      await context.params;

    const allocation =
      await prisma.workloadAllocation.findUnique({
        where: {
          id,
        },

        include: allocationInclude(),
      });

    if (!allocation) {
      return NextResponse.json(
        {
          error:
            "Workload allocation not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      !identity.isWorkloadManager &&
      allocation.employeeId !==
        identity.employee.id
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view this workload allocation.",
        },
        {
          status: 403,
        },
      );
    }

    return NextResponse.json({
      allocation:
        serialiseAllocation(
          allocation,
          identity.isWorkloadManager,
        ),
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/workload/allocations/[id]]",
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

/* =============================================================================
 * PATCH
 * =============================================================================
 */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireWorkloadIdentity();

    assertCanManageWorkload(
      identity,
    );

    const { id } =
      await context.params;

    const existing =
      await prisma.workloadAllocation.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Workload allocation not found.",
        },
        {
          status: 404,
        },
      );
    }

    const body =
      (await request.json()) as UpdateAllocationBody;

    /* =========================================================================
     * EMPLOYEE
     * =========================================================================
     */

    const employeeId =
      body.employeeId === undefined
        ? existing.employeeId
        : requiredString(
            body.employeeId,
            "Employee",
          );

    const employee =
      await requireWorkloadEmployee(
        employeeId,
      );

    /* =========================================================================
     * BASIC VALUES
     * =========================================================================
     */

    const title =
      body.title === undefined
        ? existing.title
        : requiredString(
            body.title,
            "Title",
          );

    const description =
      body.description === undefined
        ? existing.description
        : nullableString(
            body.description,
            "Description",
          );

    const type =
      body.type === undefined
        ? existing.type
        : enumValue(
            body.type,
            WorkloadAllocationType,
            "Allocation type",
          );

    const status =
      body.status === undefined
        ? existing.status
        : enumValue(
            body.status,
            WorkloadAllocationStatus,
            "Allocation status",
          );

    const priority =
      body.priority === undefined
        ? existing.priority
        : enumValue(
            body.priority,
            WorkloadPriority,
            "Priority",
          );

    const allocationMode =
      body.allocationMode === undefined
        ? existing.allocationMode
        : enumValue(
            body.allocationMode,
            WorkloadAllocationMode,
            "Allocation mode",
          );

    /* =========================================================================
     * DATES
     * =========================================================================
     */

    const startDate =
      body.startDate === undefined
        ? existing.startDate
        : requiredDate(
            body.startDate,
            "Start date",
          );

    const endDate =
      body.endDate === undefined
        ? existing.endDate
        : requiredDate(
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

    const requestedDepartmentId =
      body.departmentId === undefined
        ? existing.departmentId
        : nullableId(
            body.departmentId,
          );

    const requestedClientId =
      body.clientId === undefined
        ? existing.clientId
        : nullableId(
            body.clientId,
          );

    const requestedProjectId =
      body.projectId === undefined
        ? existing.projectId
        : nullableId(
            body.projectId,
          );

    const resolvedContext =
      await resolveWorkloadContext({
        departmentId:
          requestedDepartmentId,

        clientId:
          requestedClientId,

        projectId:
          requestedProjectId,
      });

    const departmentId =
      resolvedContext.departmentId ??
      employee.departmentId ??
      null;

    /* =========================================================================
     * HOURS / PERCENTAGE
     * =========================================================================
     */

    const requestedHoursPerWeek =
      body.hoursPerWeek === undefined
        ? existing.hoursPerWeek === null
          ? null
          : Number(
              existing.hoursPerWeek,
            )
        : nullableNumber(
            body.hoursPerWeek,
            "Hours per week",
          );

    const requestedAllocationPercent =
      body.allocationPercent === undefined
        ? existing.allocationPercent === null
          ? null
          : Number(
              existing.allocationPercent,
            )
        : nullableNumber(
            body.allocationPercent,
            "Allocation percentage",
          );

    const requestedBudgetHours =
      body.budgetHours === undefined
        ? existing.budgetHours === null
          ? null
          : Number(
              existing.budgetHours,
            )
        : nullableNumber(
            body.budgetHours,
            "Budget hours",
          );

    /*
     * If the allocation mode changes, the value belonging to the
     * previous mode should not accidentally survive.
     */
    const hoursPerWeek =
      allocationMode ===
      WorkloadAllocationMode.HOURS
        ? requestedHoursPerWeek
        : null;

    const allocationPercent =
      allocationMode ===
      WorkloadAllocationMode.PERCENTAGE
        ? requestedAllocationPercent
        : null;

    const values =
      validateAllocationValues({
        allocationMode,
        hoursPerWeek,
        allocationPercent,
        budgetHours:
          requestedBudgetHours,
      });

    /* =========================================================================
     * OTHER VALUES
     * =========================================================================
     */

    const billable =
      body.billable === undefined
        ? existing.billable
        : booleanValue(
            body.billable,
            "Billable",
          );

    const notes =
      body.notes === undefined
        ? existing.notes
        : nullableString(
            body.notes,
            "Notes",
          );

    /* =========================================================================
     * UPDATE
     * =========================================================================
     */

    const allocation =
      await prisma.workloadAllocation.update({
        where: {
          id,
        },

        data: {
          employeeId,

          departmentId,

          clientId:
            resolvedContext.clientId,

          projectId:
            resolvedContext.projectId,

          title,
          description,

          type,
          status,
          priority,

          startDate,
          endDate,

          allocationMode,

          hoursPerWeek:
            values.hoursPerWeek,

          allocationPercent:
            values.allocationPercent,

          budgetHours:
            values.budgetHours,

          billable,

          notes,

          updatedById:
            identity.admin.id,
        },

        include:
          allocationInclude(),
      });

    return NextResponse.json({
      message:
        "Workload allocation updated successfully.",

      allocation:
        serialiseAllocation(
          allocation,
          true,
        ),
    });
  } catch (error) {
    console.error(
      "[PATCH /api/admin/workload/allocations/[id]]",
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

/* =============================================================================
 * DELETE
 * =============================================================================
 */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireWorkloadIdentity();

    assertCanManageWorkload(
      identity,
    );

    const { id } =
      await context.params;

    const existing =
      await prisma.workloadAllocation.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          status: true,

          _count: {
            select: {
              timesheetEntries:
                true,
            },
          },
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Workload allocation not found.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Once actual time has been logged against an allocation,
     * retain the planning record for planned-vs-actual history.
     *
     * We therefore cancel rather than physically delete it.
     */
    if (
      existing._count.timesheetEntries >
      0
    ) {
      await prisma.workloadAllocation.update({
        where: {
          id,
        },

        data: {
          status:
            WorkloadAllocationStatus.CANCELLED,

          updatedById:
            identity.admin.id,
        },
      });

      return NextResponse.json({
        message:
          "The allocation has recorded time, so it was cancelled instead of deleted.",
        deleted: false,
        cancelled: true,
      });
    }

    await prisma.workloadAllocation.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      message:
        "Workload allocation deleted successfully.",
      deleted: true,
      cancelled: false,
    });
  } catch (error) {
    console.error(
      "[DELETE /api/admin/workload/allocations/[id]]",
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

  return {
    id: allocation.id,

    employeeId:
      allocation.employeeId,

    employee: {
      id:
        allocation.employee.id,

      employeeRef:
        allocation.employee.employeeRef,

      firstName:
        allocation.employee.firstName,

      lastName:
        allocation.employee.lastName,

      preferredName:
        allocation.employee.preferredName,

      name:
        allocation.employee.preferredName?.trim() ||
        [
          allocation.employee.firstName,
          allocation.employee.lastName,
        ]
          .filter(Boolean)
          .join(" ")
          .trim(),

      avatarUrl:
        allocation.employee.avatarUrl,

      jobTitle:
        allocation.employee.jobTitle,

      status:
        allocation.employee.status,

      department:
        allocation.employee.department,
    },

    departmentId:
      allocation.departmentId,

    clientId:
      allocation.clientId,

    projectId:
      allocation.projectId,

    department:
      allocation.department,

    client:
      allocation.client,

    project:
      allocation.project,

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
      allocation.hoursPerWeek === null
        ? null
        : Number(
            allocation.hoursPerWeek,
          ),

    allocationPercent:
      allocation.allocationPercent === null
        ? null
        : Number(
            allocation.allocationPercent,
          ),

    budgetHours:
      allocation.budgetHours === null
        ? null
        : Number(
            allocation.budgetHours,
          ),

    billable:
      allocation.billable,

    notes:
      allocation.notes,

    actualHours:
      roundHours(
        actualHours,
      ),

    actualBillableHours:
      roundHours(
        actualBillableHours,
      ),

    createdBy:
      allocation.createdBy
        ? serialiseAdmin(
            allocation.createdBy,
          )
        : null,

    updatedBy:
      allocation.updatedBy
        ? serialiseAdmin(
            allocation.updatedBy,
          )
        : null,

    createdAt:
      allocation.createdAt.toISOString(),

    updatedAt:
      allocation.updatedAt.toISOString(),

    editable,

    deletable:
      editable,
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
    .map((value) =>
      value.trim(),
    )
    .join(" ");

  return {
    id:
      admin.id,

    firstName:
      admin.firstName,

    lastName:
      admin.lastName,

    name:
      name ||
      admin.email,

    email:
      admin.email,
  };
}

/* =============================================================================
 * HELPERS
 * =============================================================================
 */

function requiredString(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `${label} is required.`,
    );
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

  if (
    typeof value !== "string"
  ) {
    throw new Error(
      `${label} must be valid text.`,
    );
  }

  const cleaned =
    value.trim();

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

  if (
    typeof value !== "string"
  ) {
    throw new Error(
      "Invalid related record identifier.",
    );
  }

  return (
    value.trim() ||
    null
  );
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

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
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
  if (
    typeof value !== "boolean"
  ) {
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
    throw new Error(
      `${label} is required.`,
    );
  }

  const source =
    /^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
      ? `${value}T00:00:00.000Z`
      : value;

  const parsed =
    new Date(source);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
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
    !Object.values(values).includes(
      value,
    )
  ) {
    throw new Error(
      `${label} is invalid.`,
    );
  }

  return value as T[keyof T];
}

function roundHours(
  value: number,
): number {
  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) * 100,
    ) / 100
  );
}