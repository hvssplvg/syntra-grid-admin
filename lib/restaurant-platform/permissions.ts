// lib/restaurant-platform/permissions.ts
//
// Thin wrapper over the existing fine-grained permission system
// (lib/auth/current-admin.ts) for the "restaurant_platform" module —
// mirrors lib/systems/permissions.ts's shape exactly, since a restaurant
// tenant IS a ManagedSystem (see prisma/schema.prisma's RestaurantLink
// doc comment) and the same CLIENT-scope reasoning applies unchanged.
//
// This governs who inside Syntra Grid Admin may act on restaurant
// platform data at all — it is checked BEFORE any call to Restaurant
// Admin's management API, never after. Restaurant Admin's own HMAC check
// (lib/restaurant-platform/client.ts on this side, lib/platform-mgmt/
// on that side) answers a different question — "did this call genuinely
// come from Syntra Grid Admin's backend" — and is not a substitute for
// this permission check.

import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import {
  assertClientRowAccess,
  clientScopeIdFilter,
  getCurrentIdentity,
  hasPermission,
  requirePermission,
  type ResolvedIdentity,
} from "@/lib/auth/current-admin";

export const RESTAURANT_PLATFORM_MODULE = "restaurant_platform";

export { AccessAction, AccessScope, getCurrentIdentity, type ResolvedIdentity };

export async function requireRestaurantPlatformPermission(
  action: AccessAction,
  opts?: { scope?: AccessScope }
): Promise<ResolvedIdentity> {
  return requirePermission(RESTAURANT_PLATFORM_MODULE, action, opts);
}

export function hasRestaurantPlatformPermission(
  identity: ResolvedIdentity,
  action: AccessAction,
  opts?: { scope?: AccessScope }
): boolean {
  return hasPermission(identity, RESTAURANT_PLATFORM_MODULE, action, opts);
}

export function restaurantPlatformClientScopeFilter(identity: ResolvedIdentity, action: AccessAction) {
  return clientScopeIdFilter(identity, RESTAURANT_PLATFORM_MODULE, action);
}

export function assertRestaurantPlatformRowAccess(
  identity: ResolvedIdentity,
  action: AccessAction,
  clientId: string | null
): void {
  assertClientRowAccess(identity, RESTAURANT_PLATFORM_MODULE, action, { clientId });
}
