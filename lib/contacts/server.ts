import {
  ClientContactRole,
  type AdminUser,
  type Prisma,
} from "@/app/generated/prisma/client";
import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";

import {
  AuthorisationError,
  assertClientRowAccess,
  clientScopeIdFilter,
  getCurrentIdentity,
  hasPermission,
  type ResolvedIdentity,
} from "@/lib/auth/current-admin";

import { prisma } from "@/lib/prisma";

/* =============================================================================
 * TYPES
 * =============================================================================
 */

/** The fine-grained permission module key for Contacts — see
 *  adminNav.ts's "contacts" AdminTab and SECURED_MODULE_KEYS. */
export const CONTACTS_MODULE = "contacts";

export type ContactIdentity = {
  admin: AdminUser;
  canManageContacts: boolean;
  resolved: ResolvedIdentity;
};

export type ContactClientDTO = {
  id: string;

  name: string;
  displayName: string | null;
  clientRef: string | null;

  logoUrl: string | null;

  status: string;
  priority: string;
  relationshipType: string;
};

export type ContactDTO = {
  id: string;

  clientId: string;
  client: ContactClientDTO;

  firstName: string;
  lastName: string;
  name: string;

  jobTitle: string | null;

  email: string | null;
  phone: string | null;

  role: string;

  primary: boolean;
  active: boolean;

  notes: string | null;

  permissions: {
    canEdit: boolean;
    canDelete: boolean;
  };

  createdAt: string;
  updatedAt: string;
};

export type ContactSummaryDTO = {
  total: number;
  active: number;
  inactive: number;
  primary: number;

  clientCount: number;

  decisionMakers: number;
  executives: number;
  finance: number;
  technical: number;
  support: number;
};

export type ContactFeedDTO = {
  summary: ContactSummaryDTO;
  contacts: ContactDTO[];

  permissions: {
    canCreate: boolean;
  };
};

/* =============================================================================
 * PRISMA PAYLOAD
 * =============================================================================
 */

const contactInclude = {
  client: {
    select: {
      id: true,

      name: true,
      displayName: true,
      clientRef: true,

      logoUrl: true,

      status: true,
      priority: true,
      relationshipType: true,
    },
  },
} satisfies Prisma.ClientContactInclude;

export type ContactWithRelations =
  Prisma.ClientContactGetPayload<{
    include: typeof contactInclude;
  }>;

/* =============================================================================
 * IDENTITY / PERMISSIONS
 * =============================================================================
 */

/**
 * Full-access behaviour is unchanged (OWNER/ADMIN/DEVELOPER may manage,
 * every other role is view-only). A restricted account is admitted only
 * once it holds at least VIEW on CONTACTS_MODULE (fail-closed by
 * default, matching requireAdmin's own convention) — its canManageContacts
 * then comes from an EDIT grant rather than AdminRole, since a
 * restricted account's role field doesn't carry management intent.
 */
export async function requireContactIdentity(): Promise<ContactIdentity> {
  const resolved = await getCurrentIdentity();

  if (!resolved.isFullAccess && !hasPermission(resolved, CONTACTS_MODULE, AccessAction.VIEW)) {
    throw new AuthorisationError("You are not authorised to view contacts.");
  }

  const canManageContacts = resolved.isFullAccess
    ? resolved.admin.role === "OWNER" ||
      resolved.admin.role === "ADMIN" ||
      resolved.admin.role === "DEVELOPER"
    : hasPermission(resolved, CONTACTS_MODULE, AccessAction.EDIT);

  return {
    admin: resolved.admin,
    canManageContacts,
    resolved,
  };
}

function hasContactAction(identity: ContactIdentity, action: AccessAction): boolean {
  if (identity.resolved.isFullAccess) {
    return action === AccessAction.VIEW ? true : identity.canManageContacts;
  }

  return hasPermission(identity.resolved, CONTACTS_MODULE, action);
}

