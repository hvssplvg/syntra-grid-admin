import {
  CalendarEventPriority,
  CalendarEventScope,
  CalendarEventType,
} from "@/app/generated/prisma/client";

import {
  assertCanCreateCalendarEvent,
  CalendarValidationError,
  type CalendarEventCreatePayload,
} from "@/lib/calendar/event-create";

import {
  calendarApiError,
  requireCalendarIdentity,
  type CalendarIdentity,
} from "@/lib/calendar/server";

/* ============================================================================
   RUNTIME
============================================================================ */

export const runtime = "nodejs";

/* ============================================================================
   LIMITS
============================================================================ */

const MAX_FILE_BYTES = 1024 * 1024;

const MAX_TEXT_LENGTH = 250_000;

const MAX_EVENTS = 200;

const DEFAULT_DURATION_MINUTES = 30;

/* ============================================================================
   TYPES
============================================================================ */

type PreviewSource =
  | "TEXT"
  | "CSV";

type PreviewStatus =
  | "ready"
  | "needs_review";

type RawScheduleRow = {
  row: number;

  title: string;

  date: string;

  time: string;

  endTime: string;

  duration: string;

  description: string;

  type: string;

  priority: string;

  scope: string;

  location: string;

  meetingUrl: string;

  allDay: string;
};

type PreviewEvent = {
  key: string;

  row: number;

  status: PreviewStatus;

  issues: string[];

  source: RawScheduleRow;

  event: CalendarEventCreatePayload | null;
};

type PreviewRequest = {
  source: PreviewSource;

  text: string;

  timezone: string;

  filename: string | null;
};

type ParsedTime = {
  hours: number;
  minutes: number;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type LocalDateTime = DateParts &
  ParsedTime;

/* ============================================================================
   ERRORS
============================================================================ */

function badRequest(message: string) {
  return Response.json(
    {
      error: message,
    },
    {
      status: 400,
    },
  );
}

/* ============================================================================
   TEXT HELPERS
============================================================================ */

function clean(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normaliseHeader(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[^a-z0-9]/g, "");
}

function firstValue(
  record: Record<string, string>,
  aliases: string[],
) {
  for (const alias of aliases) {
    const value =
      record[normaliseHeader(alias)];

    if (value?.trim()) {
      return value.trim();
    }
  }

  return "";
}

function emptyRow(row: number): RawScheduleRow {
  return {
    row,
    title: "",
    date: "",
    time: "",
    endTime: "",
    duration: "",
    description: "",
    type: "",
    priority: "",
    scope: "",
    location: "",
    meetingUrl: "",
    allDay: "",
  };
}

/* ============================================================================
   REQUEST PARSING

   Accepts either:

   JSON:
   {
     "text": "...",
     "timezone": "Africa/Lagos"
   }

   Or multipart FormData:
     file
     timezone

   Also supports multipart text submissions.
============================================================================ */

async function readPreviewRequest(
  request: Request,
): Promise<PreviewRequest> {
  const contentType =
    request.headers.get("content-type") ?? "";

  /* ------------------------------------------------------------------------
     JSON
  ------------------------------------------------------------------------ */

  if (
    contentType.includes(
      "application/json",
    )
  ) {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new CalendarValidationError(
        "Invalid JSON request.",
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new CalendarValidationError(
        "The request must be an object.",
      );
    }

    const data = body as Record<
      string,
      unknown
    >;

    const text = clean(data.text);

    const timezone = clean(
      data.timezone,
    );

    if (!text) {
      throw new CalendarValidationError(
        "Enter a schedule to continue.",
      );
    }

    if (
      text.length > MAX_TEXT_LENGTH
    ) {
      throw new CalendarValidationError(
        "The schedule is too large.",
      );
    }

    return {
      source: "TEXT",
      text,
      timezone,
      filename: null,
    };
  }

  /* ------------------------------------------------------------------------
     FORM DATA
  ------------------------------------------------------------------------ */

  if (
    contentType.includes(
      "multipart/form-data",
    )
  ) {
    const form =
      await request.formData();

    const timezone = clean(
      form.get("timezone"),
    );

    const file = form.get("file");

    if (file instanceof File) {
      if (
        file.size > MAX_FILE_BYTES
      ) {
        throw new CalendarValidationError(
          "The uploaded file must be smaller than 1 MB.",
        );
      }

      const filename =
        file.name.trim();

      const extension =
        filename
          .split(".")
          .pop()
          ?.toLowerCase() ?? "";

      if (
        !["csv", "txt"].includes(
          extension,
        )
      ) {
        throw new CalendarValidationError(
          "This version supports CSV and TXT files. Excel, Word and PDF support will be added separately.",
        );
      }

      const text =
        await file.text();

      if (!text.trim()) {
        throw new CalendarValidationError(
          "The uploaded file is empty.",
        );
      }

      return {
        source:
          extension === "csv"
            ? "CSV"
            : "TEXT",

        text,

        timezone,

        filename,
      };
    }

    const text =
      clean(form.get("text"));

    if (!text) {
      throw new CalendarValidationError(
        "Enter or upload a schedule.",
      );
    }

    if (
      text.length > MAX_TEXT_LENGTH
    ) {
      throw new CalendarValidationError(
        "The schedule is too large.",
      );
    }

    return {
      source: "TEXT",

      text,

      timezone,

      filename: null,
    };
  }

  throw new CalendarValidationError(
    "Use JSON or multipart form data.",
  );
}

/* ============================================================================
   TIMEZONE VALIDATION
============================================================================ */

function validateTimezone(
  value: string,
): string {
  if (!value) {
    throw new CalendarValidationError(
      "Select the timezone used by your schedule.",
    );
  }

  try {
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: value,
      },
    );

    return value;
  } catch {
    throw new CalendarValidationError(
      "The selected timezone is invalid.",
    );
  }
}

