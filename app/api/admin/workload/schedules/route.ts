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

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type CreateScheduleBody = {
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
 * GET /api/admin/workload/schedules
 * =============================================================================
 */

export async function GET(request: NextRequest) {
  try {
    const identity = await requireWorkloadIdentity();

    const searchParams = request.nextUrl.searchParams;

    const requestedEmployeeId = cleanString(
      searchParams.get("employeeId"),
    );

    const includeInactive =
      searchParams.get("includeInactive") === "true";

    /*
     * OWNER / ADMIN may inspect anyone.
     * Other users may only inspect their own schedule.
     */
    const employeeId = identity.isWorkloadManager
      ? requestedEmployeeId
      : identity.employee.id;

    const schedules =
      await prisma.employeeWorkSchedule.findMany({
        where: {
          ...(employeeId
            ? {
                employeeId,
              }
            : {}),

          ...(!includeInactive
            ? {
                active: true,
              }
            : {}),
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

        orderBy: [
          {
            employee: {
              firstName: "asc",
            },
          },
          {
            employee: {
              lastName: "asc",
            },
          },
          {
            effectiveFrom: "desc",
          },
          {
            createdAt: "desc",
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

      schedules: schedules.map((schedule) => ({
        id: schedule.id,

        employeeId: schedule.employeeId,

        employee: {
          id: schedule.employee.id,
          employeeRef: schedule.employee.employeeRef,

          firstName: schedule.employee.firstName,
          lastName: schedule.employee.lastName,
          preferredName: schedule.employee.preferredName,

          name:
            schedule.employee.preferredName?.trim() ||
            [
              schedule.employee.firstName,
              schedule.employee.lastName,
            ]
              .filter(Boolean)
              .join(" ")
              .trim(),

          avatarUrl: schedule.employee.avatarUrl,
          jobTitle: schedule.employee.jobTitle,
          status: schedule.employee.status,

          department: schedule.employee.department,
        },

        weeklyHours: Number(schedule.weeklyHours),

        mondayHours: Number(schedule.mondayHours),
        tuesdayHours: Number(schedule.tuesdayHours),
        wednesdayHours: Number(schedule.wednesdayHours),
        thursdayHours: Number(schedule.thursdayHours),
        fridayHours: Number(schedule.fridayHours),
        saturdayHours: Number(schedule.saturdayHours),
        sundayHours: Number(schedule.sundayHours),

        billableTargetPercent:
          schedule.billableTargetPercent === null
            ? null
            : Number(schedule.billableTargetPercent),

        timezone: schedule.timezone,

        active: schedule.active,

        effectiveFrom:
          schedule.effectiveFrom?.toISOString() ?? null,

        effectiveUntil:
          schedule.effectiveUntil?.toISOString() ?? null,

        notes: schedule.notes,

        createdBy: schedule.createdBy
          ? {
              id: schedule.createdBy.id,

              name: [
                schedule.createdBy.firstName,
                schedule.createdBy.lastName,
              ]
                .filter(Boolean)
                .join(" ")
                .trim(),

              email: schedule.createdBy.email,
            }
          : null,

        createdAt: schedule.createdAt.toISOString(),
        updatedAt: schedule.updatedAt.toISOString(),

        editable: identity.isWorkloadManager,
        deletable: identity.isWorkloadManager,
      })),
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/workload/schedules]",
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
 * POST /api/admin/workload/schedules
 * =============================================================================
 */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireWorkloadIdentity();

    assertCanManageWorkload(identity);

    const body = (await request.json()) as CreateScheduleBody;

    const employeeId = requiredString(
      body.employeeId,
      "Employee",
    );

    await requireWorkloadEmployee(employeeId);

    /* =========================================================================
     * DAILY HOURS
     * =========================================================================
     */

    const mondayHours = optionalNumber(
      body.mondayHours,
      8,
      "Monday hours",
    );

    const tuesdayHours = optionalNumber(
      body.tuesdayHours,
      8,
      "Tuesday hours",
    );

    const wednesdayHours = optionalNumber(
      body.wednesdayHours,
      8,
      "Wednesday hours",
    );

    const thursdayHours = optionalNumber(
      body.thursdayHours,
      8,
      "Thursday hours",
    );

    const fridayHours = optionalNumber(
      body.fridayHours,
      8,
      "Friday hours",
    );

    const saturdayHours = optionalNumber(
      body.saturdayHours,
      0,
      "Saturday hours",
    );

    const sundayHours = optionalNumber(
      body.sundayHours,
      0,
      "Sunday hours",
    );

    /*
     * weeklyHours is NEVER trusted from the browser.
     * It is derived from the seven daily values.
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

    const billableTargetPercent = validateOptionalPercent(
      nullableNumber(
        body.billableTargetPercent,
        "Billable target",
      ),
      "Billable target",
    );

    /* =========================================================================
     * EFFECTIVE DATES
     * =========================================================================
     */

    const effectiveFrom = nullableDate(
      body.effectiveFrom,
      "Effective from",
    );

    const effectiveUntil = nullableDate(
      body.effectiveUntil,
      "Effective until",
    );

    const active =
      typeof body.active === "boolean" ? body.active : true;

    /*
     * Only active schedules participate in overlap validation.
     * An inactive historical/draft schedule can coexist.
     */
    if (active) {
      await assertNoScheduleOverlap({
        employeeId,
        effectiveFrom,
        effectiveUntil,
      });
    }

    /* =========================================================================
     * CREATE
     * =========================================================================
     */

    const schedule =
      await prisma.employeeWorkSchedule.create({
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

          timezone: nullableString(body.timezone),

          active,

          effectiveFrom,
          effectiveUntil,

          notes: nullableString(body.notes),

          createdById: identity.admin.id,
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

              department: {
                select: {
                  id: true,
                  name: true,
                  colour: true,
                },
              },
            },
          },
        },
      });

    return NextResponse.json(
      {
        message: "Work schedule created successfully.",

        schedule: {
          id: schedule.id,

          employeeId: schedule.employeeId,

          employee: {
            id: schedule.employee.id,
            employeeRef: schedule.employee.employeeRef,

            firstName: schedule.employee.firstName,
            lastName: schedule.employee.lastName,
            preferredName: schedule.employee.preferredName,

            name:
              schedule.employee.preferredName?.trim() ||
              [
                schedule.employee.firstName,
                schedule.employee.lastName,
              ]
                .filter(Boolean)
                .join(" ")
                .trim(),

            avatarUrl: schedule.employee.avatarUrl,
            jobTitle: schedule.employee.jobTitle,
            department: schedule.employee.department,
          },

          weeklyHours: Number(schedule.weeklyHours),

          mondayHours: Number(schedule.mondayHours),
          tuesdayHours: Number(schedule.tuesdayHours),
          wednesdayHours: Number(schedule.wednesdayHours),
          thursdayHours: Number(schedule.thursdayHours),
          fridayHours: Number(schedule.fridayHours),
          saturdayHours: Number(schedule.saturdayHours),
          sundayHours: Number(schedule.sundayHours),

          billableTargetPercent:
            schedule.billableTargetPercent === null
              ? null
              : Number(schedule.billableTargetPercent),

          timezone: schedule.timezone,

          active: schedule.active,

          effectiveFrom:
            schedule.effectiveFrom?.toISOString() ?? null,

          effectiveUntil:
            schedule.effectiveUntil?.toISOString() ?? null,

          notes: schedule.notes,

          createdAt: schedule.createdAt.toISOString(),
          updatedAt: schedule.updatedAt.toISOString(),
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "[POST /api/admin/workload/schedules]",
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
 * HELPERS
 * =============================================================================
 */

function cleanString(value: string | null): string | null {
  const result = value?.trim();

  return result || null;
}

function requiredString(
  value: unknown,
  label: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Invalid text value.");
  }

  const result = value.trim();

  return result || null;
}

function optionalNumber(
  value: unknown,
  fallback: number,
  label: string,
): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const parsed =
    typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsed;
}

function nullableNumber(
  value: unknown,
  label: string,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed =
    typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }

  return parsed;
}

function nullableDate(
  value: unknown,
  label: string,
): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a valid date.`);
  }

  /*
   * Workload date-only values are stored at UTC midnight.
   */
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00.000Z`
    : value;

  const result = new Date(dateOnly);

  if (Number.isNaN(result.getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }

  return new Date(
    Date.UTC(
      result.getUTCFullYear(),
      result.getUTCMonth(),
      result.getUTCDate(),
    ),
  );
}