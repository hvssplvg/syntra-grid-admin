import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";

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

type ClientStatus =
  | "LEAD"
  | "ONBOARDING"
  | "ACTIVE"
  | "PAUSED"
  | "ARCHIVED";

type ClientPriority =
  | "STANDARD"
  | "IMPORTANT"
  | "STRATEGIC";

type ClientRelationshipType =
  | "CLIENT"
  | "PARTNER"
  | "STRATEGIC_PARTNER";

type BillingCycle =
  | "MONTHLY"
  | "QUARTERLY"
  | "ANNUAL"
  | "CUSTOM";

type CurrencyCode =
  | "NGN"
  | "GBP"
  | "USD"
  | "EUR";

type UpdateClientBody = {
  name?: unknown;
  displayName?: unknown;
  slug?: unknown;
  clientRef?: unknown;

  description?: unknown;
  industry?: unknown;

  country?: unknown;
  city?: unknown;

  logoUrl?: unknown;
  websiteUrl?: unknown;

  status?: unknown;
  priority?: unknown;
  relationshipType?: unknown;

  accountOwnerId?: unknown;

  relationshipStartedAt?: unknown;
  liveSince?: unknown;

  domain?: unknown;
  adminUrl?: unknown;

  billingCycle?: unknown;
  contractValue?: unknown;
  currency?: unknown;
  renewalAt?: unknown;

  integrationLive?: unknown;

  notes?: unknown;
};

/* =============================================================================
   CONSTANTS
============================================================================= */

const CLIENT_STATUSES: readonly ClientStatus[] = [
  "LEAD",
  "ONBOARDING",
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
];

const CLIENT_PRIORITIES: readonly ClientPriority[] = [
  "STANDARD",
  "IMPORTANT",
  "STRATEGIC",
];

const CLIENT_RELATIONSHIP_TYPES: readonly ClientRelationshipType[] = [
  "CLIENT",
  "PARTNER",
  "STRATEGIC_PARTNER",
];

const BILLING_CYCLES: readonly BillingCycle[] = [
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
  "CUSTOM",
];

const CURRENCIES: readonly CurrencyCode[] = [
  "NGN",
  "GBP",
  "USD",
  "EUR",
];

/* =============================================================================
   CLIENT SELECT

   IMPORTANT:
   This deliberately selects only fields we know belong to Client,
   ClientContact and AdminUser.

   Billing, invoices, tickets, deployments, incidents and integrations can
   be loaded by their dedicated Client 360 sections later.

   This prevents this route from depending on guessed fields in those models.
============================================================================= */

const clientSelect = {
  id: true,

  name: true,
  displayName: true,
  slug: true,
  clientRef: true,

  description: true,
  industry: true,

  country: true,
  city: true,

  logoUrl: true,
  websiteUrl: true,

  status: true,
  priority: true,
  relationshipType: true,

  relationshipStartedAt: true,
  liveSince: true,

  domain: true,
  adminUrl: true,

  billingCycle: true,
  contractValue: true,
  currency: true,
  renewalAt: true,

  integrationLive: true,

  plan: true,
  productName: true,

  notes: true,

  createdAt: true,
  updatedAt: true,

  accountOwner: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
      role: true,
      active: true,
    },
  },

  contacts: {
    orderBy: [
      {
        primary: "desc",
      },
      {
        createdAt: "asc",
      },
    ],

    select: {
      id: true,
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
    },
  },

  projects: {
    orderBy: {
      updatedAt: "desc",
    },

    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      category: true,
      status: true,

      productionUrl: true,
      adminUrl: true,
      repositoryUrl: true,

      hostingProvider: true,
      databaseType: true,
      framework: true,

      createdAt: true,
      updatedAt: true,

      _count: {
        select: {
          integrations: true,
          deployments: true,
          healthChecks: true,
          incidents: true,
          tickets: true,
        },
      },
    },
  },

  _count: {
    select: {
      contacts: true,
      projects: true,
      tickets: true,
      invoices: true,
    },
  },
} satisfies Prisma.ClientSelect;

/* =============================================================================
   HELPERS
============================================================================= */