/* ============================================================================
   CSV PARSER

   Supports:
   - Quoted columns
   - Commas inside quoted values
   - Escaped quotation marks
   - Multiline quoted values
   - CRLF and LF line endings

   No additional dependency is needed.
============================================================================ */

function parseCsv(
  input: string,
): string[][] {
  const rows: string[][] = [];

  let row: string[] = [];

  let field = "";

  let quoted = false;

  for (
    let index = 0;
    index < input.length;
    index += 1
  ) {
    const character =
      input[index];

    const next =
      input[index + 1];

    if (character === '"') {
      if (
        quoted &&
        next === '"'
      ) {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }

      continue;
    }

    if (
      character === "," &&
      !quoted
    ) {
      row.push(field);
      field = "";
      continue;
    }

    if (
      (character === "\n" ||
        character === "\r") &&
      !quoted
    ) {
      row.push(field);

      if (
        row.some(
          (item) => item.trim(),
        )
      ) {
        rows.push(row);
      }

      row = [];
      field = "";

      if (
        character === "\r" &&
        next === "\n"
      ) {
        index += 1;
      }

      continue;
    }

    field += character;
  }

  if (quoted) {
    throw new CalendarValidationError(
      "The CSV contains an unclosed quoted field.",
    );
  }

  row.push(field);

  if (
    row.some(
      (item) => item.trim(),
    )
  ) {
    rows.push(row);
  }

  return rows;
}

/* ============================================================================
   CSV ROW MAPPING

   Supported column names include:

   title / activity / content / event
   date / scheduled date / publish date
   time / start time / publish time
   end time
   duration
   description / notes / caption
   type
   priority
   scope
   location
   meeting URL
   all day
============================================================================ */