function assertContactAction(identity: ContactIdentity, action: AccessAction) {
  if (!hasContactAction(identity, action)) {
    throw new AuthorisationError(
      "You do not have permission to manage client contacts.",
    );
  }
}

export function assertCanManageContacts(
  identity: ContactIdentity,
) {
  assertContactAction(identity, AccessAction.EDIT);
}

/** The `{ in: [...] }` client-id condition for a CLIENT-scoped
 *  restricted caller's list query, or undefined when no narrowing
 *  applies. */
function contactClientIdFilter(identity: ContactIdentity, action: AccessAction) {
  return clientScopeIdFilter(identity.resolved, CONTACTS_MODULE, action);
}

/** Throws unless the identity may `action` this specific contact's
 *  record — module-level first, then (for a CLIENT-scoped restricted
 *  caller) the contact's own client against their ClientAssignment
 *  rows. Never trust the contact id alone. */
export function assertContactRowAccess(
  identity: ContactIdentity,
  action: AccessAction,
  row: { clientId: string },
) {
  assertContactAction(identity, action);
  assertClientRowAccess(identity.resolved, CONTACTS_MODULE, action, row);
}

/** True unless the identity is a CLIENT-scoped restricted caller whose
 *  assigned clients don't include this specific client — used by the
 *  DTO's per-row permission flags, which must never claim an action is
 *  available when assertContactRowAccess would actually reject it. */
function rowClientScopeOk(identity: ContactIdentity, action: AccessAction, clientId: string): boolean {
  if (identity.resolved.isFullAccess) return true;

  const grantedScope = identity.resolved.permissions.get(CONTACTS_MODULE)?.get(action);
  if (grantedScope !== AccessScope.CLIENT) return true;

  return identity.resolved.assignedClientIds.includes(clientId);
}

/* =============================================================================
 * GET CONTACT
 * =============================================================================
 */

export async function getContactById(
  id: string,
) {
  return prisma.clientContact.findUnique({
    where: {
      id,
    },

    include:
      contactInclude,
  });
}

export async function requireContact(
  id: string,
) {
  const contact =
    await getContactById(
      id,
    );

  if (!contact) {
    throw new Error(
      "Contact not found.",
    );
  }

  return contact;
}

/* =============================================================================
 * CLIENT VALIDATION
 * =============================================================================
 */

export async function requireContactClient(
  clientId: string,
) {
  const client =
    await prisma.client.findUnique({
      where: {
        id: clientId,
      },

      select: {
        id: true,
        name: true,
        displayName: true,
        status: true,
      },
    });

  if (!client) {
    throw new Error(
      "The selected client does not exist.",
    );
  }

  return client;
}

/* =============================================================================
 * FEED
 * =============================================================================
 */

export async function getContactFeed({
  identity,
  query,
  clientId,
  role,
  active,
  primary,
}: {
  identity: ContactIdentity;

  query?: string | null;
  clientId?: string | null;

  role?: ClientContactRole | null;

  active?: boolean | null;
  primary?: boolean | null;
}): Promise<ContactFeedDTO> {
  const where: Prisma.ClientContactWhereInput =
    {};

  const search =
    cleanNullableText(
      query,
    );

  if (search) {
    where.OR = [
      {
        firstName: {
          contains: search,
          mode: "insensitive",
        },
      },

      {
        lastName: {
          contains: search,
          mode: "insensitive",
        },
      },

      {
        jobTitle: {
          contains: search,
          mode: "insensitive",
        },
      },

      {
        email: {
          contains: search,
          mode: "insensitive",
        },
      },

      {
        phone: {
          contains: search,
          mode: "insensitive",
        },
      },

      {
        client: {
          is: {
            OR: [
              {
                name: {
                  contains:
                    search,

                  mode:
                    "insensitive",
                },
              },

              {
                displayName: {
                  contains:
                    search,

                  mode:
                    "insensitive",
                },
              },

              {
                clientRef: {
                  contains:
                    search,

                  mode:
                    "insensitive",
                },
              },
            ],
          },
        },
      },
    ];
  }

  if (clientId) {
    where.clientId =
      clientId;
  }

  // A CLIENT-scoped restricted caller never sees another client's
  // contacts, regardless of what clientId the browser requested.
  const clientIdIn = contactClientIdFilter(identity, AccessAction.VIEW);

  if (clientIdIn) {
    if (clientId) {
      if (!clientIdIn.in.includes(clientId)) {
        where.clientId = "__unresolvable__";
      }
    } else {
      where.clientId = clientIdIn;
    }
  }

  if (role) {
    where.role =
      role;
  }

  if (
    active !== null &&
    active !== undefined
  ) {
    where.active =
      active;
  }

  if (
    primary !== null &&
    primary !== undefined
  ) {
    where.primary =
      primary;
  }

  const contacts =
    await prisma.clientContact.findMany({
      where,

      include:
        contactInclude,

      orderBy: [
        {
          active:
            "desc",
        },
        {
          primary:
            "desc",
        },
        {
          firstName:
            "asc",
        },
        {
          lastName:
            "asc",
        },
      ],
    });

  const dtos =
    contacts.map(
      (contact) =>
        contactDTO(
          contact,
          identity,
        ),
    );

  return {
    summary:
      buildContactSummary(
        dtos,
      ),

    contacts:
      dtos,

    permissions: {
      canCreate:
        identity.canManageContacts,
    },
  };
}

