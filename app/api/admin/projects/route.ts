import { NextRequest, NextResponse } from 'next/server';

import { AccessAction } from '@/app/generated/prisma/enums';
import {
  AuthenticationError,
  AuthorisationError,
  clientScopeIdFilter,
  getCurrentIdentity,
  hasPermission,
} from '@/lib/auth/current-admin';
import { prisma } from '@/lib/prisma';

/** The fine-grained permission module key for Projects — see
 *  adminNav.ts's "projects" AdminTab and SECURED_MODULE_KEYS. */
const PROJECTS_MODULE = 'projects';

/* ============================================================================
   HELPERS
============================================================================ */

function errorResponse(error: unknown) {
  console.error('[admin/projects]', error);

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
      error: 'Unable to load projects.',
    },
    { status: 500 },
  );
}

/* ============================================================================
   GET /api/admin/projects

   Originally a lightweight project lookup used by dropdowns (e.g. the
   Contracts tab's project selector, which primarily relies on the
   projects already embedded in /api/admin/clients and only falls back to
   this endpoint when that is unavailable). The `select` below was widened
   additively for ProjectsTab.tsx's own real list — existing dropdown
   consumers are unaffected since they only read the original handful of
   fields.
============================================================================ */

export async function GET(request: NextRequest) {
  try {
    const identity = await getCurrentIdentity();

    if (!identity.isFullAccess && !hasPermission(identity, PROJECTS_MODULE, AccessAction.VIEW)) {
      throw new AuthorisationError('You are not authorised to view projects.');
    }

    const { searchParams } = new URL(request.url);

    const clientId = searchParams.get('clientId')?.trim() || undefined;

    const pageSizeParam = Number(searchParams.get('pageSize'));
    const take =
      Number.isFinite(pageSizeParam) && pageSizeParam > 0
        ? Math.min(200, Math.floor(pageSizeParam))
        : 200;

    // A CLIENT-scoped restricted caller never sees another client's
    // projects, regardless of what clientId the browser requested.
    const clientIdIn = clientScopeIdFilter(identity, PROJECTS_MODULE, AccessAction.VIEW);

    const where = clientId
      ? clientIdIn && !clientIdIn.in.includes(clientId)
        ? { clientId: '__unresolvable__' }
        : { clientId }
      : clientIdIn
        ? { clientId: clientIdIn }
        : undefined;

    const projects = await prisma.project.findMany({
      where,

      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        category: true,
        clientId: true,
        productionUrl: true,
        repositoryUrl: true,
        hostingProvider: true,
        framework: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            name: true,
            displayName: true,
            logoUrl: true,
          },
        },
        _count: {
          select: {
            tickets: true,
            incidents: true,
          },
        },
      },

      orderBy: [{ name: 'asc' }],

      take,
    });

    return NextResponse.json({
      ok: true,
      projects,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
