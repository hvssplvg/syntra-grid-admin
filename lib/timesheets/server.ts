import {
  LeaveRequestStatus,
  TimesheetEntryType,
  TimesheetStatus,
  type AdminUser,
  type Employee,
  type Prisma,
} from "@/app/generated/prisma/client";

import {
  AuthorisationError,
  requireAdmin,
} from "@/lib/auth/current-admin";

import { prisma } from "@/lib/prisma";

/* =============================================================================
 * TYPES
 * =============================================================================
 */

export type TimesheetIdentity = {
  admin: AdminUser;
  employee: Employee;
  isTimesheetManager: boolean;
};

export type TimesheetRange = {
  start: Date;
  end: Date;
};

export type TimesheetEmployeeDTO = {
  id: string;
  employeeRef: string | null;

  firstName: string;
  lastName: string;
  preferredName: string | null;

  name: string;

  avatarUrl: string | null;
  jobTitle: string;

  status: string;
  employmentType: string;

  departmentId: string | null;

  department: {
    id: string;
    name: string;
    colour: string | null;
  } | null;
};

export type TimesheetEntryDTO = {
  id: string;

  timesheetId: string;
  employeeId: string;

  clientId: string | null;
  projectId: string | null;
  allocationId: string | null;

  workDate: string;

  type: string;

  title: string;
  description: string | null;

  hours: number;

  billable: boolean;

  startedAt: string | null;
  endedAt: string | null;

  invoiceId: string | null;
  billedAt: string | null;

  notes: string | null;

  client: {
    id: string;
    name: string;
    displayName: string | null;
  } | null;

  project: {
    id: string;
    name: string;
    clientId: string;
  } | null;

  allocation: {
    id: string;
    title: string;
    clientId: string | null;
    projectId: string | null;
    billable: boolean;
  } | null;

  invoiced: boolean;

  createdAt: string;
  updatedAt: string;
};

export type TimesheetActivityDTO = {
  id: string;

  type: string;
  description: string | null;

  metadata: unknown;

  createdAt: string;

  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type TimesheetDTO = {
  id: string;

  timesheetRef: string | null;

  employeeId: string;
  employee: TimesheetEmployeeDTO;

  status: string;

  periodStart: string;
  periodEnd: string;

  totalHours: number;
  billableHours: number;
  nonBillableHours: number;

  expectedHours: number | null;
  remainingHours: number | null;

  utilisationPercent: number | null;
  billablePercent: number;

  employeeNote: string | null;

  reviewedBy: {
    id: string;
    name: string;
    email: string;
  } | null;

  reviewedAt: string | null;

  reviewNote: string | null;
  rejectionReason: string | null;

  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;

  lockedAt: string | null;

  lockedBy: {
    id: string;
    name: string;
    email: string;
  } | null;

  entryCount: number;

  entries: TimesheetEntryDTO[];
  activities: TimesheetActivityDTO[];

  permissions: {
    canEdit: boolean;
    canSubmit: boolean;

    canReview: boolean;
    canApprove: boolean;
    canReject: boolean;

    canReopen: boolean;

    canLock: boolean;
    canUnlock: boolean;

    canDelete: boolean;
  };

  createdAt: string;
  updatedAt: string;
};

export type TimesheetSummaryDTO = {
  timesheetCount: number;

  employeeCount: number;

  expectedHours: number;
  recordedHours: number;

  billableHours: number;
  nonBillableHours: number;

  remainingHours: number;

  utilisationPercent: number;
  billablePercent: number;

  draftCount: number;
  submittedCount: number;
  approvedCount: number;
  rejectedCount: number;
  lockedCount: number;
};

export type TimesheetFeedDTO = {
  summary: TimesheetSummaryDTO;
  timesheets: TimesheetDTO[];
};

/* =============================================================================
 * PRISMA PAYLOAD
 * =============================================================================
 */

const timesheetInclude = {
  employee: {
    select: {
      id: true,
      employeeRef: true,

      firstName: true,
      lastName: true,
      preferredName: true,

      avatarUrl: true,
      jobTitle: true,

      status: true,
      employmentType: true,

      departmentId: true,

      department: {
        select: {
          id: true,
          name: true,
          colour: true,
        },
      },
    },
  },

  reviewedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },

  lockedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },

  entries: {
    include: {
      client: {
        select: {
          id: true,
          name: true,
          displayName: true,
        },
      },

      project: {
        select: {
          id: true,
          name: true,
          clientId: true,
        },
      },

      allocation: {
        select: {
          id: true,
          title: true,
          clientId: true,
          projectId: true,
          billable: true,
        },
      },
    },

    orderBy: [
      {
        workDate: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  },

  activities: {
    include: {
      actor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  },
} satisfies Prisma.TimesheetInclude;

export type TimesheetWithRelations =
  Prisma.TimesheetGetPayload<{
    include: typeof timesheetInclude;
  }>;

/* =============================================================================
 * IDENTITY / PERMISSIONS
 * =============================================================================
 */

export async function requireTimesheetIdentity(): Promise<TimesheetIdentity> {
  const admin = await requireAdmin();

  const employee =
    await prisma.employee.findUnique({
      where: {
        adminUserId: admin.id,
      },
    });

  if (!employee) {
    throw new AuthorisationError(
      "Your administrator account is not linked to an employee profile.",
    );
  }

  const isTimesheetManager =
    admin.role === "OWNER" ||
    admin.role === "ADMIN";

  return {
    admin,
    employee,
    isTimesheetManager,
  };
}

export function assertCanManageTimesheets(
  identity: TimesheetIdentity,
) {
  if (!identity.isTimesheetManager) {
    throw new AuthorisationError(
      "You do not have permission to manage company timesheets.",
    );
  }
}

export function canViewEmployeeTimesheet(
  identity: TimesheetIdentity,
  employeeId: string,
) {
  return (
    identity.isTimesheetManager ||
    identity.employee.id === employeeId
  );
}

export function assertCanViewEmployeeTimesheet(
  identity: TimesheetIdentity,
  employeeId: string,
) {
  if (
    !canViewEmployeeTimesheet(
      identity,
      employeeId,
    )
  ) {
    throw new AuthorisationError(
      "You do not have permission to view this timesheet.",
    );
  }
}

export function canEditTimesheet(
  identity: TimesheetIdentity,
  timesheet: {
    employeeId: string;
    status: TimesheetStatus;
  },
) {
  if (
    timesheet.status !== TimesheetStatus.DRAFT &&
    timesheet.status !== TimesheetStatus.REJECTED
  ) {
    return false;
  }

  return (
    identity.isTimesheetManager ||
    identity.employee.id ===
      timesheet.employeeId
  );
}

export function assertCanEditTimesheet(
  identity: TimesheetIdentity,
  timesheet: {
    employeeId: string;
    status: TimesheetStatus;
  },
) {
  if (
    !canEditTimesheet(
      identity,
      timesheet,
    )
  ) {
    throw new AuthorisationError(
      "This timesheet cannot currently be edited.",
    );
  }
}

/* =============================================================================
 * DATE HELPERS
 * =============================================================================
 */

export function utcDateOnly(
  value: Date | string,
  label = "Date",
): Date {
  if (value instanceof Date) {
    if (
      Number.isNaN(
        value.getTime(),
      )
    ) {
      throw new Error(
        `${label} is invalid.`,
      );
    }

    return new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
      ),
    );
  }

  const source =
    value.trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      source,
    )
  ) {
    throw new Error(
      `${label} must use YYYY-MM-DD format.`,
    );
  }

  const date =
    new Date(
      `${source}T00:00:00.000Z`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    ) ||
    date
      .toISOString()
      .slice(0, 10) !==
      source
  ) {
    throw new Error(
      `${label} is invalid.`,
    );
  }

  return date;
}