function mapCsvRows(
  csv: string,
): RawScheduleRow[] {
  const rows = parseCsv(csv);

  if (rows.length < 2) {
    throw new CalendarValidationError(
      "The CSV must contain a header and at least one event.",
    );
  }

  const headers = rows[0].map(
    normaliseHeader,
  );

  if (
    !headers.some((header) =>
      [
        "title",
        "activity",
        "content",
        "event",
        "eventtitle",
        "posttitle",
        "task",
      ].includes(header),
    )
  ) {
    throw new CalendarValidationError(
      "The CSV must contain a Title, Activity, Content or Event column.",
    );
  }

  if (
    !headers.some((header) =>
      [
        "date",
        "scheduleddate",
        "publishdate",
        "publishingdate",
        "eventdate",
        "startdate",
      ].includes(header),
    )
  ) {
    throw new CalendarValidationError(
      "The CSV must contain a Date column.",
    );
  }

  return rows
    .slice(1)
    .map((values, index) => {
      const record: Record<
        string,
        string
      > = {};

      headers.forEach(
        (header, column) => {
          record[header] =
            values[column] ?? "";
        },
      );

      return {
        row: index + 2,

        title: firstValue(
          record,
          [
            "title",
            "eventtitle",
            "posttitle",
            "activity",
            "content",
            "event",
            "task",
          ],
        ),

        date: firstValue(
          record,
          [
            "date",
            "scheduleddate",
            "publishdate",
            "publishingdate",
            "eventdate",
            "startdate",
          ],
        ),

        time: firstValue(
          record,
          [
            "time",
            "starttime",
            "scheduledtime",
            "publishtime",
            "publishingtime",
          ],
        ),

        endTime: firstValue(
          record,
          [
            "endtime",
            "finishtime",
          ],
        ),

        duration: firstValue(
          record,
          [
            "duration",
            "durationminutes",
          ],
        ),

        description: firstValue(
          record,
          [
            "description",
            "notes",
            "caption",
            "details",
          ],
        ),

        type: firstValue(
          record,
          ["type", "eventtype"],
        ),

        priority: firstValue(
          record,
          ["priority"],
        ),

        scope: firstValue(
          record,
          ["scope", "visibility"],
        ),

        location: firstValue(
          record,
          ["location", "venue"],
        ),

        meetingUrl: firstValue(
          record,
          ["meetingurl", "meetinglink", "url"],
        ),

        allDay: firstValue(
          record,
          ["allday", "alldayevent"],
        ),
      };
    });
}

/* ============================================================================
   PASTED TEXT PARSER

   Supported examples:

   2026-11-03 | 10:00 | Instagram announcement

   2026-11-05 | 13:00 | LinkedIn company update

   03/11/2026 | 10:00 AM | Content review

   2026-11-07 | 16:00 | Campaign launch | TikTok

   The first three columns are:

   DATE | TIME | TITLE

   A fourth column is treated as a description.

   Natural-language interpretation will be added with the
   AI-assisted parser later.
============================================================================ */

function parseTextRows(
  text: string,
): RawScheduleRow[] {
  const lines =
    text.split(/\r?\n/);

  const rows: RawScheduleRow[] = [];

  lines.forEach(
    (line, index) => {
      const trimmed =
        line.trim();

      if (
        !trimmed ||
        trimmed.startsWith("#")
      ) {
        return;
      }

      const parts =
        trimmed
          .split("|")
          .map((part) => part.trim());

      const row =
        emptyRow(index + 1);

      row.date =
        parts[0] ?? "";

      row.time =
        parts[1] ?? "";

      row.title =
        parts[2] ?? "";

      row.description =
        parts.slice(3).join(" | ");

      rows.push(row);
    },
  );

  return rows;
}

/* ============================================================================
   DATE PARSING

   Supports:
   YYYY-MM-DD
   DD/MM/YYYY
   DD-MM-YYYY

   We deliberately avoid ambiguous browser Date parsing.
============================================================================ */

function parseDateParts(
  value: string,
): DateParts | null {
  const text = value.trim();

  let year: number;
  let month: number;
  let day: number;

  const iso =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      text,
    );

  const british =
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(
      text,
    );

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (british) {
    day = Number(british[1]);
    month = Number(british[2]);
    year = Number(british[3]);
  } else {
    return null;
  }

  const check =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

