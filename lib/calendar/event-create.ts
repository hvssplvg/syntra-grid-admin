import {
  CalendarEventPriority,
  CalendarEventScope,
  CalendarEventStatus,
  CalendarEventType,
  Prisma,
} from "@/app/generated/prisma/client";

import {
  AuthorisationError,
} from "@/lib/auth/current-admin";

import type {
  CalendarIdentity,
} from "@/lib/calendar/server";

import {
  prisma,
} from "@/lib/prisma";

/* ============================================================================
   TYPES
============================================================================ */

export type CalendarEventCreatePayload = {
  title: string;

  description?: string | null;

  type?: CalendarEventType;

  scope?: CalendarEventScope;

  priority?: CalendarEventPriority;

  startAt: string;

  endAt?: string | null;

  allDay?: boolean;

  timezone?: string | null;

  private?: boolean;

  location?: string | null;

  meetingUrl?: string | null;

  ownerId?: string | null;

  departmentId?: string | null;

  clientId?: string | null;

  projectId?: string | null;

  attendeeIds?: string[];
};

export type CalendarEventCreateResult = Awaited<
  ReturnType<typeof prisma.calendarEvent.create>
>;

type DatabaseClient =
  | typeof prisma
  | Prisma.TransactionClient;

type PreparedCalendarEvent = {
  title: string;

  description: string | null;

  type: CalendarEventType;

  scope: CalendarEventScope;

  priority: CalendarEventPriority;

  startAt: Date;

  endAt: Date | null;

  allDay: boolean;

  timezone: string | null;

  private: boolean;

  location: string | null;

  meetingUrl: string | null;

  ownerId: string;

  departmentId: string | null;

  clientId: string | null;

  projectId: string | null;

  attendeeIds: string[];
};

/* ============================================================================
   CONSTANTS
============================================================================ */

const MAX_TITLE_LENGTH = 250;

const MAX_DESCRIPTION_LENGTH = 20_000;

const MAX_ATTENDEES = 200;

const MAX_EVENT_DURATION_DAYS = 366;

const READ_ONLY_ROLES = new Set([
  "VIEWER",
]);

/* ============================================================================
   ERROR
============================================================================ */

export class CalendarValidationError extends Error {
  constructor(message: string) {
    super(message);

    this.name = "CalendarValidationError";
  }
}

/* ============================================================================
   BASIC VALIDATION
============================================================================ */

function cleanString(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function requiredString(
  value: unknown,
  label: string,
): string {
  const cleaned = cleanString(value);

  if (!cleaned) {
    throw new CalendarValidationError(
      `${label} is required.`,
    );
  }

  return cleaned;
}

function limitString(
  value: unknown,
  label: string,
  maximum: number,
): string | null {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return null;
  }

  if (cleaned.length > maximum) {
    throw new CalendarValidationError(
      `${label} cannot exceed ${maximum} characters.`,
    );
  }

  return cleaned;
}

function parseDateTime(
  value: unknown,
  label: string,
): Date {
  const raw = requiredString(
    value,
    label,
  );

  const date = new Date(raw);

  if (
    Number.isNaN(date.getTime())
  ) {
    throw new CalendarValidationError(
      `${label} is invalid.`,
    );
  }

  return date;
}

function optionalDateTime(
  value: unknown,
  label: string,
): Date | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return parseDateTime(
    value,
    label,
  );
}

function parseBoolean(
  value: unknown,
  fallback = false,
): boolean {
  return typeof value === "boolean"
    ? value
    : fallback;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
  fallback: T,
): T {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value !== "string" ||
    !values.includes(value as T)
  ) {
    throw new CalendarValidationError(
      `${label} is invalid.`,
    );
  }

  return value as T;
}

