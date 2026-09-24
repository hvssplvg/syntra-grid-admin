import {
  LeaveRequestStatus,
  WorkloadAllocationMode,
  WorkloadAllocationStatus,
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

export type WorkloadIdentity = {
  admin: AdminUser;
  employee: Employee;
  isWorkloadManager: boolean;
};

export type WorkloadRange = {
  start: Date;
  end: Date;
};

export type WorkloadDepartmentDTO = {
  id: string;
  name: string;
  colour: string | null;
};

export type WorkloadEmployeeDTO = {
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
  department: WorkloadDepartmentDTO | null;
};

export type WorkScheduleDTO = {
  id: string;

  weeklyHours: number;

  mondayHours: number;
  tuesdayHours: number;
  wednesdayHours: number;
  thursdayHours: number;
  fridayHours: number;
  saturdayHours: number;
  sundayHours: number;

  billableTargetPercent: number | null;

  timezone: string | null;

  effectiveFrom: string | null;
  effectiveUntil: string | null;
};

export type WorkloadAllocationDTO = {
  id: string;

  employeeId: string;

  title: string;
  description: string | null;

  type: string;
  status: string;
  priority: string;
  allocationMode: string;

  startDate: string;
  endDate: string;

  hoursPerWeek: number | null;
  allocationPercent: number | null;
  budgetHours: number | null;

  billable: boolean;

  department: WorkloadDepartmentDTO | null;

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

  notes: string | null;

  actualHours: number;
  actualBillableHours: number;

  createdAt: string;
  updatedAt: string;

  editable: boolean;
  deletable: boolean;
};

export type WorkloadCapacityDTO = {
  scheduledHours: number;
  leaveHours: number;
  availableHours: number;
};

export type WorkloadPlannedDTO = {
  allocatedHours: number;

  billableHours: number;
  nonBillableHours: number;

  remainingHours: number;

  utilisationPercent: number;
  billablePercent: number;

  targetPercent: number | null;

  overAllocatedHours: number;
  overAllocated: boolean;
};

export type WorkloadActualDTO = {
  totalHours: number;

  billableHours: number;
  nonBillableHours: number;

  utilisationPercent: number;
  billablePercent: number;
};

export type EmployeeWorkloadDTO = {
  employee: WorkloadEmployeeDTO;

  schedule: WorkScheduleDTO | null;

  capacity: WorkloadCapacityDTO;

  workload: WorkloadPlannedDTO;

  actual: WorkloadActualDTO;

  allocations: WorkloadAllocationDTO[];
};

export type WorkloadSummaryDTO = {
  employeeCount: number;

  scheduledCapacityHours: number;
  leaveHours: number;
  availableCapacityHours: number;

  allocatedHours: number;
  remainingHours: number;

  billableAllocatedHours: number;
  nonBillableAllocatedHours: number;

  actualHours: number;
  actualBillableHours: number;
  actualNonBillableHours: number;

  utilisationPercent: number;
  billablePercent: number;

  overAllocatedEmployeeCount: number;
};

export type WorkloadFeedDTO = {
  summary: WorkloadSummaryDTO;
  employees: EmployeeWorkloadDTO[];
};

/* =============================================================================
 * INTERNAL TYPES
 * =============================================================================
 */

type EmployeeWithDepartment = Prisma.EmployeeGetPayload<{
  include: {
    department: true;
  };
}>;

type WorkScheduleRecord =
  Prisma.EmployeeWorkScheduleGetPayload<object>;

type AllocationWithRelations =
  Prisma.WorkloadAllocationGetPayload<{
    include: {
      department: true;
      client: true;
      project: true;

      timesheetEntries: {
        select: {
          hours: true;
          billable: true;
          workDate: true;
        };
      };
    };
  }>;

type LeaveRecord = Prisma.LeaveRequestGetPayload<{
  select: {
    id: true;
    employeeId: true;

    startDate: true;
    endDate: true;

    startPortion: true;
    endPortion: true;

    totalDays: true;
    status: true;
  };
}>;

type TimesheetEntryRecord =
  Prisma.TimesheetEntryGetPayload<{
    select: {
      id: true;
      employeeId: true;
      workDate: true;
      hours: true;
      billable: true;
    };
  }>;

/* =============================================================================
 * IDENTITY / PERMISSIONS
 * =============================================================================
 */

export async function requireWorkloadIdentity(): Promise<WorkloadIdentity> {
  const admin = await requireAdmin();

  const employee = await prisma.employee.findUnique({
    where: {
      adminUserId: admin.id,
    },
  });

  if (!employee) {
    throw new AuthorisationError(
      "Your admin account is not linked to an employee profile.",
    );
  }

  const isWorkloadManager =
    admin.role === "OWNER" ||
    admin.role === "ADMIN";

  return {
    admin,
    employee,
    isWorkloadManager,
  };
}

export function canManageWorkload(
  identity: WorkloadIdentity,
): boolean {
  return identity.isWorkloadManager;
}

export function assertCanManageWorkload(
  identity: WorkloadIdentity,
): void {
  if (!canManageWorkload(identity)) {
    throw new AuthorisationError(
      "You do not have permission to manage workload.",
    );
  }
}

export function canManageEmployeeWorkload(
  identity: WorkloadIdentity,
  employeeId: string,
): boolean {
  if (identity.isWorkloadManager) {
    return true;
  }

  return identity.employee.id === employeeId;
}

/* =============================================================================
 * RANGE
 * =============================================================================
 */

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

function addUtcDays(
  date: Date,
  days: number,
): Date {
  const result = new Date(date);

  result.setUTCDate(
    result.getUTCDate() + days,
  );

  return result;
}

function startOfUtcWeek(
  date: Date,
): Date {
  const day = date.getUTCDay();

  const mondayOffset =
    day === 0
      ? -6
      : 1 - day;

  return addUtcDays(
    startOfUtcDay(date),
    mondayOffset,
  );
}

export function parseWorkloadRange(
  startValue?: string | null,
  endValue?: string | null,
): WorkloadRange {
  const now = new Date();

  const fallbackStart =
    startOfUtcWeek(now);

  const fallbackEnd =
    addUtcDays(
      fallbackStart,
      7,
    );

  const start = startValue
    ? startOfUtcDay(
        new Date(startValue),
      )
    : fallbackStart;

  const end = endValue
    ? startOfUtcDay(
        new Date(endValue),
      )
    : fallbackEnd;

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    throw new Error(
      "Invalid workload date range.",
    );
  }

  if (end <= start) {
    throw new Error(
      "The workload range end must be after the start.",
    );
  }

  const maximumEnd =
    addUtcDays(
      start,
      366,
    );

  if (end > maximumEnd) {
    throw new Error(
      "The workload range cannot exceed 366 days.",
    );
  }

  return {
    start,
    end,
  };
}

