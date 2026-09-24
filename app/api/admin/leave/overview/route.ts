import { LeaveRequestStatus } from "@/app/generated/prisma/client";

import {
  apiError,
  decimalToNumber,
  requireLeaveIdentity,
} from "@/lib/leave/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const {
      employee,
      isLeaveManager,
    } = await requireLeaveIdentity();

    const now = new Date();
    const year = now.getUTCFullYear();

    const yearStart = new Date(
      Date.UTC(year, 0, 1),
    );

    const yearEnd = new Date(
      Date.UTC(year + 1, 0, 1),
    );

    const [
      balances,
      myRequests,
      pendingCount,
      offTodayCount,
      upcomingCount,
    ] = await Promise.all([
      prisma.leaveBalance.findMany({
        where: {
          employeeId: employee.id,
          year,
        },
        include: {
          policy: true,
        },
        orderBy: {
          policy: {
            displayOrder: "asc",
          },
        },
      }),

      prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
        },
        include: {
          policy: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 6,
      }),

      isLeaveManager
        ? prisma.leaveRequest.count({
            where: {
              status:
                LeaveRequestStatus.PENDING,
            },
          })
        : Promise.resolve(0),

      isLeaveManager
        ? prisma.leaveRequest.count({
            where: {
              status: {
                in: [
                  LeaveRequestStatus.APPROVED,
                  LeaveRequestStatus.RECORDED,
                ],
              },
              startDate: {
                lte: now,
              },
              endDate: {
                gte: now,
              },
            },
          })
        : Promise.resolve(0),

      isLeaveManager
        ? prisma.leaveRequest.count({
            where: {
              status: {
                in: [
                  LeaveRequestStatus.APPROVED,
                  LeaveRequestStatus.RECORDED,
                ],
              },
              startDate: {
                gt: now,
                lt: yearEnd,
              },
            },
          })
        : Promise.resolve(0),
    ]);

    const myApprovedThisYear =
      await prisma.leaveRequest.aggregate({
        where: {
          employeeId: employee.id,

          status: {
            in: [
              LeaveRequestStatus.APPROVED,
              LeaveRequestStatus.RECORDED,
            ],
          },

          startDate: {
            gte: yearStart,
            lt: yearEnd,
          },
        },

        _sum: {
          totalDays: true,
        },
      });

    return Response.json({
      employee: {
        id: employee.id,
        employeeRef: employee.employeeRef,
        firstName: employee.firstName,
        lastName: employee.lastName,
        preferredName: employee.preferredName,
        avatarUrl: employee.avatarUrl,
        jobTitle: employee.jobTitle,
      },

      permissions: {
        canManage: isLeaveManager,
      },

      year,

      my: {
        approvedDaysThisYear:
          decimalToNumber(
            myApprovedThisYear._sum.totalDays,
          ) ?? 0,

        balances: balances.map((balance) => ({
          id: balance.id,
          year: balance.year,

          entitlement:
            decimalToNumber(
              balance.entitlement,
            ) ?? 0,

          carriedOver:
            decimalToNumber(
              balance.carriedOver,
            ) ?? 0,

          adjustment:
            decimalToNumber(
              balance.adjustment,
            ) ?? 0,

          used:
            decimalToNumber(balance.used) ?? 0,

          booked:
            decimalToNumber(balance.booked) ?? 0,

          available:
            (decimalToNumber(
              balance.entitlement,
            ) ?? 0) +
            (decimalToNumber(
              balance.carriedOver,
            ) ?? 0) +
            (decimalToNumber(
              balance.adjustment,
            ) ?? 0) -
            (decimalToNumber(balance.used) ?? 0) -
            (decimalToNumber(
              balance.booked,
            ) ?? 0),

          policy: {
            id: balance.policy.id,
            name: balance.policy.name,
            code: balance.policy.code,
            type: balance.policy.type,
            paid: balance.policy.paid,
          },
        })),

        recentRequests: myRequests.map(
          (request) => ({
            id: request.id,
            requestRef: request.requestRef,
            status: request.status,
            startDate: request.startDate,
            endDate: request.endDate,
            totalDays:
              decimalToNumber(
                request.totalDays,
              ) ?? 0,

            policy: {
              id: request.policy.id,
              name: request.policy.name,
              type: request.policy.type,
            },
          }),
        ),
      },

      management: isLeaveManager
        ? {
            pendingRequests: pendingCount,
            offToday: offTodayCount,
            upcomingLeave: upcomingCount,
          }
        : null,
    });
  } catch (error) {
    return apiError(error);
  }
}