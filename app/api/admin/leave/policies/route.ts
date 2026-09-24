import {
  LeaveType,
} from "@/app/generated/prisma/client";

import {
  apiError,
  requireLeaveIdentity,
  requireLeaveManager,
  serializePolicy,
} from "@/lib/leave/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const {
      isLeaveManager,
    } = await requireLeaveIdentity();

    const policies =
      await prisma.leavePolicy.findMany({
        where:
          isLeaveManager
            ? undefined
            : {
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
      policies:
        policies.map(
          serializePolicy,
        ),
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
    } = await requireLeaveManager();

    const body =
      await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const code =
      typeof body.code === "string"
        ? body.code
            .trim()
            .toUpperCase()
            .replace(
              /[^A-Z0-9]+/g,
              "_",
            )
        : "";

    if (!name || !code) {
      return Response.json(
        {
          error:
            "Policy name and code are required.",
        },
        { status: 400 },
      );
    }

    if (
      !Object.values(
        LeaveType,
      ).includes(body.type)
    ) {
      return Response.json(
        {
          error:
            "A valid leave type is required.",
        },
        { status: 400 },
      );
    }

    const existing =
      await prisma.leavePolicy.findUnique({
        where: {
          code,
        },
      });

    if (existing) {
      return Response.json(
        {
          error:
            "A leave policy with this code already exists.",
        },
        { status: 409 },
      );
    }

    const policy =
      await prisma.leavePolicy.create({
        data: {
          name,
          code,
          type: body.type,

          description:
            typeof body.description ===
              "string" &&
            body.description.trim()
              ? body.description.trim()
              : null,

          annualAllowance:
            body.annualAllowance ===
              null ||
            body.annualAllowance ===
              "" ||
            body.annualAllowance ===
              undefined
              ? null
              : Number(
                  body.annualAllowance,
                ),

          carryOverEnabled:
            Boolean(
              body.carryOverEnabled,
            ),

          maxCarryOverDays:
            body.maxCarryOverDays ===
              null ||
            body.maxCarryOverDays ===
              "" ||
            body.maxCarryOverDays ===
              undefined
              ? null
              : Number(
                  body.maxCarryOverDays,
                ),

          requiresApproval:
            body.requiresApproval !==
            false,

          allowBackdated:
            Boolean(
              body.allowBackdated,
            ),

          reasonRequired:
            Boolean(
              body.reasonRequired,
            ),

          countWeekends:
            Boolean(
              body.countWeekends,
            ),

          paid:
            body.paid !== false,

          minimumNoticeDays:
            body.minimumNoticeDays ===
              null ||
            body.minimumNoticeDays ===
              "" ||
            body.minimumNoticeDays ===
              undefined
              ? null
              : Number(
                  body.minimumNoticeDays,
                ),

          maximumDaysPerRequest:
            body.maximumDaysPerRequest ===
              null ||
            body.maximumDaysPerRequest ===
              "" ||
            body.maximumDaysPerRequest ===
              undefined
              ? null
              : Number(
                  body.maximumDaysPerRequest,
                ),

          displayOrder:
            Number.isFinite(
              Number(
                body.displayOrder,
              ),
            )
              ? Number(
                  body.displayOrder,
                )
              : 0,

          createdById:
            admin.id,

          updatedById:
            admin.id,
        },
      });

    return Response.json(
      {
        policy:
          serializePolicy(policy),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}