/* =============================================================================
 * CREATE CONTACT
 * =============================================================================
 */

export async function createContact({
  identity,
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
}: {
  identity: ContactIdentity;

  clientId: string;

  firstName: string;
  lastName: string;

  jobTitle?: string | null;

  email?: string | null;
  phone?: string | null;

  role: ClientContactRole;

  primary?: boolean;
  active?: boolean;

  notes?: string | null;
}) {
  assertContactAction(
    identity,
    AccessAction.CREATE,
  );

  const resolvedClientId =
    requiredText(
      clientId,
      "Client",
    );

  await requireContactClient(
    resolvedClientId,
  );

  if (
    !identity.resolved.isFullAccess &&
    identity.resolved.permissions.get(CONTACTS_MODULE)?.get(AccessAction.CREATE) === AccessScope.CLIENT &&
    !identity.resolved.assignedClientIds.includes(resolvedClientId)
  ) {
    throw new AuthorisationError(
      "You can only create contacts for your assigned clients.",
    );
  }

  const resolvedFirstName =
    requiredText(
      firstName,
      "First name",
    );

  const resolvedLastName =
    requiredText(
      lastName,
      "Last name",
    );

  const resolvedPrimary =
    primary ?? false;

  const resolvedActive =
    active ?? true;

  const resolvedEmail =
    cleanNullableText(
      email,
    );

  if (resolvedEmail) {
    validateEmail(
      resolvedEmail,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      /*
       * A client should only have one primary contact.
       * If the new contact is primary, remove the primary
       * flag from every existing contact for that client.
       */
      if (resolvedPrimary) {
        await tx.clientContact.updateMany({
          where: {
            clientId:
              resolvedClientId,

            primary:
              true,
          },

          data: {
            primary:
              false,
          },
        });
      }

      const contact =
        await tx.clientContact.create({
          data: {
            clientId:
              resolvedClientId,

            firstName:
              resolvedFirstName,

            lastName:
              resolvedLastName,

            jobTitle:
              cleanNullableText(
                jobTitle,
              ),

            email:
              resolvedEmail,

            phone:
              cleanNullableText(
                phone,
              ),

            role,

            primary:
              resolvedPrimary,

            active:
              resolvedActive,

            notes:
              cleanNullableText(
                notes,
              ),
          },

          select: {
            id: true,
          },
        });

      return tx.clientContact.findUniqueOrThrow({
        where: {
          id:
            contact.id,
        },

        include:
          contactInclude,
      });
    },
  );
}

/* =============================================================================
 * UPDATE CONTACT
 * =============================================================================
 */