/* =============================================================================
 * BASIC HELPERS
 * =============================================================================
 */

export function employeeName(
  employee: Pick<
    Employee,
    | "firstName"
    | "lastName"
    | "preferredName"
  >,
): string {
  const preferred =
    employee.preferredName?.trim();

  if (preferred) {
    return preferred;
  }

  return [
    employee.firstName,
    employee.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function decimalNumber(
  value:
    | Prisma.Decimal
    | number
    | string
    | null
    | undefined,
): number {
  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function nullableDecimalNumber(
  value:
    | Prisma.Decimal
    | number
    | string
    | null
    | undefined,
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function roundHours(
  value: number,
): number {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}

function roundPercent(
  value: number,
): number {
  return (
    Math.round(
      (value + Number.EPSILON) * 10,
    ) / 10
  );
}

function clampPercent(
  value: number,
): number {
  return Math.max(
    0,
    Math.min(
      100,
      value,
    ),
  );
}

function rangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return (
    startA < endB &&
    endA > startB
  );
}

function maxDate(
  a: Date,
  b: Date,
): Date {
  return a > b
    ? a
    : b;
}

function minDate(
  a: Date,
  b: Date,
): Date {
  return a < b
    ? a
    : b;
}

function dateKeyUtc(
  date: Date,
): string {
  return date
    .toISOString()
    .slice(0, 10);
}

function eachUtcDay(
  startInclusive: Date,
  endExclusive: Date,
): Date[] {
  const days: Date[] = [];

  let cursor =
    startOfUtcDay(
      startInclusive,
    );

  while (
    cursor < endExclusive
  ) {
    days.push(cursor);

    cursor =
      addUtcDays(
        cursor,
        1,
      );
  }

  return days;
}

/* =============================================================================
 * EMPLOYEE DTO
 * =============================================================================
 */

function employeeDTO(
  employee: EmployeeWithDepartment,
): WorkloadEmployeeDTO {
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

    name:
      employeeName(employee),

    avatarUrl:
      employee.avatarUrl,

    jobTitle:
      employee.jobTitle,

    status:
      employee.status,

    employmentType:
      employee.employmentType,

    department:
      employee.department
        ? {
            id:
              employee.department.id,

            name:
              employee.department.name,

            colour:
              employee.department.colour,
          }
        : null,
  };
}

/* =============================================================================
 * WORK SCHEDULES
 * =============================================================================
 */

function scheduleDTO(
  schedule: WorkScheduleRecord,
): WorkScheduleDTO {
  return {
    id:
      schedule.id,

    weeklyHours:
      decimalNumber(
        schedule.weeklyHours,
      ),

    mondayHours:
      decimalNumber(
        schedule.mondayHours,
      ),

    tuesdayHours:
      decimalNumber(
        schedule.tuesdayHours,
      ),

    wednesdayHours:
      decimalNumber(
        schedule.wednesdayHours,
      ),

    thursdayHours:
      decimalNumber(
        schedule.thursdayHours,
      ),

    fridayHours:
      decimalNumber(
        schedule.fridayHours,
      ),

    saturdayHours:
      decimalNumber(
        schedule.saturdayHours,
      ),

    sundayHours:
      decimalNumber(
        schedule.sundayHours,
      ),

    billableTargetPercent:
      nullableDecimalNumber(
        schedule.billableTargetPercent,
      ),

    timezone:
      schedule.timezone,

    effectiveFrom:
      schedule.effectiveFrom
        ?.toISOString() ??
      null,

    effectiveUntil:
      schedule.effectiveUntil
        ?.toISOString() ??
      null,
  };
}

function scheduleHoursForDay(
  schedule: WorkScheduleRecord,
  date: Date,
): number {
  switch (
    date.getUTCDay()
  ) {
    case 0:
      return decimalNumber(
        schedule.sundayHours,
      );

    case 1:
      return decimalNumber(
        schedule.mondayHours,
      );

    case 2:
      return decimalNumber(
        schedule.tuesdayHours,
      );

    case 3:
      return decimalNumber(
        schedule.wednesdayHours,
      );

    case 4:
      return decimalNumber(
        schedule.thursdayHours,
      );

    case 5:
      return decimalNumber(
        schedule.fridayHours,
      );

    case 6:
      return decimalNumber(
        schedule.saturdayHours,
      );

    default:
      return 0;
  }
}

function scheduleAppliesToDate(
  schedule: WorkScheduleRecord,
  date: Date,
): boolean {
  if (!schedule.active) {
    return false;
  }

  const day =
    startOfUtcDay(date);

  const effectiveFrom =
    schedule.effectiveFrom
      ? startOfUtcDay(
          schedule.effectiveFrom,
        )
      : null;

  const effectiveUntil =
    schedule.effectiveUntil
      ? startOfUtcDay(
          schedule.effectiveUntil,
        )
      : null;

  if (
    effectiveFrom &&
    day < effectiveFrom
  ) {
    return false;
  }

  if (
    effectiveUntil &&
    day > effectiveUntil
  ) {
    return false;
  }

  return true;
}

function resolveScheduleForDate(
  schedules: WorkScheduleRecord[],
  date: Date,
): WorkScheduleRecord | null {
  const applicable =
    schedules
      .filter((schedule) =>
        scheduleAppliesToDate(
          schedule,
          date,
        ),
      )
      .sort((a, b) => {
        const aStart =
          a.effectiveFrom
            ?.getTime() ??
          Number.NEGATIVE_INFINITY;

        const bStart =
          b.effectiveFrom
            ?.getTime() ??
          Number.NEGATIVE_INFINITY;

        return (
          bStart -
          aStart
        );
      });

  return (
    applicable[0] ??
    null
  );
}

function primaryScheduleForRange(
  schedules: WorkScheduleRecord[],
  range: WorkloadRange,
): WorkScheduleRecord | null {
  const firstDaySchedule =
    resolveScheduleForDate(
      schedules,
      range.start,
    );

  if (firstDaySchedule) {
    return firstDaySchedule;
  }

  for (
    const day of eachUtcDay(
      range.start,
      range.end,
    )
  ) {
    const schedule =
      resolveScheduleForDate(
        schedules,
        day,
      );

    if (schedule) {
      return schedule;
    }
  }

  return null;
}

function scheduledCapacityForRange(
  schedules: WorkScheduleRecord[],
  range: WorkloadRange,
): number {
  let hours = 0;

  for (
    const day of eachUtcDay(
      range.start,
      range.end,
    )
  ) {
    const schedule =
      resolveScheduleForDate(
        schedules,
        day,
      );

    if (!schedule) {
      continue;
    }

    hours +=
      scheduleHoursForDay(
        schedule,
        day,
      );
  }

  return roundHours(hours);
}

/* =============================================================================
 * LEAVE
 * =============================================================================
 */

function leaveDayFraction(
  leave: LeaveRecord,
  date: Date,
): number {
  const key =
    dateKeyUtc(date);

  const startKey =
    dateKeyUtc(
      leave.startDate,
    );

  const endKey =
    dateKeyUtc(
      leave.endDate,
    );

  if (
    key < startKey ||
    key > endKey
  ) {
    return 0;
  }

  if (
    startKey === endKey
  ) {
    if (
      leave.startPortion ===
        "FULL_DAY" &&
      leave.endPortion ===
        "FULL_DAY"
    ) {
      return 1;
    }

    return 0.5;
  }

  if (
    key === startKey
  ) {
    return leave.startPortion ===
      "FULL_DAY"
      ? 1
      : 0.5;
  }

  if (
    key === endKey
  ) {
    return leave.endPortion ===
      "FULL_DAY"
      ? 1
      : 0.5;
  }

  return 1;
}

function leaveHoursForRange(
  leaves: LeaveRecord[],
  schedules: WorkScheduleRecord[],
  range: WorkloadRange,
): number {
  let hours = 0;

  for (
    const day of eachUtcDay(
      range.start,
      range.end,
    )
  ) {
    const schedule =
      resolveScheduleForDate(
        schedules,
        day,
      );

    if (!schedule) {
      continue;
    }

    const normalHours =
      scheduleHoursForDay(
        schedule,
        day,
      );

    if (
      normalHours <= 0
    ) {
      continue;
    }

    let fraction = 0;

    for (
      const leave of leaves
    ) {
      fraction +=
        leaveDayFraction(
          leave,
          day,
        );
    }

    /*
     * Even if malformed/overlapping leave records somehow exist,
     * they cannot remove more than one complete working day.
     */
    fraction =
      Math.min(
        1,
        fraction,
      );

    hours +=
      normalHours *
      fraction;
  }

  return roundHours(hours);
}

/* =============================================================================
 * ALLOCATION CALCULATIONS
 * =============================================================================
 */

function allocationIsIncluded(
  allocation: AllocationWithRelations,
): boolean {
  return (
    allocation.status !==
      WorkloadAllocationStatus.CANCELLED &&
    allocation.status !==
      WorkloadAllocationStatus.COMPLETED
  );
}

function allocationHoursForRange(
  allocation: AllocationWithRelations,
  schedules: WorkScheduleRecord[],
  range: WorkloadRange,
): number {
  if (
    !allocationIsIncluded(
      allocation,
    )
  ) {
    return 0;
  }

  /*
   * WorkloadAllocation startDate/endDate are treated as
   * inclusive calendar dates.
   *
   * WorkloadRange is [start, end), so add one day to the
   * allocation end date for calculations.
   */
  const allocationStart =
    startOfUtcDay(
      allocation.startDate,
    );

  const allocationEndExclusive =
    addUtcDays(
      startOfUtcDay(
        allocation.endDate,
      ),
      1,
    );

  if (
    !rangesOverlap(
      allocationStart,
      allocationEndExclusive,
      range.start,
      range.end,
    )
  ) {
    return 0;
  }

  const overlapStart =
    maxDate(
      allocationStart,
      range.start,
    );

  const overlapEnd =
    minDate(
      allocationEndExclusive,
      range.end,
    );

  let result = 0;

  if (
    allocation.allocationMode ===
    WorkloadAllocationMode.PERCENTAGE
  ) {
    const percentage =
      clampPercent(
        decimalNumber(
          allocation.allocationPercent,
        ),
      );

    for (
      const day of eachUtcDay(
        overlapStart,
        overlapEnd,
      )
    ) {
      const schedule =
        resolveScheduleForDate(
          schedules,
          day,
        );

      if (!schedule) {
        continue;
      }

      const normalHours =
        scheduleHoursForDay(
          schedule,
          day,
        );

      result +=
        normalHours *
        (percentage / 100);
    }

    return roundHours(
      result,
    );
  }

  const weeklyHours =
    decimalNumber(
      allocation.hoursPerWeek,
    );

  if (
    weeklyHours <= 0
  ) {
    return 0;
  }

  /*
   * HOURS allocations are distributed across the person's
   * scheduled working days proportionally.
   *
   * Example:
   *
   * Schedule = 40h/week, Monday-Friday 8h/day.
   * Allocation = 20h/week.
   *
   * Each normal day contributes 4 allocation hours.
   */
  for (
    const day of eachUtcDay(
      overlapStart,
      overlapEnd,
    )
  ) {
    const schedule =
      resolveScheduleForDate(
        schedules,
        day,
      );

    if (!schedule) {
      continue;
    }

    const dayHours =
      scheduleHoursForDay(
        schedule,
        day,
      );

    const scheduleWeeklyHours =
      decimalNumber(
        schedule.weeklyHours,
      );

    if (
      dayHours <= 0 ||
      scheduleWeeklyHours <= 0
    ) {
      continue;
    }

    result +=
      weeklyHours *
      (
        dayHours /
        scheduleWeeklyHours
      );
  }

  return roundHours(
    result,
  );
}

/* =============================================================================
 * TIMESHEET CALCULATIONS
 * =============================================================================
 */

function timesheetTotals(
  entries: TimesheetEntryRecord[],
): {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
} {
  let totalHours = 0;
  let billableHours = 0;

  for (
    const entry of entries
  ) {
    const hours =
      decimalNumber(
        entry.hours,
      );

    totalHours += hours;

    if (entry.billable) {
      billableHours +=
        hours;
    }
  }

  totalHours =
    roundHours(
      totalHours,
    );

  billableHours =
    roundHours(
      billableHours,
    );

  return {
    totalHours,

    billableHours,

    nonBillableHours:
      roundHours(
        Math.max(
          0,
          totalHours -
            billableHours,
        ),
      ),
  };
}

/* =============================================================================
 * ALLOCATION DTO
 * =============================================================================
 */

function allocationDTO(
  allocation: AllocationWithRelations,
  identity: WorkloadIdentity,
  range: WorkloadRange,
): WorkloadAllocationDTO {
  const actualEntries =
    allocation.timesheetEntries.filter(
      (entry) => {
        const date =
          startOfUtcDay(
            entry.workDate,
          );

        return (
          date >=
            range.start &&
          date <
            range.end
        );
      },
    );

  const actual =
    timesheetTotals(
      actualEntries.map(
        (entry) => ({
          id: "",

          employeeId:
            allocation.employeeId,

          workDate:
            entry.workDate,

          hours:
            entry.hours,

          billable:
            entry.billable,
        }),
      ),
    );

  const editable =
    identity.isWorkloadManager;

  return {
    id:
      allocation.id,

    employeeId:
      allocation.employeeId,

    title:
      allocation.title,

    description:
      allocation.description,

    type:
      allocation.type,

    status:
      allocation.status,

    priority:
      allocation.priority,

    allocationMode:
      allocation.allocationMode,

    startDate:
      allocation.startDate.toISOString(),

    endDate:
      allocation.endDate.toISOString(),

    hoursPerWeek:
      nullableDecimalNumber(
        allocation.hoursPerWeek,
      ),

    allocationPercent:
      nullableDecimalNumber(
        allocation.allocationPercent,
      ),

    budgetHours:
      nullableDecimalNumber(
        allocation.budgetHours,
      ),

    billable:
      allocation.billable,

    department:
      allocation.department
        ? {
            id:
              allocation.department.id,

            name:
              allocation.department.name,

            colour:
              allocation.department.colour,
          }
        : null,

    client:
      allocation.client
        ? {
            id:
              allocation.client.id,

            name:
              allocation.client.name,

            displayName:
              allocation.client.displayName,
          }
        : null,

    project:
      allocation.project
        ? {
            id:
              allocation.project.id,

            name:
              allocation.project.name,

            clientId:
              allocation.project.clientId,
          }
        : null,

    notes:
      allocation.notes,

    actualHours:
      actual.totalHours,

    actualBillableHours:
      actual.billableHours,

    createdAt:
      allocation.createdAt.toISOString(),

    updatedAt:
      allocation.updatedAt.toISOString(),

    editable,

    deletable:
      editable,
  };
}

/* =============================================================================
 * WORKLOAD FEED
 * =============================================================================
 */

export async function getWorkloadFeed({
  identity,
  range,
  employeeId,
  departmentId,
  clientId,
  projectId,
}: {
  identity: WorkloadIdentity;
  range: WorkloadRange;

  employeeId?: string | null;
  departmentId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
}): Promise<WorkloadFeedDTO> {
  /*
   * OWNER / ADMIN can view the company workload or filter it.
   *
   * Other users can only receive their own employee workload.
   */
  const effectiveEmployeeId =
    identity.isWorkloadManager
      ? employeeId ?? null
      : identity.employee.id;

  const employeeWhere:
    Prisma.EmployeeWhereInput =
    {
      status: {
        in: [
          "ACTIVE",
          "ONBOARDING",
          "ON_LEAVE",
        ],
      },

      ...(effectiveEmployeeId
        ? {
            id:
              effectiveEmployeeId,
          }
        : {}),

      ...(departmentId
        ? {
            departmentId,
          }
        : {}),
    };

  const employees =
    await prisma.employee.findMany({
      where:
        employeeWhere,

      include: {
        department: true,
      },

      orderBy: [
        {
          firstName: "asc",
        },
        {
          lastName: "asc",
        },
      ],
    });

  if (
    employees.length === 0
  ) {
    return {
      summary:
        emptyWorkloadSummary(),

      employees: [],
    };
  }

  const employeeIds =
    employees.map(
      (employee) =>
        employee.id,
    );

  const allocationWhere:
    Prisma.WorkloadAllocationWhereInput =
    {
      employeeId: {
        in:
          employeeIds,
      },

      status: {
        not:
          WorkloadAllocationStatus.CANCELLED,
      },

      startDate: {
        lt:
          range.end,
      },

      endDate: {
        gte:
          range.start,
      },

      ...(departmentId
        ? {
            departmentId,
          }
        : {}),

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
    };

  const [
    schedules,
    allocations,
    leaves,
    timesheetEntries,
  ] = await Promise.all([
    prisma.employeeWorkSchedule.findMany({
      where: {
        employeeId: {
          in:
            employeeIds,
        },

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
                  lt:
                    range.end,
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
                  gte:
                    range.start,
                },
              },
            ],
          },
        ],
      },

      orderBy: [
        {
          employeeId:
            "asc",
        },
        {
          effectiveFrom:
            "desc",
        },
      ],
    }),

    prisma.workloadAllocation.findMany({
      where:
        allocationWhere,

      include: {
        department:
          true,

        client:
          true,

        project:
          true,

        timesheetEntries: {
          where: {
            workDate: {
              gte:
                range.start,

              lt:
                range.end,
            },
          },

          select: {
            hours:
              true,

            billable:
              true,

            workDate:
              true,
          },
        },
      },

      orderBy: [
        {
          startDate:
            "asc",
        },
        {
          title:
            "asc",
        },
      ],
    }),

    prisma.leaveRequest.findMany({
      where: {
        employeeId: {
          in:
            employeeIds,
        },

        status: {
          in: [
            LeaveRequestStatus.APPROVED,
            LeaveRequestStatus.RECORDED,
          ],
        },

        startDate: {
          lt:
            range.end,
        },

        endDate: {
          gte:
            range.start,
        },
      },

      select: {
        id:
          true,

        employeeId:
          true,

        startDate:
          true,

        endDate:
          true,

        startPortion:
          true,

        endPortion:
          true,

        totalDays:
          true,

        status:
          true,
      },
    }),

    prisma.timesheetEntry.findMany({
      where: {
        employeeId: {
          in:
            employeeIds,
        },

        workDate: {
          gte:
            range.start,

          lt:
            range.end,
        },

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

      select: {
        id:
          true,

        employeeId:
          true,

        workDate:
          true,

        hours:
          true,

        billable:
          true,
      },
    }),
  ]);

  /* ===========================================================================
   * GROUP DATA BY EMPLOYEE
   * ===========================================================================
   */

  const schedulesByEmployee =
    new Map<
      string,
      WorkScheduleRecord[]
    >();

  for (
    const schedule of schedules
  ) {
    const existing =
      schedulesByEmployee.get(
        schedule.employeeId,
      ) ?? [];

    existing.push(
      schedule,
    );

    schedulesByEmployee.set(
      schedule.employeeId,
      existing,
    );
  }

  const allocationsByEmployee =
    new Map<
      string,
      AllocationWithRelations[]
    >();

  for (
    const allocation of allocations
  ) {
    const existing =
      allocationsByEmployee.get(
        allocation.employeeId,
      ) ?? [];

    existing.push(
      allocation,
    );

    allocationsByEmployee.set(
      allocation.employeeId,
      existing,
    );
  }

  const leavesByEmployee =
    new Map<
      string,
      LeaveRecord[]
    >();

  for (
    const leave of leaves
  ) {
    const existing =
      leavesByEmployee.get(
        leave.employeeId,
      ) ?? [];

    existing.push(
      leave,
    );

    leavesByEmployee.set(
      leave.employeeId,
      existing,
    );
  }

  const entriesByEmployee =
    new Map<
      string,
      TimesheetEntryRecord[]
    >();

  for (
    const entry of timesheetEntries
  ) {
    const existing =
      entriesByEmployee.get(
        entry.employeeId,
      ) ?? [];

    existing.push(
      entry,
    );

    entriesByEmployee.set(
      entry.employeeId,
      existing,
    );
  }

  /* ===========================================================================
   * BUILD EMPLOYEE WORKLOAD ROWS
   * ===========================================================================
   */

  const employeeRows:
    EmployeeWorkloadDTO[] =
    employees.map(
      (employee) => {
        const employeeSchedules =
          schedulesByEmployee.get(
            employee.id,
          ) ?? [];

        const employeeAllocations =
          allocationsByEmployee.get(
            employee.id,
          ) ?? [];

        const employeeLeaves =
          leavesByEmployee.get(
            employee.id,
          ) ?? [];

        const employeeEntries =
          entriesByEmployee.get(
            employee.id,
          ) ?? [];

        const scheduledHours =
          scheduledCapacityForRange(
            employeeSchedules,
            range,
          );

        const leaveHours =
          leaveHoursForRange(
            employeeLeaves,
            employeeSchedules,
            range,
          );

        const availableHours =
          roundHours(
            Math.max(
              0,
              scheduledHours -
                leaveHours,
            ),
          );

        let allocatedHours =
          0;

        let billableAllocatedHours =
          0;

        for (
          const allocation of employeeAllocations
        ) {
          const hours =
            allocationHoursForRange(
              allocation,
              employeeSchedules,
              range,
            );

          allocatedHours +=
            hours;

          if (
            allocation.billable
          ) {
            billableAllocatedHours +=
              hours;
          }
        }

        allocatedHours =
          roundHours(
            allocatedHours,
          );

        billableAllocatedHours =
          roundHours(
            billableAllocatedHours,
          );

        const nonBillableAllocatedHours =
          roundHours(
            Math.max(
              0,
              allocatedHours -
                billableAllocatedHours,
            ),
          );

        const remainingHours =
          roundHours(
            availableHours -
              allocatedHours,
          );

        const utilisationPercent =
          availableHours > 0
            ? roundPercent(
                (
                  allocatedHours /
                  availableHours
                ) * 100,
              )
            : allocatedHours > 0
              ? 100
              : 0;

        const billablePercent =
          availableHours > 0
            ? roundPercent(
                (
                  billableAllocatedHours /
                  availableHours
                ) * 100,
              )
            : 0;

        const actual =
          timesheetTotals(
            employeeEntries,
          );

        const actualUtilisationPercent =
          availableHours > 0
            ? roundPercent(
                (
                  actual.totalHours /
                  availableHours
                ) * 100,
              )
            : actual.totalHours > 0
              ? 100
              : 0;

        const actualBillablePercent =
          actual.totalHours > 0
            ? roundPercent(
                (
                  actual.billableHours /
                  actual.totalHours
                ) * 100,
              )
            : 0;

        const primarySchedule =
          primaryScheduleForRange(
            employeeSchedules,
            range,
          );

        return {
          employee:
            employeeDTO(
              employee,
            ),

          schedule:
            primarySchedule
              ? scheduleDTO(
                  primarySchedule,
                )
              : null,

          capacity: {
            scheduledHours,
            leaveHours,
            availableHours,
          },

          workload: {
            allocatedHours,

            billableHours:
              billableAllocatedHours,

            nonBillableHours:
              nonBillableAllocatedHours,

            remainingHours,

            utilisationPercent,

            billablePercent,

            targetPercent:
              primarySchedule
                ? nullableDecimalNumber(
                    primarySchedule.billableTargetPercent,
                  )
                : null,

            overAllocatedHours:
              roundHours(
                Math.max(
                  0,
                  allocatedHours -
                    availableHours,
                ),
              ),

            overAllocated:
              allocatedHours >
              availableHours,
          },

          actual: {
            totalHours:
              actual.totalHours,

            billableHours:
              actual.billableHours,

            nonBillableHours:
              actual.nonBillableHours,

            utilisationPercent:
              actualUtilisationPercent,

            billablePercent:
              actualBillablePercent,
          },

          allocations:
            employeeAllocations.map(
              (allocation) =>
                allocationDTO(
                  allocation,
                  identity,
                  range,
                ),
            ),
        };
      },
    );

  return {
    summary:
      buildWorkloadSummary(
        employeeRows,
      ),

    employees:
      employeeRows,
  };
}