function stringArray(
  value: unknown,
): string[] {
  if (
    value === null ||
    value === undefined
  ) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new CalendarValidationError(
      "Attendees must be provided as an array.",
    );
  }

  if (
    value.some(
      (item) =>
        typeof item !== "string",
    )
  ) {
    throw new CalendarValidationError(
      "Attendee IDs must be strings.",
    );
  }

  return Array.from(
    new Set(
      value
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

/* ============================================================================
   TIMEZONE
============================================================================ */

function validateTimezone(
  value: unknown,
): string | null {
  const timezone = cleanString(value);

  if (!timezone) {
    return null;
  }

  if (timezone.length > 100) {
    throw new CalendarValidationError(
      "Timezone is too long.",
    );
  }

  try {
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: timezone,
      },
    );

    return timezone;
  } catch {
    throw new CalendarValidationError(
      "The selected timezone is invalid.",
    );
  }
}

/* ============================================================================
   MEETING URL
============================================================================ */

function validateMeetingUrl(
  value: unknown,
): string | null {
  const raw = cleanString(value);

  if (!raw) {
    return null;
  }

  if (raw.length > 2_000) {
    throw new CalendarValidationError(
      "Meeting URL is too long.",
    );
  }

  const candidate =
    /^https?:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;

  try {
    const parsed = new URL(candidate);

    if (
      !["http:", "https:"].includes(
        parsed.protocol,
      ) ||
      !parsed.hostname
    ) {
      throw new Error(
        "Invalid protocol.",
      );
    }

    return parsed.toString();
  } catch {
    throw new CalendarValidationError(
      "Please enter a valid meeting URL.",
    );
  }
}

/* ============================================================================
   AUTHORISATION

   These permissions apply to:

   - Manual event creation
   - Smart Planner imports
   - Future recurring event creation
   - Other calendar creation workflows

   The backend remains the authority.
============================================================================ */

export function assertCanCreateCalendarEvent(
  identity: CalendarIdentity,
): void {
  const role = String(
    identity.admin.role,
  ).toUpperCase();

  if (
    !identity.isCalendarManager &&
    READ_ONLY_ROLES.has(role)
  ) {
    throw new AuthorisationError(
      "Your account has read-only calendar access.",
    );
  }
}

/* ============================================================================
   NORMALISE INPUT
============================================================================ */

