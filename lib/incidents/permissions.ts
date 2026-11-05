// lib/incidents/permissions.ts
//
// Thin wrapper over lib/auth/current-admin.ts for the "incidents" module
// (the technical-incidents view) — mirrors lib/client-health/permissions.ts
// exactly.
//
// Deliberately does NOT gate the existing acknowledge/resolve routes
// (app/api/admin/client-health/incidents/[id]/{acknowledge,resolve}/route.ts)
// — those stay on client_health:MANAGE unchanged, so a single Incident row
// has one consistent lifecycle regardless of which tab it's viewed from.
// This module only gates the new read/list route and the new manual
// ad-hoc incident creation route.

import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import {
  assertClientRowAccess,
  clientScopeIdFilter,
  getCurrentIdentity,
  hasPermission,
  requirePermission,
  type ResolvedIdentity,
} from "@/lib/auth/current-admin";

export const INCIDENTS_MODULE = "incidents";

export { AccessAction, AccessScope, getCurrentIdentity, type ResolvedIdentity };

export async function requireIncidentsPermission(action: AccessAction, opts?: { scope?: AccessScope }): Promise<ResolvedIdentity> {
  return requirePermission(INCIDENTS_MODULE, action, opts);
}

export function hasIncidentsPermission(identity: ResolvedIdentity, action: AccessAction, opts?: { scope?: AccessScope }): boolean {
  return hasPermission(identity, INCIDENTS_MODULE, action, opts);
}

export function incidentsClientScopeFilter(identity: ResolvedIdentity, action: AccessAction) {
  return clientScopeIdFilter(identity, INCIDENTS_MODULE, action);
}

export function assertIncidentsRowAccess(identity: ResolvedIdentity, action: AccessAction, clientId: string | null): void {
  assertClientRowAccess(identity, INCIDENTS_MODULE, action, { clientId });
}