/* =============================================================================
 * SUMMARY
 * =============================================================================
 */

function emptyWorkloadSummary(): WorkloadSummaryDTO {
  return {
    employeeCount:
      0,

    scheduledCapacityHours:
      0,

    leaveHours:
      0,

    availableCapacityHours:
      0,

    allocatedHours:
      0,

    remainingHours:
      0,

    billableAllocatedHours:
      0,

    nonBillableAllocatedHours:
      0,

    actualHours:
      0,

    actualBillableHours:
      0,

    actualNonBillableHours:
      0,

    utilisationPercent:
      0,

    billablePercent:
      0,

    overAllocatedEmployeeCount:
      0,
  };
}

function buildWorkloadSummary(
  employees: EmployeeWorkloadDTO[],
): WorkloadSummaryDTO {
  if (
    employees.length === 0
  ) {
    return emptyWorkloadSummary();
  }

  let scheduledCapacityHours =
    0;

  let leaveHours =
    0;

  let availableCapacityHours =
    0;

  let allocatedHours =
    0;

  let remainingHours =
    0;

  let billableAllocatedHours =
    0;

  let nonBillableAllocatedHours =
    0;

  let actualHours =
    0;

  let actualBillableHours =
    0;

  let actualNonBillableHours =
    0;

  let overAllocatedEmployeeCount =
    0;

  for (
    const employee of employees
  ) {
    scheduledCapacityHours +=
      employee.capacity
        .scheduledHours;

    leaveHours +=
      employee.capacity
        .leaveHours;

    availableCapacityHours +=
      employee.capacity
        .availableHours;

    allocatedHours +=
      employee.workload
        .allocatedHours;

    remainingHours +=
      employee.workload
        .remainingHours;

    billableAllocatedHours +=
      employee.workload
        .billableHours;

    nonBillableAllocatedHours +=
      employee.workload
        .nonBillableHours;

    actualHours +=
      employee.actual
        .totalHours;

    actualBillableHours +=
      employee.actual
        .billableHours;

    actualNonBillableHours +=
      employee.actual
        .nonBillableHours;

    if (
      employee.workload
        .overAllocated
    ) {
      overAllocatedEmployeeCount +=
        1;
    }
  }

  scheduledCapacityHours =
    roundHours(
      scheduledCapacityHours,
    );

  leaveHours =
    roundHours(
      leaveHours,
    );

  availableCapacityHours =
    roundHours(
      availableCapacityHours,
    );

  allocatedHours =
    roundHours(
      allocatedHours,
    );

  remainingHours =
    roundHours(
      remainingHours,
    );

  billableAllocatedHours =
    roundHours(
      billableAllocatedHours,
    );

  nonBillableAllocatedHours =
    roundHours(
      nonBillableAllocatedHours,
    );

  actualHours =
    roundHours(
      actualHours,
    );

  actualBillableHours =
    roundHours(
      actualBillableHours,
    );

  actualNonBillableHours =
    roundHours(
      actualNonBillableHours,
    );

  return {
    employeeCount:
      employees.length,

    scheduledCapacityHours,

    leaveHours,

    availableCapacityHours,

    allocatedHours,

    remainingHours,

    billableAllocatedHours,

    nonBillableAllocatedHours,

    actualHours,

    actualBillableHours,

    actualNonBillableHours,

    utilisationPercent:
      availableCapacityHours > 0
        ? roundPercent(
            (
              allocatedHours /
              availableCapacityHours
            ) * 100,
          )
        : 0,

    billablePercent:
      availableCapacityHours > 0
        ? roundPercent(
            (
              billableAllocatedHours /
              availableCapacityHours
            ) * 100,
          )
        : 0,

    overAllocatedEmployeeCount,
  };
}