/* ============================================================================
   TIME PARSING

   Supports:
   09:00
   9:00
   14:30
   10:00 AM
   2:30 PM
============================================================================ */

function parseTime(
  value: string,
): ParsedTime | null {
  const text =
    value.trim();

  const match =
    /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(
      text,
    );

  if (!match) {
    return null;
  }

  let hours =
    Number(match[1]);

  const minutes =
    Number(match[2]);

  const period =
    match[3]?.toUpperCase();

  if (
    minutes > 59
  ) {
    return null;
  }

  if (period) {
    if (
      hours < 1 ||
      hours > 12
    ) {
      return null;
    }

    hours %= 12;

    if (
      period === "PM"
    ) {
      hours += 12;
    }
  } else if (
    hours > 23
  ) {
    return null;
  }

  return {
    hours,
    minutes,
  };
}

/* ============================================================================
   TIMEZONE CONVERSION

   Converts local schedule times into UTC.

   Example:
     Africa/Lagos
     2026-11-03
     10:00

   Becomes:
     2026-11-03T09:00:00.000Z

   Uses the JavaScript Intl timezone database.

   Invalid or ambiguous DST times are flagged for review.
============================================================================ */

function zonedParts(
  timestamp: number,
  timezone: string,
): LocalDateTime {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      },
    );

  const parts =
    formatter.formatToParts(
      new Date(timestamp),
    );

  const values: Record<
    string,
    number
  > = {};

  for (const part of parts) {
    if (
      [
        "year",
        "month",
        "day",
        "hour",
        "minute",
      ].includes(part.type)
    ) {
      values[part.type] =
        Number(part.value);
    }
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hours: values.hour,
    minutes: values.minute,
  };
}

function matchingLocalTime(
  left: LocalDateTime,
  right: LocalDateTime,
) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hours === right.hours &&
    left.minutes === right.minutes
  );
}

function zonedToUtc(
  parts: LocalDateTime,
  timezone: string,
): {
  date: Date | null;
  ambiguous: boolean;
} {
  /*
   * Try valid UTC offsets in 15-minute increments.
   *
   * This covers modern IANA offsets and allows us to
   * identify nonexistent or ambiguous DST wall times.
   */

  const localAsUtc =
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hours,
      parts.minutes,
    );

  const matches: number[] = [];

  for (
    let offset = -14 * 60;
    offset <= 14 * 60;
    offset += 15
  ) {
    const candidate =
      localAsUtc -
      offset * 60_000;

    const candidateParts =
      zonedParts(
        candidate,
        timezone,
      );

    if (
      matchingLocalTime(
        candidateParts,
        parts,
      )
    ) {
      matches.push(candidate);
    }
  }

  if (!matches.length) {
    return {
      date: null,
      ambiguous: false,
    };
  }

  matches.sort(
    (a, b) => a - b,
  );

  return {
    date:
      new Date(matches[0]),

    ambiguous:
      matches.length > 1,
  };
}

/* ============================================================================
   ENUM PARSING
============================================================================ */

function parseEventType(
  value: string,
): CalendarEventType {
  const normalized =
    value
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  if (
    Object.values(
      CalendarEventType,
    ).includes(
      normalized as CalendarEventType,
    )
  ) {
    return normalized as CalendarEventType;
  }

  return CalendarEventType.OTHER;
}

function parsePriority(
  value: string,
): CalendarEventPriority {
  const normalized =
    value
      .trim()
      .toUpperCase();

  if (
    Object.values(
      CalendarEventPriority,
    ).includes(
      normalized as CalendarEventPriority,
    )
  ) {
    return normalized as CalendarEventPriority;
  }

  return CalendarEventPriority.NORMAL;
}

function parseScope(
  value: string,
): CalendarEventScope {
  const normalized =
    value
      .trim()
      .toUpperCase();

  if (
    Object.values(
      CalendarEventScope,
    ).includes(
      normalized as CalendarEventScope,
    )
  ) {
    return normalized as CalendarEventScope;
  }

  return CalendarEventScope.PERSONAL;
}

