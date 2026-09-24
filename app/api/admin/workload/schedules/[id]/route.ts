import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  assertCanManageWorkload,
  assertNoScheduleOverlap,
  calculateWeeklyHours,
  requireWorkloadEmployee,
  requireWorkloadIdentity,
  validateOptionalPercent,
  workloadApiError,
} from "@/lib/workload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateScheduleBody = {
  employeeId?: unknown;

  mondayHours?: unknown;
  tuesdayHours?: unknown;
  wednesdayHours?: unknown;
  thursdayHours?: unknown;
  fridayHours?: unknown;
  saturdayHours?: unknown;
  sundayHours?: unknown;

  billableTargetPercent?: unknown;

  timezone?: unknown;
  active?: unknown;

  effectiveFrom?: unknown;
  effectiveUntil?: unknown;

  notes?: unknown;
};

/* =============================================================================
 * GET /api/admin/workload/schedules/[id]
 * =============================================================================
 */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity = await requireWorkloadIdentity();

    const { id } = await context.params;

    const schedule =
      await prisma.employeeWorkSchedule.findUnique({
        where: {
          id,
        },

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

          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

    if (!schedule) {
      return NextResponse.json(
        {
          error: "Work schedule not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      !identity.isWorkloadManager &&
      schedule.employeeId !== identity.employee.id
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view this work schedule.",
        },
        {
          status: 403,
        },
      );
    }

    return NextResponse.json({
      schedule: serialiseSchedule(schedule),
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/workload/schedules/[id]]",
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
 * PATCH /api/admin/workload/schedules/[id]
 * =============================================================================
 */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity = await requireWorkloadIdentity();

    assertCanManageWorkload(identity);

    const { id } = await context.params;

    const existing =
      await prisma.employeeWorkSchedule.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error: "Work schedule not found.",
        },
        {
          status: 404,
        },
      );
    }

    const body =
      (await request.json()) as UpdateScheduleBody;

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

    /*
     * Always validate the resulting employee.
     *
     * This also protects against an employee becoming FORMER or
     * SUSPENDED after the schedule was originally created.
     */
    await requireWorkloadEmployee(employeeId);

    /* =========================================================================
     * DAILY HOURS
     * =========================================================================
     */

    const mondayHours = resolveNumber(
      body.mondayHours,
      Number(existing.mondayHours),
      "Monday hours",
    );

    const tuesdayHours = resolveNumber(
      body.tuesdayHours,
      Number(existing.tuesdayHours),
      "Tuesday hours",
    );

    const wednesdayHours = resolveNumber(
      body.wednesdayHours,
      Number(existing.wednesdayHours),
      "Wednesday hours",
    );

    const thursdayHours = resolveNumber(
      body.thursdayHours,
      Number(existing.thursdayHours),
      "Thursday hours",
    );

    const fridayHours = resolveNumber(
      body.fridayHours,
      Number(existing.fridayHours),
      "Friday hours",
    );

    const saturdayHours = resolveNumber(
      body.saturdayHours,
      Number(existing.saturdayHours),
      "Saturday hours",
    );

    const sundayHours = resolveNumber(
      body.sundayHours,
      Number(existing.sundayHours),
      "Sunday hours",
    );

    /*
     * weeklyHours is derived on the server.
     * Never trust a weeklyHours value from the browser.
     */
    const weeklyHours = calculateWeeklyHours({
      mondayHours,
      tuesdayHours,
      wednesdayHours,
      thursdayHours,
      fridayHours,
      saturdayHours,
      sundayHours,
    });

    if (weeklyHours <= 0) {
      throw new Error(
        "The work schedule must contain at least one working hour.",
      );
    }

    /* =========================================================================
     * BILLABLE TARGET
     * =========================================================================
     */

    const billableTargetPercent =
      body.billableTargetPercent === undefined
        ? existing.billableTargetPercent === null
          ? null
          : Number(
              existing.billableTargetPercent,
            )
        : validateOptionalPercent(
            nullableNumber(
              body.billableTargetPercent,
              "Billable target",
            ),
            "Billable target",
          );

    /* =========================================================================
     * OTHER FIELDS
     * =========================================================================
     */

    const timezone =
      body.timezone === undefined
        ? existing.timezone
        : nullableString(
            body.timezone,
            "Timezone",
          );

    const notes =
      body.notes === undefined
        ? existing.notes
        : nullableString(
            body.notes,
            "Notes",
          );

    const active =
      body.active === undefined
        ? existing.active
        : booleanValue(
            body.active,
            "Active",
          );

    const effectiveFrom =
      body.effectiveFrom === undefined
        ? existing.effectiveFrom
        : nullableDate(
            body.effectiveFrom,
            "Effective from",
          );

    const effectiveUntil =
      body.effectiveUntil === undefined
        ? existing.effectiveUntil
        : nullableDate(
            body.effectiveUntil,
            "Effective until",
          );

    if (
      effectiveFrom &&
      effectiveUntil &&
      effectiveUntil < effectiveFrom
    ) {
      throw new Error(
        "The schedule end date cannot be before its start date.",
      );
    }

    /*
     * Inactive schedules do not participate in overlap validation.
     */
    if (active) {
      await assertNoScheduleOverlap({
        employeeId,
        effectiveFrom,
        effectiveUntil,
        excludeId: existing.id,
      });
    }

    /* =========================================================================
     * UPDATE
     * =========================================================================
     */

    const schedule =
      await prisma.employeeWorkSchedule.update({
        where: {
          id,
        },

        data: {
          employeeId,

          weeklyHours,

          mondayHours,
          tuesdayHours,
          wednesdayHours,
          thursdayHours,
          fridayHours,
          saturdayHours,
          sundayHours,

          billableTargetPercent,

          timezone,

          active,

          effectiveFrom,
          effectiveUntil,

          notes,
        },

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

          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

    return NextResponse.json({
      message:
        "Work schedule updated successfully.",

      schedule:
        serialiseSchedule(schedule),
    });
  } catch (error) {
    console.error(
      "[PATCH /api/admin/workload/schedules/[id]]",
      error,
    );

    const result =
      workloadApiError(error);

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
 * DELETE /api/admin/workload/schedules/[id]
 * =============================================================================
 */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireWorkloadIdentity();

    assertCanManageWorkload(identity);

    const { id } =
      await context.params;

    const existing =
      await prisma.employeeWorkSchedule.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          active: true,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Work schedule not found.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Keep historical schedule records.
     *
     * "Deleting" a schedule therefore means deactivating it rather
     * than physically removing the database row.
     */
    if (existing.active) {
      await prisma.employeeWorkSchedule.update({
        where: {
          id,
        },

        data: {
          active: false,
        },
      });
    }

    return NextResponse.json({
      message:
        "Work schedule deactivated successfully.",
    });
  } catch (error) {
    console.error(
      "[DELETE /api/admin/workload/schedules/[id]]",
      error,
    );

    const result =
      workloadApiError(error);

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
 * SERIALISER TYPES
 * =============================================================================
 */

type ScheduleForSerialisation = {
  id: string;
  employeeId: string;

  weeklyHours: unknown;

  mondayHours: unknown;
  tuesdayHours: unknown;
  wednesdayHours: unknown;
  thursdayHours: unknown;
  fridayHours: unknown;
  saturdayHours: unknown;
  sundayHours: unknown;

  billableTargetPercent: unknown | null;

  timezone: string | null;
  active: boolean;

  effectiveFrom: Date | null;
  effectiveUntil: Date | null;

  notes: string | null;

  createdAt: Date;
  updatedAt: Date;

  employee: {
    id: string;
    employeeRef: string | null;

    firstName: string;
    lastName: string;
    preferredName: string | null;

    avatarUrl: string | null;
    jobTitle: string;

    status: unknown;

    department: {
      id: string;
      name: string;
      colour: string | null;
    } | null;
  };

  createdBy: {
    id: string;

    /*
     * AdminUser.firstName / lastName are nullable in your schema.
     */
    firstName: string | null;
    lastName: string | null;

    email: string;
  } | null;
};

/* =============================================================================
 * SERIALISER
 * =============================================================================
 */

function serialiseSchedule(
  schedule: ScheduleForSerialisation,
) {
  const employeeName =
    schedule.employee.preferredName?.trim() ||
    [
      schedule.employee.firstName,
      schedule.employee.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

  const createdByName =
    schedule.createdBy
      ? [
          schedule.createdBy.firstName,
          schedule.createdBy.lastName,
        ]
          .filter(
            (
              value,
            ): value is string =>
              typeof value === "string" &&
              value.trim().length > 0,
          )
          .map((value) => value.trim())
          .join(" ")
      : "";

  return {
    id:
      schedule.id,

    employeeId:
      schedule.employeeId,

    employee: {
      id:
        schedule.employee.id,

      employeeRef:
        schedule.employee.employeeRef,

      firstName:
        schedule.employee.firstName,

      lastName:
        schedule.employee.lastName,

      preferredName:
        schedule.employee.preferredName,

      name:
        employeeName,

      avatarUrl:
        schedule.employee.avatarUrl,

      jobTitle:
        schedule.employee.jobTitle,

      status:
        schedule.employee.status,

      department:
        schedule.employee.department,
    },

    weeklyHours:
      Number(
        schedule.weeklyHours,
      ),

    mondayHours:
      Number(
        schedule.mondayHours,
      ),

    tuesdayHours:
      Number(
        schedule.tuesdayHours,
      ),

    wednesdayHours:
      Number(
        schedule.wednesdayHours,
      ),

    thursdayHours:
      Number(
        schedule.thursdayHours,
      ),

    fridayHours:
      Number(
        schedule.fridayHours,
      ),

    saturdayHours:
      Number(
        schedule.saturdayHours,
      ),

    sundayHours:
      Number(
        schedule.sundayHours,
      ),

    billableTargetPercent:
      schedule.billableTargetPercent === null
        ? null
        : Number(
            schedule.billableTargetPercent,
          ),

    timezone:
      schedule.timezone,

    active:
      schedule.active,

    effectiveFrom:
      schedule.effectiveFrom
        ?.toISOString() ??
      null,

    effectiveUntil:
      schedule.effectiveUntil
        ?.toISOString() ??
      null,

    notes:
      schedule.notes,

    createdBy:
      schedule.createdBy
        ? {
            id:
              schedule.createdBy.id,

            firstName:
              schedule.createdBy.firstName,

            lastName:
              schedule.createdBy.lastName,

            name:
              createdByName ||
              schedule.createdBy.email,

            email:
              schedule.createdBy.email,
          }
        : null,

    createdAt:
      schedule.createdAt.toISOString(),

    updatedAt:
      schedule.updatedAt.toISOString(),
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
    value === null ||
    value === undefined ||
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

  const result =
    value.trim();

  return result || null;
}

function resolveNumber(
  value: unknown,
  fallback: number,
  label: string,
): number {
  if (
    value === undefined
  ) {
    return fallback;
  }

  if (
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    throw new Error(
      `${label} must be a valid number.`,
    );
  }

  return parsed;
}

function nullableNumber(
  value: unknown,
  label: string,
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(parsed)
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

function nullableDate(
  value: unknown,
  label: string,
): Date | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !== "string"
  ) {
    throw new Error(
      `${label} must be a valid date.`,
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

  /*
   * Normalise workload date-only values to UTC midnight.
   */
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}