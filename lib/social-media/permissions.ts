// lib/social-media/permissions.ts
//
// Thin wrapper over the existing fine-grained permission system
// (lib/auth/current-admin.ts) for the "social_media" module, so every
// Social Media route enforces permissions the exact same way the rest of
// the app does — never a bespoke check.

import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import {
  AuthorisationError,
  getCurrentIdentity,
  hasPermission,
  requirePermission,
  type ResolvedIdentity,
} from "@/lib/auth/current-admin";

export const SOCIAL_MEDIA_MODULE = "social_media";

export { AccessAction, AccessScope, getCurrentIdentity, type ResolvedIdentity };

export async function requireSocialMediaPermission(
  action: AccessAction,
  opts?: { scope?: AccessScope },
): Promise<ResolvedIdentity> {
  return requirePermission(SOCIAL_MEDIA_MODULE, action, opts);
}

export function hasSocialMediaPermission(
  identity: ResolvedIdentity,
  action: AccessAction,
  opts?: { scope?: AccessScope },
): boolean {
  return hasPermission(identity, SOCIAL_MEDIA_MODULE, action, opts);
}

/**
 * OWN scope restricts a restricted caller to rows she created herself.
 * ALL and DEPARTMENT both resolve to "unrestricted" here — there is no
 * department FK on these models (a company-wide marketing channel has no
 * natural department boundary), so a DEPARTMENT grant is treated the same
 * as ALL rather than silently mis-scoping. This is a documented
 * limitation, not an oversight.
 */
export function socialMediaOwnScopeFilter(
  identity: ResolvedIdentity,
  action: AccessAction,
): { createdById: string } | undefined {
  if (identity.isFullAccess) return undefined;

  const grantedScope = identity.permissions.get(SOCIAL_MEDIA_MODULE)?.get(action);

  if (grantedScope === AccessScope.OWN) {
    return { createdById: identity.admin.id };
  }

  return undefined;
}

/** Throws unless the caller holds the given action on social_media,
 *  additionally requiring OWN-scope callers to be the row's own creator. */
export function assertSocialMediaRowAccess(
  identity: ResolvedIdentity,
  action: AccessAction,
  row: { createdById: string | null },
): void {
  if (identity.isFullAccess) return;

  const grantedScope = identity.permissions.get(SOCIAL_MEDIA_MODULE)?.get(action);

  if (!grantedScope) {
    throw new AuthorisationError(`You are not authorised to ${action.toLowerCase()} social media content.`);
  }

  if (grantedScope === AccessScope.OWN && row.createdById !== identity.admin.id) {
    throw new AuthorisationError("You can only act on social media content you created.");
  }
}
