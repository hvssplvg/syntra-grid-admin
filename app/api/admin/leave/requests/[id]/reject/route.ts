import {
  LeaveRequestStatus,
} from "@/app/generated/prisma/client";

import {
  apiError,
  decimalToNumber,
  requireLeaveManager,
} from "@/lib/leave/server";

import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const {
      admin,
      employee,
    } = await requireLeaveManager();

    const { id } =
      await context.params;

    const body =
      await request
        .json()
        .catch(() => ({}));

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    if (!reason) {
      return Response.json(
        {
          error:
            "Please provide a reason for rejecting the leave request.",
        },
        { status: 400 },
      );
    }

    const existing =
      await prisma.leaveRequest.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      return Response.json(
        {
          error:
            "Leave request not found.",
        },
        { status: 404 },
      );
    }

    if (
      existing.employeeId ===
      employee.id
    ) {
      return Response.json(
        {
          error:
            "You cannot reject your own leave request.",
        },
        { status: 403 },
      );
    }

    if (
      existing.status !==
      LeaveRequestStatus.PENDING
    ) {
      return Response.json(
        {
          error:
            "Only pending leave requests can be rejected.",
        },
        { status: 409 },
      );
    }

    const updated =
      await prisma.$transaction(
        async (tx) => {
          const leave =
            await tx.leaveRequest.update({
              where: {
                id,
              },

              data: {
                status:
                  LeaveRequestStatus.REJECTED,

                reviewedById:
                  admin.id,

                reviewedAt:
                  new Date(),

                rejectionReason:
                  reason,
              },
            });

          await tx.leaveActivity.create({
            data: {
              leaveRequestId:
                leave.id,

              employeeId:
                leave.employeeId,

              actorId:
                admin.id,

              type:
                "REQUEST_REJECTED",

              description:
                "Leave request rejected.",

              metadata: {
                reason,
              },
            },
          });

          return leave;
        },
      );

    return Response.json({
      request: {
        ...updated,
        totalDays:
          decimalToNumber(
            updated.totalDays,
          ) ?? 0,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}