export function addUtcDays(
  date: Date,
  days: number,
) {
  const result =
    new Date(
      date.getTime(),
    );

  result.setUTCDate(
    result.getUTCDate() +
      days,
  );

  return result;
}

export function parseTimesheetRange(
  startValue: string | null,
  endValue: string | null,
): TimesheetRange {
  if (
    !startValue &&
    !endValue
  ) {
    return currentUtcWeek();
  }

  if (
    !startValue ||
    !endValue
  ) {
    throw new Error(
      "Both start and end dates are required.",
    );
  }

  const start =
    utcDateOnly(
      startValue,
      "Start date",
    );

  const end =
    utcDateOnly(
      endValue,
      "End date",
    );

  if (
    end <= start
  ) {
    throw new Error(
      "End date must be after the start date.",
    );
  }

  const dayCount =
    Math.round(
      (end.getTime() -
        start.getTime()) /
        86_400_000,
    );

  if (
    dayCount > 366
  ) {
    throw new Error(
      "The selected timesheet range cannot exceed 366 days.",
    );
  }

  return {
    start,
    end,
  };
}

export function currentUtcWeek(): TimesheetRange {
  const now =
    new Date();

  const today =
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    );

  const day =
    today.getUTCDay();

  const offset =
    day === 0
      ? -6
      : 1 - day;

  const start =
    addUtcDays(
      today,
      offset,
    );

  const end =
    addUtcDays(
      start,
      7,
    );

  return {
    start,
    end,
  };
}

/* =============================================================================
 * EMPLOYEE
 * =============================================================================
 */

export async function requireTimesheetEmployee(
  employeeId: string,
) {
  const employee =
    await prisma.employee.findUnique({
      where: {
        id: employeeId,
      },
    });

  if (!employee) {
    throw new Error(
      "Employee not found.",
    );
  }

  return employee;
}

