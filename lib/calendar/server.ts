import {
  CalendarEventScope,
  CalendarEventStatus,
  LeaveRequestStatus,
  type AdminUser,
  type Employee,
} from "@/app/generated/prisma/client";

import {
  AuthorisationError,
  requireAdmin,
} from "@/lib/auth/current-admin";

import { prisma } from "@/lib/prisma";

/* ============================================================================
   TYPES
============================================================================ */

export type CalendarIdentity = {
  admin: AdminUser;
  employee: Employee;
  isCalendarManager: boolean;
};

export type CalendarItemSource =
  | "CALENDAR"
  | "LEAVE"
  | "INTERVIEW"
  | "DEPLOYMENT";

export type CalendarPersonDTO = {
  id: string;
  name: string;
  avatarUrl: string | null;
  department: {
    id: string;
    name: string;
  } | null;
};

export type CalendarItemDTO = {
  id: string;
  source: CalendarItemSource;
  sourceId: string;

  title: string;
  description: string | null;

  type: string;

  startAt: string;
  endAt: string | null;

  allDay: boolean;

  scope: string;
  priority: string;
  status: string;

  private: boolean;

  editable: boolean;
  deletable: boolean;

  owner: CalendarPersonDTO | null;

  department: {
    id: string;
    name: string;
  } | null;

  client: {
    id: string;
    name: string;
  } | null;

  project: {
    id: string;
    name: string;
  } | null;

  attendees: Array<{
    id: string;
    employeeId: string;
    name: string;
    avatarUrl: string | null;
    status: string;
  }>;

  location: string | null;
  meetingUrl: string | null;

  metadata: Record<string, unknown>;
};

export type CalendarRange = {
  start: Date;
  end: Date;
};

/* ============================================================================
   IDENTITY
============================================================================ */

export async function requireCalendarIdentity(): Promise<CalendarIdentity> {
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
    isCalendarManager:
      admin.role === "OWNER" ||
      admin.role === "ADMIN",
  };
}

/* ============================================================================
   DATE RANGE
============================================================================ */

export function parseCalendarRange(
  startValue: string | null,
  endValue: string | null,
): CalendarRange {
  const now = new Date();

  const fallbackStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() - 1,
      1,
      0,
      0,
      0,
      0,
    ),
  );

  const fallbackEnd = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + 2,
      1,
      0,
      0,
      0,
      0,
    ),
  );

  const start = startValue
    ? new Date(startValue)
    : fallbackStart;

  const end = endValue
    ? new Date(endValue)
    : fallbackEnd;

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    throw new Error(
      "The calendar start or end date is invalid.",
    );
  }

  if (end <= start) {
    throw new Error(
      "The calendar end date must be after the start date.",
    );
  }

  const maximumRangeMs =
    366 * 24 * 60 * 60 * 1000;

  if (
    end.getTime() - start.getTime() >
    maximumRangeMs
  ) {
    throw new Error(
      "Calendar requests cannot exceed one year.",
    );
  }

  return {
    start,
    end,
  };
}

/* ============================================================================
   HELPERS
============================================================================ */

export function employeeName(
  employee: Pick<
    Employee,
    "firstName" | "lastName" | "preferredName"
  >,
) {
  const first =
    employee.preferredName?.trim() ||
    employee.firstName.trim();

  return `${first} ${employee.lastName}`.trim();
}

function leaveTypeLabel(value: string) {
  const labels: Record<string, string> = {
    ANNUAL: "Annual leave",
    SICK: "Sick leave",
    PERSONAL: "Personal leave",
    COMPASSIONATE: "Compassionate leave",
    PARENTAL: "Parental leave",
    UNPAID: "Unpaid leave",
    STUDY: "Study leave",
    OTHER: "Leave",
  };

  return labels[value] ?? "Leave";
}

function interviewTypeLabel(value: string) {
  const labels: Record<string, string> = {
    PHONE: "Phone interview",
    VIDEO: "Video interview",
    ONSITE: "On-site interview",
    TECHNICAL: "Technical interview",
    PORTFOLIO: "Portfolio interview",
    CULTURE: "Culture interview",
    FINAL: "Final interview",
    OTHER: "Interview",
  };

  return labels[value] ?? "Interview";
}

function calendarPerson(
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    avatarUrl: string | null;
    department: {
      id: string;
      name: string;
    } | null;
  },
): CalendarPersonDTO {
  return {
    id: employee.id,
    name: employeeName(employee),
    avatarUrl: employee.avatarUrl,

    department: employee.department
      ? {
          id: employee.department.id,
          name: employee.department.name,
        }
      : null,
  };
}

