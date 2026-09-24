import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  TimesheetStatus,
} from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  assertCanSubmitTimesheet,
  calculateExpectedHours,
  getTimesheetById,
  recalculateTimesheetTotals,
  requireTimesheetIdentity,
  timesheetApiError,
  timesheetDTO,
  utcDateOnly,
  addUtcDays,
} from "@/lib/timesheets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  _request: NextRequest,
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
          periodStart: true,
          periodEnd: true,
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

    /*
     * First recalculate the totals from the actual entries.
     */
    const totals =
      await recalculateTimesheetTotals(
        existing.id,
      );

    assertCanSubmitTimesheet(
      identity,
      {
        employeeId:
          existing.employeeId,

        status:
          existing.status,

        totalHours:
          totals.totalHours,
      },
    );

    /*
     * Refresh expected capacity from the employee's current
     * work schedule and approved / recorded leave.
     *
     * Timesheet periodEnd is inclusive, while the capacity
     * helper expects an exclusive end.
     */
    const expectedHours =
      await calculateExpectedHours(
        existing.employeeId,

        utcDateOnly(
          existing.periodStart,
        ),

        addUtcDays(
          utcDateOnly(
            existing.periodEnd,
          ),
          1,
        ),
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
              TimesheetStatus.SUBMITTED,

            expectedHours,

            submittedAt:
              now,

            /*
             * A resubmitted rejected timesheet is no longer
             * considered rejected.
             */
            rejectedAt:
              null,

            rejectionReason:
              null,

            reviewedAt:
              null,

            reviewedById:
              null,

            reviewNote:
              null,

            approvedAt:
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
              "SUBMITTED",

            description:
              "Timesheet submitted for approval.",

            metadata: {
              totalHours:
                totals.totalHours,

              billableHours:
                totals.billableHours,

              expectedHours,

              submittedAt:
                now.toISOString(),
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
        "Unable to reload the submitted timesheet.",
      );
    }

    return NextResponse.json({
      message:
        "Timesheet submitted successfully.",

      timesheet:
        timesheetDTO(
          updated,
          identity,
        ),
    });
  } catch (error) {
    console.error(
      "[POST /api/admin/timesheets/[id]/submit]",
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