function parseAllDay(
  value: string,
) {
  return [
    "true",
    "yes",
    "1",
  ].includes(
    value.trim().toLowerCase(),
  );
}

/* ============================================================================
   BUILD PREVIEW EVENT
============================================================================ */

function buildPreviewEvent({
  row,
  timezone,
  identity,
}: {
  row: RawScheduleRow;

  timezone: string;

  identity: CalendarIdentity;
}): PreviewEvent {
  const issues: string[] = [];

  const title =
    row.title.trim();

  if (!title) {
    issues.push(
      "Event title is missing.",
    );
  }

  if (title.length > 250) {
    issues.push(
      "Event title is too long.",
    );
  }

  const dateParts =
    parseDateParts(
      row.date,
    );

  if (!dateParts) {
    issues.push(
      "Use a valid date in YYYY-MM-DD or DD/MM/YYYY format.",
    );
  }

  const allDay =
    parseAllDay(
      row.allDay,
    );

  const startTime: ParsedTime | null =
    allDay
      ? {
          hours: 0,
          minutes: 0,
        }
      : parseTime(row.time);

  if (!startTime) {
    issues.push(
      "A valid start time is required.",
    );
  }

  let durationMinutes =
    DEFAULT_DURATION_MINUTES;

  if (row.duration) {
    const suppliedDuration =
      Number(row.duration);

    if (
      !Number.isFinite(
        suppliedDuration,
      ) ||
      suppliedDuration <= 0 ||
      suppliedDuration > 1440
    ) {
      issues.push(
        "Duration must be between 1 and 1440 minutes.",
      );
    } else {
      durationMinutes =
        suppliedDuration;
    }
  }

  const explicitEnd =
    row.endTime
      ? parseTime(
          row.endTime,
        )
      : null;

  if (
    row.endTime &&
    !explicitEnd
  ) {
    issues.push(
      "The end time is invalid.",
    );
  }

  let startAt: Date | null = null;

  let endAt: Date | null = null;

  if (
    dateParts &&
    startTime
  ) {
    const startResult =
      zonedToUtc(
        {
          ...dateParts,
          ...startTime,
        },
        timezone,
      );

    startAt =
      startResult.date;

    if (!startAt) {
      issues.push(
        "This local time does not exist in the selected timezone.",
      );
    }

    if (
      startResult.ambiguous
    ) {
      issues.push(
        "This time occurs twice because of daylight saving. Confirm the correct time.",
      );
    }

    if (
      startAt &&
      !allDay
    ) {
      if (explicitEnd) {
        const endResult =
          zonedToUtc(
            {
              ...dateParts,
              ...explicitEnd,
            },
            timezone,
          );

        endAt =
          endResult.date;

        if (
          endResult.ambiguous
        ) {
          issues.push(
            "The end time is ambiguous because of daylight saving.",
          );
        }

        if (!endAt) {
          issues.push(
            "The selected end time does not exist.",
          );
        }
      } else {
        endAt = new Date(
          startAt.getTime() +
            durationMinutes *
              60_000,
        );
      }

      if (
        endAt &&
        endAt <= startAt
      ) {
        issues.push(
          "End time must be after start time.",
        );
      }
    }
  }

  let scope =
    parseScope(row.scope);

  if (
    !identity.isCalendarManager &&
    scope !==
      CalendarEventScope.PERSONAL
  ) {
    scope =
      CalendarEventScope.PERSONAL;

    issues.push(
      "Only calendar managers can create shared calendar events. This event will need a personal scope.",
    );
  }

  if (
    !startAt ||
    issues.length > 0
  ) {
    return {
      key: `row-${row.row}`,

      row: row.row,

      status: "needs_review",

      issues,

      source: row,

      event: null,
    };
  }

  return {
    key: `row-${row.row}`,

    row: row.row,

    status: "ready",

    issues: [],

    source: row,

    event: {
      title,

      description:
        row.description ||
        null,

      type:
        parseEventType(
          row.type,
        ),

      scope,

      priority:
        parsePriority(
          row.priority,
        ),

      startAt:
        startAt.toISOString(),

      endAt:
        endAt?.toISOString() ??
        null,

      allDay,

      timezone,

      private: false,

      location:
        row.location ||
        null,

      meetingUrl:
        row.meetingUrl ||
        null,

      ownerId:
        identity.employee.id,

      attendeeIds: [],
    },
  };
}