export async function updateContact({
  identity,
  contactId,
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
}: {
  identity: ContactIdentity;

  contactId: string;

  clientId: string;

  firstName: string;
  lastName: string;

  jobTitle?: string | null;

  email?: string | null;
  phone?: string | null;

  role: ClientContactRole;

  primary: boolean;
  active: boolean;

  notes?: string | null;
}) {
  const existing =
    await requireContact(
      contactId,
    );

  assertContactRowAccess(
    identity,
    AccessAction.EDIT,
    existing,
  );

  const resolvedClientId =
    requiredText(
      clientId,
      "Client",
    );

  await requireContactClient(
    resolvedClientId,
  );

  // Moving a contact to a different client is itself subject to the
  // same CLIENT-scope check as creating one there in the first place.
  if (
    !identity.resolved.isFullAccess &&
    identity.resolved.permissions.get(CONTACTS_MODULE)?.get(AccessAction.EDIT) === AccessScope.CLIENT &&
    !identity.resolved.assignedClientIds.includes(resolvedClientId)
  ) {
    throw new AuthorisationError(
      "You can only move contacts to your assigned clients.",
    );
  }

  const resolvedEmail =
    cleanNullableText(
      email,
    );

  if (resolvedEmail) {
    validateEmail(
      resolvedEmail,
    );
  }

  return prisma.$transaction(
    async (tx) => {
      if (primary) {
        await tx.clientContact.updateMany({
          where: {
            clientId:
              resolvedClientId,

            primary:
              true,

            id: {
              not:
                existing.id,
            },
          },

          data: {
            primary:
              false,
          },
        });
      }

      const contact =
        await tx.clientContact.update({
          where: {
            id:
              existing.id,
          },

          data: {
            clientId:
              resolvedClientId,

            firstName:
              requiredText(
                firstName,
                "First name",
              ),

            lastName:
              requiredText(
                lastName,
                "Last name",
              ),

            jobTitle:
              cleanNullableText(
                jobTitle,
              ),

            email:
              resolvedEmail,

            phone:
              cleanNullableText(
                phone,
              ),

            role,

            primary,

            active,

            notes:
              cleanNullableText(
                notes,
              ),
          },

          select: {
            id: true,
          },
        });

      return tx.clientContact.findUniqueOrThrow({
        where: {
          id:
            contact.id,
        },

        include:
          contactInclude,
      });
    },
  );
}

/* =============================================================================
 * DELETE CONTACT
 * =============================================================================
 */

export async function deleteContact({
  identity,
  contactId,
}: {
  identity: ContactIdentity;
  contactId: string;
}) {
  const contact =
    await requireContact(
      contactId,
    );

  assertContactRowAccess(
    identity,
    AccessAction.DELETE,
    contact,
  );

  await prisma.clientContact.delete({
    where: {
      id:
        contact.id,
    },
  });

  return {
    id:
      contact.id,
  };
}

/* =============================================================================
 * SERIALISATION
 * =============================================================================
 */

