import {
  LeaveType,
} from "@/app/generated/prisma/client";

import {
  apiError,
  requireLeaveManager,
  serializePolicy,
} from "@/lib/leave/server";

import { prisma } from "@/lib/prisma";

export async function PATCH(
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
    } = await requireLeaveManager();

    const { id } =
      await context.params;

    const body =
      await request.json();

    const existing =
      await prisma.leavePolicy.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      return Response.json(
        {
          error:
            "Leave policy not found.",
        },
        { status: 404 },
      );
    }

    if (
      body.type !== undefined &&
      !Object.values(
        LeaveType,
      ).includes(body.type)
    ) {
      return Response.json(
        {
          error:
            "Invalid leave type.",
        },
        { status: 400 },
      );
    }

    const data: Record<
      string,
      unknown
    > = {
      updatedById:
        admin.id,
    };

    if (
      typeof body.name ===
      "string"
    ) {
      const name =
        body.name.trim();

      if (!name) {
        return Response.json(
          {
            error:
              "Policy name cannot be empty.",
          },
          { status: 400 },
        );
      }

      data.name = name;
    }

    if (
      typeof body.description ===
      "string"
    ) {
      data.description =
        body.description.trim() ||
        null;
    }

    if (
      body.type !== undefined
    ) {
      data.type = body.type;
    }

    if (
      body.active !== undefined
    ) {
      data.active =
        Boolean(body.active);
    }

    if (
      body.annualAllowance !==
      undefined
    ) {
      data.annualAllowance =
        body.annualAllowance ===
          null ||
        body.annualAllowance ===
          ""
          ? null
          : Number(
              body.annualAllowance,
            );
    }

    if (
      body.carryOverEnabled !==
      undefined
    ) {
      data.carryOverEnabled =
        Boolean(
          body.carryOverEnabled,
        );
    }

    if (
      body.maxCarryOverDays !==
      undefined
    ) {
      data.maxCarryOverDays =
        body.maxCarryOverDays ===
          null ||
        body.maxCarryOverDays ===
          ""
          ? null
          : Number(
              body.maxCarryOverDays,
            );
    }

    if (
      body.requiresApproval !==
      undefined
    ) {
      data.requiresApproval =
        Boolean(
          body.requiresApproval,
        );
    }

    if (
      body.allowBackdated !==
      undefined
    ) {
      data.allowBackdated =
        Boolean(
          body.allowBackdated,
        );
    }

    if (
      body.reasonRequired !==
      undefined
    ) {
      data.reasonRequired =
        Boolean(
          body.reasonRequired,
        );
    }

    if (
      body.countWeekends !==
      undefined
    ) {
      data.countWeekends =
        Boolean(
          body.countWeekends,
        );
    }

    if (
      body.paid !== undefined
    ) {
      data.paid =
        Boolean(body.paid);
    }

    if (
      body.minimumNoticeDays !==
      undefined
    ) {
      data.minimumNoticeDays =
        body.minimumNoticeDays ===
          null ||
        body.minimumNoticeDays ===
          ""
          ? null
          : Number(
              body.minimumNoticeDays,
            );
    }

    if (
      body.maximumDaysPerRequest !==
      undefined
    ) {
      data.maximumDaysPerRequest =
        body.maximumDaysPerRequest ===
          null ||
        body.maximumDaysPerRequest ===
          ""
          ? null
          : Number(
              body.maximumDaysPerRequest,
            );
    }

    if (
      body.displayOrder !==
      undefined
    ) {
      data.displayOrder =
        Number(
          body.displayOrder,
        );
    }

    const policy =
      await prisma.leavePolicy.update({
        where: {
          id,
        },
        data,
      });

    return Response.json({
      policy:
        serializePolicy(policy),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
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
    } = await requireLeaveManager();

    const { id } =
      await context.params;

    const existing =
      await prisma.leavePolicy.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      return Response.json(
        {
          error:
            "Leave policy not found.",
        },
        { status: 404 },
      );
    }

    const policy =
      await prisma.leavePolicy.update({
        where: {
          id,
        },

        data: {
          active: false,
          updatedById:
            admin.id,
        },
      });

    return Response.json({
      policy:
        serializePolicy(policy),
    });
  } catch (error) {
    return apiError(error);
  }
}