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
    contactId: string;
  }>;
};

type UpdateContactBody = {
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

  const roles = Object.values(
    ClientContactRole,
  ) as string[];

  if (!roles.includes(value)) {
    return undefined;
  }

  return value as ClientContactRole;
}

/* =============================================================================
   FIND CONTACT
============================================================================= */

async function findContact(
  clientId: string,
  contactId: string,
) {
  return prisma.clientContact.findFirst({
    where: {
      id: contactId,
      clientId,
    },

    select: contactSelect,
  });
}

/* =============================================================================
   GET
============================================================================= */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    await requireAdmin();

    const {
      id: clientId,
      contactId,
    } = await context.params;

    if (!clientId?.trim()) {
      return jsonError(
        "Client id is required.",
        400,
      );
    }

    if (!contactId?.trim()) {
      return jsonError(
        "Contact id is required.",
        400,
      );
    }

    /*
     * The clientId is part of the query deliberately.
     *
     * This prevents someone from requesting:
     *
     * /clients/A/contacts/contact-from-client-B
     */
    const contact =
      await findContact(
        clientId,
        contactId,
      );

    if (!contact) {
      return jsonError(
        "Contact not found.",
        404,
      );
    }

    return NextResponse.json({
      ok: true,
      contact,
    });
  } catch (error) {
    return handleRouteError(
      error,
      "GET /api/admin/clients/[id]/contacts/[contactId]",
    );
  }
}

/* =============================================================================
   PATCH
============================================================================= */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin =
      await requireClientEditor();

    const {
      id: clientId,
      contactId,
    } = await context.params;

    if (!clientId?.trim()) {
      return jsonError(
        "Client id is required.",
        400,
      );
    }

    if (!contactId?.trim()) {
      return jsonError(
        "Contact id is required.",
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
       EXISTING CONTACT

       clientId is included so contacts cannot be edited through another
       client's URL.
    ========================================================================= */

    const existing =
      await findContact(
        clientId,
        contactId,
      );

    if (!existing) {
      return jsonError(
        "Contact not found.",
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

    const body: UpdateContactBody =
      rawBody;

    const data: Prisma.ClientContactUpdateInput =
      {};

    /* =========================================================================
       FIRST NAME
    ========================================================================= */

    if (
      body.firstName !== undefined
    ) {
      const firstName =
        requiredString(
          body.firstName,
        );

      if (!firstName) {
        return jsonError(
          "First name cannot be empty.",
          400,
        );
      }

      data.firstName =
        firstName;
    }

    /* =========================================================================
       LAST NAME
    ========================================================================= */

    if (
      body.lastName !== undefined
    ) {
      const parsed =
        optionalString(
          body.lastName,
        );

      if (!parsed.valid) {
        return jsonError(
          "Last name must be text.",
          400,
        );
      }

      data.lastName =
        parsed.value;
    }

    /* =========================================================================
       JOB TITLE
    ========================================================================= */

    if (
      body.jobTitle !== undefined
    ) {
      const parsed =
        optionalString(
          body.jobTitle,
        );

      if (!parsed.valid) {
        return jsonError(
          "Job title must be text.",
          400,
        );
      }

      data.jobTitle =
        parsed.value;
    }

    /* =========================================================================
       EMAIL
    ========================================================================= */

    if (body.email !== undefined) {
      const parsed =
        optionalString(
          body.email,
        );

      if (!parsed.valid) {
        return jsonError(
          "Email must be text.",
          400,
        );
      }

      const email =
        parsed.value;

      if (
        email &&
        !validEmail(email)
      ) {
        return jsonError(
          "Enter a valid email address.",
          400,
        );
      }

      if (email) {
        const duplicate =
          await prisma.clientContact.findFirst({
            where: {
              clientId,

              id: {
                not: contactId,
              },

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
            "Another contact with this email already exists for this client.",
            409,
          );
        }
      }

      data.email = email;
    }

    /* =========================================================================
       PHONE
    ========================================================================= */

    if (body.phone !== undefined) {
      const parsed =
        optionalString(
          body.phone,
        );

      if (!parsed.valid) {
        return jsonError(
          "Phone number must be text.",
          400,
        );
      }

      data.phone =
        parsed.value;
    }

    /* =========================================================================
       NOTES
    ========================================================================= */

    if (body.notes !== undefined) {
      const parsed =
        optionalString(
          body.notes,
        );

      if (!parsed.valid) {
        return jsonError(
          "Notes must be text.",
          400,
        );
      }

      data.notes =
        parsed.value;
    }

    /* =========================================================================
       ROLE
    ========================================================================= */

    if (body.role !== undefined) {
      const role =
        parseContactRole(
          body.role,
        );

      if (!role) {
        return jsonError(
          `Invalid contact role. Expected one of: ${Object.values(
            ClientContactRole,
          ).join(", ")}.`,
          400,
        );
      }

      data.role = role;
    }

    /* =========================================================================
       PRIMARY
    ========================================================================= */

    let requestedPrimary:
      | boolean
      | undefined;

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

      requestedPrimary =
        body.primary;

      data.primary =
        requestedPrimary;
    }

    /* =========================================================================
       ACTIVE
    ========================================================================= */

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

      /*
       * A primary contact cannot be made inactive while remaining primary.
       */
      const willBePrimary =
        requestedPrimary ??
        existing.primary;

      if (
        willBePrimary &&
        body.active === false
      ) {
        return jsonError(
          "A primary contact cannot be inactive. Choose another primary contact first.",
          400,
        );
      }

      data.active =
        body.active;
    }

    /*
     * If we're making this contact primary, it must also be active.
     */
    if (
      requestedPrimary === true
    ) {
      data.active = true;
    }

    /* =========================================================================
       EMPTY UPDATE
    ========================================================================= */

    if (
      Object.keys(data).length === 0
    ) {
      return jsonError(
        "No valid contact changes were supplied.",
        400,
      );
    }

    /* =========================================================================
       UPDATE
    ========================================================================= */

    const updated =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Only one primary contact per client.
           *
           * If this contact becomes primary, remove primary status from every
           * other contact first.
           */
          if (
            requestedPrimary === true
          ) {
            await tx.clientContact.updateMany({
              where: {
                clientId,

                id: {
                  not: contactId,
                },

                primary: true,
              },

              data: {
                primary: false,
              },
            });
          }

          const contact =
            await tx.clientContact.update({
              where: {
                id: contactId,
              },

              data,

              select:
                contactSelect,
            });

          await tx.auditLog.create({
            data: {
              adminUserId:
                admin.id,

              action:
                "CLIENT_CONTACT_UPDATED",

              entityType:
                "CLIENT_CONTACT",

              entityId:
                contact.id,

              metadata: {
                clientId,

                clientName:
                  client.displayName ||
                  client.name,

                contactName: [
                  contact.firstName,
                  contact.lastName,
                ]
                  .filter(Boolean)
                  .join(" "),

                changedFields:
                  Object.keys(data),

                primary:
                  contact.primary,

                active:
                  contact.active,
              },
            },
          });

          return contact;
        },
      );

    return NextResponse.json({
      ok: true,
      contact: updated,
    });
  } catch (error) {
    return handleRouteError(
      error,
      "PATCH /api/admin/clients/[id]/contacts/[contactId]",
    );
  }
}

