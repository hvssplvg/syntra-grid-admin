import {
  Prisma,
} from "@/app/generated/prisma/client";

import {
  AuthorisationError,
} from "@/lib/auth/current-admin";

import {
  assertCanCreateCalendarEvent,
  CalendarValidationError,
  createCalendarEvent,
  prepareCalendarEvent,
  type CalendarEventCreatePayload,
} from "@/lib/calendar/event-create";

import {
  calendarApiError,
  requireCalendarIdentity,
  type CalendarIdentity,
} from "@/lib/calendar/server";

import {
  prisma,
} from "@/lib/prisma";

/* ============================================================================
   RUNTIME
============================================================================ */

export const runtime = "nodejs";

/* ============================================================================
   CONFIGURATION
============================================================================ */

/**
 * Limit the number of calendar events created
 * in one import.
 *
 * Larger imports can be split into smaller batches.
 */

const MAX_IMPORT_EVENTS = 100;

/**
 * Maximum accepted JSON request size.
 */

const MAX_REQUEST_BYTES = 1024 * 1024;

/**
 * Maximum length of an import name.
 */

const MAX_IMPORT_NAME_LENGTH = 150;

/**
 * Prisma transaction timeout.
 *
 * A bulk import performs validation and database writes
 * for multiple events. Give it sufficient time to finish.
 */

const TRANSACTION_TIMEOUT = 60_000;

/**
 * Maximum waiting time to acquire a database transaction.
 */

const TRANSACTION_WAIT = 10_000;

/**
 * Retry transactions that fail because of a
 * serialisation conflict or deadlock.
 */

const MAX_TRANSACTION_ATTEMPTS = 3;

/* ============================================================================
   TYPES
============================================================================ */

type SmartPlannerImportItem = {
  key: string;

  event: CalendarEventCreatePayload;
};

type SmartPlannerImportRequest = {
  name: string;

  sourceType: string;

  sourceFileName: string | null;

  items: SmartPlannerImportItem[];
};

type ImportedEventResult = {
  key: string;

  eventId: string;

  title: string;

  startAt: string;

  endAt: string | null;

  ownerId: string;
};

type SkippedEventResult = {
  key: string;

  title: string;

  reason: string;

  existingEventId?: string;
};

type ImportResult = {
  imported: ImportedEventResult[];

  skipped: SkippedEventResult[];
};

type PreparedImportItem = {
  key: string;

  event: CalendarEventCreatePayload;
};

/* ============================================================================
   ERRORS
============================================================================ */

class SmartPlannerImportError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);

    this.name = "SmartPlannerImportError";
  }
}

/* ============================================================================
   HELPERS
============================================================================ */

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function cleanString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normaliseTitle(
  title: string,
): string {
  return title
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isValidDate(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !Number.isNaN(
      new Date(value).getTime(),
    )
  );
}