function normaliseEventInput(
  identity: CalendarIdentity,
  payload: CalendarEventCreatePayload,
): PreparedCalendarEvent {
  assertCanCreateCalendarEvent(
    identity,
  );

  const title = requiredString(
    payload.title,
    "Event title",
  );

  if (
    title.length > MAX_TITLE_LENGTH
  ) {
    throw new CalendarValidationError(
      `Event title cannot exceed ${MAX_TITLE_LENGTH} characters.`,
    );
  }

  const description = limitString(
    payload.description,
    "Description",
    MAX_DESCRIPTION_LENGTH,
  );

  const type = enumValue(
    payload.type,
    Object.values(CalendarEventType),
    "Event type",
    CalendarEventType.MEETING,
  );

  let scope = enumValue(
    payload.scope,
    Object.values(CalendarEventScope),
    "Event scope",
    CalendarEventScope.PERSONAL,
  );

  const priority = enumValue(
    payload.priority,
    Object.values(
      CalendarEventPriority,
    ),
    "Event priority",
    CalendarEventPriority.NORMAL,
  );

  const startAt = parseDateTime(
    payload.startAt,
    "Start date",
  );

  const endAt = optionalDateTime(
    payload.endAt,
    "End date",
  );

  const allDay = parseBoolean(
    payload.allDay,
    false,
  );

  const isPrivate = parseBoolean(
    payload.private,
    false,
  );

  const timezone = validateTimezone(
    payload.timezone,
  );

  const location = limitString(
    payload.location,
    "Location",
    500,
  );

  const meetingUrl = validateMeetingUrl(
    payload.meetingUrl,
  );

  let ownerId =
    cleanString(payload.ownerId) ??
    identity.employee.id;

  let departmentId = cleanString(
    payload.departmentId,
  );

  let clientId = cleanString(
    payload.clientId,
  );

  let projectId = cleanString(
    payload.projectId,
  );

  const attendeeIds = stringArray(
    payload.attendeeIds,
  );

  /* ------------------------------------------------------------------------
     DATE VALIDATION
  ------------------------------------------------------------------------ */

  if (
    endAt &&
    endAt.getTime() <=
      startAt.getTime()
  ) {
    throw new CalendarValidationError(
      "The event end date must be after its start date.",
    );
  }

  if (endAt) {
    const durationMs =
      endAt.getTime() -
      startAt.getTime();

    const maximumDurationMs =
      MAX_EVENT_DURATION_DAYS *
      24 *
      60 *
      60 *
      1000;

    if (
      durationMs >
      maximumDurationMs
    ) {
      throw new CalendarValidationError(
        "An event cannot span more than one year.",
      );
    }
  }

  /* ------------------------------------------------------------------------
     ROLE RESTRICTIONS

     OWNER / ADMIN:
       Can create for other employees and broader scopes.

     Other permitted employees:
       Personal calendar only.

     VIEWER:
       Already rejected above.
  ------------------------------------------------------------------------ */

  if (
    !identity.isCalendarManager
  ) {
    ownerId =
      identity.employee.id;

    scope =
      CalendarEventScope.PERSONAL;

    departmentId = null;

    clientId = null;

    projectId = null;
  }

  /* ------------------------------------------------------------------------
     ATTENDEE LIMIT
  ------------------------------------------------------------------------ */

  const uniqueAttendeeIds =
    attendeeIds.filter(
      (id) => id !== ownerId,
    );

  if (
    uniqueAttendeeIds.length >
    MAX_ATTENDEES
  ) {
    throw new CalendarValidationError(
      `An event cannot have more than ${MAX_ATTENDEES} attendees.`,
    );
  }

  return {
    title,
    description,

    type,
    scope,
    priority,

    startAt,
    endAt,

    allDay,
    timezone,

    private: isPrivate,

    location,
    meetingUrl,

    ownerId,
    departmentId,

    clientId,
    projectId,

    attendeeIds:
      uniqueAttendeeIds,
  };
}

/* ============================================================================
   VALIDATE DATABASE RELATIONSHIPS

   These checks are shared by manual creation and bulk importing.

   The caller may provide a transaction client to keep validation
   and event creation inside the same database transaction.
============================================================================ */

