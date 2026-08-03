import crypto from 'node:crypto';

import { NextResponse } from 'next/server';

import {
  AuthenticationError,
  AuthorisationError,
  requireFinanceAdmin,
} from '@/lib/auth/current-admin';
import { createMonzoAuthorisationUrl } from '@/lib/monzo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const admin = await requireFinanceAdmin();

    const state = crypto.randomBytes(32).toString('hex');
    const authorisationUrl = createMonzoAuthorisationUrl(state);

    const response = NextResponse.redirect(authorisationUrl);

    response.cookies.set('monzo_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/',
    });

    response.cookies.set('monzo_oauth_admin', admin.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    const loginUrl = new URL('/login', request.url);
    const financeUrl = new URL('/finance', request.url);

    if (error instanceof AuthenticationError) {
      loginUrl.searchParams.set('returnTo', '/finance');

      return NextResponse.redirect(loginUrl);
    }

    if (error instanceof AuthorisationError) {
      financeUrl.searchParams.set('monzo', 'not_authorised');

      return NextResponse.redirect(financeUrl);
    }

    console.error('Unable to start Monzo OAuth:', error);

    financeUrl.searchParams.set('monzo', 'connection_failed');

    return NextResponse.redirect(financeUrl);
  }
}