function jsonError(
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(details !== undefined
        ? {
            details,
          }
        : {}),
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

function nullableString(
  value: unknown,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function nullableDate(
  value: unknown,
): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  if (!allowed.includes(value as T)) {
    return undefined;
  }

  return value as T;
}

function parseMoney(
  value: unknown,
): string | number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === null ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      return undefined;
    }

    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return 0;
    }

    const number = Number(trimmed);

    if (
      !Number.isFinite(number) ||
      number < 0
    ) {
      return undefined;
    }

    return trimmed;
  }

  return undefined;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function serialiseClient<
  T extends {
    contractValue: unknown;
  },
>(client: T) {
  return {
    ...client,

    contractValue:
      client.contractValue === null ||
      client.contractValue === undefined
        ? "0"
        : String(client.contractValue),
  };
}

/* =============================================================================
   GET CLIENT
============================================================================= */

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    await requireAdmin();

    const { id } = await context.params;

    if (!id?.trim()) {
      return jsonError(
        "Client id is required.",
        400,
      );
    }

    const client =
      await prisma.client.findUnique({
        where: {
          id,
        },

        select: clientSelect,
      });

    if (!client) {
      return jsonError(
        "Client not found.",
        404,
      );
    }

    /* -----------------------------------------------------------------------
       CLIENT 360 SUMMARY
    ----------------------------------------------------------------------- */

    const activeProjects =
      client.projects.filter(
        (project) =>
          project.status === "ACTIVE",
      ).length;

    const integrationCount =
      client.projects.reduce(
        (total, project) =>
          total +
          project._count.integrations,
        0,
      );

    const deploymentCount =
      client.projects.reduce(
        (total, project) =>
          total +
          project._count.deployments,
        0,
      );

    const incidentCount =
      client.projects.reduce(
        (total, project) =>
          total +
          project._count.incidents,
        0,
      );

    const projectTicketCount =
      client.projects.reduce(
        (total, project) =>
          total +
          project._count.tickets,
        0,
      );

    const healthCheckCount =
      client.projects.reduce(
        (total, project) =>
          total +
          project._count.healthChecks,
        0,
      );

    const primaryContact =
      client.contacts.find(
        (contact) =>
          contact.primary &&
          contact.active,
      ) ??
      client.contacts.find(
        (contact) => contact.active,
      ) ??
      client.contacts[0] ??
      null;

    const response = serialiseClient({
      ...client,

      primaryContact,

      workspaceSummary: {
        contacts:
          client._count.contacts,

        projects:
          client._count.projects,

        activeProjects,

        tickets:
          client._count.tickets,

        projectTickets:
          projectTicketCount,

        invoices:
          client._count.invoices,

        integrations:
          integrationCount,

        deployments:
          deploymentCount,

        healthChecks:
          healthCheckCount,

        incidents:
          incidentCount,
      },
    });

    return NextResponse.json({
      ok: true,
      client: response,
    });
  } catch (error) {
    return handleRouteError(
      error,
      "GET /api/admin/clients/[id]",
    );
  }
}

