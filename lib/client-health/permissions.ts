// lib/client-health/permissions.ts
//
// Thin wrapper over the existing fine-grained permission system
// (lib/auth/current-admin.ts) for the "client_health" module — mirrors
// lib/campaigns/permissions.ts's shape exactly. Module key matches
// adminNav.ts's own `client_health` tab (Client Success section), kept
// distinct from the basic CRM `clients` CRUD so this feature's own
// permission boundary is precise rather than piggy-backing on an
// unrelated module.
//
// No OWN/DEPARTMENT row-scope filter is offered here: Client has no
// natural department boundary and no per-row creator. CLIENT scope is
// offered, via the generic clientScopeIdFilter/assertClientRowAccess in
// lib/auth/current-admin.ts (ClientAssignment is now wired into those) —
// clientHealthClientScopeFilter/assertClientHealthRowAccess below.

import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import {
  assertClientRowAccess,
  clientScopeIdFilter,
  getCurrentIdentity,
  hasPermission,
  requirePermission,
  type ResolvedIdentity,
} from "@/lib/auth/current-admin";

export const CLIENT_HEALTH_MODULE = "client_health";

export { AccessAction, AccessScope, getCurrentIdentity, type ResolvedIdentity };

export async function requireClientHealthPermission(action: AccessAction, opts?: { scope?: AccessScope }): Promise<ResolvedIdentity> {
  return requirePermission(CLIENT_HEALTH_MODULE, action, opts);
}

export function hasClientHealthPermission(identity: ResolvedIdentity, action: AccessAction, opts?: { scope?: AccessScope }): boolean {
  return hasPermission(identity, CLIENT_HEALTH_MODULE, action, opts);
}

/** The `{ in: [...] }` client-id condition for a CLIENT-scoped
 *  restricted caller, or undefined when no narrowing applies. */
export function clientHealthClientScopeFilter(identity: ResolvedIdentity, action: AccessAction) {
  return clientScopeIdFilter(identity, CLIENT_HEALTH_MODULE, action);
}

/** Throws unless the identity may `action` client health data for this
 *  specific client — never trust a clientId path/query param alone. */
export function assertClientHealthRowAccess(identity: ResolvedIdentity, action: AccessAction, clientId: string | null): void {
  assertClientRowAccess(identity, CLIENT_HEALTH_MODULE, action, { clientId });
}
