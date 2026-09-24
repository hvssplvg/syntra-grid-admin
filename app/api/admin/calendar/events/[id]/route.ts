import {
  CalendarEventPriority,
  CalendarEventScope,
  CalendarEventStatus,
  CalendarEventType,
} from "@/app/generated/prisma/client";

import {
  assertCanManageCalendarEvent,
  calendarApiError,
  requireCalendarIdentity,
} from "@/lib/calendar/server";

import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

function parseOptionalDate(
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

  if (typeof value !== "string") {
    throw new Error(
      `${label} is invalid.`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `${label} is invalid.`,
    );
  }

  return date;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
) {
  if (
    typeof value !== "string" ||
    !values.includes(value as T)
  ) {
    throw new Error(
      `${label} is invalid.`,
    );
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
   GET
============================================================================ */

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const identity =
      await requireCalendarIdentity();

    const { id } = await context.params;

    const event =
      await prisma.calendarEvent.findUnique({
        where: {
          id,
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

    if (!event) {
      return Response.json(
        {
          error:
            "Calendar event not found.",
        },
        {
          status: 404,
        },
      );
    }

    const isOwner =
      event.ownerId ===
      identity.employee.id;

    const isAttendee =
      event.attendees.some(
        (attendee) =>
          attendee.employeeId ===
          identity.employee.id,
      );

    const sameDepartment =
      Boolean(
        event.departmentId &&
          identity.employee.departmentId &&
          event.departmentId ===
            identity.employee.departmentId,
      );

    const broadlyVisible =
      event.scope ===
        CalendarEventScope.COMPANY ||
      event.scope ===
        CalendarEventScope.WORKSPACE ||
      (
        (
          event.scope ===
            CalendarEventScope.TEAM ||
          event.scope ===
            CalendarEventScope.DEPARTMENT
        ) &&
        sameDepartment
      );

    if (
      !isOwner &&
      !isAttendee &&
      !broadlyVisible &&
      !identity.isCalendarManager
    ) {
      return Response.json(
        {
          error:
            "Calendar event not found.",
        },
        {
          status: 404,
        },
      );
    }

    /*
     * Managers can know that a private event exists,
     * but private event content remains protected unless
     * they own or attend it.
     */
    if (
      event.private &&
      !isOwner &&
      !isAttendee
    ) {
      return Response.json({
        event: {
          id: event.id,
          title: "Busy",
          description: null,

          type:
            CalendarEventType.PERSONAL,

          scope: event.scope,
          priority: event.priority,
          status: event.status,

          startAt: event.startAt,
          endAt: event.endAt,

          allDay: event.allDay,
          timezone: event.timezone,

          private: true,

          location: null,
          meetingUrl: null,

          owner: {
            id: event.owner.id,
            firstName:
              event.owner.firstName,
            lastName:
              event.owner.lastName,
            preferredName:
              event.owner.preferredName,
            avatarUrl:
              event.owner.avatarUrl,
          },

          department:
            event.department,

          client: null,
          project: null,

          attendees: [],

          editable:
            isOwner ||
            identity.isCalendarManager,

          deletable:
            isOwner ||
            identity.isCalendarManager,
        },
      });
    }

    return Response.json({
      event: {
        ...event,

        editable:
          isOwner ||
          identity.isCalendarManager,

        deletable:
          isOwner ||
          identity.isCalendarManager,
      },
    });
  } catch (error) {
    return calendarApiError(error);
  }
}

/* ============================================================================
   PATCH
============================================================================ */

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const identity =
      await requireCalendarIdentity();

    const { id } = await context.params;

    const existing =
      await prisma.calendarEvent.findUnique({
        where: {
          id,
        },

        include: {
          attendees: true,
        },
      });

    if (!existing) {
      return Response.json(
        {
          error:
            "Calendar event not found.",
        },
        {
          status: 404,
        },
      );
    }

    assertCanManageCalendarEvent({
      identity,
      ownerId: existing.ownerId,
    });

    const body = await request.json();

    let ownerId =
      body.ownerId !== undefined
        ? cleanString(body.ownerId)
        : existing.ownerId;

    if (!ownerId) {
      throw new Error(
        "Event owner is required.",
      );
    }

    if (!identity.isCalendarManager) {
      ownerId =
        identity.employee.id;
    }

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

    const title =
      body.title !== undefined
        ? cleanString(body.title)
        : existing.title;

    if (!title) {
      throw new Error(
        "Event title is required.",
      );
    }

    const description =
      body.description !== undefined
        ? cleanString(
            body.description,
          )
        : existing.description;

    const type =
      body.type !== undefined
        ? enumValue(
            body.type,
            Object.values(
              CalendarEventType,
            ),
            "Event type",
          )
        : existing.type;

    let scope =
      body.scope !== undefined
        ? enumValue(
            body.scope,
            Object.values(
              CalendarEventScope,
            ),
            "Event scope",
          )
        : existing.scope;

    const priority =
      body.priority !== undefined
        ? enumValue(
            body.priority,
            Object.values(
              CalendarEventPriority,
            ),
            "Event priority",
          )
        : existing.priority;

    const status =
      body.status !== undefined
        ? enumValue(
            body.status,
            Object.values(
              CalendarEventStatus,
            ),
            "Event status",
          )
        : existing.status;

    const startAt =
      body.startAt !== undefined
        ? parseOptionalDate(
            body.startAt,
            "Start date",
          )
        : existing.startAt;

    if (!startAt) {
      throw new Error(
        "Start date is required.",
      );
    }

    const endAt =
      body.endAt !== undefined
        ? parseOptionalDate(
            body.endAt,
            "End date",
          )
        : existing.endAt;

    if (
      endAt &&
      endAt.getTime() <
        startAt.getTime()
    ) {
      throw new Error(
        "The event end date cannot be before the start date.",
      );
    }

    const allDay =
      typeof body.allDay ===
      "boolean"
        ? body.allDay
        : existing.allDay;

    const isPrivate =
      typeof body.private ===
      "boolean"
        ? body.private
        : existing.private;

    const timezone =
      body.timezone !== undefined
        ? cleanString(
            body.timezone,
          )
        : existing.timezone;

    const location =
      body.location !== undefined
        ? cleanString(
            body.location,
          )
        : existing.location;

    const meetingUrl =
      body.meetingUrl !== undefined
        ? cleanString(
            body.meetingUrl,
          )
        : existing.meetingUrl;

    let departmentId =
      body.departmentId !== undefined
        ? cleanString(
            body.departmentId,
          )
        : existing.departmentId;

    let clientId =
      body.clientId !== undefined
        ? cleanString(
            body.clientId,
          )
        : existing.clientId;

    let projectId =
      body.projectId !== undefined
        ? cleanString(
            body.projectId,
          )
        : existing.projectId;

    if (!identity.isCalendarManager) {
      scope =
        CalendarEventScope.PERSONAL;

      departmentId = null;
      clientId = null;
      projectId = null;
    }

    /* ------------------------------------------------------------------------
       PROJECT / CLIENT
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
       SCOPE
    ------------------------------------------------------------------------ */

    if (
      scope ===
        CalendarEventScope.TEAM ||
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
      scope ===
      CalendarEventScope.COMPANY
    ) {
      departmentId = null;
    }

    /* ------------------------------------------------------------------------
       ATTENDEES
    ------------------------------------------------------------------------ */

    let attendeeIds:
      | string[]
      | undefined;

    if (
      body.attendeeIds !== undefined
    ) {
      attendeeIds =
        stringArray(
          body.attendeeIds,
        ).filter(
          (employeeId) =>
            employeeId !== ownerId,
        );

      if (attendeeIds.length) {
        const count =
          await prisma.employee.count({
            where: {
              id: {
                in: attendeeIds,
              },
            },
          });

        if (
          count !==
          attendeeIds.length
        ) {
          throw new Error(
            "One or more selected attendees do not exist.",
          );
        }
      }
    }

    /* ------------------------------------------------------------------------
       UPDATE
    ------------------------------------------------------------------------ */

    const updated =
      await prisma.$transaction(
        async (tx) => {
          if (
            attendeeIds !== undefined
          ) {
            await tx.calendarEventAttendee.deleteMany({
              where: {
                eventId: id,
              },
            });
          }

          return tx.calendarEvent.update({
            where: {
              id,
            },

            data: {
              title,
              description,

              type,
              scope,
              priority,
              status,

              startAt,
              endAt,

              allDay,
              timezone,
              private: isPrivate,

              location,
              meetingUrl,

              ownerId,

              updatedById:
                identity.admin.id,

              departmentId,
              clientId,
              projectId,

              ...(attendeeIds !==
              undefined
                ? {
                    attendees: {
                      create:
                        attendeeIds.map(
                          (
                            employeeId,
                          ) => ({
                            employeeId,
                          }),
                        ),
                    },
                  }
                : {}),
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
        },
      );

    return Response.json({
      event: updated,
    });
  } catch (error) {
    return calendarApiError(error);
  }
}

/* ============================================================================
   DELETE
============================================================================ */

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const identity =
      await requireCalendarIdentity();

    const { id } =
      await context.params;

    const existing =
      await prisma.calendarEvent.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          ownerId: true,
        },
      });

    if (!existing) {
      return Response.json(
        {
          error:
            "Calendar event not found.",
        },
        {
          status: 404,
        },
      );
    }

    assertCanManageCalendarEvent({
      identity,
      ownerId:
        existing.ownerId,
    });

    /*
     * Keep calendar history rather than physically
     * deleting the event.
     */
    await prisma.calendarEvent.update({
      where: {
        id,
      },

      data: {
        status:
          CalendarEventStatus.CANCELLED,

        updatedById:
          identity.admin.id,
      },
    });

    return Response.json({
      success: true,
    });
  } catch (error) {
    return calendarApiError(error);
  }
}