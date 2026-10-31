import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  AuthenticationError,
  AuthorisationError,
  requireTeamManager,
} from '@/lib/auth/current-admin';
import {
  assertNotLastOwner,
  generateInviteToken,
  hashInviteToken,
  INVITE_TOKEN_TTL_MS,
  reconcileClientAssignments,
  reconcileRoleTemplateAssignments,
} from '@/lib/access/server';
import { ADMIN_TABS } from '@/app/components/admin/adminNav';
import { AccessAction, AccessScope } from '@/app/generated/prisma/enums';
import { EmployeeStatus } from '@/app/generated/prisma/enums';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GrantInput = {
  module: string;
  action: AccessAction;
  scope?: AccessScope;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getErrorStatus(error: unknown): number {
  if (error instanceof AuthenticationError) return 401;
  if (error instanceof AuthorisationError) return 403;
  return 500;
}

/**
 * Validates and normalises the submitted grant list. The frontend always
 * sends a fully-resolved list (whether it started from a role template or
 * the advanced matrix) — this route never looks up a template by id, so the
 * set of templates can change freely without touching this file.
 */
function parseGrants(
  value: unknown,
): { ok: true; grants: GrantInput[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: 'grants must be an array.' };
  }

  const grants: GrantInput[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'Each grant must be an object.' };
    }

    const { module, action, scope } = raw as Record<string, unknown>;

    // The Owner's Overview is never grantable, even via a direct API
    // call that bypasses the picker — see adminNav.ts's
    // getGrantableTabs/filterSectionsByPermission for the same rule on
    // the read/nav side.
    if (module === 'overview') {
      return {
        ok: false,
        error: 'The Overview module cannot be granted.',
      };
    }

    if (
      typeof module !== 'string' ||
      !Object.prototype.hasOwnProperty.call(ADMIN_TABS, module)
    ) {
      return { ok: false, error: `Unknown module: ${String(module)}.` };
    }

    if (
      typeof action !== 'string' ||
      !Object.values(AccessAction).includes(action as AccessAction)
    ) {
      return { ok: false, error: `Invalid action: ${String(action)}.` };
    }

    const resolvedScope =
      typeof scope === 'string' &&
      Object.values(AccessScope).includes(scope as AccessScope)
        ? (scope as AccessScope)
        : AccessScope.ALL;

    grants.push({ module, action: action as AccessAction, scope: resolvedScope });
  }

  return { ok: true, grants };
}

/** Optional string array fields (roleTemplateIds, clientIds) — absent
 *  means "leave unchanged" (PATCH) or "none" (POST); an empty array
 *  explicitly clears them. Only the shape is validated here; existence
 *  in the database is checked by the caller against the actual ids. */
function parseOptionalIdList(value: unknown, label: string): { ok: true; ids: string[] | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, ids: undefined };
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return { ok: false, error: `${label} must be an array of ids.` };
  }

  return { ok: true, ids: Array.from(new Set(value)) };
}

function parseOptionalNullableId(value: unknown, label: string): { ok: true; id: string | null | undefined } | { ok: false; error: string } {
  if (value === undefined) return { ok: true, id: undefined };
  if (value === null) return { ok: true, id: null };
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, error: `${label} must be a non-empty string or null.` };
  }

  return { ok: true, id: value.trim() };
}

async function roleTemplatesExist(roleTemplateIds: string[]): Promise<boolean> {
  if (roleTemplateIds.length === 0) return true;

  const found = await prisma.roleTemplate.count({ where: { id: { in: roleTemplateIds } } });
  return found === roleTemplateIds.length;
}

async function clientsExist(clientIds: string[]): Promise<boolean> {
  if (clientIds.length === 0) return true;

  const found = await prisma.client.count({ where: { id: { in: clientIds } } });
  return found === clientIds.length;
}

