import { redirect } from 'next/navigation';
import {
  Activity,
  Building2,
  Database,
  ShieldCheck,
} from 'lucide-react';

import { auth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';

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
    <main className="min-h-screen bg-[#F4F8FD] p-4 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1440px] overflow-hidden rounded-[32px] border border-[#102A22]/[0.06] bg-white shadow-2xl shadow-[#102A22]/[0.08] lg:grid-cols-[1.05fr_0.95fr] sm:min-h-[calc(100vh-3rem)]">
        <section className="relative hidden overflow-hidden bg-[#102A22] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#1E4E8C]/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-[#0F6A4B]/30 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#102A22]">
                <ShieldCheck size={21} />
              </div>

              <div>
                <p className="text-lg font-bold tracking-tight">syntraGrid</p>
                <p className="text-xs text-white/55">
                  Business Operations Platform
                </p>
              </div>
            </div>

            <div className="mt-24 max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/50">
                Centralised operations
              </p>

              <h2 className="mt-5 text-5xl font-bold leading-[1.08] tracking-tight">
                Every client.
                <br />
                Every system.
                <br />
                One control centre.
              </h2>

              <p className="mt-6 max-w-lg text-base leading-7 text-white/65">
                Monitor client platforms, manage projects, track support,
                review deployments and oversee business performance.
              </p>
            </div>
          </div>

          <div className="relative grid grid-cols-3 gap-3">
            <Feature icon={Building2} label="Clients" value="2 active" />
            <Feature icon={Activity} label="Systems" value="Operational" />
            <Feature icon={Database} label="Data" value="Connected" />
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12 sm:px-12 lg:px-16">
          <LoginForm
            ownerNeedsSetup={ownerNeedsSetup}
            ownerEmail={ownerEmail}
          />
        </section>
      </div>
    </main>
  );
}

function Feature({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
      <Icon size={16} className="text-white/60" />

      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}