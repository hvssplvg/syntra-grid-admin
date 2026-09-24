import {
  LeaveRequestStatus,
} from "@/app/generated/prisma/client";

import {
  apiError,
  decimalToNumber,
  requireLeaveIdentity,
} from "@/lib/leave/server";

import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
) {
  try {
    await requireLeaveIdentity();

    const url = new URL(request.url);

    const now = new Date();

    const year =
      Number(
        url.searchParams.get("year"),
      ) || now.getUTCFullYear();

    const month =
      Number(
        url.searchParams.get("month"),
      ) || now.getUTCMonth() + 1;

    if (
      month < 1 ||
      month > 12
    ) {
      return Response.json(
        {
          error:
            "Month must be between 1 and 12.",
        },
        { status: 400 },
      );
    }

    const start =
      new Date(
        Date.UTC(
          year,
          month - 1,
          1,
        ),
      );

    const end =
      new Date(
        Date.UTC(
          year,
          month,
          1,
        ),
      );

    const requests =
      await prisma.leaveRequest.findMany({
        where: {
          status: {
            in: [
              LeaveRequestStatus.APPROVED,
              LeaveRequestStatus.RECORDED,
            ],
          },

          startDate: {
            lt: end,
          },

          endDate: {
            gte: start,
          },
        },

        include: {
          policy: {
            select: {
              id: true,
              name: true,
              type: true,
              paid: true,
            },
          },

          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              avatarUrl: true,
              jobTitle: true,

              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },

        orderBy: {
          startDate: "asc",
        },
      });

    return Response.json({
      year,
      month,

      leave: requests.map(
        (item) => ({
          id: item.id,
          startDate:
            item.startDate,
          endDate:
            item.endDate,

          startPortion:
            item.startPortion,

          endPortion:
            item.endPortion,

          totalDays:
            decimalToNumber(
              item.totalDays,
            ) ?? 0,

          employee:
            item.employee,

          policy:
            item.policy,
        }),
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}