function employeeDTO(
  employee: TimesheetWithRelations["employee"],
): TimesheetEmployeeDTO {
  const name =
    employee.preferredName?.trim() ||
    [
      employee.firstName,
      employee.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

  return {
    id: employee.id,

    employeeRef:
      employee.employeeRef,

    firstName:
      employee.firstName,

    lastName:
      employee.lastName,

    preferredName:
      employee.preferredName,

    name,

    avatarUrl:
      employee.avatarUrl,

    jobTitle:
      employee.jobTitle,

    status:
      employee.status,

    employmentType:
      employee.employmentType,

    departmentId:
      employee.departmentId,

    department:
      employee.department,
  };
}

/* =============================================================================
 * EXPECTED HOURS
 * =============================================================================
 */

type ScheduleForCapacity = {
  id: string;

  weeklyHours: unknown;

  mondayHours: unknown;
  tuesdayHours: unknown;
  wednesdayHours: unknown;
  thursdayHours: unknown;
  fridayHours: unknown;
  saturdayHours: unknown;
  sundayHours: unknown;

  active: boolean;

  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
};

type LeaveForCapacity = {
  startDate: Date;
  endDate: Date;

  startPortion: unknown;
  endPortion: unknown;
};

export async function calculateExpectedHours(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const [
    schedules,
    leave,
  ] =
    await Promise.all([
      prisma.employeeWorkSchedule.findMany({
        where: {
          employeeId,

          active: true,

          AND: [
            {
              OR: [
                {
                  effectiveFrom:
                    null,
                },
                {
                  effectiveFrom: {
                    lt: periodEnd,
                  },
                },
              ],
            },

            {
              OR: [
                {
                  effectiveUntil:
                    null,
                },
                {
                  effectiveUntil: {
                    gte: periodStart,
                  },
                },
              ],
            },
          ],
        },

        orderBy: [
          {
            effectiveFrom:
              "desc",
          },
          {
            createdAt:
              "desc",
          },
        ],
      }),

      prisma.leaveRequest.findMany({
        where: {
          employeeId,

          status: {
            in: [
              LeaveRequestStatus.APPROVED,
              LeaveRequestStatus.RECORDED,
            ],
          },

          startDate: {
            lt: periodEnd,
          },

          endDate: {
            gte: periodStart,
          },
        },

        select: {
          startDate: true,
          endDate: true,

          startPortion: true,
          endPortion: true,
        },
      }),
    ]);

  let expected = 0;

  for (
    let date =
      new Date(
        periodStart.getTime(),
      );
    date < periodEnd;
    date =
      addUtcDays(date, 1)
  ) {
    const schedule =
      resolveScheduleForDate(
        schedules,
        date,
      );

    if (!schedule) {
      continue;
    }

    const scheduledHours =
      scheduledHoursForDate(
        schedule,
        date,
      );

    if (
      scheduledHours <= 0
    ) {
      continue;
    }

    const leaveFraction =
      leaveFractionForDate(
        leave,
        date,
      );

    expected +=
      scheduledHours *
      (1 - leaveFraction);
  }

  return roundHours(
    expected,
  );
}

function resolveScheduleForDate(
  schedules: ScheduleForCapacity[],
  date: Date,
) {
  return (
    schedules.find(
      (schedule) => {
        if (
          !schedule.active
        ) {
          return false;
        }

        const from =
          schedule.effectiveFrom
            ? utcDateOnly(
                schedule.effectiveFrom,
              )
            : null;

        const until =
          schedule.effectiveUntil
            ? utcDateOnly(
                schedule.effectiveUntil,
              )
            : null;

        if (
          from &&
          date < from
        ) {
          return false;
        }

        if (
          until &&
          date > until
        ) {
          return false;
        }

        return true;
      },
    ) ?? null
  );
}

function scheduledHoursForDate(
  schedule: ScheduleForCapacity,
  date: Date,
) {
  switch (
    date.getUTCDay()
  ) {
    case 0:
      return numberValue(
        schedule.sundayHours,
      );

    case 1:
      return numberValue(
        schedule.mondayHours,
      );

    case 2:
      return numberValue(
        schedule.tuesdayHours,
      );

    case 3:
      return numberValue(
        schedule.wednesdayHours,
      );

    case 4:
      return numberValue(
        schedule.thursdayHours,
      );

    case 5:
      return numberValue(
        schedule.fridayHours,
      );

    case 6:
      return numberValue(
        schedule.saturdayHours,
      );

    default:
      return 0;
  }
}

function leaveFractionForDate(
  leave: LeaveForCapacity[],
  date: Date,
) {
  let fraction = 0;

  for (
    const request of leave
  ) {
    const start =
      utcDateOnly(
        request.startDate,
      );

    const end =
      utcDateOnly(
        request.endDate,
      );

    if (
      date < start ||
      date > end
    ) {
      continue;
    }

    let requestFraction = 1;

    const isStart =
      sameUtcDate(
        date,
        start,
      );

    const isEnd =
      sameUtcDate(
        date,
        end,
      );

    if (
      isStart &&
      isEnd
    ) {
      requestFraction =
        Math.min(
          leavePortionFraction(
            request.startPortion,
          ),
          leavePortionFraction(
            request.endPortion,
          ),
        );
    } else if (
      isStart
    ) {
      requestFraction =
        leavePortionFraction(
          request.startPortion,
        );
    } else if (
      isEnd
    ) {
      requestFraction =
        leavePortionFraction(
          request.endPortion,
        );
    }

    fraction +=
      requestFraction;
  }

  return Math.min(
    1,
    Math.max(
      0,
      fraction,
    ),
  );
}

function leavePortionFraction(
  portion: unknown,
) {
  if (
    typeof portion !==
    "string"
  ) {
    return 1;
  }

  if (
    portion ===
    "FULL_DAY"
  ) {
    return 1;
  }

  /*
   * Any non-full-day LeaveDayPortion value is treated
   * as half a working day.
   *
   * This matches the existing Leave model where the
   * boundary portions represent partial-day leave.
   */
  return 0.5;
}

/* =============================================================================
 * TIMESHEET REFERENCES
 * =============================================================================
 */

export async function generateTimesheetRef(
  employeeId: string,
  periodStart: Date,
) {
  const employee =
    await prisma.employee.findUnique({
      where: {
        id: employeeId,
      },

      select: {
        employeeRef: true,
      },
    });

  const employeePart =
    sanitiseRefPart(
      employee?.employeeRef ||
        employeeId.slice(
          -6,
        ),
    );

  const datePart =
    periodStart
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "");

  const base =
    `TS-${employeePart}-${datePart}`;

  const existing =
    await prisma.timesheet.findUnique({
      where: {
        timesheetRef:
          base,
      },

      select: {
        id: true,
      },
    });

  if (!existing) {
    return base;
  }

  for (
    let index = 2;
    index <= 999;
    index += 1
  ) {
    const candidate =
      `${base}-${index}`;

    const duplicate =
      await prisma.timesheet.findUnique({
        where: {
          timesheetRef:
            candidate,
        },

        select: {
          id: true,
        },
      });

    if (!duplicate) {
      return candidate;
    }
  }

  throw new Error(
    "Unable to generate a unique timesheet reference.",
  );
}

/* =============================================================================
 * GET TIMESHEET
 * =============================================================================
 */

