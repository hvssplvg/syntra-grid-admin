// lib/systems/permissions.ts
//
// Thin wrapper over the existing fine-grained permission system
// (lib/auth/current-admin.ts) for the "systems" module — mirrors
// lib/client-health/permissions.ts's shape exactly. Module key matches
// adminNav.ts's own `systems` tab (Engineering section).
//
// No OWN/DEPARTMENT row-scope filter is offered here, same reasoning as
// Client Health: a ManagedSystem has no per-row creator-based ownership
// concept that makes sense to restrict by. CLIENT scope is offered via the
// generic clientScopeIdFilter/assertClientRowAccess in lib/auth/current-
// admin.ts, which already accepts a nullable clientId (a Syntra-Grid-owned
// system has clientId: null — see prisma/schema.prisma's ManagedSystem
// doc comment for why that's not a security hole: assertClientRowAccess
// denies a CLIENT-scoped identity on a null clientId exactly like it
// would on any clientId not in their ClientAssignment rows).

import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import {
  assertClientRowAccess,
  clientScopeIdFilter,
  getCurrentIdentity,
  hasPermission,
  requirePermission,
  type ResolvedIdentity,
} from "@/lib/auth/current-admin";

export const SYSTEMS_MODULE = "systems";

export { AccessAction, AccessScope, getCurrentIdentity, type ResolvedIdentity };

export async function requireSystemsPermission(action: AccessAction, opts?: { scope?: AccessScope }): Promise<ResolvedIdentity> {
  return requirePermission(SYSTEMS_MODULE, action, opts);
}

export function hasSystemsPermission(identity: ResolvedIdentity, action: AccessAction, opts?: { scope?: AccessScope }): boolean {
  return hasPermission(identity, SYSTEMS_MODULE, action, opts);
}

/** The `{ in: [...] }` client-id condition for a CLIENT-scoped
 *  restricted caller, or undefined when no narrowing applies. */
export function systemsClientScopeFilter(identity: ResolvedIdentity, action: AccessAction) {
  return clientScopeIdFilter(identity, SYSTEMS_MODULE, action);
}

/** Throws unless the identity may `action` systems data for this specific
 *  client (or for Syntra Grid's own systems, when clientId is null) —
 *  never trust a clientId path/query param alone. */
export function assertSystemsRowAccess(identity: ResolvedIdentity, action: AccessAction, clientId: string | null): void {
  assertClientRowAccess(identity, SYSTEMS_MODULE, action, { clientId });
}
