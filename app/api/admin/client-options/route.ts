import { NextResponse } from 'next/server';

import {
  AuthenticationError,
  AuthorisationError,
  requireAdmin,
} from '@/lib/auth/current-admin';
import { prisma } from '@/lib/prisma';

/* ============================================================================
   ERROR HANDLING
============================================================================ */

function errorResponse(error: unknown) {
  console.error('[admin/client-options]', error);

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
      error: 'Unable to load client options.',
    },
    { status: 500 },
  );
}

/* ============================================================================
   GET /api/admin/client-options

   Supplies browser-safe reference data required by the Clients UI.

   This deliberately returns only the admin fields required by the client
   assignment interface. It does not expose authentication identifiers or
   other internal AdminUser data.
============================================================================ */

export async function GET() {
  try {
    await requireAdmin();

    const accountOwners = await prisma.adminUser.findMany({
      where: {
        active: true,

        role: {
          in: ['OWNER', 'ADMIN', 'DEVELOPER'],
        },
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        role: true,
      },

      orderBy: [
        {
          firstName: 'asc',
        },
        {
          lastName: 'asc',
        },
        {
          email: 'asc',
        },
      ],
    });

    return NextResponse.json({
      ok: true,

      accountOwners,

      options: {
        statuses: [
          {
            value: 'LEAD',
            label: 'Lead',
          },
          {
            value: 'ONBOARDING',
            label: 'Onboarding',
          },
          {
            value: 'ACTIVE',
            label: 'Active',
          },
          {
            value: 'PAUSED',
            label: 'Paused',
          },
          {
            value: 'ARCHIVED',
            label: 'Archived',
          },
        ],

        priorities: [
          {
            value: 'STANDARD',
            label: 'Standard',
          },
          {
            value: 'IMPORTANT',
            label: 'Important',
          },
          {
            value: 'STRATEGIC',
            label: 'Strategic',
          },
        ],

        relationshipTypes: [
          {
            value: 'CLIENT',
            label: 'Client',
          },
          {
            value: 'PARTNER',
            label: 'Partner',
          },
          {
            value: 'STRATEGIC_PARTNER',
            label: 'Strategic partner',
          },
        ],

        contactRoles: [
          {
            value: 'GENERAL',
            label: 'General',
          },
          {
            value: 'DECISION_MAKER',
            label: 'Decision maker',
          },
          {
            value: 'EXECUTIVE',
            label: 'Executive',
          },
          {
            value: 'OPERATIONS',
            label: 'Operations',
          },
          {
            value: 'FINANCE',
            label: 'Finance',
          },
          {
            value: 'TECHNICAL',
            label: 'Technical',
          },
          {
            value: 'PRODUCT',
            label: 'Product',
          },
          {
            value: 'SUPPORT',
            label: 'Support',
          },
        ],

        billingCycles: [
          {
            value: 'MONTHLY',
            label: 'Monthly',
          },
          {
            value: 'QUARTERLY',
            label: 'Quarterly',
          },
          {
            value: 'ANNUAL',
            label: 'Annual',
          },
          {
            value: 'CUSTOM',
            label: 'Custom',
          },
        ],

        currencies: [
          {
            value: 'NGN',
            label: 'NGN',
          },
          {
            value: 'GBP',
            label: 'GBP',
          },
          {
            value: 'USD',
            label: 'USD',
          },
          {
            value: 'EUR',
            label: 'EUR',
          },
        ],
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}