export async function getTimesheetById(
  id: string,
) {
  return prisma.timesheet.findUnique({
    where: {
      id,
    },

    include:
      timesheetInclude,
  });
}

export async function requireTimesheet(
  id: string,
) {
  const timesheet =
    await getTimesheetById(
      id,
    );

  if (!timesheet) {
    throw new Error(
      "Timesheet not found.",
    );
  }

  return timesheet;
}

/* =============================================================================
 * FEED
 * =============================================================================
 */

export async function getTimesheetFeed({
  identity,
  range,
  employeeId,
  departmentId,
  clientId,
  projectId,
  status,
}: {
  identity: TimesheetIdentity;
  range: TimesheetRange;

  employeeId?: string | null;
  departmentId?: string | null;

  clientId?: string | null;
  projectId?: string | null;

  status?: TimesheetStatus | null;
}): Promise<TimesheetFeedDTO> {
  const where: Prisma.TimesheetWhereInput =
    {
      periodStart: {
        lt: range.end,
      },

      periodEnd: {
        gte: range.start,
      },
    };

  if (
    identity.isTimesheetManager
  ) {
    if (employeeId) {
      where.employeeId =
        employeeId;
    }

    if (departmentId) {
      where.employee = {
        departmentId,
      };
    }
  } else {
    where.employeeId =
      identity.employee.id;
  }

  if (status) {
    where.status =
      status;
  }

  if (
    clientId ||
    projectId
  ) {
    where.entries = {
      some: {
        ...(clientId
          ? {
              clientId,
            }
          : {}),

        ...(projectId
          ? {
              projectId,
            }
          : {}),
      },
    };
  }

  const timesheets =
    await prisma.timesheet.findMany({
      where,

      include:
        timesheetInclude,

      orderBy: [
        {
          periodStart:
            "desc",
        },
        {
          employee: {
            firstName:
              "asc",
          },
        },
        {
          employee: {
            lastName:
              "asc",
          },
        },
      ],
    });

  const dtos =
    timesheets.map(
      (timesheet) =>
        timesheetDTO(
          timesheet,
          identity,
        ),
    );

  return {
    summary:
      buildTimesheetSummary(
        dtos,
      ),

    timesheets:
      dtos,
  };
}

/* =============================================================================
 * CREATE / GET PERIOD TIMESHEET
 * =============================================================================
 */

export async function createTimesheet({
  identity,
  employeeId,
  periodStart,
  periodEnd,
  employeeNote,
}: {
  identity: TimesheetIdentity;

  employeeId: string;

  periodStart: Date;
  periodEnd: Date;

  employeeNote?: string | null;
}) {
  assertCanCreateTimesheetForEmployee(
    identity,
    employeeId,
  );

  await requireTimesheetEmployee(
    employeeId,
  );

  validateTimesheetPeriod(
    periodStart,
    periodEnd,
  );

  const existing =
    await prisma.timesheet.findUnique({
      where: {
        employeeId_periodStart_periodEnd:
          {
            employeeId,
            periodStart,
            periodEnd,
          },
      },

      include:
        timesheetInclude,
    });

  if (existing) {
    return existing;
  }

  const expectedHours =
    await calculateExpectedHours(
      employeeId,
      periodStart,
      periodEnd,
    );

  const timesheetRef =
    await generateTimesheetRef(
      employeeId,
      periodStart,
    );

  return prisma.$transaction(
    async (tx) => {
      const timesheet =
        await tx.timesheet.create({
          data: {
            employeeId,

            timesheetRef,

            status:
              TimesheetStatus.DRAFT,

            periodStart,
            periodEnd,

            totalHours: 0,
            billableHours: 0,

            expectedHours,

            employeeNote:
              cleanNullableText(
                employeeNote,
              ),
          },

          select: {
            id: true,
          },
        });

      await tx.timesheetActivity.create({
        data: {
          timesheetId:
            timesheet.id,

          employeeId,

          actorId:
            identity.admin.id,

          type:
            "TIMESHEET_CREATED",

          description:
            "Timesheet created.",

          metadata: {
            periodStart:
              periodStart.toISOString(),

            periodEnd:
              periodEnd.toISOString(),

            expectedHours,
          },
        },
      });

      return tx.timesheet.findUniqueOrThrow({
        where: {
          id: timesheet.id,
        },

        include:
          timesheetInclude,
      });
    },
  );
}

function assertCanCreateTimesheetForEmployee(
  identity: TimesheetIdentity,
  employeeId: string,
) {
  if (
    identity.isTimesheetManager
  ) {
    return;
  }

  if (
    identity.employee.id !==
    employeeId
  ) {
    throw new AuthorisationError(
      "You can only create your own timesheet.",
    );
  }
}

/* =============================================================================
 * ENTRY CONTEXT
 * =============================================================================
 */

