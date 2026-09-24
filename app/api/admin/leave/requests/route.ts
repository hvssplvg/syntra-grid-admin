import {
  LeaveDayPortion,
  LeaveRequestStatus,
} from "@/app/generated/prisma/client";

import {
  apiError,
  calculateLeaveDays,
  decimalToNumber,
  leaveRequestRef,
  normaliseDate,
  requireLeaveIdentity,
} from "@/lib/leave/server";

import { prisma } from "@/lib/prisma";

type DecimalLike =
  | {
      toString(): string;
    }
  | number
  | string
  | null
  | undefined;

type SerializableLeaveRequest = {
  totalDays: DecimalLike;
  [key: string]: unknown;
};

function serialiseRequest<T extends SerializableLeaveRequest>(
  request: T,
) {
  return {
    ...request,
    totalDays:
      decimalToNumber(request.totalDays) ?? 0,
  };
}

function isLeaveRequestStatus(
  value: string,
): value is LeaveRequestStatus {
  return Object.values(
    LeaveRequestStatus,
  ).includes(value as LeaveRequestStatus);
}

function isLeaveDayPortion(
  value: unknown,
): value is LeaveDayPortion {
  return (
    typeof value === "string" &&
    Object.values(
      LeaveDayPortion,
    ).includes(value as LeaveDayPortion)
  );
}

