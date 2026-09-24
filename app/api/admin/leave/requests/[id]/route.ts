import {
  apiError,
  decimalToNumber,
  requireLeaveIdentity,
} from "@/lib/leave/server";

import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const {
      employee,
      isLeaveManager,
    } = await requireLeaveIdentity();

    const { id } =
      await context.params;

    const leave =
      await prisma.leaveRequest.findUnique({
        where: {
          id,
        },

        include: {
          policy: true,

          employee: {
            include: {
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },

          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },

          activities: {
            include: {
              actor: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },

            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    if (!leave) {
      return Response.json(
        {
          error:
            "Leave request not found.",
        },
        { status: 404 },
      );
    }

    if (
      !isLeaveManager &&
      leave.employeeId !==
        employee.id
    ) {
      return Response.json(
        {
          error:
            "You are not authorised to view this leave request.",
        },
        { status: 403 },
      );
    }

    return Response.json({
      request: {
        ...leave,

        totalDays:
          decimalToNumber(
            leave.totalDays,
          ) ?? 0,

        policy: {
          ...leave.policy,

          annualAllowance:
            decimalToNumber(
              leave.policy
                .annualAllowance,
            ),

          maxCarryOverDays:
            decimalToNumber(
              leave.policy
                .maxCarryOverDays,
            ),

          maximumDaysPerRequest:
            decimalToNumber(
              leave.policy
                .maximumDaysPerRequest,
            ),
        },
      },
    });
  } catch (error) {
    return apiError(error);
  }
}