/* =============================================================================
 * SCHEDULE VALIDATION
 * =============================================================================
 */

export async function assertNoScheduleOverlap({
  employeeId,
  effectiveFrom,
  effectiveUntil,
  excludeId,
}: {
  employeeId: string;

  effectiveFrom: Date | null;
  effectiveUntil: Date | null;

  excludeId?: string | null;
}): Promise<void> {
  if (
    effectiveFrom &&
    effectiveUntil &&
    effectiveUntil <
      effectiveFrom
  ) {
    throw new Error(
      "The schedule end date cannot be before its start date.",
    );
  }

  const existing =
    await prisma.employeeWorkSchedule.findMany({
      where: {
        employeeId,

        active:
          true,

        ...(excludeId
          ? {
              id: {
                not:
                  excludeId,
              },
            }
          : {}),
      },

      select: {
        id:
          true,

        effectiveFrom:
          true,

        effectiveUntil:
          true,
      },
    });

  const candidateStart =
    effectiveFrom
      ?.getTime() ??
    Number.NEGATIVE_INFINITY;

  const candidateEnd =
    effectiveUntil
      ?.getTime() ??
    Number.POSITIVE_INFINITY;

  const overlapping =
    existing.some(
      (schedule) => {
        const existingStart =
          schedule.effectiveFrom
            ?.getTime() ??
          Number.NEGATIVE_INFINITY;

        const existingEnd =
          schedule.effectiveUntil
            ?.getTime() ??
          Number.POSITIVE_INFINITY;

        return (
          candidateStart <=
            existingEnd &&
          candidateEnd >=
            existingStart
        );
      },
    );

  if (overlapping) {
    throw new Error(
      "This work schedule overlaps another active schedule for the employee.",
    );
  }
}

