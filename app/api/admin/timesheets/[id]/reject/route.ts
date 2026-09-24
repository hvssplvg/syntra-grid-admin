import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  TimesheetStatus,
} from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  assertCanRejectTimesheet,
  getTimesheetById,
  optionalText,
  requiredText,
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

type RejectBody = {
  rejectionReason?: unknown;
  reviewNote?: unknown;
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

    assertCanRejectTimesheet(
      identity,
      existing,
    );

    const body =
      (await request.json()) as
        RejectBody;

    const rejectionReason =
      requiredText(
        body.rejectionReason,
        "Rejection reason",
      );

    const reviewNote =
      optionalText(
        body.reviewNote,
        "Review note",
      );

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
              TimesheetStatus.REJECTED,

            reviewedById:
              identity.admin.id,

            reviewedAt:
              now,

            reviewNote,

            rejectionReason,

            rejectedAt:
              now,

            approvedAt:
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
              "REJECTED",

            description:
              "Timesheet rejected and returned for changes.",

            metadata: {
              rejectedAt:
                now.toISOString(),

              rejectionReason,

              reviewNote,
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
        "Unable to reload the rejected timesheet.",
      );
    }

    return NextResponse.json({
      message:
        "Timesheet rejected.",

      timesheet:
        timesheetDTO(
          updated,
          identity,
        ),
    });
  } catch (error) {
    console.error(
      "[POST /api/admin/timesheets/[id]/reject]",
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