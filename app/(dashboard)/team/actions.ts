'use server';

// app/(dashboard)/team/actions.ts
//
// Creating a team member does two things:
//   1. auth.signUp.email() creates the Better Auth account with a temporary
//      password that you hand over.
//   2. An AdminUser row is created with authUserId already linked, so the
//      person can sign in immediately.
//
// Linking at creation means getCurrentAdmin() never has to claim the row by
// email, which removes the whole emailVerified problem.

import crypto from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth/server';
import { requireTeamManager } from '@/lib/auth/current-admin';
import { prisma } from '@/lib/prisma';

import type { FormState } from './types';

const ROLES = ['OWNER', 'ADMIN', 'DEVELOPER', 'SUPPORT', 'FINANCE', 'VIEWER'] as const;
type Role = (typeof ROLES)[number];

function text(data: FormData, key: string): string {
  return String(data.get(key) ?? '').trim();
}

function toRole(value: string): Role | null {
  return (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

/**
 * Readable temporary password. Ambiguous characters are excluded so it can be
 * dictated over the phone without confusion between 0/O and 1/l.
 */
function temporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(14);

  let value = '';
  for (const byte of bytes) value += alphabet[byte % alphabet.length];

  // Non-alphanumerics keep it valid under most password policies.
  return `SG-${value.slice(0, 7)}-${value.slice(7)}`;
}

/** Refuse to leave the account with nobody able to manage it. */
async function assertNotLastOwner(adminUserId: string) {
  const target = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: { role: true },
  });

  if (target?.role !== 'OWNER') return;

  const owners = await prisma.adminUser.count({
    where: { role: 'OWNER', active: true },
  });

  if (owners <= 1) {
    throw new Error('There must always be at least one active owner.');
  }
}

export async function inviteAdmin(
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  let actor;

  try {
    actor = await requireTeamManager();
  } catch (error) {
    return {
      ok: false,
      errors: {},
      message: error instanceof Error ? error.message : 'Not permitted.',
    };
  }

  const errors: Record<string, string> = {};

  const email = text(data, 'email').toLowerCase();
  const firstName = text(data, 'firstName');
  const lastName = text(data, 'lastName');

  if (!email) errors.email = 'An email address is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'That does not look like an email address.';
  }

  const role = toRole(text(data, 'role')) ?? 'VIEWER';

  // Only an owner may mint another owner — otherwise an admin could promote
  // themselves past the person who hired them.
  if (role === 'OWNER' && actor.role !== 'OWNER') {
    errors.role = 'Only an owner can create another owner.';
  }

  if (!errors.email) {
    const existing = await prisma.adminUser.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) errors.email = 'Someone with that email already has access.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, message: 'Fix the highlighted fields.' };
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || email;
  const password = temporaryPassword();

  // Creating a user server-side can set the session cookie for that new user,
  // which would replace the signed-in admin. Note who we are beforehand so the
  // swap can at least be detected and reported.
  const actorAuthUserId = actor.authUserId;

  let authUserId: string;

  try {
    const { data: created, error } = await auth.signUp.email({
      email,
      password,
      name: fullName,
    });

    if (error || !created?.user?.id) {
      return {
        ok: false,
        errors: {
          email:
            error?.message ??
            'The sign-in provider refused to create that account.',
        },
        message: 'Could not create the login.',
      };
    }

    authUserId = created.user.id;
  } catch (error) {
    console.error('Auth sign-up failed:', error);
    return { ok: false, errors: {}, message: 'Could not create the login.' };
  }

  try {
    await prisma.adminUser.create({
      data: {
        authUserId,
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        role,
        active: true,
      },
    });
  } catch (error) {
    // The login now exists with no permission record — say so plainly rather
    // than leaving a mismatch nobody knows about.
    console.error('AdminUser create failed after sign-up:', error);

    return {
      ok: false,
      errors: {},
      message:
        'The login was created but the permission record was not. Remove the account in Neon Auth and try again.',
    };
  }

  const { data: nowSession } = await auth.getSession().catch(() => ({ data: null }));
  const sessionReplaced =
    Boolean(actorAuthUserId) && nowSession?.user?.id !== actorAuthUserId;

  revalidatePath('/team');

  return {
    ok: true,
    errors: {},
    message: `${fullName} can sign in now.`,
    credentials: { name: fullName, email, password },
    sessionReplaced,
  };
}

export async function setAdminRole(adminUserId: string, rawRole: string) {
  const actor = await requireTeamManager();

  const role = toRole(rawRole);
  if (!role) throw new Error('Unknown role.');

  if (role === 'OWNER' && actor.role !== 'OWNER') {
    throw new Error('Only an owner can grant owner access.');
  }

  if (role !== 'OWNER') await assertNotLastOwner(adminUserId);

  await prisma.adminUser.update({ where: { id: adminUserId }, data: { role } });

  revalidatePath('/team');
}

export async function setAdminActive(adminUserId: string, active: boolean) {
  const actor = await requireTeamManager();

  if (adminUserId === actor.id && !active) {
    throw new Error('You cannot remove your own access.');
  }

  if (!active) await assertNotLastOwner(adminUserId);

  await prisma.adminUser.update({ where: { id: adminUserId }, data: { active } });

  revalidatePath('/team');
}