/* ============================================================================
   MANUAL CALENDAR VISIBILITY
============================================================================ */

function canSeeManualEvent({
  identity,
  event,
}: {
  identity: CalendarIdentity;
  event: {
    ownerId: string;
    scope: CalendarEventScope;
    departmentId: string | null;
    attendees: Array<{
      employeeId: string;
    }>;
  };
}) {
  const isOwner =
    event.ownerId === identity.employee.id;

  const isAttendee =
    event.attendees.some(
      (attendee) =>
        attendee.employeeId ===
        identity.employee.id,
    );

  if (isOwner || isAttendee) {
    return true;
  }

  if (
    event.scope ===
    CalendarEventScope.COMPANY
  ) {
    return true;
  }

  if (
    event.scope ===
      CalendarEventScope.TEAM ||
    event.scope ===
      CalendarEventScope.DEPARTMENT
  ) {
    return Boolean(
      identity.employee.departmentId &&
        event.departmentId ===
          identity.employee.departmentId,
    );
  }

  if (
    event.scope ===
    CalendarEventScope.WORKSPACE
  ) {
    /*
     * Syntra Grid does not yet have project/client
     * membership tables.
     *
     * Until that exists, workspace events are visible
     * to authenticated Syntra Grid employees.
     */
    return true;
  }

  if (
    event.scope ===
    CalendarEventScope.PERSONAL
  ) {
    /*
     * A manager does not automatically gain access
     * to somebody else's personal calendar event.
     *
     * The owner and invited attendees were already
     * handled above.
     */
    return false;
  }

  return false;
}

function canSeePrivateEventDetails({
  identity,
  event,
}: {
  identity: CalendarIdentity;
  event: {
    ownerId: string;
    private: boolean;
    attendees: Array<{
      employeeId: string;
    }>;
  };
}) {
  if (!event.private) {
    return true;
  }

  if (
    event.ownerId ===
    identity.employee.id
  ) {
    return true;
  }

  return event.attendees.some(
    (attendee) =>
      attendee.employeeId ===
      identity.employee.id,
  );
}

/* ============================================================================
   UNIFIED CALENDAR FEED
============================================================================ */

