// lib/client-health/permissions.ts
//
// Thin wrapper over the existing fine-grained permission system
// (lib/auth/current-admin.ts) for the "client_health" module — mirrors
// lib/campaigns/permissions.ts's shape exactly. Module key matches
// adminNav.ts's own `client_health` tab (Client Success section), kept
// distinct from the basic CRM `clients` CRUD (which isn't wired to the
// PermissionGrant system at all yet — it still gates on requireAdmin()
// alone) so this feature's own permission boundary is precise rather
// than piggy-backing on an unrelated module.
//
// No row-scope filter (OWN/DEPARTMENT) is offered here yet: Client has
// no natural department boundary and no per-row creator, and
// ClientAssignment (see prisma/schema.prisma) is NOT wired into any
// check yet — see its own doc comment and the Workspace Foundation
// task's explicit note not to claim client isolation is enforced before
// it actually is. Every action here is gated by the module-level grant
// alone (ALL scope, or full-access) — the same boundary every other
// authorised admin already operates under.

import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import { getCurrentIdentity, hasPermission, requirePermission, type ResolvedIdentity } from "@/lib/auth/current-admin";

export const CLIENT_HEALTH_MODULE = "client_health";

export { AccessAction, AccessScope, getCurrentIdentity, type ResolvedIdentity };

export async function requireClientHealthPermission(action: AccessAction, opts?: { scope?: AccessScope }): Promise<ResolvedIdentity> {
  return requirePermission(CLIENT_HEALTH_MODULE, action, opts);
}

export function hasClientHealthPermission(identity: ResolvedIdentity, action: AccessAction, opts?: { scope?: AccessScope }): boolean {
  return hasPermission(identity, CLIENT_HEALTH_MODULE, action, opts);
}
