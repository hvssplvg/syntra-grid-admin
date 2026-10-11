'use server';

import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { hashInviteToken } from '@/lib/access/server';

export type ClaimActionState = {
  error?: string;
  success?: boolean;
  email?: string;
};

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Submits the claim form: creates the invitee's own Neon Auth login (in her
 * own request — never the granter's) and triggers a real email-verification
 * message. This deliberately does NOT link AdminUser.authUserId or treat
 * the invitee as signed in. Possessing the invite link only gets this far;
 * actual activation happens later, when she clicks the verification email
 * and claimInvitedAdmin() (lib/auth/current-admin.ts, unmodified) links her
 * account on next sign-in, gated on Neon Auth reporting emailVerified.
 */
export async function claimInviteAction(
  token: string,
  _previousState: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const password = getText(formData, 'password');
  const confirmPassword = getText(formData, 'confirmPassword');

  if (password.length < 12) {
    return { error: 'Your password must contain at least 12 characters.' };
  }

  if (password !== confirmPassword) {
    return { error: 'The passwords do not match.' };
  }

  const tokenHash = hashInviteToken(token);

  const invite = await prisma.accessInvite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      expiresAt: true,
      usedAt: true,
      adminUser: {
        select: { id: true, email: true, firstName: true, lastName: true, authUserId: true },
      },
    },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return { error: 'This invitation link is no longer valid. Refresh the page for details.' };
  }

  const { adminUser } = invite;

  if (adminUser.authUserId) {
    // Already claimed through some other path — nothing to do here.
    return { error: 'This invitation has already been used. Sign in instead.' };
  }

  const fullName = [adminUser.firstName, adminUser.lastName].filter(Boolean).join(' ') || adminUser.email;

  const { error: signUpError } = await auth.signUp.email({
    email: adminUser.email,
    password,
    name: fullName,
  });

  if (signUpError) {
    const message = signUpError.message?.toLowerCase() ?? '';

    const accountAlreadyExists =
      message.includes('already exists') ||
      message.includes('already registered') ||
      message.includes('user exists');

    if (accountAlreadyExists) {
      // Unlike the owner-setup flow, we never attempt to sign in with the
      // password an anonymous link-holder just typed — that would be
      // probing a login that may not belong to them. Direct them to the
      // normal sign-in page instead, with no credential attempt here.
      return {
        error:
          'This email already has a dashboard login. Sign in at /login, or contact your administrator if this looks wrong.',
      };
    }

    console.error('Invite claim sign-up failed:', signUpError.message);
    return { error: 'Could not create your login. Please try again.' };
  }

  // Trigger Neon Auth's own hosted email-verification message. Activation
  // is finished later by the existing claimInvitedAdmin() path once the
  // invitee's session reports emailVerified === true — not here.
  try {
    await auth.sendVerificationEmail({
      email: adminUser.email,
      callbackURL: '/invite/verified',
    });
  } catch (error) {
    console.error('Could not send verification email:', error);
  }

  await prisma.$transaction([
    prisma.accessInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorId: adminUser.id,
        action: 'ACCESS_CLAIM_SUBMITTED',
        entityType: 'AdminUser',
        entityId: adminUser.id,
        metadata: { email: adminUser.email },
      },
    }),
  ]);

  return { success: true, email: adminUser.email };
}
