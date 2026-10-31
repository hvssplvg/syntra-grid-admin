import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { AuthenticationError, AuthorisationError, requireAdmin } from '@/lib/auth/current-admin';
import { AccessAction, AccessScope } from '@/app/generated/prisma/enums';
import { ADMIN_TABS } from '@/app/components/admin/adminNav';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

type GrantInput = { module: string; action: AccessAction; scope: AccessScope };

/** Mirrors the sibling list route's parseTemplateGrants exactly. */
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
  console.error('[admin/role-templates/:id]', error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
}

/* ============================================================================
   GET /api/admin/role-templates/[id]
============================================================================ */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const template = await prisma.roleTemplate.findUnique({
      where: { id },
      include: { grants: { orderBy: [{ module: 'asc' }, { action: 'asc' }] } },
    });

    if (!template) {
      return NextResponse.json({ ok: false, error: 'Role template not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, template });
  } catch (error) {
    return errorResponse(error);
  }
}

/* ============================================================================
   PATCH /api/admin/role-templates/[id]

   Replaces the template's name/description/default workspace and its
   full grant list. Every AdminUser currently assigned this template
   (AdminUserRoleTemplate) keeps whatever PermissionGrant rows they
   already have — editing a template does NOT retroactively re-resolve
   and rewrite already-assigned users' grants in this pass; that re-
   application is a deliberate manual action via Change Permissions,
   consistent with "do not silently mutate an existing account's access
   as a side effect of an unrelated change."
============================================================================ */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;

    const existing = await prisma.roleTemplate.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Role template not found.' }, { status: 404 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const input = body as Record<string, unknown>;

    const name = input.name === undefined ? undefined : cleanString(input.name);
    if (input.name !== undefined && !name) {
      return NextResponse.json({ ok: false, error: 'Template name is required.' }, { status: 400 });
    }

    const description = input.description === undefined ? undefined : cleanString(input.description);

    const defaultWorkspaceId =
      input.defaultWorkspaceId === undefined ? undefined : cleanString(input.defaultWorkspaceId);

    if (defaultWorkspaceId) {
      const workspaceExists = await prisma.workspace.count({ where: { id: defaultWorkspaceId } });
      if (!workspaceExists) {
        return NextResponse.json({ ok: false, error: 'The selected default workspace could not be found.' }, { status: 400 });
      }
    }

    const parsedGrants = input.grants === undefined ? undefined : parseTemplateGrants(input.grants);
    if (parsedGrants && !parsedGrants.ok) {
      return NextResponse.json({ ok: false, error: parsedGrants.error }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const template = await tx.roleTemplate.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(defaultWorkspaceId !== undefined
            ? { defaultWorkspace: defaultWorkspaceId ? { connect: { id: defaultWorkspaceId } } : { disconnect: true } }
            : {}),
        },
      });

      if (parsedGrants && parsedGrants.ok) {
        await tx.roleTemplateGrant.deleteMany({ where: { roleTemplateId: id } });

        if (parsedGrants.grants.length > 0) {
          await tx.roleTemplateGrant.createMany({
            data: parsedGrants.grants.map((grant) => ({
              roleTemplateId: id,
              module: grant.module,
              action: grant.action,
              scope: grant.scope,
            })),
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'ROLE_TEMPLATE_UPDATED',
          entityType: 'RoleTemplate',
          entityId: template.id,
          metadata: { key: template.key, name: template.name },
        },
      });

      return tx.roleTemplate.findUniqueOrThrow({
        where: { id },
        include: { grants: { orderBy: [{ module: 'asc' }, { action: 'asc' }] } },
      });
    });

    return NextResponse.json({ ok: true, template: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

/* ============================================================================
   DELETE /api/admin/role-templates/[id]

   Deletes the template itself (RoleTemplateGrant rows cascade). Does NOT
   touch any AdminUser currently assigned it — their AdminUserRoleTemplate
   row is removed (FK cascade) but their PermissionGrant rows are left
   exactly as they are, for the same "never silently mutate an existing
   account" reason as PATCH above.
============================================================================ */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireAdmin();
    const { id } = await context.params;

    const existing = await prisma.roleTemplate.findUnique({ where: { id }, select: { id: true, key: true, name: true } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Role template not found.' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.roleTemplate.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'ROLE_TEMPLATE_DELETED',
          entityType: 'RoleTemplate',
          entityId: id,
          metadata: { key: existing.key, name: existing.name },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
