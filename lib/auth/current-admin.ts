// lib/auth/current-admin.ts

import { cache } from 'react';

import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

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

/**
 * Resolves the signed-in admin, linking the auth account to an invited
 * AdminUser row on first sign-in.
 *
 * Invited rows are created with an email and no authUserId, so a lookup by
 * authUserId alone never matches and the person can never get in. This claims
 * the row the first time they authenticate.
 *
 * The claim only happens when the provider says the email is verified.
 * Without that check, anyone who can register an account with a colleague's
 * address inherits their role.
 */
/**
 * Cached with React's `cache()` so every call within the same request
 * (layout, page, nested Server Components, and any lib/*-server.ts helper
 * that calls this or getCurrentIdentity) resolves the session and admin
 * row exactly once, instead of once per call site. Scoped per request —
 * never shared across different users' requests.
 */
export const getCurrentAdmin = cache(async function getCurrentAdmin() {
  const { data: session } = await auth.getSession();

  const authUserId = session?.user?.id;

  if (!authUserId) {
    throw new AuthenticationError();
  }

  const existing = await prisma.adminUser.findUnique({ where: { authUserId } });

  if (existing) {
    if (!existing.active) {
      throw new AuthorisationError(
        'Your Syntra Grid administrator profile has been disabled.',
      );
    }

    return existing;
  }

  const claimed = await claimInvitedAdmin(session, authUserId);

  if (!claimed) {
    throw new AuthorisationError(
      'No Syntra Grid administrator profile is linked to this account.',
    );
  }

  return claimed;
});

async function claimInvitedAdmin(
  session: Awaited<ReturnType<typeof auth.getSession>>['data'],
  authUserId: string,
) {
  const user = session?.user as
    | { email?: string | null; emailVerified?: boolean | null; name?: string | null; image?: string | null }
    | undefined;

  const email = user?.email?.trim().toLowerCase();

  if (!email || user?.emailVerified !== true) return null;

  const invited = await prisma.adminUser.findUnique({ where: { email } });

  // Only an unclaimed row may be taken over. If authUserId is already set to
  // somebody else, this is a different person with the same address — refuse.
  if (!invited || invited.authUserId) return null;

  if (!invited.active) {
    throw new AuthorisationError(
      'Your Syntra Grid administrator profile has been disabled.',
    );
  }

  const [firstName, ...rest] = (user?.name ?? '').trim().split(/\s+/).filter(Boolean);

  return prisma.adminUser.update({
    where: { id: invited.id },
    data: {
      authUserId,
      // Fill in blanks from the provider without overwriting what was typed.
      firstName: invited.firstName ?? firstName ?? null,
      lastName: invited.lastName ?? (rest.length ? rest.join(' ') : null),
      avatarUrl: invited.avatarUrl ?? user?.image ?? null,
    },
  });
}

/**
 * Any active, FULL-ACCESS admin, whatever their role. Use for read-only
 * pages and routes that have not been updated to consult the fine-grained
 * permission system (getCurrentIdentity/hasPermission/requirePermission).
 *
 * Restricted accounts (AdminUser.restrictedAccess === true — i.e. every
 * account created through Employee -> Access -> Grant Dashboard Access)
 * are rejected here by default. This is a deliberate fail-closed default:
 * a module is only ever reachable by a restricted employee once its route
 * has been deliberately updated to resolve identity via getCurrentAdmin()
 * (bypassing this gate) plus its own requirePermission() checks — see
 * lib/leave/server.ts and lib/calendar/server.ts for the pattern. Every
 * pre-existing account has restrictedAccess === false, so this change has
 * no effect on the Owner or any account that existed before this system.
 */
export async function requireAdmin() {
  const admin = await getCurrentAdmin();

  if (admin.restrictedAccess) {
    throw new AuthorisationError(
      'Your account does not have access to this area.',
    );
  }

  return admin;
}

async function requireRole(roles: AdminRole[], message: string) {
  const admin = await getCurrentAdmin();

  if (!roles.includes(admin.role as AdminRole)) {
    throw new AuthorisationError(message);
  }

  return admin;
}

export async function requireFinanceAdmin() {
  return requireRole(
    ['OWNER', 'ADMIN', 'FINANCE'],
    'Only the owner, administrators and finance users can manage banking.',
  );
}

/** Who may add, promote or revoke other admins. */
export async function requireTeamManager() {
  return requireRole(
    ['OWNER', 'ADMIN'],
    'Only the owner and administrators can manage the team.',
  );
}

/** Who may edit clients, projects and integrations. */
export async function requireClientEditor() {
  return requireRole(
    ['OWNER', 'ADMIN', 'DEVELOPER'],
    'Only the owner, administrators and developers can change client records.',
  );
}

/**
 * Fine-grained module/action/scope permissions, additive on top of
 * everything above.
 *
 * isFullAccess is keyed on AdminUser.restrictedAccess, not on role. Every
 * account that existed before this system, or that gets created any other
 * way (e.g. the existing team invite flow), has restrictedAccess === false
 * and therefore full access here regardless of its AdminRole — this system
 * can only ever grant additional reach to a brand-new restricted account,
 * never take reach away from an account it didn't create.
 */

const SCOPE_RANK: Record<AccessScope, number> = {
  [AccessScope.OWN]: 0,
  [AccessScope.DEPARTMENT]: 1,
  [AccessScope.ALL]: 2,
};

export type ResolvedIdentity = {
  admin: AdminUserRecord;
  employee: Employee | null;
  isFullAccess: boolean;
  permissions: Map<string, Map<AccessAction, AccessScope>>;
};

/** Cached per request for the same reason as getCurrentAdmin above — this
 *  is called by requirePermission/hasPermission call sites throughout the
 *  API routes and server components, often more than once per request. */
export const getCurrentIdentity = cache(async function getCurrentIdentity(): Promise<ResolvedIdentity> {
  const admin = await getCurrentAdmin();
  const isFullAccess = !admin.restrictedAccess;

  const [employee, grants] = await Promise.all([
    prisma.employee.findUnique({ where: { adminUserId: admin.id } }),
    isFullAccess
      ? Promise.resolve([])
      : prisma.permissionGrant.findMany({ where: { adminUserId: admin.id } }),
  ]);

  const permissions = new Map<string, Map<AccessAction, AccessScope>>();

  for (const grant of grants) {
    if (!permissions.has(grant.module)) {
      permissions.set(grant.module, new Map());
    }

    permissions.get(grant.module)!.set(grant.action, grant.scope);
  }

  return { admin, employee, isFullAccess, permissions };
});

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

export async function requirePermission(
  module: string,
  action: AccessAction,
  opts?: { scope?: AccessScope },
): Promise<ResolvedIdentity> {
  const identity = await getCurrentIdentity();

  if (!hasPermission(identity, module, action, opts)) {
    throw new AuthorisationError(
      `You are not authorised to ${action.toLowerCase()} ${module.replace(/_/g, ' ')}.`,
    );
  }

  return identity;
}