import {
  LeaveRequestStatus,
} from "@/app/generated/prisma/client";

import {
  apiError,
  canCancelLeave,
  decimalToNumber,
  requireLeaveIdentity,
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
      isLeaveManager,
    } = await requireLeaveIdentity();

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

    const ownRequest =
      existing.employeeId ===
      employee.id;

    if (
      !ownRequest &&
      !isLeaveManager
    ) {
      return Response.json(
        {
          error:
            "You are not authorised to cancel this leave request.",
        },
        { status: 403 },
      );
    }

    if (
      !canCancelLeave(
        existing.status,
      )
    ) {
      return Response.json(
        {
          error:
            "This leave request can no longer be cancelled.",
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
                  LeaveRequestStatus.CANCELLED,

                cancelledAt:
                  new Date(),

                cancellationReason:
                  reason || null,
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
                "REQUEST_CANCELLED",

              description:
                ownRequest
                  ? "Leave request cancelled by the employee."
                  : "Leave request cancelled by management.",

              metadata:
                reason
                  ? {
                      reason,
                    }
                  : undefined,
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