/* =============================================================================
 * ALLOCATION VALIDATION
 * =============================================================================
 */

export function validateAllocationValues({
  allocationMode,
  hoursPerWeek,
  allocationPercent,
  budgetHours,
}: {
  allocationMode:
    WorkloadAllocationMode;

  hoursPerWeek?:
    | number
    | null;

  allocationPercent?:
    | number
    | null;

  budgetHours?:
    | number
    | null;
}): {
  hoursPerWeek:
    | number
    | null;

  allocationPercent:
    | number
    | null;

  budgetHours:
    | number
    | null;
} {
  if (
    budgetHours !== null &&
    budgetHours !== undefined &&
    (
      !Number.isFinite(
        budgetHours,
      ) ||
      budgetHours < 0
    )
  ) {
    throw new Error(
      "Budget hours cannot be negative.",
    );
  }

  if (
    allocationMode ===
    WorkloadAllocationMode.HOURS
  ) {
    if (
      hoursPerWeek === null ||
      hoursPerWeek === undefined ||
      !Number.isFinite(
        hoursPerWeek,
      ) ||
      hoursPerWeek <= 0
    ) {
      throw new Error(
        "Hours per week must be greater than zero.",
      );
    }

    return {
      hoursPerWeek,

      allocationPercent:
        null,

      budgetHours:
        budgetHours ??
        null,
    };
  }

  if (
    allocationPercent === null ||
    allocationPercent === undefined ||
    !Number.isFinite(
      allocationPercent,
    ) ||
    allocationPercent <= 0 ||
    allocationPercent > 100
  ) {
    throw new Error(
      "Allocation percentage must be greater than 0 and no more than 100.",
    );
  }

  return {
    hoursPerWeek:
      null,

    allocationPercent,

    budgetHours:
      budgetHours ??
      null,
  };
}

