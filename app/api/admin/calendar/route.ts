import {
  AuthorisationError,
  requirePermission,
} from "@/lib/auth/current-admin";
import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";

import {
  createCalendarEvent,
  CalendarValidationError,
  type CalendarEventCreatePayload,
} from "@/lib/calendar/event-create";

import {
  calendarApiError,
  getCalendarFeed,
  parseCalendarRange,
  requireCalendarIdentity,
} from "@/lib/calendar/server";

/* ============================================================================
   CONFIGURATION
============================================================================ */

export const runtime = "nodejs";

/* ============================================================================
   HELPERS
============================================================================ */

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

/* ============================================================================
   GET — UNIFIED CALENDAR FEED

   Preserves the existing calendar system.

   Sources:
   - Manual calendar events
   - Approved / recorded leave
   - Recruitment interviews
   - Engineering deployments

   Permissions and private-event masking remain in
   lib/calendar/server.ts.
============================================================================ */

export async function GET(request: Request) {
  try {
    /* ------------------------------------------------------------------------
       AUTHENTICATE
    ------------------------------------------------------------------------ */

    const identity =
      await requireCalendarIdentity();

    if (identity.admin.restrictedAccess) {
      await requirePermission(
        "calendar",
        AccessAction.VIEW,
        { scope: AccessScope.OWN },
      );
    }

    const url = new URL(request.url);

    /* ------------------------------------------------------------------------
       DATE RANGE
    ------------------------------------------------------------------------ */

    const range = parseCalendarRange(
      url.searchParams.get("start"),
      url.searchParams.get("end"),
    );

    /* ------------------------------------------------------------------------
       FILTERS
    ------------------------------------------------------------------------ */

    const departmentId = cleanString(
      url.searchParams.get("departmentId"),
    );

    const requestedEmployeeId = cleanString(
      url.searchParams.get("employeeId"),
    );

    const clientId = cleanString(
      url.searchParams.get("clientId"),
    );

    const projectId = cleanString(
      url.searchParams.get("projectId"),
    );

    /* ------------------------------------------------------------------------
       EMPLOYEE FILTER AUTHORISATION

       Regular employees may filter only their own calendars.

       Managers can filter any employee calendar, subject to
       the visibility rules enforced by getCalendarFeed().
    ------------------------------------------------------------------------ */

    let employeeId: string | null = null;

    if (requestedEmployeeId) {
      if (
        identity.isCalendarManager ||
        requestedEmployeeId === identity.employee.id
      ) {
        employeeId = requestedEmployeeId;
      } else {
        throw new AuthorisationError(
          "You are not authorised to view that employee calendar.",
        );
      }
    }

    /* ------------------------------------------------------------------------
       DEPARTMENT FILTER AUTHORISATION

       Regular employees cannot select another department.

       Managers can filter any department.
    ------------------------------------------------------------------------ */

    if (
      departmentId &&
      !identity.isCalendarManager &&
      departmentId !== identity.employee.departmentId
    ) {
      throw new AuthorisationError(
        "You are not authorised to view that department calendar.",
      );
    }

    /* ------------------------------------------------------------------------
       FETCH UNIFIED FEED
    ------------------------------------------------------------------------ */

    const items = await getCalendarFeed({
      identity,
      range,
      departmentId,
      employeeId,
      clientId,
      projectId,
    });

    /* ------------------------------------------------------------------------
       RESPONSE

       Preserve the existing response contract so the
       Calendar frontend and other consumers continue working.
    ------------------------------------------------------------------------ */

    return Response.json({
      viewer: {
        adminId: identity.admin.id,

        employeeId: identity.employee.id,

        firstName: identity.employee.firstName,

        lastName: identity.employee.lastName,

        preferredName: identity.employee.preferredName,

        avatarUrl: identity.employee.avatarUrl,

        departmentId: identity.employee.departmentId,

        role: identity.admin.role,

        isCalendarManager: identity.isCalendarManager,
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
    return handleCalendarRouteError(error);
  }
}

/* ============================================================================
   POST — CREATE CALENDAR EVENT

   Uses the shared calendar event service.

   This ensures manual creation and Smart Planner imports
   follow the same rules.

   Permissions:

   OWNER / ADMIN:
     Can create calendar events for employees and
     use broader calendar scopes.

   DEVELOPER / SUPPORT / FINANCE:
     Can create events on their own personal calendar.

   VIEWER:
     Read-only. Cannot create events.

   These checks are enforced by event-create.ts,
   not merely by the Calendar interface.
============================================================================ */

export async function POST(request: Request) {
  try {
    /* ------------------------------------------------------------------------
       AUTHENTICATE
    ------------------------------------------------------------------------ */

    const identity =
      await requireCalendarIdentity();

    if (identity.admin.restrictedAccess) {
      await requirePermission(
        "calendar",
        AccessAction.CREATE,
        { scope: AccessScope.OWN },
      );
    }

    /* ------------------------------------------------------------------------
       PARSE BODY
    ------------------------------------------------------------------------ */

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new CalendarValidationError(
        "The request body must contain valid JSON.",
      );
    }

    if (!isPlainObject(body)) {
      throw new CalendarValidationError(
        "The event must be provided as a JSON object.",
      );
    }

    /* ------------------------------------------------------------------------
       CREATE EVENT

       No duplicated permission checks or database queries
       are needed here.

       The shared service handles:

       - Viewer restrictions
       - Owner and employee assignment
       - Calendar scope restrictions
       - Event type and priority validation
       - Start/end date validation
       - Employee and attendee validation
       - Department validation
       - Client and project relationships
       - Timezone validation
       - Meeting URL validation
       - Database creation
    ------------------------------------------------------------------------ */

    const event = await createCalendarEvent({
      identity,

      payload: body as CalendarEventCreatePayload,
    });

    /* ------------------------------------------------------------------------
       RESPONSE

       Keep the same format as the original POST endpoint.
    ------------------------------------------------------------------------ */

    return Response.json(
      {
        event,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return handleCalendarRouteError(error);
  }
}

/* ============================================================================
   ERROR HANDLING

   Authentication:
     401

   Authorisation:
     403

   Invalid event data:
     400

   Other server/database errors:
     Existing calendarApiError handler.
============================================================================ */

function handleCalendarRouteError(
  error: unknown,
): Response {
  if (error instanceof CalendarValidationError) {
    return Response.json(
      {
        error: error.message,
      },
      {
        status: 400,
      },
    );
  }

  return calendarApiError(error);
}