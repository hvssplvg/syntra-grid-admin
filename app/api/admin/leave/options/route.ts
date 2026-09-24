import {
  LeaveDayPortion,
  LeaveRequestStatus,
  LeaveType,
} from "@/app/generated/prisma/client";

import {
  apiError,
  requireLeaveIdentity,
  serializePolicy,
} from "@/lib/leave/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const identity = await requireLeaveIdentity();

    const policies = await prisma.leavePolicy.findMany({
      where: {
        active: true,
      },
      orderBy: [
        {
          displayOrder: "asc",
        },
        {
          name: "asc",
        },
      ],
    });

    return Response.json({
      employee: {
        id: identity.employee.id,
        employeeRef: identity.employee.employeeRef,
        firstName: identity.employee.firstName,
        lastName: identity.employee.lastName,
        preferredName: identity.employee.preferredName,
        avatarUrl: identity.employee.avatarUrl,
        jobTitle: identity.employee.jobTitle,
      },

      permissions: {
        canRequest: true,
        canManage: identity.isLeaveManager,
        canManagePolicies: identity.isLeaveManager,
        canManageBalances: identity.isLeaveManager,
      },

      policies: policies.map(serializePolicy),

      leaveTypes: Object.values(LeaveType),
      dayPortions: Object.values(LeaveDayPortion),
      statuses: Object.values(LeaveRequestStatus),
    });
  } catch (error) {
    return apiError(error);
  }
}