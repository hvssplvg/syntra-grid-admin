import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createTimesheet,
  getTimesheetFeed,
  parseTimesheetRange,
  parseTimesheetStatus,
  requireTimesheetIdentity,
  timesheetApiError,
  timesheetDTO,
  utcDateOnly,
  validateTimesheetPeriod,
} from "@/lib/timesheets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateTimesheetBody = {
  employeeId?: unknown;

  periodStart?: unknown;
  periodEnd?: unknown;

  employeeNote?: unknown;
};

/* =============================================================================
 * GET /api/admin/timesheets
 * =============================================================================
 *
 * Dashboard feed.
 *
 * Query parameters:
 *
 * ?start=2026-09-21
 * &end=2026-09-28
 * &employeeId=
 * &departmentId=
 * &clientId=
 * &projectId=
 * &status=
 *
 * Search range semantics:
 *
 * start = inclusive
 * end   = exclusive
 *
 * Example:
 *
 * 2026-09-21 -> 2026-09-28
 *
 * represents Monday 21 September through Sunday 27 September.
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

    const start =
      searchParams.get(
        "start",
      );

    const end =
      searchParams.get(
        "end",
      );

    const employeeId =
      cleanOptionalParam(
        searchParams.get(
          "employeeId",
        ),
      );

    const departmentId =
      cleanOptionalParam(
        searchParams.get(
          "departmentId",
        ),
      );

    const clientId =
      cleanOptionalParam(
        searchParams.get(
          "clientId",
        ),
      );

    const projectId =
      cleanOptionalParam(
        searchParams.get(
          "projectId",
        ),
      );

    const status =
      parseTimesheetStatus(
        cleanOptionalParam(
          searchParams.get(
            "status",
          ),
        ),
      );

    const range =
      parseTimesheetRange(
        start,
        end,
      );

    const feed =
      await getTimesheetFeed({
        identity,
        range,

        employeeId,
        departmentId,

        clientId,
        projectId,

        status,
      });

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

      range: {
        start:
          range.start.toISOString(),

        end:
          range.end.toISOString(),
      },

      filters: {
        employeeId,
        departmentId,

        clientId,
        projectId,

        status,
      },

      ...feed,
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/timesheets]",
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
 * POST /api/admin/timesheets
 * =============================================================================
 *
 * Creates a timesheet.
 *
 * Example:
 *
 * {
 *   "employeeId": "employee-id",
 *   "periodStart": "2026-09-21",
 *   "periodEnd": "2026-09-27",
 *   "employeeNote": null
 * }
 *
 * Normal employees can create only their own timesheet.
 * OWNER / ADMIN can create one for another employee.
 *
 * The unique employee + period constraint prevents duplicate timesheets.
 * =============================================================================
 */

export async function POST(
  request: NextRequest,
) {
  try {
    const identity =
      await requireTimesheetIdentity();

    const body =
      (await request.json()) as
        CreateTimesheetBody;

    /* =========================================================================
     * EMPLOYEE
     * =========================================================================
     */

    const employeeId =
      body.employeeId ===
        undefined ||
      body.employeeId ===
        null ||
      body.employeeId ===
        ""
        ? identity.employee.id
        : requiredString(
            body.employeeId,
            "Employee",
          );

    /*
     * Normal employees cannot use POST body manipulation
     * to create a timesheet for somebody else.
     */
    if (
      !identity.isTimesheetManager &&
      employeeId !==
        identity.employee.id
    ) {
      return NextResponse.json(
        {
          error:
            "You can only create your own timesheet.",
        },
        {
          status: 403,
        },
      );
    }

    /* =========================================================================
     * PERIOD
     * =========================================================================
     */

    const periodStart =
      parseRequiredDate(
        body.periodStart,
        "Period start",
      );

    const periodEnd =
      parseRequiredDate(
        body.periodEnd,
        "Period end",
      );

    validateTimesheetPeriod(
      periodStart,
      periodEnd,
    );

    /* =========================================================================
     * NOTE
     * =========================================================================
     */

    const employeeNote =
      nullableString(
        body.employeeNote,
        "Employee note",
      );

    /* =========================================================================
     * CREATE
     * =========================================================================
     */

    const timesheet =
      await createTimesheet({
        identity,

        employeeId,

        periodStart,
        periodEnd,

        employeeNote,
      });

    return NextResponse.json(
      {
        message:
          "Timesheet created successfully.",

        timesheet:
          timesheetDTO(
            timesheet,
            identity,
          ),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "[POST /api/admin/timesheets]",
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

function requiredString(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !==
      "string" ||
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
    typeof value !==
    "string"
  ) {
    throw new Error(
      `${label} must be text.`,
    );
  }

  const result =
    value.trim();

  return result || null;
}

function parseRequiredDate(
  value: unknown,
  label: string,
): Date {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    throw new Error(
      `${label} is required.`,
    );
  }

  return utcDateOnly(
    value.trim(),
    label,
  );
}