/* =============================================================================
   PATCH CLIENT
============================================================================= */

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin =
      await requireClientEditor();

    const { id } = await context.params;

    if (!id?.trim()) {
      return jsonError(
        "Client id is required.",
        400,
      );
    }

    const existing =
      await prisma.client.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          name: true,
          slug: true,
          clientRef: true,
          status: true,
        },
      });

    if (!existing) {
      return jsonError(
        "Client not found.",
        404,
      );
    }

    const rawBody: unknown =
      await request.json();

    if (!isRecord(rawBody)) {
      return jsonError(
        "Invalid request body.",
        400,
      );
    }

    const body: UpdateClientBody =
      rawBody;

    const data: Prisma.ClientUpdateInput =
      {};

    /* =========================================================================
       NAME
    ========================================================================= */

    if (body.name !== undefined) {
      const name =
        requiredString(body.name);

      if (!name) {
        return jsonError(
          "Client name cannot be empty.",
          400,
        );
      }

      data.name = name;
    }

    /* =========================================================================
       DISPLAY NAME
    ========================================================================= */

    if (
      body.displayName !== undefined
    ) {
      const displayName =
        nullableString(
          body.displayName,
        );

      if (
        displayName === undefined
      ) {
        return jsonError(
          "Display name must be text or null.",
          400,
        );
      }

      data.displayName =
        displayName;
    }

    /* =========================================================================
       SLUG
    ========================================================================= */

    if (body.slug !== undefined) {
      if (
        typeof body.slug !== "string"
      ) {
        return jsonError(
          "Slug must be text.",
          400,
        );
      }

      const slug =
        slugify(body.slug);

      if (!slug) {
        return jsonError(
          "Enter a valid client slug.",
          400,
        );
      }

      const duplicate =
        await prisma.client.findFirst({
          where: {
            slug,

            id: {
              not: id,
            },
          },

          select: {
            id: true,
          },
        });

      if (duplicate) {
        return jsonError(
          "Another client already uses this slug.",
          409,
        );
      }

      data.slug = slug;
    }

    /* =========================================================================
       CLIENT REFERENCE
    ========================================================================= */

    if (
      body.clientRef !== undefined
    ) {
      const clientRef =
        nullableString(
          body.clientRef,
        );

      if (
        clientRef === undefined
      ) {
        return jsonError(
          "Client reference must be text or null.",
          400,
        );
      }

      if (clientRef) {
        const duplicate =
          await prisma.client.findFirst({
            where: {
              clientRef,

              id: {
                not: id,
              },
            },

            select: {
              id: true,
            },
          });

        if (duplicate) {
          return jsonError(
            "Another client already uses this client reference.",
            409,
          );
        }
      }

      data.clientRef =
        clientRef;
    }

    /* =========================================================================
       COMPANY INFORMATION
    ========================================================================= */

    if (
      body.description !== undefined
    ) {
      const value =
        nullableString(
          body.description,
        );

      if (value === undefined) {
        return jsonError(
          "Description must be text or null.",
          400,
        );
      }

      data.description = value;
    }

    if (
      body.industry !== undefined
    ) {
      const value =
        nullableString(
          body.industry,
        );

      if (value === undefined) {
        return jsonError(
          "Industry must be text or null.",
          400,
        );
      }

      data.industry = value;
    }

    if (
      body.country !== undefined
    ) {
      const value =
        nullableString(
          body.country,
        );

      if (value === undefined) {
        return jsonError(
          "Country must be text or null.",
          400,
        );
      }

      data.country = value;
    }

    if (body.city !== undefined) {
      const value =
        nullableString(body.city);

      if (value === undefined) {
        return jsonError(
          "City must be text or null.",
          400,
        );
      }

      data.city = value;
    }

    if (
      body.logoUrl !== undefined
    ) {
      const value =
        nullableString(
          body.logoUrl,
        );

      if (value === undefined) {
        return jsonError(
          "Logo URL must be text or null.",
          400,
        );
      }

      data.logoUrl = value;
    }

    if (
      body.websiteUrl !== undefined
    ) {
      const value =
        nullableString(
          body.websiteUrl,
        );

      if (value === undefined) {
        return jsonError(
          "Website URL must be text or null.",
          400,
        );
      }

      data.websiteUrl = value;
    }

    if (
      body.domain !== undefined
    ) {
      const value =
        nullableString(
          body.domain,
        );

      if (value === undefined) {
        return jsonError(
          "Domain must be text or null.",
          400,
        );
      }

      data.domain = value;
    }

    if (
      body.adminUrl !== undefined
    ) {
      const value =
        nullableString(
          body.adminUrl,
        );

      if (value === undefined) {
        return jsonError(
          "Admin URL must be text or null.",
          400,
        );
      }

      data.adminUrl = value;
    }

    if (body.notes !== undefined) {
      const value =
        nullableString(
          body.notes,
        );

      if (value === undefined) {
        return jsonError(
          "Notes must be text or null.",
          400,
        );
      }

      data.notes = value;
    }

    /* =========================================================================
       STATUS
    ========================================================================= */

    if (
      body.status !== undefined
    ) {
      const status = enumValue(
        body.status,
        CLIENT_STATUSES,
      );

      if (!status) {
        return jsonError(
          "Invalid client status.",
          400,
        );
      }

      data.status = status;
    }

    /* =========================================================================
       PRIORITY
    ========================================================================= */

    if (
      body.priority !== undefined
    ) {
      const priority =
        enumValue(
          body.priority,
          CLIENT_PRIORITIES,
        );

      if (!priority) {
        return jsonError(
          "Invalid client priority.",
          400,
        );
      }

      data.priority = priority;
    }

    /* =========================================================================
       RELATIONSHIP
    ========================================================================= */

    if (
      body.relationshipType !==
      undefined
    ) {
      const relationshipType =
        enumValue(
          body.relationshipType,
          CLIENT_RELATIONSHIP_TYPES,
        );

      if (!relationshipType) {
        return jsonError(
          "Invalid relationship type.",
          400,
        );
      }

      data.relationshipType =
        relationshipType;
    }

    /* =========================================================================
       ACCOUNT OWNER
    ========================================================================= */

    if (
      body.accountOwnerId !==
      undefined
    ) {
      if (
        body.accountOwnerId !==
          null &&
        typeof body.accountOwnerId !==
          "string"
      ) {
        return jsonError(
          "Account owner id must be text or null.",
          400,
        );
      }

      const accountOwnerId =
        typeof body.accountOwnerId ===
        "string"
          ? body.accountOwnerId.trim()
          : "";

      if (!accountOwnerId) {
        data.accountOwner = {
          disconnect: true,
        };
      } else {
        const owner =
          await prisma.adminUser.findUnique(
            {
              where: {
                id: accountOwnerId,
              },

              select: {
                id: true,
                active: true,
                role: true,
              },
            },
          );

        if (
          !owner ||
          !owner.active
        ) {
          return jsonError(
            "The selected account owner is unavailable.",
            400,
          );
        }

        if (
          ![
            "OWNER",
            "ADMIN",
            "DEVELOPER",
          ].includes(owner.role)
        ) {
          return jsonError(
            "The selected team member cannot own client relationships.",
            400,
          );
        }

        data.accountOwner = {
          connect: {
            id: owner.id,
          },
        };
      }
    }

    /* =========================================================================
       RELATIONSHIP START DATE
    ========================================================================= */

    if (
      body.relationshipStartedAt !==
      undefined
    ) {
      const value =
        nullableDate(
          body.relationshipStartedAt,
        );

      if (value === undefined) {
        return jsonError(
          "Relationship start date is invalid.",
          400,
        );
      }

      data.relationshipStartedAt =
        value;
    }

    /* =========================================================================
       LIVE DATE
    ========================================================================= */

    if (
      body.liveSince !== undefined
    ) {
      const value =
        nullableDate(
          body.liveSince,
        );

      if (value === undefined) {
        return jsonError(
          "Live date is invalid.",
          400,
        );
      }

      data.liveSince = value;
    }

    /* =========================================================================
       RENEWAL DATE
    ========================================================================= */

    if (
      body.renewalAt !== undefined
    ) {
      const value =
        nullableDate(
          body.renewalAt,
        );

      if (value === undefined) {
        return jsonError(
          "Renewal date is invalid.",
          400,
        );
      }

      data.renewalAt = value;
    }

    /* =========================================================================
       BILLING CYCLE
    ========================================================================= */

    if (
      body.billingCycle !== undefined
    ) {
      const billingCycle =
        enumValue(
          body.billingCycle,
          BILLING_CYCLES,
        );

      if (!billingCycle) {
        return jsonError(
          "Invalid billing cycle.",
          400,
        );
      }

      data.billingCycle =
        billingCycle;
    }

    /* =========================================================================
       CURRENCY
    ========================================================================= */

    if (
      body.currency !== undefined
    ) {
      const currency =
        enumValue(
          body.currency,
          CURRENCIES,
        );

      if (!currency) {
        return jsonError(
          "Invalid currency.",
          400,
        );
      }

      data.currency = currency;
    }

    /* =========================================================================
       CONTRACT VALUE
    ========================================================================= */

    if (
      body.contractValue !== undefined
    ) {
      const contractValue =
        parseMoney(
          body.contractValue,
        );

      if (
        contractValue === undefined
      ) {
        return jsonError(
          "Contract value must be zero or a positive number.",
          400,
        );
      }

      data.contractValue =
        contractValue;
    }

    /* =========================================================================
       INTEGRATION LIVE
    ========================================================================= */

    if (
      body.integrationLive !==
      undefined
    ) {
      if (
        typeof body.integrationLive !==
        "boolean"
      ) {
        return jsonError(
          "Integration live must be true or false.",
          400,
        );
      }

      data.integrationLive =
        body.integrationLive;
    }

    /* =========================================================================
       EMPTY UPDATE
    ========================================================================= */

    if (
      Object.keys(data).length === 0
    ) {
      return jsonError(
        "No valid client changes were supplied.",
        400,
      );
    }

    /* =========================================================================
       UPDATE
    ========================================================================= */

    const updated =
      await prisma.$transaction(
        async (tx) => {
          const client =
            await tx.client.update({
              where: {
                id,
              },

              data,

              select:
                clientSelect,
            });

          await tx.auditLog.create({
            data: {
              actorId:
                admin.id,

              action:
                "CLIENT_UPDATED",

              entityType:
                "CLIENT",

              entityId: id,

              metadata: {
                clientName:
                  client.name,

                previousStatus:
                  existing.status,

                currentStatus:
                  client.status,

                changedFields:
                  Object.keys(
                    data,
                  ),
              },
            },
          });

          return client;
        },
      );

    const activeProjects =
      updated.projects.filter(
        (project) =>
          project.status ===
          "ACTIVE",
      ).length;

    const integrationCount =
      updated.projects.reduce(
        (total, project) =>
          total +
          project._count
            .integrations,
        0,
      );

    const deploymentCount =
      updated.projects.reduce(
        (total, project) =>
          total +
          project._count
            .deployments,
        0,
      );

    const healthCheckCount =
      updated.projects.reduce(
        (total, project) =>
          total +
          project._count
            .healthChecks,
        0,
      );

    const incidentCount =
      updated.projects.reduce(
        (total, project) =>
          total +
          project._count
            .incidents,
        0,
      );

    const projectTicketCount =
      updated.projects.reduce(
        (total, project) =>
          total +
          project._count.tickets,
        0,
      );

    const primaryContact =
      updated.contacts.find(
        (contact) =>
          contact.primary &&
          contact.active,
      ) ??
      updated.contacts.find(
        (contact) =>
          contact.active,
      ) ??
      updated.contacts[0] ??
      null;

    const response =
      serialiseClient({
        ...updated,

        primaryContact,

        workspaceSummary: {
          contacts:
            updated._count
              .contacts,

          projects:
            updated._count
              .projects,

          activeProjects,

          tickets:
            updated._count
              .tickets,

          projectTickets:
            projectTicketCount,

          invoices:
            updated._count
              .invoices,

          integrations:
            integrationCount,

          deployments:
            deploymentCount,

          healthChecks:
            healthCheckCount,

          incidents:
            incidentCount,
        },
      });

    return NextResponse.json({
      ok: true,
      client: response,
    });
  } catch (error) {
    return handleRouteError(
      error,
      "PATCH /api/admin/clients/[id]",
    );
  }
}

