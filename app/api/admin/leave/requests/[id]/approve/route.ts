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

    const internalNote =
      typeof body.internalNote === "string"
        ? body.internalNote.trim()
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

    if (
      existing.employeeId ===
      employee.id
    ) {
      return Response.json(
        {
          error:
            "You cannot approve your own leave request.",
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
            "Only pending leave requests can be approved.",
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
                  LeaveRequestStatus.APPROVED,

                reviewedById:
                  admin.id,

                reviewedAt:
                  new Date(),

                internalNote:
                  internalNote ||
                  existing.internalNote,

                rejectionReason:
                  null,
              },

              include: {
                policy: true,
                employee: true,
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
                "REQUEST_APPROVED",

              description:
                "Leave request approved.",

              metadata:
                internalNote
                  ? {
                      internalNote,
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