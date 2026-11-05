// lib/deployments/permissions.ts
//
// Thin wrapper over lib/auth/current-admin.ts for the "deployments"
// module — mirrors lib/client-health/permissions.ts's shape exactly.
//
// Deployment has no direct clientId column (it only has projectId) — the
// owning client is always resolved via Deployment.project.clientId by the
// caller (load the Deployment with `include: { project: { select: {
// clientId: true } } }`) before calling assertDeploymentsRowAccess below.

import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import {
  assertClientRowAccess,
  clientScopeIdFilter,
  getCurrentIdentity,
  hasPermission,
  requirePermission,
  type ResolvedIdentity,
} from "@/lib/auth/current-admin";

export const DEPLOYMENTS_MODULE = "deployments";

export { AccessAction, AccessScope, getCurrentIdentity, type ResolvedIdentity };

export async function requireDeploymentsPermission(action: AccessAction, opts?: { scope?: AccessScope }): Promise<ResolvedIdentity> {
  return requirePermission(DEPLOYMENTS_MODULE, action, opts);
}

export function hasDeploymentsPermission(identity: ResolvedIdentity, action: AccessAction, opts?: { scope?: AccessScope }): boolean {
  return hasPermission(identity, DEPLOYMENTS_MODULE, action, opts);
}

export function deploymentsClientScopeFilter(identity: ResolvedIdentity, action: AccessAction) {
  return clientScopeIdFilter(identity, DEPLOYMENTS_MODULE, action);
}

/** `clientId` here is the deployment's PROJECT's clientId, resolved by the
 *  caller — never trust a client-supplied clientId/projectId param alone. */
export function assertDeploymentsRowAccess(identity: ResolvedIdentity, action: AccessAction, clientId: string | null): void {
  assertClientRowAccess(identity, DEPLOYMENTS_MODULE, action, { clientId });
}
