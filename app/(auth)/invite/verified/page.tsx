import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

/**
 * Landing spot for Neon Auth's own email-verification link
 * (auth.sendVerificationEmail's callbackURL in
 * app/(auth)/invite/[token]/actions.ts). It does no linking itself —
 * visiting /dashboard with a now-verified session is what lets
 * getCurrentAdmin() -> claimInvitedAdmin() (lib/auth/current-admin.ts,
 * unmodified) perform the actual activation.
 */
export default async function InviteVerifiedPage() {
  const { data: session } = await auth.getSession();

  redirect(session?.user ? '/dashboard' : '/login');
}