/* ============================================================================
   DEDUPLICATION WITHIN PREVIEW
============================================================================ */

function identifyDuplicates(
  events: PreviewEvent[],
): PreviewEvent[] {
  const seen =
    new Set<string>();

  return events.map(
    (item) => {
      if (
        !item.event
      ) {
        return item;
      }

      const key = [
        item.event.title
          .trim()
          .toLowerCase(),

        item.event.startAt,

        item.event.ownerId,
      ].join("|");

      if (seen.has(key)) {
        return {
          ...item,

          status:
            "needs_review",

          issues: [
            ...item.issues,

            "This event appears more than once in the uploaded schedule.",
          ],
        };
      }

      seen.add(key);

      return item;
    },
  );
}

/* ============================================================================
   POST — SMART PLANNER PREVIEW

   IMPORTANT:

   This endpoint never writes calendar events.

   It only:
   - Authenticates
   - Checks creation permission
   - Parses input
   - Validates scheduling data
   - Returns proposed events
============================================================================ */

export async function POST(
  request: Request,
) {
  try {
    /* ------------------------------------------------------------------------
       AUTHENTICATION
    ------------------------------------------------------------------------ */

    const identity =
      await requireCalendarIdentity();

    assertCanCreateCalendarEvent(
      identity,
    );

    /* ------------------------------------------------------------------------
       INPUT
    ------------------------------------------------------------------------ */

    const input =
      await readPreviewRequest(
        request,
      );

    const timezone =
      validateTimezone(
        input.timezone,
      );

    /* ------------------------------------------------------------------------
       PARSE
    ------------------------------------------------------------------------ */

    const rawRows =
      input.source === "CSV"
        ? mapCsvRows(
            input.text,
          )
        : parseTextRows(
            input.text,
          );

    if (
      rawRows.length === 0
    ) {
      return badRequest(
        "No events were found. Check the schedule format.",
      );
    }

    if (
      rawRows.length >
      MAX_EVENTS
    ) {
      return badRequest(
        `You can preview up to ${MAX_EVENTS} events at a time.`,
      );
    }

    /* ------------------------------------------------------------------------
       BUILD PREVIEW
    ------------------------------------------------------------------------ */

    const proposed =
      rawRows.map(
        (row) =>
          buildPreviewEvent({
            row,

            timezone,

            identity,
          }),
      );

    const events =
      identifyDuplicates(
        proposed,
      );

    /* ------------------------------------------------------------------------
       SUMMARY
    ------------------------------------------------------------------------ */

    const ready =
      events.filter(
        (item) =>
          item.status ===
          "ready",
      ).length;

    const needsReview =
      events.length -
      ready;

    /* ------------------------------------------------------------------------
       RESPONSE
    ------------------------------------------------------------------------ */

    return Response.json({
      success: true,

      previewOnly: true,

      source: {
        type:
          input.source,

        filename:
          input.filename,

        timezone,
      },

      summary: {
        total:
          events.length,

        ready,

        needsReview,
      },

      events,

      message:
        needsReview === 0
          ? `${ready} events are ready for review and import.`
          : `${ready} events are ready. ${needsReview} require attention.`,
    });
  } catch (error) {
    if (
      error instanceof
      CalendarValidationError
    ) {
      return Response.json(
        {
          error:
            error.message,
        },
        {
          status: 400,
        },
      );
    }

    return calendarApiError(
      error,
    );
  }
}