export async function resolveTimesheetEntryContext({
  employeeId,
  clientId,
  projectId,
  allocationId,
}: {
  employeeId: string;

  clientId?: string | null;
  projectId?: string | null;
  allocationId?: string | null;
}) {
  let resolvedClientId =
    cleanId(clientId);

  let resolvedProjectId =
    cleanId(projectId);

  const resolvedAllocationId =
    cleanId(allocationId);

  let allocationBillable:
    | boolean
    | null = null;

  if (
    resolvedAllocationId
  ) {
    const allocation =
      await prisma.workloadAllocation.findUnique({
        where: {
          id: resolvedAllocationId,
        },

        select: {
          id: true,
          employeeId: true,

          clientId: true,
          projectId: true,

          billable: true,

          status: true,
        },
      });

    if (!allocation) {
      throw new Error(
        "The selected workload allocation does not exist.",
      );
    }

    if (
      allocation.employeeId !==
      employeeId
    ) {
      throw new Error(
        "The selected workload allocation belongs to another employee.",
      );
    }

    if (
      allocation.status ===
      "CANCELLED"
    ) {
      throw new Error(
        "A cancelled workload allocation cannot be used for a timesheet entry.",
      );
    }

    if (
      resolvedProjectId &&
      allocation.projectId &&
      resolvedProjectId !==
        allocation.projectId
    ) {
      throw new Error(
        "The selected project does not match the workload allocation.",
      );
    }

    if (
      resolvedClientId &&
      allocation.clientId &&
      resolvedClientId !==
        allocation.clientId
    ) {
      throw new Error(
        "The selected client does not match the workload allocation.",
      );
    }

    resolvedProjectId =
      allocation.projectId ||
      resolvedProjectId;

    resolvedClientId =
      allocation.clientId ||
      resolvedClientId;

    allocationBillable =
      allocation.billable;
  }

  if (
    resolvedProjectId
  ) {
    const project =
      await prisma.project.findUnique({
        where: {
          id: resolvedProjectId,
        },

        select: {
          id: true,
          clientId: true,
        },
      });

    if (!project) {
      throw new Error(
        "The selected project does not exist.",
      );
    }

    if (
      resolvedClientId &&
      resolvedClientId !==
        project.clientId
    ) {
      throw new Error(
        "The selected project does not belong to the selected client.",
      );
    }

    resolvedClientId =
      project.clientId;
  }

  if (
    resolvedClientId
  ) {
    const client =
      await prisma.client.findUnique({
        where: {
          id: resolvedClientId,
        },

        select: {
          id: true,
        },
      });

    if (!client) {
      throw new Error(
        "The selected client does not exist.",
      );
    }
  }

  return {
    clientId:
      resolvedClientId,

    projectId:
      resolvedProjectId,

    allocationId:
      resolvedAllocationId,

    allocationBillable,
  };
}

/* =============================================================================
 * ENTRY VALIDATION
 * =============================================================================
 */

export function validateTimesheetEntryValues({
  timesheet,
  workDate,
  hours,
  startedAt,
  endedAt,
}: {
  timesheet: {
    periodStart: Date;
    periodEnd: Date;
  };

  workDate: Date;

  hours: number;

  startedAt?: Date | null;
  endedAt?: Date | null;
}) {
  if (
    !Number.isFinite(hours) ||
    hours <= 0
  ) {
    throw new Error(
      "Hours must be greater than zero.",
    );
  }

  if (
    hours > 24
  ) {
    throw new Error(
      "A single timesheet entry cannot exceed 24 hours.",
    );
  }

  const date =
    utcDateOnly(
      workDate,
      "Work date",
    );

  const start =
    utcDateOnly(
      timesheet.periodStart,
    );

  const endExclusive =
    addUtcDays(
      utcDateOnly(
        timesheet.periodEnd,
      ),
      1,
    );

  /*
   * Timesheet periodEnd is stored as an inclusive date.
   */
  if (
    date < start ||
    date >= endExclusive
  ) {
    throw new Error(
      "The work date must fall inside the timesheet period.",
    );
  }

  if (
    startedAt &&
    endedAt &&
    startedAt >= endedAt
  ) {
    throw new Error(
      "The start time must be before the end time.",
    );
  }
}

/* =============================================================================
 * INVOICE PROTECTION
 * =============================================================================
 */

export function assertEntryNotInvoiced(
  entry: {
    invoiceId: string | null;
    billedAt: Date | null;
  },
) {
  if (
    entry.invoiceId ||
    entry.billedAt
  ) {
    throw new Error(
      "This timesheet entry has already been billed and cannot be changed.",
    );
  }
}

/* =============================================================================
 * RECALCULATE TOTALS
 * =============================================================================
 */

export async function recalculateTimesheetTotals(
  timesheetId: string,
  tx:
    | Prisma.TransactionClient
    | typeof prisma = prisma,
) {
  const aggregate =
    await tx.timesheetEntry.aggregate({
      where: {
        timesheetId,
      },

      _sum: {
        hours: true,
      },
    });

  const billableAggregate =
    await tx.timesheetEntry.aggregate({
      where: {
        timesheetId,
        billable: true,
      },

      _sum: {
        hours: true,
      },
    });

  const totalHours =
    roundHours(
      numberValue(
        aggregate._sum.hours,
      ),
    );

  const billableHours =
    roundHours(
      numberValue(
        billableAggregate._sum.hours,
      ),
    );

  await tx.timesheet.update({
    where: {
      id: timesheetId,
    },

    data: {
      totalHours,
      billableHours,
    },
  });

  return {
    totalHours,
    billableHours,
  };
}

/* =============================================================================
 * EXPECTED HOURS REFRESH
 * =============================================================================
 */

export async function refreshExpectedHours(
  timesheetId: string,
) {
  const timesheet =
    await prisma.timesheet.findUnique({
      where: {
        id: timesheetId,
      },

      select: {
        id: true,
        employeeId: true,
        periodStart: true,
        periodEnd: true,
      },
    });

  if (!timesheet) {
    throw new Error(
      "Timesheet not found.",
    );
  }

  const periodEndExclusive =
    addUtcDays(
      utcDateOnly(
        timesheet.periodEnd,
      ),
      1,
    );

  const expectedHours =
    await calculateExpectedHours(
      timesheet.employeeId,
      utcDateOnly(
        timesheet.periodStart,
      ),
      periodEndExclusive,
    );

  await prisma.timesheet.update({
    where: {
      id: timesheet.id,
    },

    data: {
      expectedHours,
    },
  });

  return expectedHours;
}

/* =============================================================================
 * ACTIVITY
 * =============================================================================
 */