export async function getCalendarFeed({
  identity,
  range,
  departmentId,
  employeeId,
  clientId,
  projectId,
}: {
  identity: CalendarIdentity;
  range: CalendarRange;
  departmentId?: string | null;
  employeeId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
}) {
  /*
   * Build AND conditions rather than spreading multiple OR
   * properties into one Prisma object.
   *
   * This is important because the date-overlap query uses OR,
   * while the optional employee filter also needs OR.
   */
  const manualEventAnd: object[] = [
    {
      status: {
        not: CalendarEventStatus.CANCELLED,
      },
    },

    /*
     * Event overlaps requested range when:
     *
     * startAt < range.end
     * AND
     * (
     *   endAt >= range.start
     *   OR
     *   event has no end and startAt >= range.start
     * )
     */
    {
      startAt: {
        lt: range.end,
      },
    },

    {
      OR: [
        {
          endAt: {
            gte: range.start,
          },
        },
        {
          AND: [
            {
              endAt: null,
            },
            {
              startAt: {
                gte: range.start,
              },
            },
          ],
        },
      ],
    },
  ];

  if (departmentId) {
    manualEventAnd.push({
      departmentId,
    });
  }

  if (employeeId) {
    manualEventAnd.push({
      OR: [
        {
          ownerId: employeeId,
        },
        {
          attendees: {
            some: {
              employeeId,
            },
          },
        },
      ],
    });
  }

  if (clientId) {
    manualEventAnd.push({
      clientId,
    });
  }

  if (projectId) {
    manualEventAnd.push({
      projectId,
    });
  }

  const [
    manualEvents,
    leaveRequests,
    interviews,
    deployments,
  ] = await Promise.all([
    /* ------------------------------------------------------------------------
       MANUAL EVENTS
    ------------------------------------------------------------------------ */

    prisma.calendarEvent.findMany({
      where: {
        AND: manualEventAnd,
      },

      include: {
        owner: {
          include: {
            department: true,
          },
        },

        department: true,
        client: true,
        project: true,

        attendees: {
          include: {
            employee: true,
          },
        },
      },

      orderBy: {
        startAt: "asc",
      },
    }),

    /* ------------------------------------------------------------------------
       LEAVE
    ------------------------------------------------------------------------ */

    prisma.leaveRequest.findMany({
      where: {
        status: {
          in: [
            LeaveRequestStatus.APPROVED,
            LeaveRequestStatus.RECORDED,
          ],
        },

        /*
         * Leave overlaps the requested calendar range.
         *
         * Leave dates are inclusive date-based records,
         * so <= and >= are intentional here.
         */
        startDate: {
          lte: range.end,
        },

        endDate: {
          gte: range.start,
        },

        ...(departmentId
          ? {
              employee: {
                departmentId,
              },
            }
          : {}),

        ...(employeeId
          ? {
              employeeId,
            }
          : {}),
      },

      include: {
        employee: {
          include: {
            department: true,
          },
        },

        policy: true,
      },

      orderBy: {
        startDate: "asc",
      },
    }),

    /* ------------------------------------------------------------------------
       INTERVIEWS
    ------------------------------------------------------------------------ */

    prisma.interview.findMany({
      where: {
        scheduledAt: {
          gte: range.start,
          lt: range.end,
        },

        status: {
          not: "CANCELLED",
        },

        ...(departmentId
          ? {
              application: {
                jobOpening: {
                  departmentId,
                },
              },
            }
          : {}),
      },

      include: {
        application: {
          include: {
            candidate: true,

            jobOpening: {
              include: {
                department: true,
              },
            },
          },
        },

        interviewers: {
          include: {
            adminUser: {
              include: {
                employee: true,
              },
            },
          },
        },
      },

      orderBy: {
        scheduledAt: "asc",
      },
    }),

    /* ------------------------------------------------------------------------
       DEPLOYMENTS
    ------------------------------------------------------------------------ */

    prisma.deployment.findMany({
      where: {
        /*
         * Prefer actual deployment start when available.
         * Older deployment rows may only have createdAt,
         * so broad retrieval happens here and final range
         * validation occurs when mapping below.
         */
        OR: [
          {
            startedAt: {
              gte: range.start,
              lt: range.end,
            },
          },
          {
            startedAt: null,

            createdAt: {
              gte: range.start,
              lt: range.end,
            },
          },
        ],

        ...(projectId
          ? {
              projectId,
            }
          : {}),

        ...(clientId
          ? {
              project: {
                clientId,
              },
            }
          : {}),
      },

      include: {
        project: {
          include: {
            client: true,
          },
        },
      },

      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  const items: CalendarItemDTO[] = [];

  /* ==========================================================================
     MANUAL EVENTS
  ========================================================================== */

  for (const event of manualEvents) {
    if (
      !canSeeManualEvent({
        identity,
        event,
      })
    ) {
      continue;
    }

    const canSeeDetails =
      canSeePrivateEventDetails({
        identity,
        event,
      });

    const isOwner =
      event.ownerId ===
      identity.employee.id;

    const canManage =
      isOwner ||
      identity.isCalendarManager;

    items.push({
      id: `calendar:${event.id}`,
      source: "CALENDAR",
      sourceId: event.id,

      title: canSeeDetails
        ? event.title
        : "Busy",

      description: canSeeDetails
        ? event.description
        : null,

      type: canSeeDetails
        ? event.type
        : "PERSONAL",

      startAt:
        event.startAt.toISOString(),

      endAt:
        event.endAt?.toISOString() ??
        null,

      allDay: event.allDay,

      scope: event.scope,
      priority: event.priority,
      status: event.status,

      private: event.private,

      editable: canManage,
      deletable: canManage,

      owner: calendarPerson(
        event.owner,
      ),

      department:
        event.department
          ? {
              id:
                event.department.id,

              name:
                event.department.name,
            }
          : null,

      client:
        canSeeDetails &&
        event.client
          ? {
              id: event.client.id,

              name:
                event.client
                  .displayName ||
                event.client.name,
            }
          : null,

      project:
        canSeeDetails &&
        event.project
          ? {
              id: event.project.id,
              name:
                event.project.name,
            }
          : null,

      attendees:
        canSeeDetails
          ? event.attendees.map(
              (attendee) => ({
                id:
                  attendee.id,

                employeeId:
                  attendee.employee.id,

                name:
                  employeeName(
                    attendee.employee,
                  ),

                avatarUrl:
                  attendee.employee
                    .avatarUrl,

                status:
                  attendee.status,
              }),
            )
          : [],

      location:
        canSeeDetails
          ? event.location
          : null,

      meetingUrl:
        canSeeDetails
          ? event.meetingUrl
          : null,

      metadata: {
        timezone:
          event.timezone,
      },
    });
  }

  /* ==========================================================================
     LEAVE
  ========================================================================== */

  for (const leave of leaveRequests) {
    const isSelf =
      leave.employeeId ===
      identity.employee.id;

    const sameDepartment =
      Boolean(
        identity.employee
          .departmentId &&
          leave.employee
            .departmentId ===
            identity.employee
              .departmentId,
      );

    /*
     * Managers see confirmed company leave.
     *
     * Regular employees see:
     * - their own leave
     * - confirmed absences in their department
     *
     * This gives the calendar useful staffing visibility
     * without exposing private leave information.
     */
    if (
      !identity.isCalendarManager &&
      !isSelf &&
      !sameDepartment
    ) {
      continue;
    }

    const canSeeLeaveType =
      identity.isCalendarManager ||
      isSelf;

    const personName =
      employeeName(
        leave.employee,
      );

    const typeLabel =
      leaveTypeLabel(
        leave.policy.type,
      );

    items.push({
      id: `leave:${leave.id}`,
      source: "LEAVE",
      sourceId: leave.id,

      title: canSeeLeaveType
        ? `${personName} — ${typeLabel}`
        : `${personName} — Away`,

      description: null,

      type: "LEAVE",

      startAt:
        leave.startDate.toISOString(),

      endAt:
        leave.endDate.toISOString(),

      allDay: true,

      scope: "TEAM",
      priority: "NORMAL",
      status: leave.status,

      private: false,

      editable: false,
      deletable: false,

      owner: calendarPerson(
        leave.employee,
      ),

      department:
        leave.employee.department
          ? {
              id:
                leave.employee
                  .department.id,

              name:
                leave.employee
                  .department.name,
            }
          : null,

      client: null,
      project: null,

      attendees: [],

      location: null,
      meetingUrl: null,

      metadata: {
        leaveType:
          canSeeLeaveType
            ? leave.policy.type
            : null,

        leaveTypeLabel:
          canSeeLeaveType
            ? typeLabel
            : null,

        totalDays:
          Number(
            leave.totalDays.toString(),
          ),

        startPortion:
          leave.startPortion,

        endPortion:
          leave.endPortion,

        requestRef:
          isSelf ||
          identity.isCalendarManager
            ? leave.requestRef
            : null,
      },
    });
  }

  /* ==========================================================================
     RECRUITMENT INTERVIEWS
  ========================================================================== */

  for (const interview of interviews) {
    const interviewerEmployees =
      interview.interviewers
        .map(
          (interviewer) =>
            interviewer.adminUser
              .employee,
        )
        .filter(
          (
            employee,
          ): employee is NonNullable<
            typeof employee
          > => Boolean(employee),
        );

    const isInterviewer =
      interviewerEmployees.some(
        (employee) =>
          employee.id ===
          identity.employee.id,
      );

    /*
     * Interview information is restricted to:
     * - OWNER / ADMIN
     * - assigned interviewers
     */
    if (
      !identity.isCalendarManager &&
      !isInterviewer
    ) {
      continue;
    }

    /*
     * When an employee calendar filter is active,
     * interviews should only appear when that employee
     * is one of the assigned interviewers.
     */
    if (
      employeeId &&
      !interviewerEmployees.some(
        (employee) =>
          employee.id ===
          employeeId,
      )
    ) {
      continue;
    }

    const candidate =
      interview.application
        .candidate;

    const candidateName =
      `${candidate.firstName} ${candidate.lastName}`.trim();

    const duration =
      interview.durationMinutes ??
      60;

    const endAt = new Date(
      interview.scheduledAt.getTime() +
        duration * 60 * 1000,
    );

    items.push({
      id:
        `interview:${interview.id}`,

      source: "INTERVIEW",
      sourceId: interview.id,

      title:
        `${interviewTypeLabel(
          interview.type,
        )} — ${candidateName}`,

      description:
        interview.instructions ??
        null,

      type: "INTERVIEW",

      startAt:
        interview.scheduledAt
          .toISOString(),

      endAt:
        endAt.toISOString(),

      allDay: false,

      scope: "PERSONAL",
      priority: "NORMAL",
      status:
        interview.status,

      private: true,

      editable: false,
      deletable: false,

      owner: null,

      department:
        interview.application
          .jobOpening.department
          ? {
              id:
                interview
                  .application
                  .jobOpening
                  .department.id,

              name:
                interview
                  .application
                  .jobOpening
                  .department.name,
            }
          : null,

      client: null,
      project: null,

      attendees:
        interviewerEmployees.map(
          (employee) => ({
            id: employee.id,

            employeeId:
              employee.id,

            name:
              employeeName(
                employee,
              ),

            avatarUrl:
              employee.avatarUrl,

            status:
              "ACCEPTED",
          }),
        ),

      location:
        interview.location ??
        null,

      meetingUrl:
        interview.meetingUrl ??
        null,

      metadata: {
        interviewType:
          interview.type,

        timezone:
          interview.timezone,

        applicationId:
          interview.applicationId,

        jobTitle:
          interview.application
            .jobOpening.title,
      },
    });
  }

  /* ==========================================================================
     DEPLOYMENTS
  ========================================================================== */

  for (const deployment of deployments) {
    const deploymentStart =
      deployment.startedAt ??
      deployment.createdAt;

    /*
     * Extra guard so the DTO remains inside the
     * requested calendar range even when older rows
     * do not have startedAt populated.
     */
    if (
      deploymentStart < range.start ||
      deploymentStart >= range.end
    ) {
      continue;
    }

    items.push({
      id:
        `deployment:${deployment.id}`,

      source: "DEPLOYMENT",
      sourceId: deployment.id,

      title:
        deployment.commitTitle ||
        `${deployment.project.name} deployment`,

      description:
        deployment.environment
          ? `${deployment.environment} deployment`
          : null,

      type: "DEPLOYMENT",

      startAt:
        deploymentStart.toISOString(),

      endAt:
        deployment.finishedAt
          ?.toISOString() ??
        null,

      allDay: false,

      scope: "WORKSPACE",
      priority: "NORMAL",
      status:
        deployment.status,

      private: false,

      editable: false,
      deletable: false,

      owner: null,
      department: null,

      client: {
        id:
          deployment.project
            .client.id,

        name:
          deployment.project
            .client.displayName ||
          deployment.project
            .client.name,
      },

      project: {
        id:
          deployment.project.id,

        name:
          deployment.project.name,
      },

      attendees: [],

      location: null,

      meetingUrl:
        deployment.deploymentUrl ??
        null,

      metadata: {
        provider:
          deployment.provider,

        environment:
          deployment.environment,

        branch:
          deployment.branch,

        commitHash:
          deployment.commitHash,
      },
    });
  }

  /* ==========================================================================
     SORT
  ========================================================================== */

  items.sort((a, b) => {
    const difference =
      new Date(
        a.startAt,
      ).getTime() -
      new Date(
        b.startAt,
      ).getTime();

    if (difference !== 0) {
      return difference;
    }

    /*
     * Put all-day items before timed items when
     * they begin at the same instant.
     */
    if (
      a.allDay !== b.allDay
    ) {
      return a.allDay
        ? -1
        : 1;
    }

    return a.title.localeCompare(
      b.title,
    );
  });

  return items;
}

/* ============================================================================
   MANUAL EVENT AUTHORISATION
============================================================================ */

export function canManageCalendarEvent({
  identity,
  ownerId,
}: {
  identity: CalendarIdentity;
  ownerId: string;
}) {
  return (
    identity.isCalendarManager ||
    identity.employee.id ===
      ownerId
  );
}

export function assertCanManageCalendarEvent({
  identity,
  ownerId,
}: {
  identity: CalendarIdentity;
  ownerId: string;
}) {
  if (
    !canManageCalendarEvent({
      identity,
      ownerId,
    })
  ) {
    throw new AuthorisationError(
      "You are not authorised to manage this calendar event.",
    );
  }
}

/* ============================================================================
   API ERROR
============================================================================ */

export function calendarApiError(
  error: unknown,
) {
  console.error(
    "[CALENDAR_API]",
    error,
  );

  if (
    error instanceof Error &&
    error.name ===
      "AuthenticationError"
  ) {
    return Response.json(
      {
        error:
          error.message,
      },
      {
        status: 401,
      },
    );
  }

  if (
    error instanceof Error &&
    error.name ===
      "AuthorisationError"
  ) {
    return Response.json(
      {
        error:
          error.message,
      },
      {
        status: 403,
      },
    );
  }

  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong.",
    },
    {
      status: 500,
    },
  );
}