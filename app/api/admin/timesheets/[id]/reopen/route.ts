import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  TimesheetStatus,
} from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  assertCanReopenTimesheet,
  getTimesheetById,
  optionalText,
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

type ReopenBody = {
  note?: unknown;
};

export async function POST(
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

    assertCanReopenTimesheet(
      identity,
      existing,
    );

    let body: ReopenBody = {};

    try {
      body =
        (await request.json()) as
          ReopenBody;
    } catch {
      // Reopen note is optional.
    }

    const note =
      optionalText(
        body.note,
        "Reopen note",
      );

    const previousStatus =
      existing.status;

    const now =
      new Date();

    await prisma.$transaction(
      async (tx) => {
        await tx.timesheet.update({
          where: {
            id:
              existing.id,
          },

          data: {
            status:
              TimesheetStatus.DRAFT,

            reviewedById:
              null,

            reviewedAt:
              null,

            reviewNote:
              null,

            rejectionReason:
              null,

            submittedAt:
              null,

            approvedAt:
              null,

            rejectedAt:
              null,

            lockedAt:
              null,

            lockedById:
              null,
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
              "REOPENED",

            description:
              "Timesheet reopened for editing.",

            metadata: {
              previousStatus,

              reopenedAt:
                now.toISOString(),

              note,
            },
          },
        });
      },
    );

    const updated =
      await getTimesheetById(
        existing.id,
      );

    if (!updated) {
      throw new Error(
        "Unable to reload the reopened timesheet.",
      );
    }

    return NextResponse.json({
      message:
        "Timesheet reopened successfully.",

      timesheet:
        timesheetDTO(
          updated,
          identity,
        ),
    });
  } catch (error) {
    console.error(
      "[POST /api/admin/timesheets/[id]/reopen]",
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