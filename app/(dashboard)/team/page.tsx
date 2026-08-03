// app/(dashboard)/team/page.tsx

import { AlertTriangle, ShieldCheck, UserRound } from 'lucide-react';

import { requireAdmin } from '@/lib/auth/current-admin';
import { prisma } from '@/lib/prisma';

import { InviteAdmin } from './InviteAdmin';
import { AdminRow } from './AdminRow';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team · Syntra Grid' };

const CAN_MANAGE = ['OWNER', 'ADMIN'];

/** What each role can actually reach, in plain words. */
const ROLE_DESCRIPTIONS: Record<string, string> = {
  OWNER: 'Everything, including billing and other owners',
  ADMIN: 'Everything except creating owners',
  DEVELOPER: 'Clients, projects and integrations',
  SUPPORT: 'Tickets and client records',
  FINANCE: 'Banking, invoices and billing',
  VIEWER: 'Read-only across the admin',
};

export default async function TeamPage() {
  // Must be inside the component. At module scope this would run at import
  // time, with no request and therefore no session.
  const actor = await requireAdmin();
  const canManage = CAN_MANAGE.includes(actor.role);

  const admins = await prisma.adminUser.findMany({
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      role: true,
      active: true,
      authUserId: true,
      createdAt: true,
      _count: { select: { tickets: true } },
    },
  });

  const pending = admins.filter((admin) => !admin.authUserId && admin.active).length;

  return (
    <div className="space-y-7">
      <header>
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-[#A87B1B]" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#A87B1B]">
            Access control
          </p>
        </div>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0B1020]">Team</h1>

        <p className="mt-1 max-w-xl text-sm leading-6 text-[#5A6173]">
          Who can sign in to Syntra Grid, and what each of them can reach.
        </p>
      </header>

      {pending > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-sm leading-6 text-amber-800">
            <span className="font-bold">
              {pending} {pending === 1 ? 'account has' : 'accounts have'} never signed in.
            </span>{' '}
            Their access starts the first time they authenticate with that email
            address.
          </p>
        </div>
      )}

      {canManage && <InviteAdmin isOwner={actor.role === 'OWNER'} />}

      <section className="rounded-3xl border border-[#D4AF37]/15 bg-white shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
        <div className="border-b border-[#0B1020]/[0.06] p-5 sm:p-6">
          <h2 className="text-base font-bold text-[#0B1020]">
            {admins.length} {admins.length === 1 ? 'person' : 'people'}
          </h2>
          <p className="mt-1 text-sm text-[#5A6173]">
            {admins.filter((admin) => admin.active).length} active.
          </p>
        </div>

        {admins.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <UserRound size={22} className="mx-auto text-[#5A6173]/40" />
            <p className="mt-3 text-sm font-bold text-[#0B1020]">Nobody yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#0B1020]/[0.05]">
            {admins.map((admin) => (
              <AdminRow
                key={admin.id}
                id={admin.id}
                name={
                  [admin.firstName, admin.lastName].filter(Boolean).join(' ') ||
                  admin.email
                }
                email={admin.email}
                avatarUrl={admin.avatarUrl}
                role={admin.role}
                active={admin.active}
                linked={Boolean(admin.authUserId)}
                assignedTickets={admin._count.tickets}
                isSelf={admin.id === actor.id}
                canManage={canManage}
                canGrantOwner={actor.role === 'OWNER'}
              />
            ))}
          </ul>
        )}
      </section>

      {/* What the roles mean — worth stating, since the names are not obvious */}
      <section className="rounded-3xl border border-[#D4AF37]/15 bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)] sm:p-6">
        <h2 className="text-base font-bold text-[#0B1020]">Roles</h2>
        <p className="mt-1 text-sm text-[#5A6173]">
          Give the narrowest role that lets someone do their job.
        </p>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => (
            <div
              key={role}
              className="rounded-xl border border-[#0B1020]/[0.06] bg-[#FAFAF9] p-3.5"
            >
              <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#A87B1B]">
                {role.replaceAll('_', ' ')}
              </dt>
              <dd className="mt-1 text-xs leading-5 text-[#5A6173]">{description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}