// lib/campaigns/permissions.ts
//
// Thin wrapper over the existing fine-grained permission system
// (lib/auth/current-admin.ts) for the "campaigns" module — mirrors
// lib/social-media/permissions.ts exactly, so every Campaigns route
// enforces permissions the same way the rest of the app does.
//
// Sub-resources (milestones, tasks, content, budget, approvals, etc.) do
// not have their own independent OWN/ALL row ownership — they inherit the
// PARENT campaign's row access via assertCampaignRowAccess, the same way
// BrandRequestComment/Attachment inherit their parent BrandRequest's row
// check rather than tracking a separate creator-based scope. On top of
// that inherited check, a handful of named actors (a task's assignee, a
// content item's creator/reviewer, an expense's recorder, an approval's
// assigned approver) may act on their OWN item even without campaign-level
// access — see the isX helpers below, used directly by lib/campaigns/*.ts.

import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import {
  AuthorisationError,
  getCurrentIdentity,
  hasPermission,
  requirePermission,
  type ResolvedIdentity,
} from "@/lib/auth/current-admin";
import { Prisma } from "@/app/generated/prisma/client";

export const CAMPAIGNS_MODULE = "campaigns";

export { AccessAction, AccessScope, getCurrentIdentity, type ResolvedIdentity };

export async function requireCampaignsPermission(
  action: AccessAction,
  opts?: { scope?: AccessScope },
): Promise<ResolvedIdentity> {
  return requirePermission(CAMPAIGNS_MODULE, action, opts);
}

export function hasCampaignsPermission(
  identity: ResolvedIdentity,
  action: AccessAction,
  opts?: { scope?: AccessScope },
): boolean {
  return hasPermission(identity, CAMPAIGNS_MODULE, action, opts);
}

/**
 * OWN restricts to campaigns the caller created herself. DEPARTMENT now
 * restricts to campaigns whose departmentId matches the caller's own
 * Employee.departmentId (Campaign gained a real departmentId in the
 * 20261012170000_campaigns_full_build migration, so this is no longer the
 * "no natural department boundary" case Social Media documents — a caller
 * granted DEPARTMENT with no resolvable department of their own sees
 * nothing, rather than silently falling back to ALL).
 */
export function campaignOwnScopeFilter(
  identity: ResolvedIdentity,
  action: AccessAction,
): Prisma.CampaignWhereInput | undefined {
  if (identity.isFullAccess) return undefined;

  const grantedScope = identity.permissions.get(CAMPAIGNS_MODULE)?.get(action);

  if (grantedScope === AccessScope.OWN) {
    return { createdById: identity.admin.id };
  }

  if (grantedScope === AccessScope.DEPARTMENT) {
    if (!identity.employee?.departmentId) return { id: "__unresolvable__" };
    return { departmentId: identity.employee.departmentId };
  }

  return undefined;
}

/** Throws unless the caller holds the given action on campaigns,
 *  additionally requiring OWN/DEPARTMENT-scoped callers to be within their
 *  scope for this specific campaign row. Every sub-resource route calls
 *  this against its PARENT campaign before mutating the sub-resource. */
export function assertCampaignRowAccess(
  identity: ResolvedIdentity,
  action: AccessAction,
  row: { createdById: string | null; departmentId?: string | null },
): void {
  if (identity.isFullAccess) return;

  const grantedScope = identity.permissions.get(CAMPAIGNS_MODULE)?.get(action);

  if (!grantedScope) {
    throw new AuthorisationError(`You are not authorised to ${action.toLowerCase()} campaigns.`);
  }

  if (grantedScope === AccessScope.OWN && row.createdById !== identity.admin.id) {
    throw new AuthorisationError("You can only act on campaigns you created.");
  }

  if (grantedScope === AccessScope.DEPARTMENT) {
    const callerDepartmentId = identity.employee?.departmentId ?? null;
    if (!callerDepartmentId || row.departmentId !== callerDepartmentId) {
      throw new AuthorisationError("You can only act on campaigns in your own department.");
    }
  }
}

/** True if the caller's own linked Employee record is the given id — used
 *  for the named-actor exemptions (task assignee, content creator/
 *  reviewer, expense recorder) that can act on their own item regardless
 *  of campaign-level row access. */
export function isOwnEmployee(identity: ResolvedIdentity, employeeId: string | null | undefined): boolean {
  return Boolean(identity.employee && employeeId && employeeId === identity.employee.id);
}

/** True if the caller's own AdminUser id is the given id — used for
 *  actor-based exemptions keyed to the dashboard identity rather than an
 *  Employee record (expense recorder, approval requester). */
export function isOwnAdminUser(identity: ResolvedIdentity, adminUserId: string | null | undefined): boolean {
  return Boolean(adminUserId && adminUserId === identity.admin.id);
}
