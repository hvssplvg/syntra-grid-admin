import { NextRequest, NextResponse } from "next/server";

import {
  contactApiError,
  contactDTO,
  createContact,
  getContactFeed,
  optionalBoolean,
  parseContactRole,
  parseOptionalBooleanQuery,
  parseOptionalContactRole,
  requireContactIdentity,
  requiredText,
} from "@/lib/contacts/server";

/* =============================================================================
 * GET /api/admin/contacts
 * =============================================================================
 *
 * Query parameters:
 *
 * ?query=
 * ?clientId=
 * ?role=
 * ?active=true|false
 * ?primary=true|false
 *
 * All authenticated admin users may read contacts.
 * OWNER / ADMIN / DEVELOPER receive management permissions in the DTO.
 * =============================================================================
 */

export async function GET(
  request: NextRequest,
) {
  try {
    const identity =
      await requireContactIdentity();

    const searchParams =
      request.nextUrl.searchParams;

    const query =
      cleanQueryParam(
        searchParams.get("query"),
      );

    const clientId =
      cleanQueryParam(
        searchParams.get("clientId"),
      );

    const role =
      parseOptionalContactRole(
        searchParams.get("role"),
      );

    const active =
      parseOptionalBooleanQuery(
        searchParams.get("active"),
        "Active",
      );

    const primary =
      parseOptionalBooleanQuery(
        searchParams.get("primary"),
        "Primary",
      );

    const feed =
      await getContactFeed({
        identity,

        query,
        clientId,

        role,

        active,
        primary,
      });

    return NextResponse.json(
      feed,
      {
        status: 200,
      },
    );
  } catch (error) {
    return contactErrorResponse(
      error,
    );
  }
}

/* =============================================================================
 * POST /api/admin/contacts
 * =============================================================================
 *
 * Creates a client contact.
 *
 * OWNER / ADMIN / DEVELOPER only.
 *
 * Expected body:
 *
 * {
 *   clientId: string;
 *   firstName: string;
 *   lastName: string;
 *   jobTitle?: string | null;
 *   email?: string | null;
 *   phone?: string | null;
 *   role: ClientContactRole;
 *   primary?: boolean;
 *   active?: boolean;
 *   notes?: string | null;
 * }
 * =============================================================================
 */

export async function POST(
  request: NextRequest,
) {
  try {
    const identity =
      await requireContactIdentity();

    const body =
      await readJsonBody(
        request,
      );

    const clientId =
      requiredText(
        body.clientId,
        "Client",
      );

    const firstName =
      requiredText(
        body.firstName,
        "First name",
      );

    const lastName =
      requiredText(
        body.lastName,
        "Last name",
      );

    const role =
      parseContactRole(
        body.role ??
          "GENERAL",
      );

    const primary =
      optionalBoolean(
        body.primary,
        false,
      );

    const active =
      optionalBoolean(
        body.active,
        true,
      );

    const contact =
      await createContact({
        identity,

        clientId,

        firstName,
        lastName,

        jobTitle:
          optionalString(
            body.jobTitle,
            "Job title",
          ),

        email:
          optionalString(
            body.email,
            "Email",
          ),

        phone:
          optionalString(
            body.phone,
            "Phone",
          ),

        role,

        primary,
        active,

        notes:
          optionalString(
            body.notes,
            "Notes",
          ),
      });

    return NextResponse.json(
      {
        contact:
          contactDTO(
            contact,
            identity,
          ),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return contactErrorResponse(
      error,
    );
  }
}

/* =============================================================================
 * REQUEST HELPERS
 * =============================================================================
 */

type ContactRequestBody = {
  clientId?: unknown;

  firstName?: unknown;
  lastName?: unknown;

  jobTitle?: unknown;

  email?: unknown;
  phone?: unknown;

  role?: unknown;

  primary?: unknown;
  active?: unknown;

  notes?: unknown;
};

async function readJsonBody(
  request: NextRequest,
): Promise<ContactRequestBody> {
  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    throw new Error(
      "Request body must contain valid JSON.",
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new Error(
      "Request body must be a JSON object.",
    );
  }

  return body as ContactRequestBody;
}

function optionalString(
  value: unknown,
  label: string,
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value !== "string"
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

function cleanQueryParam(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  return (
    value.trim() ||
    null
  );
}

/* =============================================================================
 * ERROR RESPONSE
 * =============================================================================
 */

function contactErrorResponse(
  error: unknown,
) {
  const result =
    contactApiError(
      error,
    );

  return NextResponse.json(
    {
      error:
        result.message,
    },
    {
      status:
        result.status,
    },
  );
}