import {
  apiError,
  decimalToNumber,
  requireLeaveIdentity,
  requireLeaveManager,
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

type SerializableLeaveBalance = {
  entitlement: DecimalLike;
  carriedOver: DecimalLike;
  adjustment: DecimalLike;
  used: DecimalLike;
  booked: DecimalLike;

  [key: string]: unknown;
};

function serialiseBalance<T extends SerializableLeaveBalance>(
  balance: T,
) {
  const entitlement =
    decimalToNumber(balance.entitlement) ?? 0;

  const carriedOver =
    decimalToNumber(balance.carriedOver) ?? 0;

  const adjustment =
    decimalToNumber(balance.adjustment) ?? 0;

  const used =
    decimalToNumber(balance.used) ?? 0;

  const booked =
    decimalToNumber(balance.booked) ?? 0;

  return {
    ...balance,

    entitlement,
    carriedOver,
    adjustment,
    used,
    booked,

    available:
      entitlement +
      carriedOver +
      adjustment -
      used -
      booked,
  };
}

export async function GET(request: Request) {
  try {
    const {
      employee,
      isLeaveManager,
    } = await requireLeaveIdentity();

    const url = new URL(request.url);

    const requestedYear = Number(
      url.searchParams.get("year"),
    );

    const year =
      Number.isInteger(requestedYear) &&
      requestedYear > 2000
        ? requestedYear
        : new Date().getUTCFullYear();

    const managementScope =
      url.searchParams.get("scope") === "all" &&
      isLeaveManager;

    const balances =
      await prisma.leaveBalance.findMany({
        where: {
          year,

          ...(!managementScope
            ? {
                employeeId: employee.id,
              }
            : {}),
        },

        include: {
          policy: true,

          ...(managementScope
            ? {
                employee: {
                  select: {
                    id: true,
                    employeeRef: true,
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
              }
            : {}),
        },

        orderBy: [
          {
            employeeId: "asc",
          },
          {
            policy: {
              displayOrder: "asc",
            },
          },
        ],
      });

    return Response.json({
      year,

      scope: managementScope
        ? "all"
        : "mine",

      balances: balances.map(
        serialiseBalance,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const {
      admin,
    } = await requireLeaveManager();

    const body = await request.json();

    const employeeId =
      typeof body.employeeId === "string"
        ? body.employeeId.trim()
        : "";

    const policyId =
      typeof body.policyId === "string"
        ? body.policyId.trim()
        : "";

    const year = Number(body.year);

    if (
      !employeeId ||
      !policyId ||
      !Number.isInteger(year)
    ) {
      return Response.json(
        {
          error:
            "Employee, leave policy and year are required.",
        },
        {
          status: 400,
        },
      );
    }

    const [
      employee,
      policy,
    ] = await Promise.all([
      prisma.employee.findUnique({
        where: {
          id: employeeId,
        },
      }),

      prisma.leavePolicy.findUnique({
        where: {
          id: policyId,
        },
      }),
    ]);

    if (!employee) {
      return Response.json(
        {
          error: "Employee not found.",
        },
        {
          status: 404,
        },
      );
    }

    if (!policy) {
      return Response.json(
        {
          error: "Leave policy not found.",
        },
        {
          status: 404,
        },
      );
    }

    const entitlement = Number(
      body.entitlement ??
        policy.annualAllowance ??
        0,
    );

    const carriedOver = Number(
      body.carriedOver ?? 0,
    );

    const adjustment = Number(
      body.adjustment ?? 0,
    );

    if (
      !Number.isFinite(entitlement) ||
      !Number.isFinite(carriedOver) ||
      !Number.isFinite(adjustment)
    ) {
      return Response.json(
        {
          error:
            "Leave balance values must be valid numbers.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      entitlement < 0 ||
      carriedOver < 0
    ) {
      return Response.json(
        {
          error:
            "Entitlement and carried-over leave cannot be negative.",
        },
        {
          status: 400,
        },
      );
    }

    const reason =
      typeof body.adjustmentReason ===
        "string" &&
      body.adjustmentReason.trim()
        ? body.adjustmentReason.trim()
        : null;

    const balance =
      await prisma.leaveBalance.upsert({
        where: {
          employeeId_policyId_year: {
            employeeId,
            policyId,
            year,
          },
        },

        create: {
          employeeId,
          policyId,
          year,

          entitlement,
          carriedOver,
          adjustment,

          adjustedById: admin.id,

          adjustmentReason: reason,
        },

        update: {
          entitlement,
          carriedOver,
          adjustment,

          adjustedById: admin.id,

          adjustmentReason: reason,
        },

        include: {
          employee: {
            select: {
              id: true,
              employeeRef: true,
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

          policy: true,
        },
      });

    return Response.json({
      balance:
        serialiseBalance(balance),
    });
  } catch (error) {
    return apiError(error);
  }
}