export async function addTimesheetActivity({
  timesheetId,
  employeeId,
  actorId,
  type,
  description,
  metadata,
  tx = prisma,
}: {
  timesheetId: string;
  employeeId: string;

  actorId?: string | null;

  type:
    | "TIMESHEET_CREATED"
    | "ENTRY_ADDED"
    | "ENTRY_UPDATED"
    | "ENTRY_REMOVED"
    | "SUBMITTED"
    | "APPROVED"
    | "REJECTED"
    | "REOPENED"
    | "LOCKED"
    | "UNLOCKED"
    | "NOTE_ADDED";

  description?: string | null;

  metadata?: Prisma.InputJsonValue;

  tx?:
    | Prisma.TransactionClient
    | typeof prisma;
}) {
  return tx.timesheetActivity.create({
    data: {
      timesheetId,
      employeeId,

      actorId:
        actorId || null,

      type,

      description:
        cleanNullableText(
          description,
        ),

      ...(metadata !==
      undefined
        ? {
            metadata,
          }
        : {}),
    },
  });
}

/* =============================================================================
 * WORKFLOW VALIDATION
 * =============================================================================
 */

export function assertCanSubmitTimesheet(
  identity: TimesheetIdentity,
  timesheet: {
    employeeId: string;
    status: TimesheetStatus;
    totalHours: unknown;
  },
) {
  if (
    timesheet.status !==
      TimesheetStatus.DRAFT &&
    timesheet.status !==
      TimesheetStatus.REJECTED
  ) {
    throw new Error(
      "Only draft or rejected timesheets can be submitted.",
    );
  }

  if (
    !identity.isTimesheetManager &&
    identity.employee.id !==
      timesheet.employeeId
  ) {
    throw new AuthorisationError(
      "You cannot submit another employee's timesheet.",
    );
  }

  if (
    numberValue(
      timesheet.totalHours,
    ) <= 0
  ) {
    throw new Error(
      "Add at least one time entry before submitting the timesheet.",
    );
  }
}

export function assertCanApproveTimesheet(
  identity: TimesheetIdentity,
  timesheet: {
    status: TimesheetStatus;
  },
) {
  assertCanManageTimesheets(
    identity,
  );

  if (
    timesheet.status !==
    TimesheetStatus.SUBMITTED
  ) {
    throw new Error(
      "Only submitted timesheets can be approved.",
    );
  }
}

export function assertCanRejectTimesheet(
  identity: TimesheetIdentity,
  timesheet: {
    status: TimesheetStatus;
  },
) {
  assertCanManageTimesheets(
    identity,
  );

  if (
    timesheet.status !==
    TimesheetStatus.SUBMITTED
  ) {
    throw new Error(
      "Only submitted timesheets can be rejected.",
    );
  }
}

export function assertCanReopenTimesheet(
  identity: TimesheetIdentity,
  timesheet: {
    status: TimesheetStatus;
  },
) {
  assertCanManageTimesheets(
    identity,
  );

  if (
    timesheet.status ===
    TimesheetStatus.LOCKED
  ) {
    throw new Error(
      "Unlock the timesheet before reopening it.",
    );
  }

  if (
    timesheet.status !==
      TimesheetStatus.APPROVED &&
    timesheet.status !==
      TimesheetStatus.REJECTED &&
    timesheet.status !==
      TimesheetStatus.SUBMITTED
  ) {
    throw new Error(
      "This timesheet cannot be reopened.",
    );
  }
}

export function assertCanLockTimesheet(
  identity: TimesheetIdentity,
  timesheet: {
    status: TimesheetStatus;
  },
) {
  assertCanManageTimesheets(
    identity,
  );

  if (
    timesheet.status !==
    TimesheetStatus.APPROVED
  ) {
    throw new Error(
      "Only approved timesheets can be locked.",
    );
  }
}

export function assertCanUnlockTimesheet(
  identity: TimesheetIdentity,
  timesheet: {
    status: TimesheetStatus;
  },
) {
  assertCanManageTimesheets(
    identity,
  );

  if (
    timesheet.status !==
    TimesheetStatus.LOCKED
  ) {
    throw new Error(
      "Only locked timesheets can be unlocked.",
    );
  }
}

/* =============================================================================
 * SERIALISATION
 * =============================================================================
 */