/* =============================================================================
   DELETE CLIENT

   This is deliberately a SOFT DELETE.

   We archive the client instead of deleting the row so that projects,
   invoices, support history, monitoring data and audit history remain intact.
============================================================================= */

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const admin =
      await requireClientEditor();

    const { id } =
      await context.params;

    if (!id?.trim()) {
      return jsonError(
        "Client id is required.",
        400,
      );
    }

    const existing =
      await prisma.client.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          name: true,
          displayName: true,
          slug: true,
          clientRef: true,
          status: true,
        },
      });

    if (!existing) {
      return jsonError(
        "Client not found.",
        404,
      );
    }

    /*
     * Already archived = idempotent success.
     */
    if (
      existing.status ===
      "ARCHIVED"
    ) {
      return NextResponse.json({
        ok: true,
        archived: true,
        alreadyArchived: true,
        client: existing,
      });
    }

    const archived =
      await prisma.$transaction(
        async (tx) => {
          const client =
            await tx.client.update({
              where: {
                id,
              },

              data: {
                status:
                  "ARCHIVED",
              },

              select: {
                id: true,
                name: true,
                displayName: true,
                slug: true,
                clientRef: true,
                status: true,
                updatedAt: true,
              },
            });

          await tx.auditLog.create({
            data: {
              actorId:
                admin.id,

              action:
                "CLIENT_ARCHIVED",

              entityType:
                "CLIENT",

              entityId: id,

              metadata: {
                clientName:
                  existing.displayName ??
                  existing.name,

                previousStatus:
                  existing.status,
              },
            },
          });

          return client;
        },
      );

    return NextResponse.json({
      ok: true,
      archived: true,
      client: archived,
    });
  } catch (error) {
    return handleRouteError(
      error,
      "DELETE /api/admin/clients/[id]",
    );
  }
}