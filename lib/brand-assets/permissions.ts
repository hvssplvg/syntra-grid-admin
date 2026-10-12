// lib/brand-assets/permissions.ts
//
// Thin wrapper over the existing fine-grained permission system
// (lib/auth/current-admin.ts) for the "brand_assets" module — the exact
// same pattern lib/social-media/permissions.ts already established, so
// every Brand Assets route enforces permissions the same way the rest of
// the app does. "brand_assets" already exists as a module key in
// adminNav.ts's SECURED_MODULE_KEYS and the role-template presets
// (lib/access/role-templates.ts), so nothing new is introduced here.
//
// Action mapping (matches the capability list the task itself suggested:
// "Upload Assets" is its own, lower tier than "Manage Assets"/"Manage
// Brand Kits"/"Manage Templates"; "Create Requests" is lower than
// "Review Requests"/"Approve Requests" — collapsed into one APPROVE
// action the same way Social Media collapses review+schedule into one):
//   VIEW    — read anything: overview stats, browse assets/kits/
//             guidelines/templates/requests
//   CREATE  — upload an asset ("Upload Assets"), create a request
//             ("Create Requests"), comment/attach on a request you're
//             already part of
//   EDIT    — edit the metadata of an asset or request you created
//             (rename, re-tag, re-describe — not file replacement or
//             the request workflow itself)
//   APPROVE — the whole request pipeline beyond raw creation: assign,
//             start progress, submit for review, approve, reject,
//             request changes, complete, cancel ("Review Requests" +
//             "Approve Requests")
//   MANAGE  — brand kits, brand guidelines (including publish/unpublish),
//             templates, and an asset's structural/destructive actions:
//             archive, restore, delete, replace the file, restore a past
//             version ("Manage Assets"/"Manage Brand Kits"/"Manage
//             Guidelines"/"Manage Templates")

import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import {
  AuthorisationError,
  getCurrentIdentity,
  hasPermission,
  requirePermission,
  type ResolvedIdentity,
} from "@/lib/auth/current-admin";

export const BRAND_ASSETS_MODULE = "brand_assets";

export { AccessAction, AccessScope, getCurrentIdentity, type ResolvedIdentity };

export async function requireBrandAssetsPermission(
  action: AccessAction,
  opts?: { scope?: AccessScope },
): Promise<ResolvedIdentity> {
  return requirePermission(BRAND_ASSETS_MODULE, action, opts);
}

export function hasBrandAssetsPermission(
  identity: ResolvedIdentity,
  action: AccessAction,
  opts?: { scope?: AccessScope },
): boolean {
  return hasPermission(identity, BRAND_ASSETS_MODULE, action, opts);
}

/** OWN scope restricts a restricted caller to rows she created herself.
 *  ALL and DEPARTMENT both resolve to "unrestricted" — same documented
 *  limitation as Social Media, since none of these models have a
 *  department FK. */
export function brandAssetsOwnScopeFilter(
  identity: ResolvedIdentity,
  action: AccessAction,
  ownerField: string,
): Record<string, string> | undefined {
  if (identity.isFullAccess) return undefined;

  const grantedScope = identity.permissions.get(BRAND_ASSETS_MODULE)?.get(action);

  if (grantedScope === AccessScope.OWN) {
    return { [ownerField]: identity.admin.id };
  }

  return undefined;
}

/** Throws unless the caller holds the given action on brand_assets,
 *  additionally requiring OWN-scope callers to own the row themselves. */
export function assertBrandAssetsRowAccess(
  identity: ResolvedIdentity,
  action: AccessAction,
  row: { ownerId: string | null },
): void {
  if (identity.isFullAccess) return;

  const grantedScope = identity.permissions.get(BRAND_ASSETS_MODULE)?.get(action);

  if (!grantedScope) {
    throw new AuthorisationError(`You are not authorised to ${action.toLowerCase()} brand assets.`);
  }

  if (grantedScope === AccessScope.OWN && row.ownerId !== identity.admin.id) {
    throw new AuthorisationError("You can only act on brand assets you created.");
  }
}

/**
 * A Brand Request's "own" is wider than a single owner field: the person
 * who filed it AND whoever it's assigned to both need to be able to see
 * and edit it at OWN scope — an assignee doing the work didn't create
 * the request, but still needs it to not be invisible to them. Workflow
 * actions (assign/start/approve/reject/...) are reviewed under APPROVE
 * and deliberately have no row check at all, mirroring Social Media's
 * approvePost/schedulePost precedent — a reviewer approves other
 * people's content, not just their own.
 */
export function brandRequestOwnScopeFilter(
  identity: ResolvedIdentity,
  action: AccessAction,
): { OR: Array<{ requestedById: string } | { assignedToId: string }> } | undefined {
  if (identity.isFullAccess) return undefined;

  const grantedScope = identity.permissions.get(BRAND_ASSETS_MODULE)?.get(action);

  if (grantedScope === AccessScope.OWN) {
    return { OR: [{ requestedById: identity.admin.id }, { assignedToId: identity.admin.id }] };
  }

  return undefined;
}

export function assertBrandRequestRowAccess(
  identity: ResolvedIdentity,
  action: AccessAction,
  row: { requestedById: string | null; assignedToId: string | null },
): void {
  if (identity.isFullAccess) return;

  const grantedScope = identity.permissions.get(BRAND_ASSETS_MODULE)?.get(action);

  if (!grantedScope) {
    throw new AuthorisationError(`You are not authorised to ${action.toLowerCase()} this request.`);
  }

  if (grantedScope === AccessScope.OWN && row.requestedById !== identity.admin.id && row.assignedToId !== identity.admin.id) {
    throw new AuthorisationError("You can only act on requests you created or are assigned to.");
  }
}
