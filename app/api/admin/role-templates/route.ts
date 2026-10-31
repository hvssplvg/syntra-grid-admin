import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { AuthenticationError, AuthorisationError, requireAdmin } from '@/lib/auth/current-admin';
import { AccessAction, AccessScope } from '@/app/generated/prisma/enums';
import { ADMIN_TABS } from '@/app/components/admin/adminNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ============================================================================
   HELPERS
============================================================================ */

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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

type GrantInput = { module: string; action: AccessAction; scope: AccessScope };

/** Mirrors app/api/admin/team/[id]/access/route.ts's parseGrants exactly
 *  — same module/action/scope validation, same "overview" exclusion —
 *  so a template can only ever offer what a manually-built grant list
 *  could already offer. */
function parseTemplateGrants(value: unknown): { ok: true; grants: GrantInput[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: 'grants must be an array.' };
  }

  const grants: GrantInput[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'Each grant must be an object.' };
    }

    const { module, action, scope } = raw as Record<string, unknown>;

    if (module === 'overview') {
      return { ok: false, error: 'The Overview module cannot be granted.' };
    }

    if (typeof module !== 'string' || !Object.prototype.hasOwnProperty.call(ADMIN_TABS, module)) {
      return { ok: false, error: `Unknown module: ${String(module)}.` };
    }

    if (typeof action !== 'string' || !Object.values(AccessAction).includes(action as AccessAction)) {
      return { ok: false, error: `Invalid action: ${String(action)}.` };
    }

    const resolvedScope =
      typeof scope === 'string' && Object.values(AccessScope).includes(scope as AccessScope)
        ? (scope as AccessScope)
        : AccessScope.ALL;

    grants.push({ module, action: action as AccessAction, scope: resolvedScope });
  }

  return { ok: true, grants };
}

function errorResponse(error: unknown) {
  console.error('[admin/role-templates]', error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
}

/* ============================================================================
   GET /api/admin/role-templates

   Lists every RoleTemplate with its grants — feeds the Team section's
   template picker (Grant/Change Dashboard Access) and the "Manage role
   templates" panel. Full-access only: template management (unlike
   holding a template) is an administrative action, same tier as
   managing the team itself.
============================================================================ */
export async function GET() {
  try {
    await requireAdmin();

    const templates = await prisma.roleTemplate.findMany({
      orderBy: { name: 'asc' },
      include: {
        grants: { orderBy: [{ module: 'asc' }, { action: 'asc' }] },
        defaultWorkspace: { select: { id: true, key: true, name: true } },
        _count: { select: { assignedUsers: true } },
      },
    });

    return NextResponse.json({ ok: true, templates });
  } catch (error) {
    return errorResponse(error);
  }
}

/* ============================================================================
   POST /api/admin/role-templates

   Creates a new reusable role template. Grants are validated the same
   way a manually-built grant list is — a template can never offer more
   than an administrator could already configure by hand.
============================================================================ */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin();

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;

    const name = cleanString(input.name);
    if (!name) {
      return NextResponse.json({ ok: false, error: 'Template name is required.' }, { status: 400 });
    }

    const key = slugify(cleanString(input.key) ?? name);
    if (!key) {
      return NextResponse.json({ ok: false, error: 'A valid template key could not be generated.' }, { status: 400 });
    }

    const description = cleanString(input.description);

    const defaultWorkspaceId = cleanString(input.defaultWorkspaceId);
    if (defaultWorkspaceId) {
      const workspaceExists = await prisma.workspace.count({ where: { id: defaultWorkspaceId } });
      if (!workspaceExists) {
        return NextResponse.json({ ok: false, error: 'The selected default workspace could not be found.' }, { status: 400 });
      }
    }

    const parsedGrants = parseTemplateGrants(input.grants);
    if (!parsedGrants.ok) {
      return NextResponse.json({ ok: false, error: parsedGrants.error }, { status: 400 });
    }

    const existing = await prisma.roleTemplate.findUnique({ where: { key }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'A role template with this name already exists.' }, { status: 409 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const template = await tx.roleTemplate.create({
        data: {
          key,
          name,
          description,
          defaultWorkspaceId,
          grants: {
            create: parsedGrants.grants.map((grant) => ({
              module: grant.module,
              action: grant.action,
              scope: grant.scope,
            })),
          },
        },
        include: { grants: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'ROLE_TEMPLATE_CREATED',
          entityType: 'RoleTemplate',
          entityId: template.id,
          metadata: { key: template.key, name: template.name, modules: parsedGrants.grants.map((g) => g.module) },
        },
      });

      return template;
    });

    return NextResponse.json({ ok: true, template: created }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