/* =============================================================================
   DELETE

   For contacts we use a real delete.

   Client operational/history records are preserved elsewhere. If you later
   want contact retention for compliance/audit purposes, we can change this
   to active=false instead without changing the Client 360 UI.
============================================================================= */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin =
      await requireClientEditor();

    const {
      id: clientId,
      contactId,
    } = await context.params;

    if (!clientId?.trim()) {
      return jsonError(
        "Client id is required.",
        400,
      );
    }

    if (!contactId?.trim()) {
      return jsonError(
        "Contact id is required.",
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
       CONTACT
    ========================================================================= */

    const existing =
      await findContact(
        clientId,
        contactId,
      );

    if (!existing) {
      return jsonError(
        "Contact not found.",
        404,
      );
    }

    /* =========================================================================
       DELETE
    ========================================================================= */

    await prisma.$transaction(
      async (tx) => {
        await tx.clientContact.delete({
          where: {
            id: contactId,
          },
        });

        await tx.auditLog.create({
          data: {
            adminUserId:
              admin.id,

            action:
              "CLIENT_CONTACT_DELETED",

            entityType:
              "CLIENT_CONTACT",

            entityId:
              contactId,

            metadata: {
              clientId,

              clientName:
                client.displayName ||
                client.name,

              contactName: [
                existing.firstName,
                existing.lastName,
              ]
                .filter(Boolean)
                .join(" "),

              email:
                existing.email,

              role:
                existing.role,

              wasPrimary:
                existing.primary,
            },
          },
        });
      },
    );

    /* =========================================================================
       PRIMARY CONTACT FALLBACK

       If we removed the primary contact, automatically promote another active
       contact so the client isn't left without a primary person when possible.
    ========================================================================= */

    let promotedContact = null;

    if (existing.primary) {
      const nextContact =
        await prisma.clientContact.findFirst({
          where: {
            clientId,
            active: true,
          },

          orderBy: [
            {
              createdAt: "asc",
            },
            {
              firstName: "asc",
            },
          ],

          select: {
            id: true,
          },
        });

      if (nextContact) {
        promotedContact =
          await prisma.clientContact.update({
            where: {
              id: nextContact.id,
            },

            data: {
              primary: true,
            },

            select:
              contactSelect,
          });
      }
    }

    return NextResponse.json({
      ok: true,

      deleted: true,

      contactId,

      promotedContact,
    });
  } catch (error) {
    return handleRouteError(
      error,
      "DELETE /api/admin/clients/[id]/contacts/[contactId]",
    );
  }
}