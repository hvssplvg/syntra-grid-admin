import {
  CalendarEventPriority,
  CalendarEventScope,
  CalendarEventStatus,
  CalendarEventType,
} from "@/app/generated/prisma/client";

import {
  AuthorisationError,
} from "@/lib/auth/current-admin";

import {
  calendarApiError,
  getCalendarFeed,
  parseCalendarRange,
  requireCalendarIdentity,
} from "@/lib/calendar/server";

import { prisma } from "@/lib/prisma";

/* ============================================================================
   HELPERS
============================================================================ */

function cleanString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function requiredString(
  value: unknown,
  label: string,
) {
  const cleaned = cleanString(value);

  if (!cleaned) {
    throw new Error(`${label} is required.`);
  }

  return cleaned;
}

function parseDateTime(
  value: unknown,
  label: string,
) {
  const raw = requiredString(value, label);
  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is invalid.`);
  }

  return date;
}

function optionalDateTime(
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

  return parseDateTime(value, label);
}

function parseBoolean(
  value: unknown,
  fallback = false,
) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
  fallback?: T,
): T {
  if (
    (value === null ||
      value === undefined ||
      value === "") &&
    fallback
  ) {
    return fallback;
  }

  if (
    typeof value !== "string" ||
    !values.includes(value as T)
  ) {
    throw new Error(`${label} is invalid.`);
  }

  return value as T;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter(
          (item): item is string =>
            typeof item === "string",
        )
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

/* ============================================================================
   GET — UNIFIED CALENDAR FEED
============================================================================ */

export async function GET(request: Request) {
  try {
    const identity =
      await requireCalendarIdentity();

    const url = new URL(request.url);

    const range = parseCalendarRange(
      url.searchParams.get("start"),
      url.searchParams.get("end"),
    );

    const departmentId =
      cleanString(
        url.searchParams.get("departmentId"),
      );

    const requestedEmployeeId =
      cleanString(
        url.searchParams.get("employeeId"),
      );

    const clientId =
      cleanString(
        url.searchParams.get("clientId"),
      );

    const projectId =
      cleanString(
        url.searchParams.get("projectId"),
      );

    /*
     * Regular employees cannot use employeeId to inspect
     * arbitrary calendars.
     *
     * Their default feed is already personalised by
     * getCalendarFeed().
     */
    let employeeId: string | null = null;

    if (requestedEmployeeId) {
      if (
        identity.isCalendarManager ||
        requestedEmployeeId ===
          identity.employee.id
      ) {
        employeeId = requestedEmployeeId;
      } else {
        throw new AuthorisationError(
          "You are not authorised to view that employee calendar.",
        );
      }
    }

    /*
     * Department filtering is restricted for regular
     * employees to their own department.
     */
    if (
      departmentId &&
      !identity.isCalendarManager &&
      departmentId !==
        identity.employee.departmentId
    ) {
      throw new AuthorisationError(
        "You are not authorised to view that department calendar.",
      );
    }

    const items = await getCalendarFeed({
      identity,
      range,
      departmentId,
      employeeId,
      clientId,
      projectId,
    });

    return Response.json({
      viewer: {
        adminId: identity.admin.id,

        employeeId:
          identity.employee.id,

        firstName:
          identity.employee.firstName,

        lastName:
          identity.employee.lastName,

        preferredName:
          identity.employee.preferredName,

        avatarUrl:
          identity.employee.avatarUrl,

        departmentId:
          identity.employee.departmentId,

        role: identity.admin.role,

        isCalendarManager:
          identity.isCalendarManager,
      },

      range: {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
      },

      filters: {
        departmentId,
        employeeId,
        clientId,
        projectId,
      },

      items,
    });
  } catch (error) {
    return calendarApiError(error);
  }
}

/* ============================================================================
   POST — CREATE MANUAL CALENDAR EVENT
============================================================================ */

export async function POST(request: Request) {
  try {
    const identity =
      await requireCalendarIdentity();

    const body = await request.json();

    const title = requiredString(
      body.title,
      "Event title",
    );

    const description =
      cleanString(body.description);

    const type = enumValue(
      body.type,
      Object.values(CalendarEventType),
      "Event type",
      CalendarEventType.MEETING,
    );

    let scope = enumValue(
      body.scope,
      Object.values(CalendarEventScope),
      "Event scope",
      CalendarEventScope.PERSONAL,
    );

    const priority = enumValue(
      body.priority,
      Object.values(CalendarEventPriority),
      "Event priority",
      CalendarEventPriority.NORMAL,
    );

    const startAt = parseDateTime(
      body.startAt,
      "Start date",
    );

    const endAt = optionalDateTime(
      body.endAt,
      "End date",
    );

    if (
      endAt &&
      endAt.getTime() < startAt.getTime()
    ) {
      throw new Error(
        "The event end date cannot be before the start date.",
      );
    }

    const allDay = parseBoolean(
      body.allDay,
      false,
    );

    const isPrivate = parseBoolean(
      body.private,
      false,
    );

    const timezone =
      cleanString(body.timezone);

    const location =
      cleanString(body.location);

    const meetingUrl =
      cleanString(body.meetingUrl);

    let ownerId =
      cleanString(body.ownerId) ??
      identity.employee.id;

    let departmentId =
      cleanString(body.departmentId);

    let clientId =
      cleanString(body.clientId);

    let projectId =
      cleanString(body.projectId);

    const attendeeIds =
      stringArray(body.attendeeIds);

    /* ------------------------------------------------------------------------
       ROLE RULES
    ------------------------------------------------------------------------ */

    if (!identity.isCalendarManager) {
      ownerId = identity.employee.id;

      /*
       * Regular employees can create their own personal
       * calendar events.
       *
       * They can also invite attendees to that event,
       * but they cannot publish department/company/workspace
       * events themselves.
       */
      scope = CalendarEventScope.PERSONAL;

      departmentId = null;
      clientId = null;
      projectId = null;
    }

    /* ------------------------------------------------------------------------
       OWNER
    ------------------------------------------------------------------------ */

    const owner =
      await prisma.employee.findUnique({
        where: {
          id: ownerId,
        },

        select: {
          id: true,
          departmentId: true,
        },
      });

    if (!owner) {
      throw new Error(
        "The selected event owner does not exist.",
      );
    }

    /* ------------------------------------------------------------------------
       PROJECT / CLIENT CONSISTENCY
    ------------------------------------------------------------------------ */

    if (projectId) {
      const project =
        await prisma.project.findUnique({
          where: {
            id: projectId,
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
        clientId &&
        clientId !== project.clientId
      ) {
        throw new Error(
          "The selected project does not belong to the selected client.",
        );
      }

      clientId = project.clientId;
    }

    if (clientId) {
      const client =
        await prisma.client.findUnique({
          where: {
            id: clientId,
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

    /* ------------------------------------------------------------------------
       SCOPE VALIDATION
    ------------------------------------------------------------------------ */

    if (
      scope === CalendarEventScope.TEAM ||
      scope ===
        CalendarEventScope.DEPARTMENT
    ) {
      departmentId =
        departmentId ??
        owner.departmentId;

      if (!departmentId) {
        throw new Error(
          "A department is required for department calendar events.",
        );
      }

      const department =
        await prisma.department.findUnique({
          where: {
            id: departmentId,
          },

          select: {
            id: true,
          },
        });

      if (!department) {
        throw new Error(
          "The selected department does not exist.",
        );
      }
    }

    if (
      scope ===
        CalendarEventScope.WORKSPACE &&
      !clientId &&
      !projectId
    ) {
      throw new Error(
        "A client or project is required for workspace events.",
      );
    }

    if (
      scope === CalendarEventScope.COMPANY
    ) {
      departmentId = null;
    }

    /* ------------------------------------------------------------------------
       ATTENDEES
    ------------------------------------------------------------------------ */

    const uniqueAttendeeIds =
      attendeeIds.filter(
        (id) => id !== ownerId,
      );

    if (uniqueAttendeeIds.length) {
      const validAttendees =
        await prisma.employee.count({
          where: {
            id: {
              in: uniqueAttendeeIds,
            },
          },
        });

      if (
        validAttendees !==
        uniqueAttendeeIds.length
      ) {
        throw new Error(
          "One or more selected attendees do not exist.",
        );
      }
    }

    /* ------------------------------------------------------------------------
       CREATE
    ------------------------------------------------------------------------ */

    const event =
      await prisma.calendarEvent.create({
        data: {
          title,
          description,

          type,
          scope,
          priority,

          status:
            CalendarEventStatus.SCHEDULED,

          startAt,
          endAt,

          allDay,
          timezone,
          private: isPrivate,

          location,
          meetingUrl,

          ownerId,

          createdById:
            identity.admin.id,

          departmentId,
          clientId,
          projectId,

          attendees:
            uniqueAttendeeIds.length
              ? {
                  create:
                    uniqueAttendeeIds.map(
                      (employeeId) => ({
                        employeeId,
                      }),
                    ),
                }
              : undefined,
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
      });

    return Response.json(
      {
        event,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return calendarApiError(error);
  }
}