function isRetryablePrismaError(
  error: unknown,
): boolean {
  return (
    error instanceof
      Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

/* ============================================================================
   READ REQUEST

   Expected JSON:

   {
     "name": "November Social Media Calendar",

     "sourceType": "CSV",

     "sourceFileName": "november-content.csv",

     "items": [
       {
         "key": "row-2",

         "event": {
           "title": "Instagram Product Announcement",
           "type": "OTHER",
           "scope": "PERSONAL",
           "priority": "NORMAL",
           "startAt": "2026-11-03T09:00:00.000Z",
           "endAt": "2026-11-03T09:30:00.000Z",
           "timezone": "Africa/Lagos"
         }
       }
     ]
   }

   The frontend must send only events the employee
   has approved for import.
============================================================================ */

async function readImportRequest(
  request: Request,
): Promise<SmartPlannerImportRequest> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !contentType
      .toLowerCase()
      .includes("application/json")
  ) {
    throw new SmartPlannerImportError(
      "The import request must use JSON.",
    );
  }

  const contentLength =
    request.headers.get("content-length");

  if (
    contentLength &&
    Number(contentLength) > MAX_REQUEST_BYTES
  ) {
    throw new SmartPlannerImportError(
      "The import request is too large.",
      413,
    );
  }

  /*
   * Read the body as text first so we can enforce
   * the actual request size.
   *
   * Content-Length alone cannot be trusted.
   */

  let raw: string;

  try {
    raw = await request.text();
  } catch {
    throw new SmartPlannerImportError(
      "Unable to read the import request.",
    );
  }

  const requestSize =
    new TextEncoder().encode(raw).byteLength;

  if (
    requestSize > MAX_REQUEST_BYTES
  ) {
    throw new SmartPlannerImportError(
      "The import request is too large.",
      413,
    );
  }

  let body: unknown;

  try {
    body = JSON.parse(raw);
  } catch {
    throw new SmartPlannerImportError(
      "The import request contains invalid JSON.",
    );
  }

  if (!isRecord(body)) {
    throw new SmartPlannerImportError(
      "The import request must be an object.",
    );
  }

  /* ------------------------------------------------------------------------
     IMPORT NAME
  ------------------------------------------------------------------------ */

  const name =
    cleanString(body.name) ||
    "Smart Planner Import";

  if (
    name.length > MAX_IMPORT_NAME_LENGTH
  ) {
    throw new SmartPlannerImportError(
      "The import name is too long.",
    );
  }

  /* ------------------------------------------------------------------------
     SOURCE
  ------------------------------------------------------------------------ */

  const sourceType =
    cleanString(body.sourceType)
      .toUpperCase() ||
    "TEXT";

  const allowedSourceTypes =
    new Set([
      "TEXT",
      "CSV",
      "EXCEL",
      "WORD",
      "PDF",
      "ICS",
      "AI",
      "MANUAL",
    ]);

  if (
    !allowedSourceTypes.has(sourceType)
  ) {
    throw new SmartPlannerImportError(
      "The selected import source is invalid.",
    );
  }

  const sourceFileName =
    cleanString(body.sourceFileName) ||
    null;

  if (
    sourceFileName &&
    sourceFileName.length > 255
  ) {
    throw new SmartPlannerImportError(
      "The source filename is too long.",
    );
  }

  /* ------------------------------------------------------------------------
     ITEMS
  ------------------------------------------------------------------------ */

  if (!Array.isArray(body.items)) {
    throw new SmartPlannerImportError(
      "Import items must be provided as an array.",
    );
  }

  if (
    body.items.length === 0
  ) {
    throw new SmartPlannerImportError(
      "Select at least one event to import.",
    );
  }

  if (
    body.items.length >
    MAX_IMPORT_EVENTS
  ) {
    throw new SmartPlannerImportError(
      `You can import up to ${MAX_IMPORT_EVENTS} events at a time.`,
    );
  }

  const keys =
    new Set<string>();

  const items: SmartPlannerImportItem[] =
    body.items.map(
      (
        item: unknown,
        index: number,
      ) => {
        if (!isRecord(item)) {
          throw new SmartPlannerImportError(
            `Event ${index + 1} is invalid.`,
          );
        }

        const key =
          cleanString(item.key);

        if (
          !key ||
          key.length > 150
        ) {
          throw new SmartPlannerImportError(
            `Event ${index + 1} needs a valid import key.`,
          );
        }

        if (
          keys.has(key)
        ) {
          throw new SmartPlannerImportError(
            `The import contains a duplicate item key: ${key}.`,
          );
        }

        keys.add(key);

        if (
          !isRecord(item.event)
        ) {
          throw new SmartPlannerImportError(
            `Event ${index + 1} is missing its calendar information.`,
          );
        }

        const event =
          item.event as CalendarEventCreatePayload;

        if (
          typeof event.title !== "string" ||
          !event.title.trim()
        ) {
          throw new SmartPlannerImportError(
            `Event ${index + 1} needs a title.`,
          );
        }

        if (
          !isValidDate(
            event.startAt,
          )
        ) {
          throw new SmartPlannerImportError(
            `Event ${index + 1} needs a valid start date.`,
          );
        }

        return {
          key,

          event,
        };
      },
    );

  return {
    name,
    sourceType,
    sourceFileName,
    items,
  };
}

/* ============================================================================
   AUTHORISATION

   Every import requires:
   - An authenticated admin account
   - A linked employee profile
   - Calendar creation permission

   This uses the same permission function as manual
   event creation.

   The actual event assignments and scopes are
   validated again inside createCalendarEvent().
============================================================================ */

function assertCanImport(
  identity: CalendarIdentity,
) {
  assertCanCreateCalendarEvent(
    identity,
  );

  /*
   * Additional restrictions can be added here later.
   *
   * For example:
   *
   * - Import limits by role
   * - Department-specific approval requirements
   * - Company-wide schedule approval
   */
}

