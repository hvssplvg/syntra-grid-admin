import {
  apiError,
  decimalToNumber,
  requireLeaveIdentity,
} from "@/lib/leave/server";
import { requirePermission } from "@/lib/auth/current-admin";
import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";

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
      admin,
      employee,
      isLeaveManager,
    } = await requireLeaveIdentity();

    if (admin.restrictedAccess) {
      await requirePermission(
        "leave",
        AccessAction.VIEW,
        { scope: AccessScope.OWN },
      );
    }

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

    // internalNote is a management-only annotation (see the schema
    // comment on LeaveRequest.internalNote) — never exposed to a
    // non-manager, including the request's own owner.
    const { internalNote, ...visibleLeave } = leave;

    return Response.json({
      request: {
        ...visibleLeave,

        internalNote: isLeaveManager ? internalNote : undefined,

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