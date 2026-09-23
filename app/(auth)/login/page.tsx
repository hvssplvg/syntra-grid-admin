import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

import AuthBackdrop from './Authbackdrop';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const { data: session } = await auth.getSession();

  if (session?.user) {
    redirect('/dashboard');
  }

  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase() ?? '';

  const owner = ownerEmail
    ? await prisma.adminUser.findUnique({
        where: {
          email: ownerEmail,
        },
        select: {
          authUserId: true,
        },
      })
    : null;

  const ownerNeedsSetup = !!owner && !owner.authUserId;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FBFBFD] px-4 py-10">
      {/* Brand wash: gold above, teal below, the same pairing as the site. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-44 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[#D4AF37]/25 blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 left-1/4 h-[460px] w-[460px] rounded-full bg-[#14B8A6]/20 blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(11,16,32,0.07) 1px, transparent 0)',
          backgroundSize: '38px 38px',
          maskImage:
            'radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 75%)',
        }}
      />

      <AuthBackdrop />

      <div className="relative flex w-full flex-col items-center">
        <LoginForm
          ownerNeedsSetup={ownerNeedsSetup}
          ownerEmail={ownerEmail}
        />

        <p className="mt-7 text-center text-xs leading-5 text-[#5A6173]">
          CentraGrid · Internal access only
          <br />
          Syntra Grid LTD
        </p>
      </div>
    </main>
  );
}