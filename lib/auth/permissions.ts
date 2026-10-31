// lib/auth/permissions.ts
//
// The pure, DB/session-free half of the fine-grained permission system —
// deliberately split out of lib/auth/current-admin.ts, which transitively
// imports next/headers (via lib/auth/server.ts) and therefore cannot be
// imported directly in a test file (it throws at import time outside
// Next's own request runtime — every existing test mocks it wholesale
// instead). Extracting the logic that has NO such dependency into this
// module means it can be unit-tested for real, not just exercised through
// a mock that always returns whatever a test tells it to.
//
// lib/auth/current-admin.ts re-exports everything here for backward
// compatibility — every existing call site keeps importing from
// '@/lib/auth/current-admin' unchanged. New call sites that only need
// this pure layer (no live session) may import from here directly.

import type { AdminUser as AdminUserRecord, Employee } from '@/app/generated/prisma/client';
import { AccessAction, AccessScope } from '@/app/generated/prisma/enums';

export class AuthenticationError extends Error {
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorisationError extends Error {
  constructor(message = 'You are not authorised to perform this action.') {
    super(message);
    this.name = 'AuthorisationError';
  }
}

export type AdminRole =
  | 'OWNER'
  | 'ADMIN'
  | 'DEVELOPER'
  | 'SUPPORT'
  | 'FINANCE'
  | 'VIEWER';

export const SCOPE_RANK: Record<AccessScope, number> = {
  [AccessScope.OWN]: 0,
  // Narrower than a whole department (an assigned subset of clients),
  // wider than just your own rows.
  [AccessScope.CLIENT]: 1,
  [AccessScope.DEPARTMENT]: 2,
  [AccessScope.ALL]: 3,
};

export type ResolvedIdentity = {
  admin: AdminUserRecord;
  employee: Employee | null;
  isFullAccess: boolean;
  permissions: Map<string, Map<AccessAction, AccessScope>>;
  // Client ids this account holds a ClientAssignment row for. Always []
  // for full-access identities (never consulted — isFullAccess short-
  // circuits every check below) and for restricted identities with no
  // assignments, which is meaningfully different from "sees everything":
  // see resolveClientScope.
  assignedClientIds: string[];
};

export function hasPermission(
  identity: ResolvedIdentity,
  module: string,
  action: AccessAction,
  opts?: { scope?: AccessScope },
): boolean {
  if (identity.isFullAccess) return true;

  const grantedScope = identity.permissions.get(module)?.get(action);

  if (!grantedScope) return false;
  if (!opts?.scope) return true;

  return SCOPE_RANK[grantedScope] >= SCOPE_RANK[opts.scope];
}

/**
 * CLIENT-scope resolution, shared by every module with real client-owned
 * data (contracts, contacts, projects, the client directory itself,
 * campaigns, client health, social media) rather than reimplemented per
 * module — CLIENT's resolution never depends on module-specific row
 * shape, only on the caller's own ClientAssignment rows, unlike
 * OWN/DEPARTMENT (see campaignOwnScopeFilter in lib/campaigns/
 * permissions.ts for that module-specific pattern).
 *
 * `restricted: false` covers both full access and a granted scope other
 * than CLIENT (ALL, or DEPARTMENT for a module with no department
 * concept of its own) — both mean "do not narrow by client" here.
 * `restricted: true` with an empty `clientIds` array is the "assigned to
 * nothing yet" case, and must produce zero visible rows, never every
 * row — callers achieve that for free by passing the array straight into
 * a Prisma `{ in: [] }` filter, which already matches nothing.
 */
export function resolveClientScope(
  identity: ResolvedIdentity,
  module: string,
  action: AccessAction,
): { restricted: false } | { restricted: true; clientIds: string[] } {
  if (identity.isFullAccess) return { restricted: false };

  const grantedScope = identity.permissions.get(module)?.get(action);

  if (grantedScope !== AccessScope.CLIENT) return { restricted: false };

  return { restricted: true, clientIds: identity.assignedClientIds };
}

/**
 * The `{ in: [...] }` condition for a CLIENT-scoped caller, or undefined
 * when no narrowing applies — spread this onto whichever field holds the
 * client id for the model being queried (`clientId` for most models,
 * `id` for the Client directory itself).
 */
export function clientScopeIdFilter(
  identity: ResolvedIdentity,
  module: string,
  action: AccessAction,
): { in: string[] } | undefined {
  const scope = resolveClientScope(identity, module, action);
  return scope.restricted ? { in: scope.clientIds } : undefined;
}

/**
 * Throws unless the caller holds `action` on `module` at all, and —
 * additionally, for a CLIENT-scoped caller — unless `row.clientId` is
 * one of their assigned clients. Mirrors assertCampaignRowAccess's shape
 * (lib/campaigns/permissions.ts) for the CLIENT dimension specifically.
 * Never trust a resource id alone as proof of authorisation: callers use
 * this immediately after loading the row by id, before acting on it.
 */
export function assertClientRowAccess(
  identity: ResolvedIdentity,
  module: string,
  action: AccessAction,
  row: { clientId: string | null },
): void {
  if (identity.isFullAccess) return;

  const grantedScope = identity.permissions.get(module)?.get(action);

  if (!grantedScope) {
    throw new AuthorisationError(
      `You are not authorised to ${action.toLowerCase()} ${module.replace(/_/g, ' ')}.`,
    );
  }

  if (grantedScope === AccessScope.CLIENT) {
    if (!row.clientId || !identity.assignedClientIds.includes(row.clientId)) {
      throw new AuthorisationError(
        'You can only act on records belonging to your assigned clients.',
      );
    }
  }
}
