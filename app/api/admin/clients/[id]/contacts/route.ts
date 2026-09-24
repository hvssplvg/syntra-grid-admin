import { NextRequest, NextResponse } from "next/server";

import type { Prisma } from "@/app/generated/prisma/client";
import { ClientContactRole } from "@/app/generated/prisma/enums";

import { prisma } from "@/lib/prisma";
import {
  AuthenticationError,
  AuthorisationError,
  requireAdmin,
  requireClientEditor,
} from "@/lib/auth/current-admin";

/* =============================================================================
   TYPES
============================================================================= */

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CreateContactBody = {
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
   SELECT
============================================================================= */

const contactSelect = {
  id: true,
  clientId: true,

  firstName: true,
  lastName: true,
  jobTitle: true,

  email: true,
  phone: true,

  role: true,

  primary: true,
  active: true,

  notes: true,

  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClientContactSelect;

/* =============================================================================
   HELPERS
============================================================================= */

function jsonError(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
    },
  );
}

function handleRouteError(
  error: unknown,
  context: string,
) {
  if (error instanceof AuthenticationError) {
    return jsonError(
      error.message || "Authentication required.",
      401,
    );
  }

  if (error instanceof AuthorisationError) {
    return jsonError(
      error.message ||
        "You do not have permission to perform this action.",
      403,
    );
  }

  console.error(`[${context}]`, error);

  return jsonError(
    "Something went wrong. Please try again.",
    500,
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function requiredString(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed || undefined;
}

function optionalString(
  value: unknown,
): {
  valid: boolean;
  value: string;
} {
  if (
    value === undefined ||
    value === null
  ) {
    return {
      valid: true,
      value: "",
    };
  }

  if (typeof value !== "string") {
    return {
      valid: false,
      value: "",
    };
  }

  return {
    valid: true,
    value: value.trim(),
  };
}

function validEmail(
  value: string,
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function parseContactRole(
  value: unknown,
): ClientContactRole | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const values = Object.values(
    ClientContactRole,
  ) as string[];

  if (!values.includes(value)) {
    return undefined;
  }

  return value as ClientContactRole;
}

/* =============================================================================
   GET CONTACTS
============================================================================= */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    await requireAdmin();

    const { id: clientId } =
      await context.params;

    if (!clientId?.trim()) {
      return jsonError(
        "Client id is required.",
        400,
      );
    }

    const client =
      await prisma.client.findUnique({
        where: {
          id: clientId,
        },

        select: {
          id: true,
          name: true,
          displayName: true,
        },
      });

    if (!client) {
      return jsonError(
        "Client not found.",
        404,
      );
    }

    const contacts =
      await prisma.clientContact.findMany({
        where: {
          clientId,
        },

        orderBy: [
          {
            primary: "desc",
          },
          {
            active: "desc",
          },
          {
            firstName: "asc",
          },
          {
            lastName: "asc",
          },
        ],

        select: contactSelect,
      });

    return NextResponse.json({
      ok: true,

      client: {
        id: client.id,
        name:
          client.displayName ||
          client.name,
      },

      contacts,

      meta: {
        total: contacts.length,

        active: contacts.filter(
          (contact) =>
            contact.active,
        ).length,

        primary:
          contacts.find(
            (contact) =>
              contact.primary,
          )?.id ?? null,
      },
    });
  } catch (error) {
    return handleRouteError(
      error,
      "GET /api/admin/clients/[id]/contacts",
    );
  }
}

