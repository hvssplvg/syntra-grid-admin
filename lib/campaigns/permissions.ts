// lib/campaigns/permissions.ts
//
// Thin wrapper over the existing fine-grained permission system
// (lib/auth/current-admin.ts) for the "campaigns" module — mirrors
// lib/social-media/permissions.ts exactly, so every Campaigns route
// enforces permissions the same way the rest of the app does.

import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import {
  AuthorisationError,
  getCurrentIdentity,
  hasPermission,
  requirePermission,
  type ResolvedIdentity,
} from "@/lib/auth/current-admin";

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
 * OWN scope restricts a restricted caller to campaigns she created herself.
 * ALL and DEPARTMENT both resolve to "unrestricted" here — there is no
 * department FK on Campaign (a company-wide marketing record has no natural
 * department boundary), so a DEPARTMENT grant is treated the same as ALL
 * rather than silently mis-scoping. This mirrors Social Media's own
 * documented limitation exactly.
 */
export function campaignOwnScopeFilter(
  identity: ResolvedIdentity,
  action: AccessAction,
): { createdById: string } | undefined {
  if (identity.isFullAccess) return undefined;

  const grantedScope = identity.permissions.get(CAMPAIGNS_MODULE)?.get(action);

  if (grantedScope === AccessScope.OWN) {
    return { createdById: identity.admin.id };
  }

  return undefined;
}

/** Throws unless the caller holds the given action on campaigns,
 *  additionally requiring OWN-scope callers to be the row's own creator. */
export function assertCampaignRowAccess(
  identity: ResolvedIdentity,
  action: AccessAction,
  row: { createdById: string | null },
): void {
  if (identity.isFullAccess) return;

  const grantedScope = identity.permissions.get(CAMPAIGNS_MODULE)?.get(action);

  if (!grantedScope) {
    throw new AuthorisationError(`You are not authorised to ${action.toLowerCase()} campaigns.`);
  }

  if (grantedScope === AccessScope.OWN && row.createdById !== identity.admin.id) {
    throw new AuthorisationError("You can only act on campaigns you created.");
  }
}