export async function GET(
  request: Request,
) {
  try {
    const {
      employee,
      isLeaveManager,
    } = await requireLeaveIdentity();

    const url = new URL(request.url);

    const scope =
      url.searchParams.get("scope") ?? "mine";

    const status =
      url.searchParams.get("status");

    const policyId =
      url.searchParams.get("policyId");

    const q =
      url.searchParams.get("q")?.trim();

    const managementScope =
      scope === "all" && isLeaveManager;

    const requests =
      await prisma.leaveRequest.findMany({
        where: {
          ...(!managementScope
            ? {
                employeeId: employee.id,
              }
            : {}),

          ...(status &&
          isLeaveRequestStatus(status)
            ? {
                status,
              }
            : {}),

          ...(policyId
            ? {
                policyId,
              }
            : {}),

          ...(managementScope && q
            ? {
                employee: {
                  OR: [
                    {
                      firstName: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                    {
                      lastName: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                    {
                      workEmail: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                    {
                      employeeRef: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              }
            : {}),
        },

        include: {
          policy: true,

          employee: {
            select: {
              id: true,
              employeeRef: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              avatarUrl: true,
              jobTitle: true,
              workEmail: true,

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
        },

        orderBy: [
          {
            createdAt: "desc",
          },
        ],
      });

    return Response.json({
      scope: managementScope
        ? "all"
        : "mine",

      requests:
        requests.map(serialiseRequest),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: Request,
) {
  try {
    const {
      admin,
      employee,
    } = await requireLeaveIdentity();

    const body: unknown =
      await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return Response.json(
        {
          error:
            "Invalid request body.",
        },
        {
          status: 400,
        },
      );
    }

    const input =
      body as Record<string, unknown>;

    const policyId =
      typeof input.policyId === "string"
        ? input.policyId.trim()
        : "";

    if (!policyId) {
      return Response.json(
        {
          error:
            "A leave policy is required.",
        },
        {
          status: 400,
        },
      );
    }

    const policy =
      await prisma.leavePolicy.findFirst({
        where: {
          id: policyId,
          active: true,
        },
      });

    if (!policy) {
      return Response.json(
        {
          error:
            "The selected leave policy is unavailable.",
        },
        {
          status: 404,
        },
      );
    }

    const startDate =
      normaliseDate(input.startDate);

    const endDate =
      normaliseDate(input.endDate);

    if (!startDate || !endDate) {
      return Response.json(
        {
          error:
            "Valid start and end dates are required.",
        },
        {
          status: 400,
        },
      );
    }

    if (endDate < startDate) {
      return Response.json(
        {
          error:
            "The end date cannot be before the start date.",
        },
        {
          status: 400,
        },
      );
    }

    const startPortion =
      isLeaveDayPortion(
        input.startPortion,
      )
        ? input.startPortion
        : LeaveDayPortion.FULL_DAY;

    const endPortion =
      isLeaveDayPortion(
        input.endPortion,
      )
        ? input.endPortion
        : LeaveDayPortion.FULL_DAY;

    const reason =
      typeof input.reason === "string"
        ? input.reason.trim()
        : "";

    const employeeNote =
      typeof input.employeeNote ===
      "string"
        ? input.employeeNote.trim()
        : "";

    if (
      policy.reasonRequired &&
      !reason
    ) {
      return Response.json(
        {
          error:
            "A reason is required for this type of leave.",
        },
        {
          status: 400,
        },
      );
    }

    const today = new Date();

    today.setUTCHours(
      0,
      0,
      0,
      0,
    );

    if (
      !policy.allowBackdated &&
      startDate < today
    ) {
      return Response.json(
        {
          error:
            "This leave policy does not allow backdated requests.",
        },
        {
          status: 400,
        },
      );
    }

    const totalDays =
      calculateLeaveDays({
        startDate,
        endDate,
        startPortion,
        endPortion,
        countWeekends:
          policy.countWeekends,
      });

    if (
      policy.maximumDaysPerRequest &&
      totalDays >
        Number(
          policy.maximumDaysPerRequest,
        )
    ) {
      return Response.json(
        {
          error:
            `This leave policy allows a maximum of ${policy.maximumDaysPerRequest.toString()} days per request.`,
        },
        {
          status: 400,
        },
      );
    }

    if (
      policy.minimumNoticeDays &&
      policy.minimumNoticeDays > 0
    ) {
      const difference =
        Math.floor(
          (startDate.getTime() -
            today.getTime()) /
            86_400_000,
        );

      if (
        difference <
        policy.minimumNoticeDays
      ) {
        return Response.json(
          {
            error:
              `This leave policy requires at least ${policy.minimumNoticeDays} days' notice.`,
          },
          {
            status: 400,
          },
        );
      }
    }

    const overlapping =
      await prisma.leaveRequest.findFirst({
        where: {
          employeeId: employee.id,

          status: {
            in: [
              LeaveRequestStatus.PENDING,
              LeaveRequestStatus.APPROVED,
              LeaveRequestStatus.RECORDED,
            ],
          },

          startDate: {
            lte: endDate,
          },

          endDate: {
            gte: startDate,
          },
        },
      });

    if (overlapping) {
      return Response.json(
        {
          error:
            "You already have a leave request covering part of these dates.",
        },
        {
          status: 409,
        },
      );
    }

    const ownerSelfRecord =
      admin.role === "OWNER";

    const status =
      ownerSelfRecord
        ? LeaveRequestStatus.RECORDED
        : policy.requiresApproval
          ? LeaveRequestStatus.PENDING
          : LeaveRequestStatus.APPROVED;

    const created =
      await prisma.$transaction(
        async (tx) => {
          const leave =
            await tx.leaveRequest.create({
              data: {
                requestRef:
                  leaveRequestRef(),

                employeeId:
                  employee.id,

                policyId:
                  policy.id,

                status,

                startDate,
                endDate,

                startPortion,
                endPortion,

                totalDays,

                reason:
                  reason || null,

                employeeNote:
                  employeeNote || null,

                ...(status ===
                LeaveRequestStatus.RECORDED
                  ? {
                      recordedAt:
                        new Date(),
                    }
                  : {}),

                ...(status ===
                LeaveRequestStatus.APPROVED
                  ? {
                      reviewedAt:
                        new Date(),
                    }
                  : {}),
              },

              include: {
                policy: true,
              },
            });

          await tx.leaveActivity.create({
            data: {
              leaveRequestId:
                leave.id,

              employeeId:
                employee.id,

              actorId:
                admin.id,

              type:
                status ===
                LeaveRequestStatus.RECORDED
                  ? "REQUEST_RECORDED"
                  : status ===
                      LeaveRequestStatus.APPROVED
                    ? "REQUEST_APPROVED"
                    : "REQUEST_CREATED",

              description:
                status ===
                LeaveRequestStatus.RECORDED
                  ? "Leave recorded by the owner."
                  : status ===
                      LeaveRequestStatus.APPROVED
                    ? "Leave automatically approved under the selected policy."
                    : "Leave request submitted.",
            },
          });

          return leave;
        },
      );

    return Response.json(
      {
        request:
          serialiseRequest(created),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return apiError(error);
  }
}