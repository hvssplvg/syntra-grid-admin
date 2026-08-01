// app/clients/esteem-learning-centre/users/page.tsx

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  GraduationCap,
  Hash,
  Info,
  KeyRound,
  School,
  ShieldCheck,
  ShieldOff,
  UserX,
  Users,
} from 'lucide-react';

import {
  getEsteemUsers,
  type EsteemUsersPayload,
  type IntegrityIssue,
  type CounterState,
} from '@/lib/integrations/firebase/getUsers';
import { ESTEEM_ACCOUNT } from '@/lib/clients/esteem-account';
import { RefreshButton } from '@/lib/clients/RefreshButton';
import { UsersTable } from '@/lib/clients/UsersTable';

export const dynamic = 'force-dynamic';

const PREMIUM_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const WASH_SOFT =
  'linear-gradient(135deg, rgba(212,175,55,0.06), rgba(20,184,166,0.05)), #FAFAF9';
const BASE = '/clients/esteem-learning-centre';

type LoadState =
  | { ok: true; data: EsteemUsersPayload }
  | { ok: false; error: string };

export default async function EsteemUsersPage() {
  const state = await load();

  return (
    <div className="space-y-7">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-[#5A6173]">
        <Link href="/clients" className="font-semibold transition-colors hover:text-[#0D9488]">
          Clients
        </Link>
        <span className="text-[#5A6173]/35">/</span>
        <Link href={BASE} className="inline-flex items-center gap-1.5 font-semibold transition-colors hover:text-[#0D9488]">
          <ArrowLeft size={14} aria-hidden />
          {ESTEEM_ACCOUNT.name}
        </Link>
        <span className="text-[#5A6173]/35">/</span>
        <span className="font-medium text-[#0B1020]">Users</span>
      </nav>

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1020]">Users</h1>
          <p className="mt-1 text-sm text-[#5A6173]">
            Every account in the school Firebase project, with the record checks that keep the
            students, staff and users collections agreeing with each other.
          </p>
        </div>

        <RefreshButton />
      </header>

      {!state.ok ? (
        <ErrorPanel message={state.error} />
      ) : (
        <>
          <RosterMetrics counts={state.data.counts} />

          <IntegritySection issues={state.data.issues} />

          <CountersSection counters={state.data.counters} />

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-bold text-[#0B1020]">Roster</h2>
              <p className="mt-1 text-sm text-[#5A6173]">
                Read-only. Accounts are created and edited in the school&apos;s own admin dashboard.
              </p>
            </div>

            <UsersTable users={state.data.users} />
          </section>
        </>
      )}
    </div>
  );
}

async function load(): Promise<LoadState> {
  try {
    return { ok: true, data: await getEsteemUsers() };
  } catch (error) {
    console.error('Esteem users read failed:', error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error while reading the school Firebase project.',
    };
  }
}

/* ─────────────────────── sections ─────────────────────── */

function RosterMetrics({ counts }: { counts: EsteemUsersPayload['counts'] }) {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Metric label="Total accounts" value={counts.total} icon={Users} tone="gold" primary />
        <Metric label="Students" value={counts.student} icon={GraduationCap} tone="teal" />
        <Metric label="Teachers" value={counts.teacher} icon={School} tone="gold" />
        <Metric label="Admins" value={counts.admin} icon={ShieldCheck} tone="teal" />
        <Metric label="Support staff" value={counts.staff} icon={Users} tone="gold" />
      </div>

      {/* Signals — the numbers that need a decision, not just a count */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Signal
          icon={KeyRound}
          value={counts.neverSignedIn}
          label="never signed in"
          detail="Still holding the temporary password issued at creation."
          tone={counts.neverSignedIn > 0 ? 'warn' : 'ok'}
        />
        <Signal
          icon={UserX}
          value={counts.deactivated}
          label="deactivated"
          detail="Account exists but is switched off."
          tone={counts.deactivated > 0 ? 'muted' : 'ok'}
        />
        <Signal
          icon={ShieldOff}
          value={counts.noDashboardAccess}
          label="without dashboard access"
          detail="Support staff who work off-system by design."
          tone="muted"
        />
      </div>
    </section>
  );
}

function IntegritySection({ issues }: { issues: IntegrityIssue[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-[#0B1020]">Record checks</h2>
        <p className="mt-1 text-sm text-[#5A6173]">
          Every account is written twice — once to <code className="rounded bg-[#0B1020]/[0.05] px-1 py-0.5 font-mono text-xs">users</code>{' '}
          and once to <code className="rounded bg-[#0B1020]/[0.05] px-1 py-0.5 font-mono text-xs">students</code> or{' '}
          <code className="rounded bg-[#0B1020]/[0.05] px-1 py-0.5 font-mono text-xs">staff</code>. These checks confirm the pair still agrees.
        </p>
      </div>

      {issues.length === 0 ? (
        <div
          className="flex items-center gap-3 rounded-2xl border border-[#14B8A6]/20 p-4"
          style={{ background: WASH_SOFT }}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#14B8A6]/12 text-[#0D9488]">
            <CheckCircle2 size={17} aria-hidden />
          </div>
          <p className="text-sm text-[#5A6173]">
            All records paired, all IDs unique, counters ahead of the highest issued ID.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue) => (
            <li key={issue.code}>
              <IssueRow issue={issue} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CountersSection({ counters }: { counters: CounterState[] }) {
  const anyCollision = counters.some((counter) => counter.willCollide);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-[#0B1020]">ID counters</h2>
        <p className="mt-1 text-sm text-[#5A6173]">
          The next ID each role will be given, checked against the highest one already in use.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counters.map((counter) => (
          <div
            key={counter.role}
            className={`rounded-2xl border p-4 ${
              counter.willCollide
                ? 'border-red-200 bg-red-50/70'
                : 'border-[#0B1020]/[0.06] bg-white'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6173]">
              {counter.role}
            </p>

            <p
              className={`mt-2.5 font-mono text-lg font-bold ${
                counter.willCollide ? 'text-red-700' : 'text-[#0B1020]'
              }`}
            >
              {nextId(counter)}
            </p>

            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[#5A6173]">
              <Hash size={11} aria-hidden />
              highest in use {counter.highestIssued || '—'}
            </p>

            {counter.willCollide && (
              <p className="mt-2 text-xs font-bold text-red-700">
                Next create would collide
              </p>
            )}
          </div>
        ))}
      </div>

      {anyCollision && (
        <p className="text-xs text-[#5A6173]">
          Fix by raising the affected value in{' '}
          <code className="rounded bg-[#0B1020]/[0.05] px-1 py-0.5 font-mono">
            systemCounters/school_esteem
          </code>{' '}
          to at least the highest ID in use, before anyone creates another account.
        </p>
      )}
    </section>
  );
}

function nextId(counter: CounterState) {
  const prefix = {
    student: 'ELC-STD-',
    teacher: 'ELC-TCH-',
    admin: 'ELC-ADM-',
    staff: 'ELC-STF-',
  }[counter.role];

  return `${prefix}${String(counter.counter + 1).padStart(4, '0')}`;
}

/* ─────────────────────── pieces ─────────────────────── */

const TONES = {
  gold: {
    icon: 'bg-gradient-to-br from-[#F3DFA2] via-[#D4AF37] to-[#A87B1B] text-[#3A2B05]',
    value: 'text-[#A87B1B]',
  },
  teal: {
    icon: 'bg-gradient-to-br from-[#5EEAD4] via-[#14B8A6] to-[#0D9488] text-[#04312B]',
    value: 'text-[#0D9488]',
  },
} as const;

function Metric({
  label,
  value,
  icon: Icon,
  tone,
  primary = false,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: keyof typeof TONES;
  primary?: boolean;
}) {
  const current = TONES[tone];

  return (
    <div
      className="rounded-2xl border border-[#0B1020]/[0.06] bg-white p-4 shadow-sm transition-all duration-300 hover:border-[#D4AF37]/25 hover:shadow-[0_12px_24px_rgba(11,16,32,0.06)] motion-reduce:transition-none"
      style={{ transitionTimingFunction: PREMIUM_EASE }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6173]">
          {label}
        </p>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${current.icon}`}
        >
          <Icon size={15} strokeWidth={2.25} aria-hidden />
        </div>
      </div>

      <p
        className={`mt-3 font-bold tabular-nums ${current.value} ${primary ? 'text-3xl' : 'text-2xl'}`}
      >
        {value}
      </p>
    </div>
  );
}

function Signal({
  icon: Icon,
  value,
  label,
  detail,
  tone,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  detail: string;
  tone: 'ok' | 'warn' | 'muted';
}) {
  const iconClass =
    tone === 'warn'
      ? 'bg-amber-100 text-amber-600'
      : tone === 'ok'
      ? 'bg-[#14B8A6]/12 text-[#0D9488]'
      : 'bg-[#0B1020]/[0.05] text-[#5A6173]';

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#0B1020]/[0.06] bg-white p-4">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
        <Icon size={16} aria-hidden />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-bold text-[#0B1020]">
          <span className="tabular-nums">{value}</span>{' '}
          <span className="font-semibold text-[#5A6173]">{label}</span>
        </p>
        <p className="mt-0.5 text-xs leading-5 text-[#5A6173]">{detail}</p>
      </div>
    </div>
  );
}

const ISSUE_TONES = {
  critical: {
    wrap: 'border-red-200 bg-red-50/70',
    icon: 'bg-red-100 text-red-600',
    title: 'text-red-800',
    body: 'text-red-700',
    chip: 'bg-white text-red-700',
    Icon: AlertTriangle,
  },
  warn: {
    wrap: 'border-amber-200 bg-amber-50/70',
    icon: 'bg-amber-100 text-amber-600',
    title: 'text-amber-900',
    body: 'text-amber-800',
    chip: 'bg-white text-amber-800',
    Icon: AlertTriangle,
  },
  info: {
    wrap: 'border-[#D4AF37]/25',
    icon: 'bg-[#D4AF37]/12 text-[#A87B1B]',
    title: 'text-[#0B1020]',
    body: 'text-[#5A6173]',
    chip: 'bg-white text-[#5A6173]',
    Icon: Info,
  },
} as const;

function IssueRow({ issue }: { issue: IntegrityIssue }) {
  const current = ISSUE_TONES[issue.severity];
  const { Icon } = current;
  const hidden = issue.affectedCount - issue.affected.length;

  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 ${current.wrap}`}
      style={issue.severity === 'info' ? { background: WASH_SOFT } : undefined}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${current.icon}`}>
        <Icon size={17} aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-bold ${current.title}`}>{issue.title}</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${current.chip}`}>
            {issue.affectedCount}
          </span>
        </div>

        <p className={`mt-1 text-sm ${current.body}`}>{issue.detail}</p>

        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {issue.affected.map((entry) => (
            <li
              key={entry}
              className="rounded-md bg-white/80 px-2 py-1 font-mono text-[11px] text-[#0B1020]"
            >
              {entry}
            </li>
          ))}
          {hidden > 0 && (
            <li className={`px-2 py-1 text-[11px] font-semibold ${current.body}`}>
              and {hidden} more
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
        <AlertTriangle size={17} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-red-800">Could not read the user records</p>
        <p className="mt-1 break-words text-sm text-red-700">{message}</p>
        <p className="mt-2 text-xs text-red-700/80">
          Check the service-account credentials in your environment variables, then refresh.
        </p>
      </div>
    </div>
  );
}