/* =============================================================================
 * PROJECT / CLIENT / DEPARTMENT VALIDATION
 * =============================================================================
 */

export async function resolveWorkloadContext({
  departmentId,
  clientId,
  projectId,
}: {
  departmentId?:
    | string
    | null;

  clientId?:
    | string
    | null;

  projectId?:
    | string
    | null;
}): Promise<{
  departmentId:
    | string
    | null;

  clientId:
    | string
    | null;

  projectId:
    | string
    | null;
}> {
  const resolvedDepartmentId =
    departmentId
      ?.trim() ||
    null;

  let resolvedClientId =
    clientId
      ?.trim() ||
    null;

  const resolvedProjectId =
    projectId
      ?.trim() ||
    null;

  if (
    resolvedDepartmentId
  ) {
    const department =
      await prisma.department.findUnique({
        where: {
          id:
            resolvedDepartmentId,
        },

        select: {
          id:
            true,
        },
      });

    if (!department) {
      throw new Error(
        "The selected department does not exist.",
      );
    }
  }

  if (
    resolvedProjectId
  ) {
    const project =
      await prisma.project.findUnique({
        where: {
          id:
            resolvedProjectId,
        },

        select: {
          id:
            true,

          clientId:
            true,
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

    /*
     * Project is the source of truth for its client.
     */
    resolvedClientId =
      project.clientId;
  }

  if (
    resolvedClientId
  ) {
    const client =
      await prisma.client.findUnique({
        where: {
          id:
            resolvedClientId,
        },

        select: {
          id:
            true,
        },
      });

    if (!client) {
      throw new Error(
        "The selected client does not exist.",
      );
    }
  }

  return {
    departmentId:
      resolvedDepartmentId,

    clientId:
      resolvedClientId,

    projectId:
      resolvedProjectId,
  };
}

/* =============================================================================
 * EMPLOYEE VALIDATION
 * =============================================================================
 */

export async function requireWorkloadEmployee(
  employeeId: string,
): Promise<Employee> {
  const employee =
    await prisma.employee.findUnique({
      where: {
        id:
          employeeId,
      },
    });

  if (!employee) {
    throw new Error(
      "The selected employee does not exist.",
    );
  }

  if (
    employee.status ===
      "FORMER" ||
    employee.status ===
      "SUSPENDED"
  ) {
    throw new Error(
      "Workload cannot be assigned to this employee.",
    );
  }

  return employee;
}

/* =============================================================================
 * WEEKLY HOURS
 * =============================================================================
 */

export function calculateWeeklyHours({
  mondayHours,
  tuesdayHours,
  wednesdayHours,
  thursdayHours,
  fridayHours,
  saturdayHours,
  sundayHours,
}: {
  mondayHours: number;
  tuesdayHours: number;
  wednesdayHours: number;
  thursdayHours: number;
  fridayHours: number;
  saturdayHours: number;
  sundayHours: number;
}): number {
  const values = [
    mondayHours,
    tuesdayHours,
    wednesdayHours,
    thursdayHours,
    fridayHours,
    saturdayHours,
    sundayHours,
  ];

  for (
    const value of values
  ) {
    if (
      !Number.isFinite(
        value,
      ) ||
      value < 0 ||
      value > 24
    ) {
      throw new Error(
        "Daily working hours must be between 0 and 24.",
      );
    }
  }

  return roundHours(
    values.reduce(
      (
        total,
        value,
      ) =>
        total +
        value,

      0,
    ),
  );
}

/* =============================================================================
 * PERCENT VALIDATION
 * =============================================================================
 */

export function validateOptionalPercent(
  value:
    | number
    | null
    | undefined,

  label = "Percentage",
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    !Number.isFinite(
      value,
    ) ||
    value < 0 ||
    value > 100
  ) {
    throw new Error(
      `${label} must be between 0 and 100.`,
    );
  }

  return value;
}

/* =============================================================================
 * API ERROR
 * =============================================================================
 */

export function workloadApiError(
  error: unknown,
): {
  status: number;
  message: string;
} {
  /*
   * Your existing AuthorisationError accepts a message only.
   * It does not expose a numeric .status property.
   */
  if (
    error instanceof
    AuthorisationError
  ) {
    return {
      status:
        403,

      message:
        error.message ||
        "You are not authorised to perform this action.",
    };
  }

  if (
    error instanceof Error
  ) {
    return {
      status:
        400,

      message:
        error.message,
    };
  }

  return {
    status:
      500,

    message:
      "An unexpected workload error occurred.",
  };
}