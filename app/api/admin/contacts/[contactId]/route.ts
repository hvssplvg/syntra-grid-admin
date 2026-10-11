import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  contactApiError,
  contactDTO,
  deleteContact,
  parseContactRole,
  requireContact,
  requireContactIdentity,
  requiredText,
  updateContact,
} from "@/lib/contacts/server";

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type RouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

type UpdateContactRequestBody = {
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

/* =============================================================================
 * GET /api/admin/contacts/[contactId]
 * =============================================================================
 *
 * Returns one contact.
 *
 * All authenticated admin users may read contacts.
 * Management permissions are included in the returned DTO.
 * =============================================================================
 */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireContactIdentity();

    const {
      contactId,
    } =
      await context.params;

    const resolvedContactId =
      requiredText(
        contactId,
        "Contact",
      );

    const contact =
      await requireContact(
        resolvedContactId,
      );

    return NextResponse.json(
      {
        contact:
          contactDTO(
            contact,
            identity,
          ),
      },
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
 * PATCH /api/admin/contacts/[contactId]
 * =============================================================================
 *
 * Updates an existing client contact.
 *
 * OWNER / ADMIN / DEVELOPER only.
 *
 * The endpoint accepts a partial body. Any omitted field keeps its
 * existing value.
 * =============================================================================
 */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireContactIdentity();

    const {
      contactId,
    } =
      await context.params;

    const resolvedContactId =
      requiredText(
        contactId,
        "Contact",
      );

    /*
     * Load the existing record first so PATCH can genuinely
     * behave as a partial update.
     */
    const existing =
      await requireContact(
        resolvedContactId,
      );

    const body =
      await readJsonBody(
        request,
      );

    const clientId =
      body.clientId === undefined
        ? existing.clientId
        : requiredText(
            body.clientId,
            "Client",
          );

    const firstName =
      body.firstName === undefined
        ? existing.firstName
        : requiredText(
            body.firstName,
            "First name",
          );

    const lastName =
      body.lastName === undefined
        ? existing.lastName
        : requiredText(
            body.lastName,
            "Last name",
          );

    const jobTitle =
      body.jobTitle === undefined
        ? existing.jobTitle
        : optionalString(
            body.jobTitle,
            "Job title",
          );

    const email =
      body.email === undefined
        ? existing.email
        : optionalString(
            body.email,
            "Email",
          );

    const phone =
      body.phone === undefined
        ? existing.phone
        : optionalString(
            body.phone,
            "Phone",
          );

    const role =
      body.role === undefined
        ? existing.role
        : parseContactRole(
            body.role,
          );

    const primary =
      body.primary === undefined
        ? existing.primary
        : requiredBoolean(
            body.primary,
            "Primary",
          );

    const active =
      body.active === undefined
        ? existing.active
        : requiredBoolean(
            body.active,
            "Active",
          );

    const notes =
      body.notes === undefined
        ? existing.notes
        : optionalString(
            body.notes,
            "Notes",
          );

    const contact =
      await updateContact({
        identity,

        contactId:
          resolvedContactId,

        clientId,

        firstName,
        lastName,

        jobTitle,

        email,
        phone,

        role,

        primary,
        active,

        notes,
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
 * DELETE /api/admin/contacts/[contactId]
 * =============================================================================
 *
 * Permanently deletes a client contact.
 *
 * OWNER / ADMIN / DEVELOPER only.
 * =============================================================================
 */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const identity =
      await requireContactIdentity();

    const {
      contactId,
    } =
      await context.params;

    const resolvedContactId =
      requiredText(
        contactId,
        "Contact",
      );

    const deleted =
      await deleteContact({
        identity,

        contactId:
          resolvedContactId,
      });

    return NextResponse.json(
      {
        success: true,

        deletedContactId:
          deleted.id,
      },
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
 * REQUEST HELPERS
 * =============================================================================
 */

async function readJsonBody(
  request: NextRequest,
): Promise<UpdateContactRequestBody> {
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

  return body as UpdateContactRequestBody;
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

function requiredBoolean(
  value: unknown,
  label: string,
): boolean {
  if (
    typeof value !==
    "boolean"
  ) {
    throw new Error(
      `${label} must be true or false.`,
    );
  }

  return value;
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