/* ============================================================================
   DUPLICATE DETECTION

   We consider an event a potential duplicate when
   an existing calendar event has the same:

   - Owner
   - Start date/time
   - Normalised title

   This is intentionally conservative.

   Two different meetings at the same time may still
   be legitimate.

   They are not duplicates unless their titles match.
============================================================================ */

async function findExistingDuplicate({
  db,
  ownerId,
  startAt,
  title,
}: {
  db: Prisma.TransactionClient;

  ownerId: string;

  startAt: Date;

  title: string;
}) {
  const existing =
    await db.calendarEvent.findMany({
      where: {
        ownerId,

        startAt,

        status: {
          not: "CANCELLED",
        },
      },

      select: {
        id: true,
        title: true,
      },
    });

  const normalised =
    normaliseTitle(title);

  return (
    existing.find(
      (event) =>
        normaliseTitle(
          event.title,
        ) === normalised,
    ) ?? null
  );
}

/* ============================================================================
   VALIDATE APPROVED EVENTS

   The frontend preview is not trusted.

   Every event is checked again using our shared
   server-side calendar validation service.

   If any selected event is invalid, we reject the
   entire request before writing anything.
============================================================================ */

async function validateImportItems({
  identity,
  items,
}: {
  identity: CalendarIdentity;

  items: SmartPlannerImportItem[];
}): Promise<PreparedImportItem[]> {
  const prepared: PreparedImportItem[] =
    [];

  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    const item =
      items[index];

    try {
      const event =
        await prepareCalendarEvent({
          identity,

          payload: item.event,
        });

      prepared.push({
        key: item.key,

        event: {
          title:
            event.title,

          description:
            event.description,

          type:
            event.type,

          scope:
            event.scope,

          priority:
            event.priority,

          startAt:
            event.startAt.toISOString(),

          endAt:
            event.endAt?.toISOString() ??
            null,

          allDay:
            event.allDay,

          timezone:
            event.timezone,

          private:
            event.private,

          location:
            event.location,

          meetingUrl:
            event.meetingUrl,

          ownerId:
            event.ownerId,

          departmentId:
            event.departmentId,

          clientId:
            event.clientId,

          projectId:
            event.projectId,

          attendeeIds:
            event.attendeeIds,
        },
      });
    } catch (error) {
      if (
        error instanceof
        AuthorisationError
      ) {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Invalid event.";

      throw new SmartPlannerImportError(
        `Event ${index + 1} (${item.key}): ${message}`,
      );
    }
  }

  return prepared;
}

/* ============================================================================
   IMPORT TRANSACTION

   All selected events are processed inside one database
   transaction.

   If a database error occurs, the transaction rolls back.

   Existing duplicates are skipped instead of inserted.

   Every newly created event uses createCalendarEvent(),
   so it passes through the same validation and permission
   checks as manually created events.
============================================================================ */

async function importEvents({
  identity,
  items,
}: {
  identity: CalendarIdentity;

  items: PreparedImportItem[];
}): Promise<ImportResult> {
  return prisma.$transaction(
    async (tx) => {
      const imported: ImportedEventResult[] =
        [];

      const skipped: SkippedEventResult[] =
        [];

      /*
       * Detect repeated events within the same request.
       *
       * These duplicates are skipped even when their
       * import keys differ.
       */

      const processed =
        new Set<string>();

      for (const item of items) {
        const event =
          item.event;

        const startAt =
          new Date(
            event.startAt,
          );

        const ownerId =
          event.ownerId!;

        const signature = [
          ownerId,

          startAt.toISOString(),

          normaliseTitle(
            event.title,
          ),
        ].join("|");

        /* ------------------------------------------------------------------
           DUPLICATE WITHIN THIS IMPORT
        ------------------------------------------------------------------ */

        if (
          processed.has(
            signature,
          )
        ) {
          skipped.push({
            key:
              item.key,

            title:
              event.title,

            reason:
              "This event appears more than once in the selected import.",
          });

          continue;
        }

        processed.add(
          signature,
        );

        /* ------------------------------------------------------------------
           EXISTING DATABASE DUPLICATE
        ------------------------------------------------------------------ */

        const duplicate =
          await findExistingDuplicate({
            db: tx,

            ownerId,

            startAt,

            title:
              event.title,
          });

        if (duplicate) {
          skipped.push({
            key:
              item.key,

            title:
              event.title,

            reason:
              "An event with the same title and start time already exists on this calendar.",

            existingEventId:
              duplicate.id,
          });

          continue;
        }

        /* ------------------------------------------------------------------
           CREATE CALENDAR EVENT
        ------------------------------------------------------------------ */

        const created =
          await createCalendarEvent({
            identity,

            payload: event,

            db: tx,
          });

        imported.push({
          key:
            item.key,

          eventId:
            created.id,

          title:
            created.title,

          startAt:
            created.startAt.toISOString(),

          endAt:
            created.endAt?.toISOString() ??
            null,

          ownerId:
            created.ownerId,
        });
      }

      return {
        imported,

        skipped,
      };
    },
    {
      isolationLevel:
        Prisma.TransactionIsolationLevel
          .Serializable,

      maxWait:
        TRANSACTION_WAIT,

      timeout:
        TRANSACTION_TIMEOUT,
    },
  );
}

