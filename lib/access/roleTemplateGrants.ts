// lib/access/roleTemplateGrants.ts
//
// Pure, dependency-free merge logic for RoleTemplate grants — used both
// server-side (role-template routes, the read-only Preview feature) and
// client-side (TeamTab.tsx's Grant/Change Dashboard Access matrix, which
// pre-fills from one or more selected templates before submit). Kept out
// of lib/access/server.ts deliberately: that file imports `crypto` and
// `@/lib/prisma`, neither of which can run in a 'use client' component.

import { AccessAction, AccessScope } from '@/app/generated/prisma/enums';

// Mirrors lib/auth/current-admin.ts's SCOPE_RANK exactly — duplicated
// (rather than imported) because current-admin.ts transitively pulls in
// next/headers, which only resolves server-side. Keep both in sync if a
// new AccessScope value is ever added.
const SCOPE_RANK: Record<AccessScope, number> = {
  [AccessScope.OWN]: 0,
  [AccessScope.CLIENT]: 1,
  [AccessScope.DEPARTMENT]: 2,
  [AccessScope.ALL]: 3,
};

export type RoleTemplateGrantInput = {
  module: string;
  action: AccessAction;
  scope: AccessScope;
};

/**
 * Resolves the PermissionGrant-shaped rows that applying one or more
 * RoleTemplates produces.
 *
 * Precedence, matching the task's explicit "avoid ambiguous permission
 * precedence" requirement: a template can only ever ADD reach, never
 * take it away from another applied template.
 *   - Per module+action, the resolved scope is the highest-ranked scope
 *     (OWN < CLIENT < DEPARTMENT < ALL) among every template that grants
 *     that module+action at all.
 *   - The resolved set of module+action pairs is the UNION across every
 *     applied template — a narrower template never removes an action a
 *     broader one already grants.
 */
export function mergeRoleTemplateGrants(
  templates: Array<{ grants: RoleTemplateGrantInput[] }>,
): RoleTemplateGrantInput[] {
  const resolved = new Map<string, RoleTemplateGrantInput>();

  for (const template of templates) {
    for (const grant of template.grants) {
      const key = `${grant.module}:${grant.action}`;
      const existing = resolved.get(key);

      if (!existing || SCOPE_RANK[grant.scope] > SCOPE_RANK[existing.scope]) {
        resolved.set(key, grant);
      }
    }
  }

  return Array.from(resolved.values());
}

/**
 * Merges a resolved role-template grant list with a manually-built one
 * (the advanced matrix), using the same "highest scope wins, actions
 * union" rule — a manual edit can widen what a template grants, but a
 * template never silently narrows a manual edit either.
 */
export function mergeManualGrantsWithTemplates(
  templateGrants: RoleTemplateGrantInput[],
  manualGrants: RoleTemplateGrantInput[],
): RoleTemplateGrantInput[] {
  return mergeRoleTemplateGrants([{ grants: templateGrants }, { grants: manualGrants }]);
}