/* ============================================================================
   POST /api/admin/team/[id]/access — Grant Dashboard Access
============================================================================ */

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireTeamManager();
    const { id } = await context.params;

    const body: unknown = await request.json();

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request body.' },
        { status: 400 },
      );
    }

    const input = body as Record<string, unknown>;
    const parsedGrants = parseGrants(input.grants);

    if (!parsedGrants.ok) {
      return NextResponse.json({ ok: false, error: parsedGrants.error }, { status: 400 });
    }

    const parsedRoleTemplateIds = parseOptionalIdList(input.roleTemplateIds, 'roleTemplateIds');
    if (!parsedRoleTemplateIds.ok) {
      return NextResponse.json({ ok: false, error: parsedRoleTemplateIds.error }, { status: 400 });
    }

    const parsedClientIds = parseOptionalIdList(input.clientIds, 'clientIds');
    if (!parsedClientIds.ok) {
      return NextResponse.json({ ok: false, error: parsedClientIds.error }, { status: 400 });
    }

    const parsedDefaultWorkspaceId = parseOptionalNullableId(input.defaultWorkspaceId, 'defaultWorkspaceId');
    if (!parsedDefaultWorkspaceId.ok) {
      return NextResponse.json({ ok: false, error: parsedDefaultWorkspaceId.error }, { status: 400 });
    }

    const parsedDefaultClientId = parseOptionalNullableId(input.defaultClientId, 'defaultClientId');
    if (!parsedDefaultClientId.ok) {
      return NextResponse.json({ ok: false, error: parsedDefaultClientId.error }, { status: 400 });
    }

    // Validated before any write happens below, so a bad id never leaves
    // the PermissionGrant/Employee-link writes committed with no matching
    // role-template/client reconciliation.
    if (parsedRoleTemplateIds.ids !== undefined && !(await roleTemplatesExist(parsedRoleTemplateIds.ids))) {
      return NextResponse.json({ ok: false, error: 'One or more selected role templates could not be found.' }, { status: 400 });
    }

    if (parsedClientIds.ids !== undefined && !(await clientsExist(parsedClientIds.ids))) {
      return NextResponse.json({ ok: false, error: 'One or more selected clients could not be found.' }, { status: 400 });
    }

    if (parsedDefaultWorkspaceId.id) {
      const workspaceExists = await prisma.workspace.count({ where: { id: parsedDefaultWorkspaceId.id } });
      if (!workspaceExists) {
        return NextResponse.json({ ok: false, error: 'The selected default workspace could not be found.' }, { status: 400 });
      }
    }

    if (parsedDefaultClientId.id) {
      const clientExists = await prisma.client.count({ where: { id: parsedDefaultClientId.id } });
      if (!clientExists) {
        return NextResponse.json({ ok: false, error: 'The selected default client could not be found.' }, { status: 400 });
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        workEmail: true,
        status: true,
        adminUserId: true,
      },
    });

    if (!employee) {
      return NextResponse.json({ ok: false, error: 'Employee not found.' }, { status: 404 });
    }

    if (employee.status === EmployeeStatus.FORMER) {
      return NextResponse.json(
        { ok: false, error: 'This employee has been offboarded. Re-onboard them before granting dashboard access.' },
        { status: 409 },
      );
    }

    if (!employee.workEmail) {
      return NextResponse.json(
        { ok: false, error: 'Set a work email for this employee before granting dashboard access.' },
        { status: 400 },
      );
    }

    if (employee.adminUserId) {
      return NextResponse.json(
        { ok: false, error: 'This employee already has dashboard access. Use Change Permissions instead.' },
        { status: 409 },
      );
    }

    const existingAdminUser = await prisma.adminUser.findUnique({
      where: { email: employee.workEmail },
      select: {
        id: true,
        active: true,
        restrictedAccess: true,
        authUserId: true,
        employee: { select: { id: true } },
      },
    });

    let adminUserId: string;
    let requiresClaim: boolean;

    if (!existingAdminUser) {
      // No AdminUser at this email at all — create a brand new restricted one.
      const created = await prisma.adminUser.create({
        data: {
          email: employee.workEmail,
          firstName: employee.firstName,
          lastName: employee.lastName,
          role: 'VIEWER',
          active: true,
          restrictedAccess: true,
        },
      });

      adminUserId = created.id;
      requiresClaim = true;
    } else if (existingAdminUser.employee && existingAdminUser.employee.id !== id) {
      return NextResponse.json(
        { ok: false, error: 'This email is already linked to another employee\'s dashboard account.' },
        { status: 409 },
      );
    } else if (!existingAdminUser.restrictedAccess) {
      // A pre-existing, full-access account (Owner/Admin/Developer/Finance/
      // Support/legacy-Viewer, or anything created outside this feature)
      // owns this email. Never silently convert it — surface a conflict and
      // require a human to resolve it deliberately.
      return NextResponse.json(
        {
          ok: false,
          error:
            'An existing dashboard account with full access already uses this email. Resolve this manually before granting restricted access.',
        },
        { status: 409 },
      );
    } else {
      // Unlinked, and this system created it before (e.g. a previous grant
      // that was later revoked) — safe to reactivate and relink.
      await prisma.adminUser.update({
        where: { id: existingAdminUser.id },
        data: { active: true },
      });

      adminUserId = existingAdminUser.id;
      requiresClaim = !existingAdminUser.authUserId;
    }

    await prisma.employee.update({
      where: { id },
      data: { adminUserId },
    });

    await prisma.permissionGrant.deleteMany({ where: { adminUserId } });

    if (parsedGrants.grants.length > 0) {
      await prisma.permissionGrant.createMany({
        data: parsedGrants.grants.map((grant) => ({
          adminUserId,
          module: grant.module,
          action: grant.action,
          scope: grant.scope ?? AccessScope.ALL,
          grantedById: actor.id,
        })),
      });
    }

    let roleTemplateChange: { added: string[]; removed: string[] } | null = null;
    if (parsedRoleTemplateIds.ids !== undefined) {
      roleTemplateChange = await reconcileRoleTemplateAssignments(prisma, adminUserId, parsedRoleTemplateIds.ids, actor.id);
    }

    let clientAssignmentChange: { added: string[]; removed: string[] } | null = null;
    if (parsedClientIds.ids !== undefined) {
      clientAssignmentChange = await reconcileClientAssignments(prisma, adminUserId, parsedClientIds.ids, actor.id);
    }

    if (parsedDefaultWorkspaceId.id !== undefined || parsedDefaultClientId.id !== undefined) {
      await prisma.adminUser.update({
        where: { id: adminUserId },
        data: {
          ...(parsedDefaultWorkspaceId.id !== undefined ? { defaultWorkspaceId: parsedDefaultWorkspaceId.id } : {}),
          ...(parsedDefaultClientId.id !== undefined ? { defaultClientId: parsedDefaultClientId.id } : {}),
        },
      });
    }

    let inviteLink: string | null = null;
    let inviteExpiresAt: Date | null = null;

    if (requiresClaim) {
      const rawToken = generateInviteToken();
      const tokenHash = hashInviteToken(rawToken);
      const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

      await prisma.accessInvite.upsert({
        where: { adminUserId },
        create: {
          adminUserId,
          tokenHash,
          expiresAt,
          createdById: actor.id,
        },
        update: {
          tokenHash,
          expiresAt,
          usedAt: null,
          createdById: actor.id,
        },
      });

      const origin = request.nextUrl.origin;
      inviteLink = `${origin}/invite/${rawToken}`;
      inviteExpiresAt = expiresAt;
    }

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'ACCESS_GRANTED',
        entityType: 'Employee',
        entityId: employee.id,
        metadata: {
          adminUserId,
          modules: parsedGrants.grants.map((g) => g.module),
          requiresClaim,
          roleTemplateIds: parsedRoleTemplateIds.ids ?? null,
          clientIds: parsedClientIds.ids ?? null,
        },
      },
    });

    if (roleTemplateChange && (roleTemplateChange.added.length > 0 || roleTemplateChange.removed.length > 0)) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'ROLE_TEMPLATES_CHANGED',
          entityType: 'Employee',
          entityId: employee.id,
          metadata: { adminUserId, ...roleTemplateChange },
        },
      });
    }

    if (clientAssignmentChange && (clientAssignmentChange.added.length > 0 || clientAssignmentChange.removed.length > 0)) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'CLIENT_ASSIGNMENTS_CHANGED',
          entityType: 'Employee',
          entityId: employee.id,
          metadata: { adminUserId, ...clientAssignmentChange },
        },
      });
    }

    if (parsedDefaultWorkspaceId.id !== undefined) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'DEFAULT_WORKSPACE_CHANGED',
          entityType: 'Employee',
          entityId: employee.id,
          metadata: { adminUserId, defaultWorkspaceId: parsedDefaultWorkspaceId.id },
        },
      });
    }

    if (parsedDefaultClientId.id !== undefined) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'DEFAULT_CLIENT_CHANGED',
          entityType: 'Employee',
          entityId: employee.id,
          metadata: { adminUserId, defaultClientId: parsedDefaultClientId.id },
        },
      });
    }

    return NextResponse.json({
      ok: true,
      access: {
        adminUserId,
        requiresClaim,
        inviteLink,
        inviteExpiresAt,
      },
    });
  } catch (error) {
    console.error('POST /api/admin/team/[id]/access failed:', error);

    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, 'Could not grant dashboard access.') },
      { status: getErrorStatus(error) },
    );
  }
}

