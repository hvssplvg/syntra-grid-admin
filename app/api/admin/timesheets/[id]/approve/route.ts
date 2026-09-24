import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  TimesheetStatus,
} from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  assertCanApproveTimesheet,
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

type ApproveBody = {
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
          totalHours: true,
          billableHours: true,
          expectedHours: true,
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

    assertCanApproveTimesheet(
      identity,
      existing,
    );

    let body: ApproveBody = {};

    try {
      body =
        (await request.json()) as
          ApproveBody;
    } catch {
      /*
       * Empty request bodies are valid for approval.
       */
    }

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
              TimesheetStatus.APPROVED,

            reviewedById:
              identity.admin.id,

            reviewedAt:
              now,

            reviewNote,

            rejectionReason:
              null,

            rejectedAt:
              null,

            approvedAt:
              now,
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
              "APPROVED",

            description:
              "Timesheet approved.",

            metadata: {
              approvedAt:
                now.toISOString(),

              totalHours:
                Number(
                  existing.totalHours,
                ),

              billableHours:
                Number(
                  existing.billableHours,
                ),

              expectedHours:
                existing.expectedHours ===
                null
                  ? null
                  : Number(
                      existing.expectedHours,
                    ),

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
        "Unable to reload the approved timesheet.",
      );
    }

    return NextResponse.json({
      message:
        "Timesheet approved successfully.",

      timesheet:
        timesheetDTO(
          updated,
          identity,
        ),
    });
  } catch (error) {
    console.error(
      "[POST /api/admin/timesheets/[id]/approve]",
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