/* =============================================================================
   POST CONTACT
============================================================================= */

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin =
      await requireClientEditor();

    const { id: clientId } =
      await context.params;

    if (!clientId?.trim()) {
      return jsonError(
        "Client id is required.",
        400,
      );
    }

    /* =========================================================================
       CLIENT
    ========================================================================= */

    const client =
      await prisma.client.findUnique({
        where: {
          id: clientId,
        },

        select: {
          id: true,
          name: true,
          displayName: true,
        },
      });

    if (!client) {
      return jsonError(
        "Client not found.",
        404,
      );
    }

    /* =========================================================================
       BODY
    ========================================================================= */

    const rawBody: unknown =
      await request.json();

    if (!isRecord(rawBody)) {
      return jsonError(
        "Invalid request body.",
        400,
      );
    }

    const body: CreateContactBody =
      rawBody;

    /* =========================================================================
       FIRST NAME
    ========================================================================= */

    const firstName =
      requiredString(
        body.firstName,
      );

    if (!firstName) {
      return jsonError(
        "First name is required.",
        400,
      );
    }

    /* =========================================================================
       LAST NAME
    ========================================================================= */

    const parsedLastName =
      optionalString(
        body.lastName,
      );

    if (!parsedLastName.valid) {
      return jsonError(
        "Last name must be text.",
        400,
      );
    }

    const lastName =
      parsedLastName.value;

    /* =========================================================================
       JOB TITLE
    ========================================================================= */

    const parsedJobTitle =
      optionalString(
        body.jobTitle,
      );

    if (!parsedJobTitle.valid) {
      return jsonError(
        "Job title must be text.",
        400,
      );
    }

    const jobTitle =
      parsedJobTitle.value;

    /* =========================================================================
       EMAIL
    ========================================================================= */

    const parsedEmail =
      optionalString(
        body.email,
      );

    if (!parsedEmail.valid) {
      return jsonError(
        "Email must be text.",
        400,
      );
    }

    const email =
      parsedEmail.value;

    if (
      email &&
      !validEmail(email)
    ) {
      return jsonError(
        "Enter a valid email address.",
        400,
      );
    }

    /* =========================================================================
       PHONE
    ========================================================================= */

    const parsedPhone =
      optionalString(
        body.phone,
      );

    if (!parsedPhone.valid) {
      return jsonError(
        "Phone number must be text.",
        400,
      );
    }

    const phone =
      parsedPhone.value;

    /* =========================================================================
       NOTES
    ========================================================================= */

    const parsedNotes =
      optionalString(
        body.notes,
      );

    if (!parsedNotes.valid) {
      return jsonError(
        "Notes must be text.",
        400,
      );
    }

    const notes =
      parsedNotes.value;

    /* =========================================================================
       ROLE

       Do not recreate the Prisma enum ourselves.
       We use the generated ClientContactRole directly.
    ========================================================================= */

    const availableRoles =
      Object.values(
        ClientContactRole,
      );

    if (
      availableRoles.length === 0
    ) {
      return jsonError(
        "No client contact roles are configured.",
        500,
      );
    }

    let role: ClientContactRole;

    if (body.role === undefined) {
      /*
       * Prefer GENERAL if your schema contains it.
       * Otherwise use the first actual generated enum value.
       */
      role =
        availableRoles.find(
          (candidate) =>
            candidate === "GENERAL",
        ) ??
        availableRoles[0];
    } else {
      const parsedRole =
        parseContactRole(
          body.role,
        );

      if (!parsedRole) {
        return jsonError(
          `Invalid contact role. Expected one of: ${availableRoles.join(
            ", ",
          )}.`,
          400,
        );
      }

      role = parsedRole;
    }

    /* =========================================================================
       PRIMARY
    ========================================================================= */

    let primary = false;

    if (
      body.primary !== undefined
    ) {
      if (
        typeof body.primary !==
        "boolean"
      ) {
        return jsonError(
          "Primary must be true or false.",
          400,
        );
      }

      primary = body.primary;
    }

    /* =========================================================================
       ACTIVE
    ========================================================================= */

    let active = true;

    if (
      body.active !== undefined
    ) {
      if (
        typeof body.active !==
        "boolean"
      ) {
        return jsonError(
          "Active must be true or false.",
          400,
        );
      }

      active = body.active;
    }

    /*
     * A primary contact cannot be inactive.
     */
    if (primary) {
      active = true;
    }

    /* =========================================================================
       DUPLICATE EMAIL
    ========================================================================= */

    if (email) {
      const duplicate =
        await prisma.clientContact.findFirst({
          where: {
            clientId,

            email: {
              equals: email,
              mode: "insensitive",
            },
          },

          select: {
            id: true,
          },
        });

      if (duplicate) {
        return jsonError(
          "A contact with this email already exists for this client.",
          409,
        );
      }
    }

    /* =========================================================================
       CREATE
    ========================================================================= */

    const contact =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Maintain exactly one primary contact.
           */
          if (primary) {
            await tx.clientContact.updateMany({
              where: {
                clientId,
                primary: true,
              },

              data: {
                primary: false,
              },
            });
          }

          const created =
            await tx.clientContact.create({
              data: {
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
              },

              select:
                contactSelect,
            });

          /* ===================================================================
             AUDIT
          =================================================================== */

          await tx.auditLog.create({
            data: {
              actorId:
                admin.id,

              action:
                "CLIENT_CONTACT_CREATED",

              entityType:
                "CLIENT_CONTACT",

              entityId:
                created.id,

              metadata: {
                clientId,

                clientName:
                  client.displayName ||
                  client.name,

                contactName: [
                  created.firstName,
                  created.lastName,
                ]
                  .filter(Boolean)
                  .join(" "),

                role:
                  created.role,

                primary:
                  created.primary,
              },
            },
          });

          return created;
        },
      );

    /* =========================================================================
       RESPONSE
    ========================================================================= */

    return NextResponse.json(
      {
        ok: true,
        contact,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    return handleRouteError(
      error,
      "POST /api/admin/clients/[id]/contacts",
    );
  }
}