import { NextRequest, NextResponse } from 'next/server';

import {
  AuthenticationError,
  AuthorisationError,
  requireAdmin,
} from '@/lib/auth/current-admin';
import { prisma } from '@/lib/prisma';

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
    await requireAdmin();

    const { searchParams } = new URL(request.url);

    const clientId = searchParams.get('clientId')?.trim() || undefined;

    const pageSizeParam = Number(searchParams.get('pageSize'));
    const take =
      Number.isFinite(pageSizeParam) && pageSizeParam > 0
        ? Math.min(200, Math.floor(pageSizeParam))
        : 200;

    const projects = await prisma.project.findMany({
      where: clientId ? { clientId } : undefined,

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
