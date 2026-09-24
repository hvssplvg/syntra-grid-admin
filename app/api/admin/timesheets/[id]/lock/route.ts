import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  TimesheetStatus,
} from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  assertCanLockTimesheet,
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

    assertCanLockTimesheet(
      identity,
      existing,
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
              TimesheetStatus.LOCKED,

            lockedAt:
              now,

            lockedById:
              identity.admin.id,
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
              "LOCKED",

            description:
              "Timesheet locked.",

            metadata: {
              lockedAt:
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
        "Unable to reload the locked timesheet.",
      );
    }

    return NextResponse.json({
      message:
        "Timesheet locked successfully.",

      timesheet:
        timesheetDTO(
          updated,
          identity,
        ),
    });
  } catch (error) {
    console.error(
      "[POST /api/admin/timesheets/[id]/lock]",
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