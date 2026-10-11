import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { hashInviteToken } from '@/lib/access/server';

import AuthBackdrop from '../../login/Authbackdrop';
import ClaimForm from './ClaimForm';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: PageProps) {
  const { data: session } = await auth.getSession();

  if (session?.user) {
    redirect('/dashboard');
  }

  const { token } = await params;
  const tokenHash = hashInviteToken(token);

  const invite = await prisma.accessInvite.findUnique({
    where: { tokenHash },
    select: {
      expiresAt: true,
      usedAt: true,
      adminUser: {
        select: { email: true, firstName: true, lastName: true },
      },
    },
  });

  let state: 'invalid' | 'expired' | 'used' | 'valid' = 'invalid';

  if (invite) {
    if (invite.usedAt) {
      state = 'used';
    } else if (invite.expiresAt < new Date()) {
      state = 'expired';
    } else {
      state = 'valid';
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FBFBFD] px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-44 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[#D4AF37]/25 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 left-1/4 h-[460px] w-[460px] rounded-full bg-[#14B8A6]/20 blur-[120px]"
      />

      <AuthBackdrop />

      <div className="relative flex w-full flex-col items-center">
        {state === 'valid' && invite ? (
          <ClaimForm
            token={token}
            email={invite.adminUser.email}
            name={[invite.adminUser.firstName, invite.adminUser.lastName]
              .filter(Boolean)
              .join(' ')}
          />
        ) : (
          <InviteProblem state={state === 'valid' ? 'invalid' : state} />
        )}

        <p className="mt-7 text-center text-xs leading-5 text-[#5A6173]">
          CentraGrid · Internal access only
          <br />
          Syntra Grid LTD
        </p>
      </div>
    </main>
  );
}

function InviteProblem({ state }: { state: 'invalid' | 'expired' | 'used' }) {
  const copy = {
    invalid: {
      title: 'This invitation link is not valid.',
      body: 'Double-check the link, or ask whoever invited you to send a new one.',
    },
    expired: {
      title: 'This invitation has expired.',
      body: 'Invitation links are valid for 7 days. Ask whoever invited you to send a new one.',
    },
    used: {
      title: 'This invitation has already been used.',
      body: 'If you already set a password, sign in instead. If this looks wrong, contact your administrator.',
    },
  }[state];

  return (
    <div className="w-full max-w-sm rounded-2xl border border-[#0B1020]/10 bg-white p-8 text-center shadow-[0_24px_60px_-20px_rgba(11,16,32,0.25)]">
      <h1 className="text-lg font-semibold text-[#0B1020]">{copy.title}</h1>
      <p className="mt-2 text-sm leading-6 text-[#5A6173]">{copy.body}</p>

      <a
        href="/login"
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0B1020] text-sm font-semibold text-white transition hover:opacity-90"
      >
        Go to sign in
      </a>
    </div>
  );
}
