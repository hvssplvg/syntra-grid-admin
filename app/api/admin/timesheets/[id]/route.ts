import {
  NextRequest,
  NextResponse,
} from "next/server";

import { prisma } from "@/lib/prisma";

import {
  assertCanEditTimesheet,
  assertCanViewEmployeeTimesheet,
  getTimesheetById,
  requireTimesheetIdentity,
  timesheetApiError,
  timesheetDTO,
} from "@/lib/timesheets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateTimesheetBody = {
  employeeNote?: unknown;
};

/* =============================================================================
 * GET /api/admin/timesheets/[id]
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

    assertCanViewEmployeeTimesheet(
      identity,
      timesheet.employeeId,
    );

    return NextResponse.json({
      timesheet:
        timesheetDTO(
          timesheet,
          identity,
        ),
    });
  } catch (error) {
    console.error(
      "[GET /api/admin/timesheets/[id]]",
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
 * PATCH /api/admin/timesheets/[id]
 * =============================================================================
 *
 * Currently edits the employee note.
 *
 * We deliberately do NOT allow:
 *
 * - employeeId
 * - periodStart
 * - periodEnd
 * - status
 * - totals
 * - review fields
 * - lock fields
 *
 * through this generic route.
 *
 * Workflow fields are controlled by their dedicated endpoints.
 * =============================================================================
 */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireTimesheetIdentity();

    const { id } =
      await context.params;

    const existing =
      await prisma.timesheet.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          employeeId: true,
          status: true,
        },
      });

    if (!existing) {
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

    assertCanEditTimesheet(
      identity,
      existing,
    );

    const body =
      (await request.json()) as
        UpdateTimesheetBody;

    if (
      body.employeeNote ===
      undefined
    ) {
      throw new Error(
        "No timesheet changes were supplied.",
      );
    }

    const employeeNote =
      nullableString(
        body.employeeNote,
        "Employee note",
      );

    await prisma.$transaction(
      async (tx) => {
        await tx.timesheet.update({
          where: {
            id,
          },

          data: {
            employeeNote,
          },
        });

        await tx.timesheetActivity.create({
          data: {
            timesheetId:
              existing.id,

            employeeId:
              existing.employeeId,

            actorId:
              identity.admin.id,

            type:
              "NOTE_ADDED",

            description:
              employeeNote
                ? "Timesheet note updated."
                : "Timesheet note removed.",

            metadata: {
              hasNote:
                Boolean(
                  employeeNote,
                ),
            },
          },
        });
      },
    );

    const updated =
      await getTimesheetById(id);

    if (!updated) {
      throw new Error(
        "Unable to load the updated timesheet.",
      );
    }

    return NextResponse.json({
      message:
        "Timesheet updated successfully.",

      timesheet:
        timesheetDTO(
          updated,
          identity,
        ),
    });
  } catch (error) {
    console.error(
      "[PATCH /api/admin/timesheets/[id]]",
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
 * DELETE /api/admin/timesheets/[id]
 * =============================================================================
 *
 * OWNER / ADMIN only.
 *
 * Only a DRAFT timesheet can be deleted.
 *
 * Invoiced/billed entries prevent deletion.
 * =============================================================================
 */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireTimesheetIdentity();

    if (
      !identity.isTimesheetManager
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to delete company timesheets.",
        },
        {
          status: 403,
        },
      );
    }

    const { id } =
      await context.params;

    const existing =
      await prisma.timesheet.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          employeeId: true,
          status: true,

          entries: {
            select: {
              id: true,
              invoiceId: true,
              billedAt: true,
            },
          },
        },
      });

    if (!existing) {
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
      existing.status !==
      "DRAFT"
    ) {
      throw new Error(
        "Only draft timesheets can be deleted.",
      );
    }

    const hasBilledEntries =
      existing.entries.some(
        (entry) =>
          Boolean(
            entry.invoiceId ||
              entry.billedAt,
          ),
      );

    if (hasBilledEntries) {
      throw new Error(
        "This timesheet contains billed entries and cannot be deleted.",
      );
    }

    await prisma.timesheet.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      message:
        "Timesheet deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[DELETE /api/admin/timesheets/[id]]",
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

  return (
    value.trim() ||
    null
  );
}