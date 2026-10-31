import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  AuthenticationError,
  AuthorisationError,
  hasPermission,
  requireAdmin,
  type ResolvedIdentity,
} from '@/lib/auth/current-admin';
import { AccessAction } from '@/app/generated/prisma/enums';
import { mergeRoleTemplateGrants, type RoleTemplateGrantInput } from '@/lib/access/roleTemplateGrants';
import {
  ADMIN_TABS,
  filterSectionsByPermission,
  type AdminTab,
} from '@/app/components/admin/adminNav';
import { listWorkspaces } from '@/lib/workspaces/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ============================================================================
   GET /api/admin/access-preview?roleTemplateIds=a,b
   GET /api/admin/access-preview?employeeId=X

   Read-only "Preview as" (task spec §10). Full-access only — never
   reachable by a restricted account, so previewing can never itself be
   a privilege-escalation path. This NEVER creates a session, swaps
   identity, or grants any real access: it builds a synthetic,
   in-memory identity (never persisted, never the caller's own) and
   feeds it through the EXACT same permission-resolution functions real
   requests use (hasPermission, filterSectionsByPermission, the
   workspace-filtering logic in app/api/admin/workspaces/route.ts) — so
   what this returns is never a hand-maintained approximation of what a
   restricted login would see.

   Two modes:
   - roleTemplateIds: a hypothetical employee who would hold exactly
     these templates, with no client assignments yet (clients are
     assigned per-employee, not per-template).
   - employeeId: the ACTUAL current state of a real restricted
     employee's dashboard account — their real grants, real role
     templates, real client assignments. Read-only: no mutation, no
     impersonation, no session of theirs is touched.
============================================================================ */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const params = request.nextUrl.searchParams;
    const employeeId = params.get('employeeId')?.trim() || null;
    const roleTemplateIdsParam = params.get('roleTemplateIds')?.trim() || null;

    if (!employeeId && !roleTemplateIdsParam) {
      return NextResponse.json(
        { ok: false, error: 'Provide either employeeId or roleTemplateIds.' },
        { status: 400 },
      );
    }

    let grants: RoleTemplateGrantInput[];
    let assignedClientIds: string[] = [];
    let appliedTemplateNames: string[] = [];
    let subjectLabel: string;

    if (employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          firstName: true,
          lastName: true,
          adminUser: {
            select: {
              restrictedAccess: true,
              active: true,
              permissionGrants: { select: { module: true, action: true, scope: true } },
              clientAssignments: { select: { clientId: true } },
              roleTemplatesAssigned: { select: { roleTemplate: { select: { name: true } } } },
            },
          },
        },
      });

      if (!employee?.adminUser) {
        return NextResponse.json({ ok: false, error: 'This employee has no dashboard account to preview.' }, { status: 404 });
      }

      if (!employee.adminUser.restrictedAccess) {
        return NextResponse.json(
          { ok: false, error: 'This is a full-access account — preview only applies to restricted accounts.' },
          { status: 400 },
        );
      }

      grants = employee.adminUser.permissionGrants.map((grant) => ({
        module: grant.module,
        action: grant.action,
        scope: grant.scope,
      }));
      assignedClientIds = employee.adminUser.clientAssignments.map((row) => row.clientId);
      appliedTemplateNames = employee.adminUser.roleTemplatesAssigned.map((row) => row.roleTemplate.name);
      subjectLabel = [employee.firstName, employee.lastName].filter(Boolean).join(' ') || 'This employee';

      if (!employee.adminUser.active) {
        return NextResponse.json({
          ok: true,
          preview: {
            subjectLabel,
            deactivated: true,
            sections: [],
            workspaces: [],
            clients: [],
            grants: [],
            appliedTemplateNames,
          },
        });
      }
    } else {
      const roleTemplateIds = Array.from(new Set((roleTemplateIdsParam ?? '').split(',').map((id) => id.trim()).filter(Boolean)));

      const templates = await prisma.roleTemplate.findMany({
        where: { id: { in: roleTemplateIds } },
        select: { id: true, name: true, grants: { select: { module: true, action: true, scope: true } } },
      });

      if (templates.length !== roleTemplateIds.length) {
        return NextResponse.json({ ok: false, error: 'One or more selected role templates could not be found.' }, { status: 400 });
      }

      grants = mergeRoleTemplateGrants(
        templates.map((template) => ({
          grants: template.grants.map((grant) => ({ module: grant.module, action: grant.action, scope: grant.scope })),
        })),
      );
      appliedTemplateNames = templates.map((template) => template.name);
      subjectLabel = appliedTemplateNames.length > 0 ? appliedTemplateNames.join(' + ') : 'A new restricted employee';
    }

    // The exact synthetic-identity shape hasPermission/
    // filterSectionsByPermission already expect — built here, in memory,
    // from the resolved grants above. Never the caller's own identity,
    // never persisted, never backed by a real session.
    const permissions = new Map<string, Map<AccessAction, (typeof grants)[number]['scope']>>();
    for (const grant of grants) {
      if (!permissions.has(grant.module)) permissions.set(grant.module, new Map());
      permissions.get(grant.module)!.set(grant.action, grant.scope);
    }

    const syntheticIdentity = {
      isFullAccess: false,
      permissions,
      assignedClientIds,
    } as unknown as ResolvedIdentity;

    const hasModuleAccess = (tab: AdminTab) => hasPermission(syntheticIdentity, tab, AccessAction.VIEW);

    const sections = filterSectionsByPermission(false, hasModuleAccess).map((section) => ({
      id: section.id,
      label: section.label,
      modules: section.items.map((item) => ({
        tab: item.tab,
        label: item.title,
        actions: Array.from(permissions.get(item.tab)?.keys() ?? []),
        scope: permissions.get(item.tab)?.get(AccessAction.VIEW) ?? null,
      })),
    }));

    const accessibleSectionIds = new Set<string>(sections.map((section) => section.id));

    const allWorkspaces = await listWorkspaces();
    const workspaces = allWorkspaces.filter(
      (workspace) => workspace.sectionKeys.length > 0 && workspace.sectionKeys.some((id) => accessibleSectionIds.has(id)),
    );

    const clients =
      assignedClientIds.length > 0
        ? await prisma.client.findMany({
            where: { id: { in: assignedClientIds } },
            select: { id: true, name: true, displayName: true },
          })
        : [];

    const restrictedModuleCount = Object.keys(ADMIN_TABS).filter((tab) => !permissions.has(tab)).length;

    return NextResponse.json({
      ok: true,
      preview: {
        subjectLabel,
        deactivated: false,
        appliedTemplateNames,
        sections,
        workspaces,
        clients,
        grants,
        restrictedModuleCount,
      },
    });
  } catch (error) {
    console.error('[admin/access-preview]', error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: 'Something went wrong.' }, { status: 500 });
  }
}
