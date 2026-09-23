import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/server';

export async function POST() {
  try {
    const { error } = await auth.signOut();

    if (error) {
      console.error('Neon Auth sign-out failed:', error);

      return NextResponse.json(
        {
          ok: false,
          error: error.message || 'Could not sign out.',
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error('Neon Auth sign-out failed:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Could not sign out.',
      },
      {
        status: 500,
      },
    );
  }
}