/* ============================================================================
   PATCH /api/admin/team/[id]/access — Change permissions (and, optionally,
   the advanced system-role override)
============================================================================ */

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireTeamManager();
    const { id } = await context.params;

    const body: unknown = await request.json();

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request body.' },
        { status: 400 },
      );
    }

    const input = body as Record<string, unknown>;
    const parsedGrants = parseGrants(input.grants);

    if (!parsedGrants.ok) {
      return NextResponse.json({ ok: false, error: parsedGrants.error }, { status: 400 });
    }

    const parsedRoleTemplateIds = parseOptionalIdList(input.roleTemplateIds, 'roleTemplateIds');
    if (!parsedRoleTemplateIds.ok) {
      return NextResponse.json({ ok: false, error: parsedRoleTemplateIds.error }, { status: 400 });
    }

    const parsedClientIds = parseOptionalIdList(input.clientIds, 'clientIds');
    if (!parsedClientIds.ok) {
      return NextResponse.json({ ok: false, error: parsedClientIds.error }, { status: 400 });
    }

    const parsedDefaultWorkspaceId = parseOptionalNullableId(input.defaultWorkspaceId, 'defaultWorkspaceId');
    if (!parsedDefaultWorkspaceId.ok) {
      return NextResponse.json({ ok: false, error: parsedDefaultWorkspaceId.error }, { status: 400 });
    }

    const parsedDefaultClientId = parseOptionalNullableId(input.defaultClientId, 'defaultClientId');
    if (!parsedDefaultClientId.ok) {
      return NextResponse.json({ ok: false, error: parsedDefaultClientId.error }, { status: 400 });
    }

    if (parsedRoleTemplateIds.ids !== undefined && !(await roleTemplatesExist(parsedRoleTemplateIds.ids))) {
      return NextResponse.json({ ok: false, error: 'One or more selected role templates could not be found.' }, { status: 400 });
    }

    if (parsedClientIds.ids !== undefined && !(await clientsExist(parsedClientIds.ids))) {
      return NextResponse.json({ ok: false, error: 'One or more selected clients could not be found.' }, { status: 400 });
    }

    if (parsedDefaultWorkspaceId.id) {
      const workspaceExists = await prisma.workspace.count({ where: { id: parsedDefaultWorkspaceId.id } });
      if (!workspaceExists) {
        return NextResponse.json({ ok: false, error: 'The selected default workspace could not be found.' }, { status: 400 });
      }
    }

    if (parsedDefaultClientId.id) {
      const clientExists = await prisma.client.count({ where: { id: parsedDefaultClientId.id } });
      if (!clientExists) {
        return NextResponse.json({ ok: false, error: 'The selected default client could not be found.' }, { status: 400 });
      }
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        adminUserId: true,
        adminUser: { select: { id: true, role: true, restrictedAccess: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ ok: false, error: 'Employee not found.' }, { status: 404 });
    }

    if (!employee.adminUserId || !employee.adminUser) {
      return NextResponse.json(
        { ok: false, error: 'This employee does not have dashboard access yet. Grant access first.' },
        { status: 409 },
      );
    }

    const adminUserId = employee.adminUser.id;

    const rawRole = input.role;
    if (typeof rawRole === 'string' && rawRole !== employee.adminUser.role) {
      const allowedRoles = ['OWNER', 'ADMIN', 'DEVELOPER', 'SUPPORT', 'FINANCE', 'VIEWER'];

      if (!allowedRoles.includes(rawRole)) {
        return NextResponse.json({ ok: false, error: 'Unknown role.' }, { status: 400 });
      }

      if (rawRole === 'OWNER' && actor.role !== 'OWNER') {
        return NextResponse.json(
          { ok: false, error: 'Only an owner can grant owner access.' },
          { status: 403 },
        );
      }

      if (employee.adminUser.role === 'OWNER' && rawRole !== 'OWNER') {
        await assertNotLastOwner(adminUserId);
      }

      await prisma.adminUser.update({
        where: { id: adminUserId },
        data: { role: rawRole as never },
      });
    }

    await prisma.permissionGrant.deleteMany({ where: { adminUserId } });

    if (parsedGrants.grants.length > 0) {
      await prisma.permissionGrant.createMany({
        data: parsedGrants.grants.map((grant) => ({
          adminUserId,
          module: grant.module,
          action: grant.action,
          scope: grant.scope ?? AccessScope.ALL,
          grantedById: actor.id,
        })),
      });
    }

    let roleTemplateChange: { added: string[]; removed: string[] } | null = null;
    if (parsedRoleTemplateIds.ids !== undefined) {
      roleTemplateChange = await reconcileRoleTemplateAssignments(prisma, adminUserId, parsedRoleTemplateIds.ids, actor.id);
    }

    let clientAssignmentChange: { added: string[]; removed: string[] } | null = null;
    if (parsedClientIds.ids !== undefined) {
      clientAssignmentChange = await reconcileClientAssignments(prisma, adminUserId, parsedClientIds.ids, actor.id);
    }

    if (parsedDefaultWorkspaceId.id !== undefined || parsedDefaultClientId.id !== undefined) {
      await prisma.adminUser.update({
        where: { id: adminUserId },
        data: {
          ...(parsedDefaultWorkspaceId.id !== undefined ? { defaultWorkspaceId: parsedDefaultWorkspaceId.id } : {}),
          ...(parsedDefaultClientId.id !== undefined ? { defaultClientId: parsedDefaultClientId.id } : {}),
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'ACCESS_CHANGED',
        entityType: 'Employee',
        entityId: employee.id,
        metadata: {
          adminUserId,
          modules: parsedGrants.grants.map((g) => g.module),
          roleTemplateIds: parsedRoleTemplateIds.ids ?? null,
          clientIds: parsedClientIds.ids ?? null,
        },
      },
    });

    if (roleTemplateChange && (roleTemplateChange.added.length > 0 || roleTemplateChange.removed.length > 0)) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'ROLE_TEMPLATES_CHANGED',
          entityType: 'Employee',
          entityId: employee.id,
          metadata: { adminUserId, ...roleTemplateChange },
        },
      });
    }

    if (clientAssignmentChange && (clientAssignmentChange.added.length > 0 || clientAssignmentChange.removed.length > 0)) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'CLIENT_ASSIGNMENTS_CHANGED',
          entityType: 'Employee',
          entityId: employee.id,
          metadata: { adminUserId, ...clientAssignmentChange },
        },
      });
    }

    if (parsedDefaultWorkspaceId.id !== undefined) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'DEFAULT_WORKSPACE_CHANGED',
          entityType: 'Employee',
          entityId: employee.id,
          metadata: { adminUserId, defaultWorkspaceId: parsedDefaultWorkspaceId.id },
        },
      });
    }

    if (parsedDefaultClientId.id !== undefined) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'DEFAULT_CLIENT_CHANGED',
          entityType: 'Employee',
          entityId: employee.id,
          metadata: { adminUserId, defaultClientId: parsedDefaultClientId.id },
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/admin/team/[id]/access failed:', error);

    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, 'Could not change dashboard access.') },
      { status: getErrorStatus(error) },
    );
  }
}