export function contactDTO(
  contact: ContactWithRelations,
  identity: ContactIdentity,
): ContactDTO {
  const name =
    [
      contact.firstName,
      contact.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

  return {
    id:
      contact.id,

    clientId:
      contact.clientId,

    client: {
      id:
        contact.client.id,

      name:
        contact.client.name,

      displayName:
        contact.client.displayName,

      clientRef:
        contact.client.clientRef,

      logoUrl:
        contact.client.logoUrl,

      status:
        contact.client.status,

      priority:
        contact.client.priority,

      relationshipType:
        contact.client.relationshipType,
    },

    firstName:
      contact.firstName,

    lastName:
      contact.lastName,

    name,

    jobTitle:
      contact.jobTitle,

    email:
      contact.email,

    phone:
      contact.phone,

    role:
      contact.role,

    primary:
      contact.primary,

    active:
      contact.active,

    notes:
      contact.notes,

    permissions: {
      canEdit:
        hasContactAction(identity, AccessAction.EDIT) &&
        rowClientScopeOk(identity, AccessAction.EDIT, contact.clientId),

      canDelete:
        hasContactAction(identity, AccessAction.DELETE) &&
        rowClientScopeOk(identity, AccessAction.DELETE, contact.clientId),
    },

    createdAt:
      contact.createdAt.toISOString(),

    updatedAt:
      contact.updatedAt.toISOString(),
  };
}

/* =============================================================================
 * SUMMARY
 * =============================================================================
 */

function buildContactSummary(
  contacts: ContactDTO[],
): ContactSummaryDTO {
  let active = 0;
  let inactive = 0;
  let primary = 0;

  let decisionMakers = 0;
  let executives = 0;
  let finance = 0;
  let technical = 0;
  let support = 0;

  const clientIds =
    new Set<string>();

  for (
    const contact of contacts
  ) {
    clientIds.add(
      contact.clientId,
    );

    if (contact.active) {
      active += 1;
    } else {
      inactive += 1;
    }

    if (contact.primary) {
      primary += 1;
    }

    switch (
      contact.role
    ) {
      case ClientContactRole.DECISION_MAKER:
        decisionMakers += 1;
        break;

      case ClientContactRole.EXECUTIVE:
        executives += 1;
        break;

      case ClientContactRole.FINANCE:
        finance += 1;
        break;

      case ClientContactRole.TECHNICAL:
        technical += 1;
        break;

      case ClientContactRole.SUPPORT:
        support += 1;
        break;
    }
  }

  return {
    total:
      contacts.length,

    active,
    inactive,
    primary,

    clientCount:
      clientIds.size,

    decisionMakers,
    executives,
    finance,
    technical,
    support,
  };
}

/* =============================================================================
 * ENUM VALIDATION
 * =============================================================================
 */

export function parseContactRole(
  value: unknown,
): ClientContactRole {
  if (
    typeof value !==
      "string" ||
    !Object.values(
      ClientContactRole,
    ).includes(
      value as ClientContactRole,
    )
  ) {
    throw new Error(
      "Invalid contact role.",
    );
  }

  return value as ClientContactRole;
}

export function parseOptionalContactRole(
  value: string | null,
): ClientContactRole | null {
  if (!value) {
    return null;
  }

  return parseContactRole(
    value,
  );
}

/* =============================================================================
 * GENERIC VALIDATION
 * =============================================================================
 */

export function requiredText(
  value: unknown,
  label: string,
) {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
    throw new Error(
      `${label} is required.`,
    );
  }

  return value.trim();
}

export function optionalBoolean(
  value: unknown,
  fallback: boolean,
) {
  if (
    value === undefined
  ) {
    return fallback;
  }

  if (
    typeof value !==
    "boolean"
  ) {
    throw new Error(
      "Expected a true or false value.",
    );
  }

  return value;
}

export function parseOptionalBooleanQuery(
  value: string | null,
  label = "Value",
): boolean | null {
  if (
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (
    value === "true"
  ) {
    return true;
  }

  if (
    value === "false"
  ) {
    return false;
  }

  throw new Error(
    `${label} must be true or false.`,
  );
}

export function validateEmail(
  email: string,
) {
  const normalised =
    email.trim();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalised,
    )
  ) {
    throw new Error(
      "Enter a valid email address.",
    );
  }

  return normalised;
}

/* =============================================================================
 * API ERROR
 * =============================================================================
 */

export function contactApiError(
  error: unknown,
): {
  status: number;
  message: string;
} {
  if (
    error instanceof
    AuthorisationError
  ) {
    return {
      status: 403,

      message:
        error.message ||
        "You do not have permission to perform this action.",
    };
  }

  if (
    error instanceof Error
  ) {
    return {
      status: 400,

      message:
        error.message ||
        "Unable to process the contact request.",
    };
  }

  return {
    status: 500,

    message:
      "An unexpected contacts error occurred.",
  };
}

/* =============================================================================
 * INTERNAL HELPERS
 * =============================================================================
 */

function cleanNullableText(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return null;
  }

  return (
    value.trim() ||
    null
  );
}