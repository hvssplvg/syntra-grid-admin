import { NextRequest, NextResponse } from 'next/server';

import {
  AuthenticationError,
  AuthorisationError,
  requireAdmin,
  requireClientEditor,
} from '@/lib/auth/current-admin';
import { prisma } from '@/lib/prisma';

/* ============================================================================
   HELPERS
============================================================================ */

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const cleaned = value.trim();

  return cleaned.length ? cleaned : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;

  const date = new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMoney(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) return 0;

  return parsed;
}

function errorResponse(error: unknown) {
  console.error('[admin/clients]', error);

  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 401 },
    );
  }

  if (error instanceof AuthorisationError) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
      },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'Something went wrong while processing the client request.',
    },
    { status: 500 },
  );
}

/* ============================================================================
   GET /api/admin/clients
============================================================================ */

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);

    const search = cleanString(searchParams.get('search'));
    const status = cleanString(searchParams.get('status'));
    const priority = cleanString(searchParams.get('priority'));

    const clients = await prisma.client.findMany({
      where: {
        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  displayName: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  industry: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  country: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  clientRef: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),

        ...(status &&
        ['LEAD', 'ONBOARDING', 'ACTIVE', 'PAUSED', 'ARCHIVED'].includes(status)
          ? {
              status: status as
                | 'LEAD'
                | 'ONBOARDING'
                | 'ACTIVE'
                | 'PAUSED'
                | 'ARCHIVED',
            }
          : {}),

        ...(priority &&
        ['STANDARD', 'IMPORTANT', 'STRATEGIC'].includes(priority)
          ? {
              priority: priority as
                | 'STANDARD'
                | 'IMPORTANT'
                | 'STRATEGIC',
            }
          : {}),
      },

      select: {
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

        createdAt: true,
        updatedAt: true,

        accountOwner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },

        contacts: {
          where: {
            active: true,
          },
          orderBy: [
            {
              primary: 'desc',
            },
            {
              createdAt: 'asc',
            },
          ],
          take: 3,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            email: true,
            phone: true,
            role: true,
            primary: true,
          },
        },

        projects: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            category: true,
          },
          orderBy: {
            createdAt: 'desc',
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
      },

      orderBy: [
        {
          status: 'asc',
        },
        {
          name: 'asc',
        },
      ],
    });

    const clientIds = clients.map((client) => client.id);

    const openTicketCounts =
      clientIds.length > 0
        ? await prisma.supportTicket.groupBy({
            by: ['clientId'],
            where: {
              clientId: {
                in: clientIds,
              },
              status: {
                in: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_CLIENT'],
              },
            },
            _count: {
              _all: true,
            },
          })
        : [];

    const openTicketsByClient = new Map(
      openTicketCounts.map((item) => [item.clientId, item._count._all]),
    );

    const data = clients.map((client) => ({
      ...client,

      contractValue: client.contractValue.toString(),

      openSupportCount: openTicketsByClient.get(client.id) ?? 0,
    }));

    return NextResponse.json({
      ok: true,
      clients: data,
      meta: {
        total: data.length,
        active: data.filter((client) => client.status === 'ACTIVE').length,
        onboarding: data.filter((client) => client.status === 'ONBOARDING')
          .length,
        archived: data.filter((client) => client.status === 'ARCHIVED').length,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/* ============================================================================
   POST /api/admin/clients
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const admin = await requireClientEditor();

    const body = await request.json();

    const name = cleanString(body.name);

    if (!name) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Client name is required.',
        },
        { status: 400 },
      );
    }

    const slug = slugify(cleanString(body.slug) ?? name);

    if (!slug) {
      return NextResponse.json(
        {
          ok: false,
          error: 'A valid client slug could not be generated.',
        },
        { status: 400 },
      );
    }

    const existing = await prisma.client.findUnique({
      where: {
        slug,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          error: 'A client with this name or slug already exists.',
        },
        { status: 409 },
      );
    }

    const clientRef = cleanString(body.clientRef);

    if (clientRef) {
      const existingReference = await prisma.client.findUnique({
        where: {
          clientRef,
        },
        select: {
          id: true,
        },
      });

      if (existingReference) {
        return NextResponse.json(
          {
            ok: false,
            error: 'This client reference is already in use.',
          },
          { status: 409 },
        );
      }
    }

    const accountOwnerId =
      cleanString(body.accountOwnerId) ?? admin.id;

    const accountOwner = await prisma.adminUser.findFirst({
      where: {
        id: accountOwnerId,
        active: true,
      },
      select: {
        id: true,
      },
    });

    if (!accountOwner) {
      return NextResponse.json(
        {
          ok: false,
          error: 'The selected account owner does not exist or is inactive.',
        },
        { status: 400 },
      );
    }

    const allowedStatuses = [
      'LEAD',
      'ONBOARDING',
      'ACTIVE',
      'PAUSED',
      'ARCHIVED',
    ] as const;

    const allowedPriorities = [
      'STANDARD',
      'IMPORTANT',
      'STRATEGIC',
    ] as const;

    const allowedRelationshipTypes = [
      'CLIENT',
      'PARTNER',
      'STRATEGIC_PARTNER',
    ] as const;

    const allowedBillingCycles = [
      'MONTHLY',
      'QUARTERLY',
      'ANNUAL',
      'CUSTOM',
    ] as const;

    const allowedCurrencies = ['NGN', 'GBP', 'USD', 'EUR'] as const;

    const status = allowedStatuses.includes(body.status)
      ? body.status
      : 'ONBOARDING';

    const priority = allowedPriorities.includes(body.priority)
      ? body.priority
      : 'STANDARD';

    const relationshipType = allowedRelationshipTypes.includes(
      body.relationshipType,
    )
      ? body.relationshipType
      : 'CLIENT';

    const billingCycle = allowedBillingCycles.includes(body.billingCycle)
      ? body.billingCycle
      : 'ANNUAL';

    const currency = allowedCurrencies.includes(body.currency)
      ? body.currency
      : 'NGN';

    const contact = body.primaryContact;

    const created = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name,
          displayName: cleanString(body.displayName),

          slug,
          clientRef,

          description: cleanString(body.description),

          industry: cleanString(body.industry),
          country: cleanString(body.country),
          city: cleanString(body.city),

          logoUrl: cleanString(body.logoUrl),
          websiteUrl: cleanString(body.websiteUrl),

          status,
          priority,
          relationshipType,

          accountOwnerId,

          relationshipStartedAt: parseDate(body.relationshipStartedAt),
          liveSince: parseDate(body.liveSince),

          notes: cleanString(body.notes),

          domain: cleanString(body.domain),
          adminUrl: cleanString(body.adminUrl),

          productName: cleanString(body.productName),
          plan: cleanString(body.plan),

          billingCycle,
          contractValue: parseMoney(body.contractValue),
          currency,

          renewalAt: parseDate(body.renewalAt),

          integrationKey: cleanString(body.integrationKey),
          integrationLive: body.integrationLive === true,

          ...(contact &&
          cleanString(contact.firstName) &&
          cleanString(contact.lastName)
            ? {
                contacts: {
                  create: {
                    firstName: cleanString(contact.firstName)!,
                    lastName: cleanString(contact.lastName)!,
                    jobTitle: cleanString(contact.jobTitle),
                    email: cleanString(contact.email)?.toLowerCase() ?? null,
                    phone: cleanString(contact.phone),

                    role: [
                      'GENERAL',
                      'DECISION_MAKER',
                      'EXECUTIVE',
                      'OPERATIONS',
                      'FINANCE',
                      'TECHNICAL',
                      'PRODUCT',
                      'SUPPORT',
                    ].includes(contact.role)
                      ? contact.role
                      : 'GENERAL',

                    primary: true,
                    active: true,

                    notes: cleanString(contact.notes),
                  },
                },
              }
            : {}),
        },

        include: {
          accountOwner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },

          contacts: true,

          _count: {
            select: {
              contacts: true,
              projects: true,
              tickets: true,
              invoices: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,

          action: 'CLIENT_CREATED',

          entityType: 'Client',
          entityId: client.id,

          clientId: client.id,

          metadata: {
            name: client.name,
            slug: client.slug,
            status: client.status,
            priority: client.priority,
            relationshipType: client.relationshipType,
          },
        },
      });

      return client;
    });

    return NextResponse.json(
      {
        ok: true,
        client: {
          ...created,
          contractValue: created.contractValue.toString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}