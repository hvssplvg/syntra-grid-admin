import {
  LeaveDayPortion,
  LeaveRequestStatus,
  type AdminUser,
  type Employee,
  type LeavePolicy,
} from "@/app/generated/prisma/client";

import {
  AuthorisationError,
  requireAdmin,
} from "@/lib/auth/current-admin";

import { prisma } from "@/lib/prisma";

export type LeaveIdentity = {
  admin: AdminUser;
  employee: Employee;
  isLeaveManager: boolean;
};

export async function requireLeaveIdentity(): Promise<LeaveIdentity> {
  const admin = await requireAdmin();

  const employee = await prisma.employee.findUnique({
    where: {
      adminUserId: admin.id,
    },
  });

  if (!employee) {
    throw new AuthorisationError(
      "Your administrator account is not linked to an employee profile.",
    );
  }

  return {
    admin,
    employee,
    isLeaveManager:
      admin.role === "OWNER" ||
      admin.role === "ADMIN",
  };
}

export async function requireLeaveManager() {
  const identity = await requireLeaveIdentity();

  if (!identity.isLeaveManager) {
    throw new AuthorisationError(
      "You are not authorised to manage employee leave.",
    );
  }

  return identity;
}

export function normaliseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(`${value.trim()}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function decimalToNumber(
  value:
    | { toString(): string }
    | number
    | string
    | null
    | undefined,
) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value.toString());

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

export function serializePolicy(policy: LeavePolicy) {
  return {
    ...policy,
    annualAllowance: decimalToNumber(policy.annualAllowance),
    maxCarryOverDays: decimalToNumber(policy.maxCarryOverDays),
    maximumDaysPerRequest: decimalToNumber(
      policy.maximumDaysPerRequest,
    ),
  };
}
export function calculateLeaveDays({
  startDate,
  endDate,
  startPortion,
  endPortion,
  countWeekends,
}: {
  startDate: Date;
  endDate: Date;
  startPortion: LeaveDayPortion;
  endPortion: LeaveDayPortion;
  countWeekends: boolean;
}) {
  if (endDate < startDate) {
    throw new Error(
      "The leave end date cannot be before the start date.",
    );
  }

  const isIncludedDay = (date: Date) => {
    if (countWeekends) {
      return true;
    }

    const day = date.getUTCDay();
    return day !== 0 && day !== 6;
  };

  const cursor = new Date(startDate);
  let days = 0;

  while (cursor <= endDate) {
    if (isIncludedDay(cursor)) {
      days += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (days === 0) {
    throw new Error(
      "The selected dates do not contain any leave days.",
    );
  }

  const sameDay =
    startDate.getUTCFullYear() === endDate.getUTCFullYear() &&
    startDate.getUTCMonth() === endDate.getUTCMonth() &&
    startDate.getUTCDate() === endDate.getUTCDate();

  if (sameDay) {
    if (
      startPortion !== LeaveDayPortion.FULL_DAY ||
      endPortion !== LeaveDayPortion.FULL_DAY
    ) {
      return 0.5;
    }

    return 1;
  }

  if (
    isIncludedDay(startDate) &&
    startPortion !== LeaveDayPortion.FULL_DAY
  ) {
    days -= 0.5;
  }

  if (
    isIncludedDay(endDate) &&
    endPortion !== LeaveDayPortion.FULL_DAY
  ) {
    days -= 0.5;
  }

  return Math.max(days, 0);
}
export function canCancelLeave(status: LeaveRequestStatus) {
  return (
    status === LeaveRequestStatus.PENDING ||
    status === LeaveRequestStatus.APPROVED ||
    status === LeaveRequestStatus.RECORDED
  );
}

export function leaveRequestRef() {
  const year = new Date().getUTCFullYear();

  return `SG-LV-${year}-${crypto.randomUUID()
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase()}`;
}

export function apiError(error: unknown) {
  console.error("[LEAVE_API]", error);

  if (
    error instanceof Error &&
    error.name === "AuthenticationError"
  ) {
    return Response.json(
      { error: error.message },
      { status: 401 },
    );
  }

  if (
    error instanceof Error &&
    error.name === "AuthorisationError"
  ) {
    return Response.json(
      { error: error.message },
      { status: 403 },
    );
  }

  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong.",
    },
    { status: 500 },
  );
}