export function timesheetDTO(
  timesheet: TimesheetWithRelations,
  identity: TimesheetIdentity,
): TimesheetDTO {
  const totalHours =
    numberValue(
      timesheet.totalHours,
    );

  const billableHours =
    numberValue(
      timesheet.billableHours,
    );

  const expectedHours =
    timesheet.expectedHours ===
    null
      ? null
      : numberValue(
          timesheet.expectedHours,
        );

  const nonBillableHours =
    roundHours(
      totalHours -
        billableHours,
    );

  const remainingHours =
    expectedHours === null
      ? null
      : roundHours(
          expectedHours -
            totalHours,
        );

  const utilisationPercent =
    expectedHours === null
      ? null
      : expectedHours <= 0
        ? totalHours > 0
          ? 100
          : 0
        : roundPercent(
            (totalHours /
              expectedHours) *
              100,
          );

  const billablePercent =
    totalHours <= 0
      ? 0
      : roundPercent(
          (billableHours /
            totalHours) *
            100,
        );

  const manager =
    identity.isTimesheetManager;

  const owner =
    identity.employee.id ===
    timesheet.employeeId;

  const editable =
    (manager || owner) &&
    (timesheet.status ===
      TimesheetStatus.DRAFT ||
      timesheet.status ===
        TimesheetStatus.REJECTED);

  return {
    id:
      timesheet.id,

    timesheetRef:
      timesheet.timesheetRef,

    employeeId:
      timesheet.employeeId,

    employee:
      employeeDTO(
        timesheet.employee,
      ),

    status:
      timesheet.status,

    periodStart:
      timesheet.periodStart.toISOString(),

    periodEnd:
      timesheet.periodEnd.toISOString(),

    totalHours,

    billableHours,

    nonBillableHours,

    expectedHours,

    remainingHours,

    utilisationPercent,

    billablePercent,

    employeeNote:
      timesheet.employeeNote,

    reviewedBy:
      adminSummary(
        timesheet.reviewedBy,
      ),

    reviewedAt:
      timesheet.reviewedAt?.toISOString() ??
      null,

    reviewNote:
      timesheet.reviewNote,

    rejectionReason:
      timesheet.rejectionReason,

    submittedAt:
      timesheet.submittedAt?.toISOString() ??
      null,

    approvedAt:
      timesheet.approvedAt?.toISOString() ??
      null,

    rejectedAt:
      timesheet.rejectedAt?.toISOString() ??
      null,

    lockedAt:
      timesheet.lockedAt?.toISOString() ??
      null,

    lockedBy:
      adminSummary(
        timesheet.lockedBy,
      ),

    entryCount:
      timesheet.entries.length,

    entries:
      timesheet.entries.map(
        entryDTO,
      ),

    activities:
      timesheet.activities.map(
        activityDTO,
      ),

    permissions: {
      canEdit:
        editable,

      canSubmit:
        (manager || owner) &&
        (timesheet.status ===
          TimesheetStatus.DRAFT ||
          timesheet.status ===
            TimesheetStatus.REJECTED) &&
        totalHours > 0,

      canReview:
        manager &&
        timesheet.status ===
          TimesheetStatus.SUBMITTED,

      canApprove:
        manager &&
        timesheet.status ===
          TimesheetStatus.SUBMITTED,

      canReject:
        manager &&
        timesheet.status ===
          TimesheetStatus.SUBMITTED,

      canReopen:
        manager &&
        timesheet.status !==
          TimesheetStatus.LOCKED &&
        (timesheet.status ===
          TimesheetStatus.SUBMITTED ||
          timesheet.status ===
            TimesheetStatus.APPROVED ||
          timesheet.status ===
            TimesheetStatus.REJECTED),

      canLock:
        manager &&
        timesheet.status ===
          TimesheetStatus.APPROVED,

      canUnlock:
        manager &&
        timesheet.status ===
          TimesheetStatus.LOCKED,

      canDelete:
        manager &&
        timesheet.status ===
          TimesheetStatus.DRAFT &&
        timesheet.entries.every(
          (entry) =>
            !entry.invoiceId &&
            !entry.billedAt,
        ),
    },

    createdAt:
      timesheet.createdAt.toISOString(),

    updatedAt:
      timesheet.updatedAt.toISOString(),
  };
}

function entryDTO(
  entry: TimesheetWithRelations["entries"][number],
): TimesheetEntryDTO {
  return {
    id:
      entry.id,

    timesheetId:
      entry.timesheetId,

    employeeId:
      entry.employeeId,

    clientId:
      entry.clientId,

    projectId:
      entry.projectId,

    allocationId:
      entry.allocationId,

    workDate:
      entry.workDate.toISOString(),

    type:
      entry.type,

    title:
      entry.title,

    description:
      entry.description,

    hours:
      numberValue(
        entry.hours,
      ),

    billable:
      entry.billable,

    startedAt:
      entry.startedAt?.toISOString() ??
      null,

    endedAt:
      entry.endedAt?.toISOString() ??
      null,

    invoiceId:
      entry.invoiceId,

    billedAt:
      entry.billedAt?.toISOString() ??
      null,

    notes:
      entry.notes,

    client:
      entry.client,

    project:
      entry.project,

    allocation:
      entry.allocation,

    invoiced:
      Boolean(
        entry.invoiceId ||
          entry.billedAt,
      ),

    createdAt:
      entry.createdAt.toISOString(),

    updatedAt:
      entry.updatedAt.toISOString(),
  };
}

function activityDTO(
  activity: TimesheetWithRelations["activities"][number],
): TimesheetActivityDTO {
  return {
    id:
      activity.id,

    type:
      activity.type,

    description:
      activity.description,

    metadata:
      activity.metadata,

    createdAt:
      activity.createdAt.toISOString(),

    actor:
      adminSummary(
        activity.actor,
      ),
  };
}

