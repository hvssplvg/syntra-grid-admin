// lib/auth/current-admin.ts

import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

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
export async function getCurrentAdmin() {
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
}

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

/** Any active admin, whatever their role. Use for read-only pages. */
export async function requireAdmin() {
  return getCurrentAdmin();
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