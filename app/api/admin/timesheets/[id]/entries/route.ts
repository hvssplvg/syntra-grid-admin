import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import {
  assertCanEditTimesheet,
  getTimesheetById,
  optionalBoolean,
  optionalDateTime,
  optionalText,
  parseTimesheetEntryType,
  positiveNumber,
  recalculateTimesheetTotals,
  requireTimesheetIdentity,
  resolveTimesheetEntryContext,
  timesheetApiError,
  timesheetDTO,
  utcDateOnly,
  validateTimesheetEntryValues,
} from "@/lib/timesheets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CreateEntryBody = {
  clientId?: unknown;
  projectId?: unknown;
  allocationId?: unknown;

  workDate?: unknown;

  type?: unknown;

  title?: unknown;
  description?: unknown;

  hours?: unknown;

  billable?: unknown;

  startedAt?: unknown;
  endedAt?: unknown;

  notes?: unknown;
};

/* =============================================================================
 * GET /api/admin/timesheets/[id]/entries
 * =============================================================================
 */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireTimesheetIdentity();

    const { id } =
      await context.params;

    const timesheet =
      await getTimesheetById(id);

    if (!timesheet) {
      return NextResponse.json(
        {
          error:
            "Timesheet not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      !identity.isTimesheetManager &&
      timesheet.employeeId !==
        identity.employee.id
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view these timesheet entries.",
        },
        {
          status: 403,
        },
      );
    }

    /*
     * The main Timesheet DTO already contains the entries,
     * so returning the full timesheet keeps the frontend
     * state consistent after entry operations.
     */
    return NextResponse.json({
      timesheet:
        timesheetDTO(
          timesheet,
          identity,
        ),
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/timesheets/[id]/entries]",
      error,
    );

    const result =
      timesheetApiError(error);

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
 * POST /api/admin/timesheets/[id]/entries
 * =============================================================================
 */

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireTimesheetIdentity();

    const { id } =
      await context.params;

    const timesheet =
      await prisma.timesheet.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          employeeId: true,

          status: true,

          periodStart: true,
          periodEnd: true,
        },
      });

    if (!timesheet) {
      return NextResponse.json(
        {
          error:
            "Timesheet not found.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * This blocks changes to:
     *
     * SUBMITTED
     * APPROVED
     * LOCKED
     *
     * DRAFT and REJECTED remain editable.
     */
    assertCanEditTimesheet(
      identity,
      timesheet,
    );

    const body =
      (await request.json()) as
        CreateEntryBody;

    /* =========================================================================
     * WORK DATE
     * =========================================================================
     */

    const workDate =
      requiredDate(
        body.workDate,
        "Work date",
      );

    /* =========================================================================
     * HOURS
     * =========================================================================
     */

    const hours =
      positiveNumber(
        body.hours,
        "Hours",
      );

    /* =========================================================================
     * TYPE
     * =========================================================================
     */

    const type =
      body.type ===
      undefined
        ? parseTimesheetEntryType(
            "PROJECT",
          )
        : parseTimesheetEntryType(
            body.type,
          );

    /* =========================================================================
     * TEXT
     * =========================================================================
     */

    const title =
      requiredString(
        body.title,
        "Title",
      );

    const description =
      optionalText(
        body.description,
        "Description",
      );

    const notes =
      optionalText(
        body.notes,
        "Notes",
      );

    /* =========================================================================
     * CLIENT / PROJECT / ALLOCATION
     * =========================================================================
     */

    const contextValues =
      await resolveTimesheetEntryContext({
        employeeId:
          timesheet.employeeId,

        clientId:
          optionalId(
            body.clientId,
            "Client",
          ),

        projectId:
          optionalId(
            body.projectId,
            "Project",
          ),

        allocationId:
          optionalId(
            body.allocationId,
            "Allocation",
          ),
      });

    /* =========================================================================
     * BILLABLE
     * =========================================================================
     *
     * If the browser explicitly provides billable, use it.
     *
     * Otherwise, when an allocation is selected, inherit its billable setting.
     *
     * Otherwise default to false.
     * =========================================================================
     */

    const billable =
      body.billable ===
      undefined
        ? contextValues.allocationBillable ??
          false
        : optionalBoolean(
            body.billable,
            false,
          );

    /* =========================================================================
     * OPTIONAL CLOCK TIMES
     * =========================================================================
     */

    const startedAt =
      optionalDateTime(
        body.startedAt,
        "Start time",
      );

    const endedAt =
      optionalDateTime(
        body.endedAt,
        "End time",
      );

    /* =========================================================================
     * VALIDATION
     * =========================================================================
     */

    validateTimesheetEntryValues({
      timesheet,

      workDate,

      hours,

      startedAt,
      endedAt,
    });

    /*
     * When clock times are provided, they should belong to
     * the same work date as the entry.
     */
    validateClockDate(
      startedAt,
      workDate,
      "Start time",
    );

    validateClockDate(
      endedAt,
      workDate,
      "End time",
    );

    /* =========================================================================
     * CREATE
     * =========================================================================
     */

    const entry =
      await prisma.$transaction(
        async (tx) => {
          const created =
            await tx.timesheetEntry.create({
              data: {
                timesheetId:
                  timesheet.id,

                /*
                 * Never trust employeeId from the browser.
                 * It always comes from the parent timesheet.
                 */
                employeeId:
                  timesheet.employeeId,

                clientId:
                  contextValues.clientId,

                projectId:
                  contextValues.projectId,

                allocationId:
                  contextValues.allocationId,

                workDate,

                type,

                title,
                description,

                hours,

                billable,

                startedAt,
                endedAt,

                notes,
              },

              select: {
                id: true,
              },
            });

          await recalculateTimesheetTotals(
            timesheet.id,
            tx,
          );

          await tx.timesheetActivity.create({
            data: {
              timesheetId:
                timesheet.id,

              employeeId:
                timesheet.employeeId,

              actorId:
                identity.admin.id,

              type:
                "ENTRY_ADDED",

              description:
                `Added ${formatHours(hours)} to "${title}".`,

              metadata: {
                entryId:
                  created.id,

                workDate:
                  workDate.toISOString(),

                hours,

                billable,

                clientId:
                  contextValues.clientId,

                projectId:
                  contextValues.projectId,

                allocationId:
                  contextValues.allocationId,
              },
            },
          });

          return created;
        },
      );

    const updated =
      await getTimesheetById(
        timesheet.id,
      );

    if (!updated) {
      throw new Error(
        "Unable to reload the updated timesheet.",
      );
    }

    return NextResponse.json(
      {
        message:
          "Time entry added successfully.",

        entryId:
          entry.id,

        timesheet:
          timesheetDTO(
            updated,
            identity,
          ),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "[POST /api/admin/timesheets/[id]/entries]",
      error,
    );

    const result =
      timesheetApiError(error);

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

function optionalId(
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
      `${label} must be valid.`,
    );
  }

  return (
    value.trim() ||
    null
  );
}

function requiredDate(
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

function validateClockDate(
  value: Date | null,
  workDate: Date,
  label: string,
) {
  if (!value) {
    return;
  }

  if (
    value.getUTCFullYear() !==
      workDate.getUTCFullYear() ||
    value.getUTCMonth() !==
      workDate.getUTCMonth() ||
    value.getUTCDate() !==
      workDate.getUTCDate()
  ) {
    throw new Error(
      `${label} must fall on the selected work date.`,
    );
  }
}

function formatHours(
  hours: number,
) {
  return `${hours}h`;
}