export async function prepareCalendarEvent({
  identity,
  payload,
  db = prisma,
}: {
  identity: CalendarIdentity;

  payload: CalendarEventCreatePayload;

  db?: DatabaseClient;
}): Promise<PreparedCalendarEvent> {
  const input = normaliseEventInput(
    identity,
    payload,
  );

  /* ------------------------------------------------------------------------
     OWNER
  ------------------------------------------------------------------------ */

  const owner = await db.employee.findUnique({
    where: {
      id: input.ownerId,
    },

    select: {
      id: true,
      departmentId: true,
    },
  });

  if (!owner) {
    throw new CalendarValidationError(
      "The selected event owner does not exist.",
    );
  }

  /* ------------------------------------------------------------------------
     PROJECT / CLIENT
  ------------------------------------------------------------------------ */

  let clientId = input.clientId;

  if (
    input.projectId
  ) {
    const project =
      await db.project.findUnique({
        where: {
          id: input.projectId,
        },

        select: {
          id: true,
          clientId: true,
        },
      });

    if (!project) {
      throw new CalendarValidationError(
        "The selected project does not exist.",
      );
    }

    if (
      clientId &&
      clientId !== project.clientId
    ) {
      throw new CalendarValidationError(
        "The selected project does not belong to the selected client.",
      );
    }

    clientId =
      project.clientId;
  }

  if (clientId) {
    const client =
      await db.client.findUnique({
        where: {
          id: clientId,
        },

        select: {
          id: true,
        },
      });

    if (!client) {
      throw new CalendarValidationError(
        "The selected client does not exist.",
      );
    }
  }

  /* ------------------------------------------------------------------------
     DEPARTMENT
  ------------------------------------------------------------------------ */

  let departmentId =
    input.departmentId;

  if (
    input.scope === CalendarEventScope.TEAM ||
    input.scope === CalendarEventScope.DEPARTMENT
  ) {
    departmentId =
      departmentId ??
      owner.departmentId;

    if (!departmentId) {
      throw new CalendarValidationError(
        "A department is required for team or department events.",
      );
    }
  }

  if (departmentId) {
    const department =
      await db.department.findUnique({
        where: {
          id: departmentId,
        },

        select: {
          id: true,
        },
      });

    if (!department) {
      throw new CalendarValidationError(
        "The selected department does not exist.",
      );
    }
  }

  if (
    input.scope === CalendarEventScope.COMPANY
  ) {
    departmentId = null;
  }

  /* ------------------------------------------------------------------------
     WORKSPACE SCOPE
  ------------------------------------------------------------------------ */

  if (
    input.scope === CalendarEventScope.WORKSPACE &&
    !clientId &&
    !input.projectId
  ) {
    throw new CalendarValidationError(
      "A client or project is required for workspace events.",
    );
  }

  /* ------------------------------------------------------------------------
     ATTENDEES
  ------------------------------------------------------------------------ */

  if (input.attendeeIds.length) {
    const count =
      await db.employee.count({
        where: {
          id: {
            in: input.attendeeIds,
          },
        },
      });

    if (
      count !==
      input.attendeeIds.length
    ) {
      throw new CalendarValidationError(
        "One or more selected attendees do not exist.",
      );
    }
  }

  return {
    ...input,

    clientId,
    departmentId,
  };
}

/* ============================================================================
   CREATE EVENT

   This is the shared creation function.

   For manual creation:
     createCalendarEvent({ identity, payload })

   For bulk imports:
     createCalendarEvent({ identity, payload, db: tx })

   The latter allows Smart Planner to import events inside
   a Prisma transaction.
============================================================================ */

export async function createCalendarEvent({
  identity,
  payload,
  db = prisma,
}: {
  identity: CalendarIdentity;

  payload: CalendarEventCreatePayload;

  db?: DatabaseClient;
}) {
  const prepared =
    await prepareCalendarEvent({
      identity,
      payload,
      db,
    });

  const event =
    await db.calendarEvent.create({
      data: {
        title:
          prepared.title,

        description:
          prepared.description,

        type:
          prepared.type,

        scope:
          prepared.scope,

        priority:
          prepared.priority,

        status:
          CalendarEventStatus.SCHEDULED,

        startAt:
          prepared.startAt,

        endAt:
          prepared.endAt,

        allDay:
          prepared.allDay,

        timezone:
          prepared.timezone,

        private:
          prepared.private,

        location:
          prepared.location,

        meetingUrl:
          prepared.meetingUrl,

        owner: {
          connect: {
            id:
              prepared.ownerId,
          },
        },

        createdBy: {
          connect: {
            id:
              identity.admin.id,
          },
        },

        department:
          prepared.departmentId
            ? {
                connect: {
                  id:
                    prepared.departmentId,
                },
              }
            : undefined,

        client:
          prepared.clientId
            ? {
                connect: {
                  id:
                    prepared.clientId,
                },
              }
            : undefined,

        project:
          prepared.projectId
            ? {
                connect: {
                  id:
                    prepared.projectId,
                },
              }
            : undefined,

        attendees:
          prepared.attendeeIds.length
            ? {
                create:
                  prepared.attendeeIds.map(
                    (employeeId) => ({
                      employee: {
                        connect: {
                          id: employeeId,
                        },
                      },
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

  return event;
}