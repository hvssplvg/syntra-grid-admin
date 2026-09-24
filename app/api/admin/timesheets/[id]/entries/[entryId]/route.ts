import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import {
  assertCanEditTimesheet,
  assertEntryNotInvoiced,
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
    entryId: string;
  }>;
};

type UpdateEntryBody = {
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
 * GET /api/admin/timesheets/[id]/entries/[entryId]
 * =============================================================================
 */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireTimesheetIdentity();

    const {
      id,
      entryId,
    } = await context.params;

    const entry =
      await prisma.timesheetEntry.findFirst({
        where: {
          id: entryId,
          timesheetId: id,
        },

        include: {
          timesheet: {
            select: {
              id: true,
              employeeId: true,
              status: true,
              periodStart: true,
              periodEnd: true,
            },
          },

          client: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },

          project: {
            select: {
              id: true,
              name: true,
              clientId: true,
            },
          },

          allocation: {
            select: {
              id: true,
              title: true,
              clientId: true,
              projectId: true,
              billable: true,
            },
          },
        },
      });

    if (!entry) {
      return NextResponse.json(
        {
          error:
            "Timesheet entry not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (
      !identity.isTimesheetManager &&
      entry.employeeId !==
        identity.employee.id
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view this timesheet entry.",
        },
        {
          status: 403,
        },
      );
    }

    return NextResponse.json({
      entry: serialiseEntry(
        entry,
      ),
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/timesheets/[id]/entries/[entryId]]",
      error,
    );

    const result =
      timesheetApiError(error);

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
 * PATCH /api/admin/timesheets/[id]/entries/[entryId]
 * =============================================================================
 */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireTimesheetIdentity();

    const {
      id,
      entryId,
    } = await context.params;

    /* =========================================================================
     * EXISTING ENTRY
     * =========================================================================
     */

    const existing =
      await prisma.timesheetEntry.findFirst({
        where: {
          id: entryId,
          timesheetId: id,
        },

        include: {
          timesheet: {
            select: {
              id: true,
              employeeId: true,
              status: true,
              periodStart: true,
              periodEnd: true,
            },
          },
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Timesheet entry not found.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Only DRAFT / REJECTED timesheets can normally be edited.
     */
    assertCanEditTimesheet(
      identity,
      existing.timesheet,
    );

    /*
     * Once this entry has been attached to an invoice,
     * its billing-critical information is frozen.
     */
    assertEntryNotInvoiced(
      existing,
    );

    const body =
      (await request.json()) as
        UpdateEntryBody;

    /* =========================================================================
     * WORK DATE
     * =========================================================================
     */

    const workDate =
      body.workDate ===
      undefined
        ? utcDateOnly(
            existing.workDate,
          )
        : requiredDate(
            body.workDate,
            "Work date",
          );

    /* =========================================================================
     * HOURS
     * =========================================================================
     */

    const hours =
      body.hours ===
      undefined
        ? Number(
            existing.hours,
          )
        : positiveNumber(
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
        ? existing.type
        : parseTimesheetEntryType(
            body.type,
          );

    /* =========================================================================
     * TEXT
     * =========================================================================
     */

    const title =
      body.title ===
      undefined
        ? existing.title
        : requiredString(
            body.title,
            "Title",
          );

    const description =
      body.description ===
      undefined
        ? existing.description
        : optionalText(
            body.description,
            "Description",
          );

    const notes =
      body.notes ===
      undefined
        ? existing.notes
        : optionalText(
            body.notes,
            "Notes",
          );

    /* =========================================================================
     * RELATIONSHIP IDS
     * =========================================================================
     *
     * undefined = retain existing value
     * null / "" = clear existing value
     * string = replace existing value
     * =========================================================================
     */

    const requestedClientId =
      body.clientId ===
      undefined
        ? existing.clientId
        : optionalId(
            body.clientId,
            "Client",
          );

    const requestedProjectId =
      body.projectId ===
      undefined
        ? existing.projectId
        : optionalId(
            body.projectId,
            "Project",
          );

    const requestedAllocationId =
      body.allocationId ===
      undefined
        ? existing.allocationId
        : optionalId(
            body.allocationId,
            "Allocation",
          );

    const contextValues =
      await resolveTimesheetEntryContext({
        employeeId:
          existing.timesheet.employeeId,

        clientId:
          requestedClientId,

        projectId:
          requestedProjectId,

        allocationId:
          requestedAllocationId,
      });

    /* =========================================================================
     * BILLABLE
     * =========================================================================
     */

    let billable =
      existing.billable;

    if (
      body.billable !==
      undefined
    ) {
      billable =
        optionalBoolean(
          body.billable,
          existing.billable,
        );
    } else if (
      body.allocationId !==
        undefined &&
      contextValues.allocationBillable !==
        null
    ) {
      /*
       * If the allocation itself was changed and the browser
       * did not explicitly choose a billable value, inherit
       * the new allocation's billing behaviour.
       */
      billable =
        contextValues.allocationBillable;
    }

    /* =========================================================================
     * CLOCK TIMES
     * =========================================================================
     */

    const startedAt =
      body.startedAt ===
      undefined
        ? existing.startedAt
        : optionalDateTime(
            body.startedAt,
            "Start time",
          );

    const endedAt =
      body.endedAt ===
      undefined
        ? existing.endedAt
        : optionalDateTime(
            body.endedAt,
            "End time",
          );

    /* =========================================================================
     * VALIDATION
     * =========================================================================
     */

    validateTimesheetEntryValues({
      timesheet:
        existing.timesheet,

      workDate,

      hours,

      startedAt,
      endedAt,
    });

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
     * UPDATE
     * =========================================================================
     */

    await prisma.$transaction(
      async (tx) => {
        await tx.timesheetEntry.update({
          where: {
            id:
              existing.id,
          },

          data: {
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
        });

        /*
         * Never trust totals from the browser.
         *
         * Recalculate from the actual TimesheetEntry rows.
         */
        await recalculateTimesheetTotals(
          existing.timesheet.id,
          tx,
        );

        await tx.timesheetActivity.create({
          data: {
            timesheetId:
              existing.timesheet.id,

            employeeId:
              existing.timesheet.employeeId,

            actorId:
              identity.admin.id,

            type:
              "ENTRY_UPDATED",

            description:
              `Updated "${title}" (${formatHours(hours)}).`,

            metadata: {
              entryId:
                existing.id,

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
      },
    );

    /* =========================================================================
     * RELOAD
     * =========================================================================
     */

    const updated =
      await getTimesheetById(
        existing.timesheet.id,
      );

    if (!updated) {
      throw new Error(
        "Unable to reload the updated timesheet.",
      );
    }

    return NextResponse.json({
      message:
        "Time entry updated successfully.",

      timesheet:
        timesheetDTO(
          updated,
          identity,
        ),
    });
  } catch (error) {
    console.error(
      "[PATCH /api/admin/timesheets/[id]/entries/[entryId]]",
      error,
    );

    const result =
      timesheetApiError(error);

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
 * DELETE /api/admin/timesheets/[id]/entries/[entryId]
 * =============================================================================
 */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireTimesheetIdentity();

    const {
      id,
      entryId,
    } = await context.params;

    const existing =
      await prisma.timesheetEntry.findFirst({
        where: {
          id: entryId,
          timesheetId: id,
        },

        include: {
          timesheet: {
            select: {
              id: true,
              employeeId: true,
              status: true,
            },
          },
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error:
            "Timesheet entry not found.",
        },
        {
          status: 404,
        },
      );
    }

    assertCanEditTimesheet(
      identity,
      existing.timesheet,
    );

    /*
     * A billed entry cannot be removed because that would
     * invalidate the relationship between approved time and
     * the client invoice.
     */
    assertEntryNotInvoiced(
      existing,
    );

    const deletedTitle =
      existing.title;

    const deletedHours =
      Number(
        existing.hours,
      );

    await prisma.$transaction(
      async (tx) => {
        await tx.timesheetEntry.delete({
          where: {
            id:
              existing.id,
          },
        });

        await recalculateTimesheetTotals(
          existing.timesheet.id,
          tx,
        );

        await tx.timesheetActivity.create({
          data: {
            timesheetId:
              existing.timesheet.id,

            employeeId:
              existing.timesheet.employeeId,

            actorId:
              identity.admin.id,

            type:
              "ENTRY_REMOVED",

            description:
              `Removed "${deletedTitle}" (${formatHours(
                deletedHours,
              )}).`,

            metadata: {
              entryId:
                existing.id,

              title:
                deletedTitle,

              hours:
                deletedHours,

              workDate:
                existing.workDate.toISOString(),

              clientId:
                existing.clientId,

              projectId:
                existing.projectId,

              allocationId:
                existing.allocationId,
            },
          },
        });
      },
    );

    const updated =
      await getTimesheetById(
        existing.timesheet.id,
      );

    if (!updated) {
      throw new Error(
        "Unable to reload the updated timesheet.",
      );
    }

    return NextResponse.json({
      message:
        "Time entry removed successfully.",

      timesheet:
        timesheetDTO(
          updated,
          identity,
        ),
    });
  } catch (error) {
    console.error(
      "[DELETE /api/admin/timesheets/[id]/entries/[entryId]]",
      error,
    );

    const result =
      timesheetApiError(error);

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
 * SERIALISER
 * =============================================================================
 */

function serialiseEntry(entry: {
  id: string;

  timesheetId: string;
  employeeId: string;

  clientId: string | null;
  projectId: string | null;
  allocationId: string | null;

  workDate: Date;

  type: unknown;

  title: string;
  description: string | null;

  hours: unknown;

  billable: boolean;

  startedAt: Date | null;
  endedAt: Date | null;

  invoiceId: string | null;
  billedAt: Date | null;

  notes: string | null;

  createdAt: Date;
  updatedAt: Date;

  client: {
    id: string;
    name: string;
    displayName: string | null;
  } | null;

  project: {
    id: string;
    name: string;
    clientId: string;
  } | null;

  allocation: {
    id: string;
    title: string;
    clientId: string | null;
    projectId: string | null;
    billable: boolean;
  } | null;
}) {
  return {
    id:
      entry.id,

    timesheetId:
      entry.timesheetId,

    employeeId:
      entry.employeeId,

    clientId:
      entry.clientId,

    projectId:
      entry.projectId,

    allocationId:
      entry.allocationId,

    workDate:
      entry.workDate.toISOString(),

    type:
      entry.type,

    title:
      entry.title,

    description:
      entry.description,

    hours:
      Number(
        entry.hours,
      ),

    billable:
      entry.billable,

    startedAt:
      entry.startedAt?.toISOString() ??
      null,

    endedAt:
      entry.endedAt?.toISOString() ??
      null,

    invoiceId:
      entry.invoiceId,

    billedAt:
      entry.billedAt?.toISOString() ??
      null,

    notes:
      entry.notes,

    client:
      entry.client,

    project:
      entry.project,

    allocation:
      entry.allocation,

    invoiced:
      Boolean(
        entry.invoiceId ||
          entry.billedAt,
      ),

    createdAt:
      entry.createdAt.toISOString(),

    updatedAt:
      entry.updatedAt.toISOString(),
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