/* ============================================================================
   POST — IMPORT APPROVED SMART PLANNER EVENTS

   This endpoint creates real CalendarEvent records.

   It does not:
   - Create recruitment interviews
   - Create leave requests
   - Trigger engineering deployments
   - Publish social media posts

   It only creates calendar events using the same
   service as manual event creation.
============================================================================ */

export async function POST(
  request: Request,
) {
  try {
    /* ------------------------------------------------------------------------
       AUTHENTICATE
    ------------------------------------------------------------------------ */

    const identity =
      await requireCalendarIdentity();

    /* ------------------------------------------------------------------------
       CHECK PERMISSIONS
    ------------------------------------------------------------------------ */

    assertCanImport(
      identity,
    );

    /* ------------------------------------------------------------------------
       READ IMPORT
    ------------------------------------------------------------------------ */

    const input =
      await readImportRequest(
        request,
      );

    /* ------------------------------------------------------------------------
       VALIDATE ALL EVENTS FIRST
    ------------------------------------------------------------------------ */

    const prepared =
      await validateImportItems({
        identity,

        items:
          input.items,
      });

    /* ------------------------------------------------------------------------
       IMPORT WITH SERIALISATION RETRIES
    ------------------------------------------------------------------------ */

    let result: ImportResult | null =
      null;

    for (
      let attempt = 1;
      attempt <= MAX_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        result =
          await importEvents({
            identity,

            items:
              prepared,
          });

        break;
      } catch (error) {
        if (
          !isRetryablePrismaError(
            error,
          ) ||
          attempt === MAX_TRANSACTION_ATTEMPTS
        ) {
          throw error;
        }
      }
    }

    if (!result) {
      throw new Error(
        "Unable to complete the calendar import.",
      );
    }

    /* ------------------------------------------------------------------------
       SUMMARY
    ------------------------------------------------------------------------ */

    const importedCount =
      result.imported.length;

    const skippedCount =
      result.skipped.length;

    const summary = {
      total:
        input.items.length,

      imported:
        importedCount,

      skipped:
        skippedCount,

      failed: 0,
    };

    /* ------------------------------------------------------------------------
       RESPONSE
    ------------------------------------------------------------------------ */

    return Response.json(
      {
        success: true,

        source: {
          name:
            input.name,

          type:
            input.sourceType,

          filename:
            input.sourceFileName,
        },

        summary,

        imported:
          result.imported,

        skipped:
          result.skipped,

        message:
          importedCount === 0
            ? "No new events were imported. The selected events may already exist."
            : skippedCount > 0
              ? `${importedCount} events imported successfully. ${skippedCount} duplicates were skipped.`
              : `${importedCount} events added to your calendar successfully.`,
      },
      {
        status:
          importedCount > 0
            ? 201
            : 200,
      },
    );
  } catch (error) {
    /* ------------------------------------------------------------------------
       REQUEST VALIDATION ERRORS
    ------------------------------------------------------------------------ */

    if (
      error instanceof
      SmartPlannerImportError
    ) {
      return Response.json(
        {
          success: false,

          error:
            error.message,
        },
        {
          status:
            error.status,
        },
      );
    }

    /* ------------------------------------------------------------------------
       SHARED CALENDAR VALIDATION ERRORS
    ------------------------------------------------------------------------ */

    if (
      error instanceof
      CalendarValidationError
    ) {
      return Response.json(
        {
          success: false,

          error:
            error.message,
        },
        {
          status: 400,
        },
      );
    }

    /* ------------------------------------------------------------------------
       AUTHENTICATION / AUTHORISATION / SERVER ERRORS
    ------------------------------------------------------------------------ */

    return calendarApiError(
      error,
    );
  }
}