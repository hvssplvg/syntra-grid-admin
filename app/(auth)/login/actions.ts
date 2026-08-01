'use server';

import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

export type AuthActionState = {
  error?: string;
  success?: string;
};

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === 'string' ? value.trim() : '';
}

export async function signInAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = getText(formData, 'email').toLowerCase();
  const password = getText(formData, 'password');

  if (!email || !password) {
    return {
      error: 'Enter your email address and password.',
    };
  }

  const admin = await prisma.adminUser.findUnique({
    where: {
      email,
    },
  });

  if (!admin || !admin.active) {
    return {
      error: 'This account is not authorised to access CentraGrid.',
    };
  }

  const signInResult = await auth.signIn.email({
    email,
    password,
  });

  if (signInResult.error) {
    console.error('Neon Auth sign-in failed:', signInResult.error);

    return {
      error: 'The email address or password is incorrect.',
    };
  }

  const authUserId = signInResult.data?.user?.id;

  if (!authUserId) {
    return {
      error: 'Neon Auth did not return a user ID.',
    };
  }

  if (admin.authUserId && admin.authUserId !== authUserId) {
    await auth.signOut();

    return {
      error: 'This login account is not linked to the CentraGrid profile.',
    };
  }

  if (!admin.authUserId) {
    await prisma.adminUser.update({
      where: {
        id: admin.id,
      },
      data: {
        authUserId,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'AUTH_SIGN_IN',
      entityType: 'AdminUser',
      entityId: admin.id,
      metadata: {
        email: admin.email,
        role: admin.role,
        authUserId,
      },
    },
  });

  redirect('/dashboard');
}

export async function setupOwnerAction(
  _previousState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = getText(formData, 'email').toLowerCase();
  const firstName = getText(formData, 'firstName');
  const lastName = getText(formData, 'lastName');
  const password = getText(formData, 'password');
  const confirmPassword = getText(formData, 'confirmPassword');
  const setupSecret = getText(formData, 'setupSecret');

  const expectedEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const expectedSetupSecret = process.env.OWNER_SETUP_SECRET?.trim();

  if (!expectedEmail || !expectedSetupSecret) {
    return {
      error: 'Owner setup has not been configured.',
    };
  }

  if (setupSecret !== expectedSetupSecret) {
    return {
      error: 'The owner setup code is incorrect.',
    };
  }

  if (email !== expectedEmail) {
    return {
      error: 'Use the owner email configured for CentraGrid.',
    };
  }

  if (!firstName) {
    return {
      error: 'Enter your first name.',
    };
  }

  if (password.length < 12) {
    return {
      error: 'Your password must contain at least 12 characters.',
    };
  }

  if (password !== confirmPassword) {
    return {
      error: 'The passwords do not match.',
    };
  }

  const owner = await prisma.adminUser.findUnique({
    where: {
      email: expectedEmail,
    },
  });

  if (!owner) {
    return {
      error: 'The CentraGrid owner profile could not be found.',
    };
  }

  if (owner.role !== 'OWNER') {
    return {
      error: 'The configured account is not an owner account.',
    };
  }

  if (!owner.active) {
    return {
      error: 'The owner profile is currently disabled.',
    };
  }

  if (owner.authUserId) {
    return {
      error: 'The owner account has already been configured. Sign in instead.',
    };
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  let authUserId: string | undefined;

  const signUpResult = await auth.signUp.email({
    email: expectedEmail,
    name: fullName,
    password,
  });

  if (!signUpResult.error) {
    authUserId = signUpResult.data?.user?.id;
  } else {
    const message = signUpResult.error.message?.toLowerCase() || '';

    const accountAlreadyExists =
      message.includes('already exists') ||
      message.includes('already registered') ||
      message.includes('user exists');

    if (!accountAlreadyExists) {
      console.error('Neon Auth signup failed:', signUpResult.error);

      return {
        error:
          signUpResult.error.message ||
          'The owner authentication account could not be created.',
      };
    }

    // The earlier attempt may already have created the Neon Auth account.
    // Sign in with the submitted password and use the returned user ID.
    const signInResult = await auth.signIn.email({
      email: expectedEmail,
      password,
    });

    if (signInResult.error) {
      console.error(
        'Existing Neon Auth owner sign-in failed:',
        signInResult.error
      );

      return {
        error:
          'The authentication account already exists, but the password did not match.',
      };
    }

    authUserId = signInResult.data?.user?.id;
  }

  if (!authUserId) {
    return {
      error: 'Neon Auth did not return a user ID.',
    };
  }

  await prisma.adminUser.update({
    where: {
      id: owner.id,
    },
    data: {
      authUserId,
      firstName,
      lastName: lastName || null,
      active: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: owner.id,
      action: 'OWNER_ACCOUNT_SETUP',
      entityType: 'AdminUser',
      entityId: owner.id,
      metadata: {
        email: owner.email,
        authUserId,
      },
    },
  });

  redirect('/dashboard');
}