function adminSummary(
  admin:
    | {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
      }
    | null,
) {
  if (!admin) {
    return null;
  }

  const name =
    [
      admin.firstName,
      admin.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    admin.email;

  return {
    id:
      admin.id,

    name,

    email:
      admin.email,
  };
}

/* =============================================================================
 * SUMMARY
 * =============================================================================
 */

function buildTimesheetSummary(
  timesheets: TimesheetDTO[],
): TimesheetSummaryDTO {
  let expectedHours = 0;
  let recordedHours = 0;

  let billableHours = 0;
  let nonBillableHours = 0;

  let draftCount = 0;
  let submittedCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let lockedCount = 0;

  const employeeIds =
    new Set<string>();

  for (
    const timesheet of timesheets
  ) {
    employeeIds.add(
      timesheet.employeeId,
    );

    expectedHours +=
      timesheet.expectedHours ??
      0;

    recordedHours +=
      timesheet.totalHours;

    billableHours +=
      timesheet.billableHours;

    nonBillableHours +=
      timesheet.nonBillableHours;

    switch (
      timesheet.status
    ) {
      case TimesheetStatus.DRAFT:
        draftCount += 1;
        break;

      case TimesheetStatus.SUBMITTED:
        submittedCount += 1;
        break;

      case TimesheetStatus.APPROVED:
        approvedCount += 1;
        break;

      case TimesheetStatus.REJECTED:
        rejectedCount += 1;
        break;

      case TimesheetStatus.LOCKED:
        lockedCount += 1;
        break;
    }
  }

  const remainingHours =
    roundHours(
      expectedHours -
        recordedHours,
    );

  return {
    timesheetCount:
      timesheets.length,

    employeeCount:
      employeeIds.size,

    expectedHours:
      roundHours(
        expectedHours,
      ),

    recordedHours:
      roundHours(
        recordedHours,
      ),

    billableHours:
      roundHours(
        billableHours,
      ),

    nonBillableHours:
      roundHours(
        nonBillableHours,
      ),

    remainingHours,

    utilisationPercent:
      expectedHours <= 0
        ? recordedHours > 0
          ? 100
          : 0
        : roundPercent(
            (recordedHours /
              expectedHours) *
              100,
          ),

    billablePercent:
      recordedHours <= 0
        ? 0
        : roundPercent(
            (billableHours /
              recordedHours) *
              100,
          ),

    draftCount,
    submittedCount,
    approvedCount,
    rejectedCount,
    lockedCount,
  };
}

/* =============================================================================
 * PERIOD VALIDATION
 * =============================================================================
 */

export function validateTimesheetPeriod(
  periodStart: Date,
  periodEnd: Date,
) {
  const start =
    utcDateOnly(
      periodStart,
      "Period start",
    );

  const end =
    utcDateOnly(
      periodEnd,
      "Period end",
    );

  if (
    end < start
  ) {
    throw new Error(
      "Timesheet period end cannot be before its start date.",
    );
  }

  const days =
    Math.round(
      (end.getTime() -
        start.getTime()) /
        86_400_000,
    ) + 1;

  if (
    days > 366
  ) {
    throw new Error(
      "A timesheet period cannot exceed 366 days.",
    );
  }
}

/* =============================================================================
 * ENUM VALIDATION
 * =============================================================================
 */

export function parseTimesheetStatus(
  value: string | null,
): TimesheetStatus | null {
  if (!value) {
    return null;
  }

  if (
    !Object.values(
      TimesheetStatus,
    ).includes(
      value as TimesheetStatus,
    )
  ) {
    throw new Error(
      "Invalid timesheet status.",
    );
  }

  return value as TimesheetStatus;
}

export function parseTimesheetEntryType(
  value: unknown,
): TimesheetEntryType {
  if (
    typeof value !==
      "string" ||
    !Object.values(
      TimesheetEntryType,
    ).includes(
      value as TimesheetEntryType,
    )
  ) {
    throw new Error(
      "Invalid timesheet entry type.",
    );
  }

  return value as TimesheetEntryType;
}

/* =============================================================================
 * GENERIC VALIDATION
 * =============================================================================
 */

export function requiredText(
  value: unknown,
  label: string,
) {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    throw new Error(
      `${label} is required.`,
    );
  }

  return value.trim();
}

export function optionalText(
  value: unknown,
  label = "Value",
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
    "string"
  ) {
    throw new Error(
      `${label} must be text.`,
    );
  }

  return (
    value.trim() ||
    null
  );
}

export function positiveNumber(
  value: unknown,
  label: string,
) {
  const parsed =
    typeof value ===
    "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(
      parsed,
    ) ||
    parsed <= 0
  ) {
    throw new Error(
      `${label} must be greater than zero.`,
    );
  }

  return parsed;
}

export function optionalBoolean(
  value: unknown,
  fallback: boolean,
) {
  if (
    value === undefined
  ) {
    return fallback;
  }

  if (
    typeof value !==
    "boolean"
  ) {
    throw new Error(
      "Expected a true or false value.",
    );
  }

  return value;
}

export function optionalDateTime(
  value: unknown,
  label: string,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !==
    "string"
  ) {
    throw new Error(
      `${label} must be a valid date and time.`,
    );
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      `${label} must be a valid date and time.`,
    );
  }

  return date;
}

/* =============================================================================
 * API ERROR
 * =============================================================================
 */

export function timesheetApiError(
  error: unknown,
): {
  status: number;
  message: string;
} {
  if (
    error instanceof
    AuthorisationError
  ) {
    return {
      status: 403,
      message:
        error.message ||
        "You do not have permission to perform this action.",
    };
  }

  if (
    error instanceof Error
  ) {
    return {
      status: 400,
      message:
        error.message ||
        "Unable to process the timesheet request.",
    };
  }

  return {
    status: 500,
    message:
      "An unexpected timesheet error occurred.",
  };
}

/* =============================================================================
 * INTERNAL HELPERS
 * =============================================================================
 */

function numberValue(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}

function roundHours(
  value: number,
) {
  return (
    Math.round(
      (value +
        Number.EPSILON) *
        100,
    ) / 100
  );
}

function roundPercent(
  value: number,
) {
  return (
    Math.round(
      (value +
        Number.EPSILON) *
        100,
    ) / 100
  );
}

function sameUtcDate(
  left: Date,
  right: Date,
) {
  return (
    left.getUTCFullYear() ===
      right.getUTCFullYear() &&
    left.getUTCMonth() ===
      right.getUTCMonth() &&
    left.getUTCDate() ===
      right.getUTCDate()
  );
}

function sanitiseRefPart(
  value: string,
) {
  return (
    value
      .toUpperCase()
      .replace(
        /[^A-Z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      )
      .slice(
        0,
        24,
      ) || "EMP"
  );
}

function cleanNullableText(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return null;
  }

  return (
    value.trim() ||
    null
  );
}

function cleanId(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return null;
  }

  return (
    value.trim() ||
    null
  );
}