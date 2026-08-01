// app/clients/esteem-learning-centre/page.tsx

import Image from 'next/image';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Database,
  FileText,
  GraduationCap,
  Info,
  LifeBuoy,
  Minus,
  School,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';

import {
  getEsteemOverview,
  type EsteemOverview,
} from '@/lib/integrations/firebase/getOverview';
import { ESTEEM_ACCOUNT } from '@/lib/clients/esteem-account';
import { RefreshButton } from '@/lib/clients/RefreshButton';

export const dynamic = 'force-dynamic';

// Theme tokens — keep in sync with Sidebar / Navbar / DashboardPage.
// ink: #0B1020   muted: #5A6173   gold: #D4AF37 / #A87B1B   teal: #14B8A6 / #0D9488
const PREMIUM_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const GOLD = 'linear-gradient(135deg,#F3DFA2,#D4AF37 60%,#C79A2A)';
const WASH_SOFT =
  'linear-gradient(135deg, rgba(212,175,55,0.06), rgba(20,184,166,0.05)), #FAFAF9';

const BASE = '/clients/esteem-learning-centre';

/**
 * Fields the page uses beyond the current EsteemOverview. All optional, so the
 * page compiles and degrades gracefully until getOverview() returns them.
 * See the notes at the bottom of this file for the queries to add.
 */
type EsteemOverviewPlus = EsteemOverview & {
  activeLast7Days?: number;
  activeLast30Days?: number;
  admissionsPending?: number;
  admissionsThisTerm?: number;
  quizzes?: number;
  quizAttempts?: number;
  recentUsers?: {
    id: string;
    name: string;
    role: string;
    createdAt: string; // ISO
  }[];
  weeklyActivity?: { label: string; value: number }[];
};

type IntegrationState = {
  status: 'connected' | 'disconnected';
  overview: EsteemOverviewPlus | null;
  error: string | null;
  checkedAt: Date;
};

export default async function EsteemLearningCentrePage() {
  const integration = await loadEsteemIntegration();
  const account = ESTEEM_ACCOUNT;
  const data = integration.overview;

  const totalUsers =
    (data?.students ?? 0) + (data?.teachers ?? 0) + (data?.admins ?? 0);

  const renewalInDays = daysUntil(account.renewalAt);
  const attention = buildAttentionItems({ integration, account, renewalInDays });

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-[#5A6173]">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 font-semibold transition-colors duration-200 hover:text-[#0D9488]"
        >
          <ArrowLeft size={14} aria-hidden />
          Clients
        </Link>
        <span className="text-[#5A6173]/35">/</span>
        <span className="font-medium text-[#0B1020]">{account.name}</span>
      </nav>

      {/* ── Header: account facts, not decoration ─────────────────────────── */}
      <header className="rounded-3xl border border-[#D4AF37]/15 bg-white shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <ClientMark logo={account.logo} name={account.name} />

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[#0B1020]">
                  {account.name}
                </h1>
                <AccountStatusPill status={account.status} />
              </div>

              <p className="mt-1 text-sm text-[#5A6173]">
                {account.productName} · live since {formatDate(account.liveSince)}
              </p>

              <a
                href={`https://${account.domain}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D9488] transition-colors hover:text-[#0B1020]"
              >
                {account.domain}
                <ArrowUpRight size={13} aria-hidden />
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton />
            <a
              href={account.adminUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-[#241A05] transition hover:brightness-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A87B1B]"
              style={{ background: GOLD, boxShadow: '0 10px 26px rgba(212,175,55,0.3)' }}
            >
              Open school admin
              <ArrowUpRight size={15} aria-hidden />
            </a>
          </div>
        </div>

        {/* Account facts row */}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-3xl border-t border-[#0B1020]/[0.06] bg-[#0B1020]/[0.06] sm:grid-cols-3 lg:grid-cols-5">
          <Fact label="Client ID" value={account.clientRef} mono />
          <Fact label="Plan" value={account.plan} />
          <Fact
            label="Billing"
            value={account.billingCycle === 'annual' ? 'Annual' : 'Monthly'}
          />
          <Fact
            label="Renews"
            value={formatDate(account.renewalAt)}
            hint={renewalLabel(renewalInDays)}
            hintTone={renewalInDays <= 90 ? 'warn' : 'muted'}
          />
          <Fact
            label="Primary contact"
            value={account.primaryContact.name}
            hint={account.primaryContact.role}
          />
        </dl>
      </header>

      {/* ── Needs attention: the reason to open this page ─────────────────── */}
      <section aria-labelledby="attention-heading">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 id="attention-heading" className="text-base font-bold text-[#0B1020]">
            Needs attention
          </h2>
          <p className="text-xs font-semibold text-[#5A6173]">
            Checked {formatTime(integration.checkedAt)}
          </p>
        </div>

        {attention.length === 0 ? (
          <div
            className="flex items-center gap-3 rounded-2xl border border-[#14B8A6]/20 p-4"
            style={{ background: WASH_SOFT }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#14B8A6]/12 text-[#0D9488]">
              <ShieldCheck size={17} aria-hidden />
            </div>
            <p className="text-sm text-[#5A6173]">
              Nothing outstanding. Platform healthy, no pending requests, no open
              tickets.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {attention.map((item) => (
              <li key={item.title}>
                <AttentionRow {...item} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── People ────────────────────────────────────────────────────────── */}
      <section aria-labelledby="people-heading" className="space-y-4">
        <SectionHeading
          id="people-heading"
          title="People"
          description="Who has an account and who joined recently."
          href={`${BASE}/users`}
          linkLabel="View all users"
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              label="Total accounts"
              value={data ? totalUsers : '—'}
              description="Students, teachers and admins"
              icon={Users}
              tone="gold"
            />
            <MetricCard
              label="Students"
              value={data?.students ?? '—'}
              description="Enrolled learner accounts"
              icon={GraduationCap}
              tone="teal"
            />
            <MetricCard
              label="Teachers"
              value={data?.teachers ?? '—'}
              description="Teaching staff accounts"
              icon={School}
              tone="gold"
            />
            <MetricCard
              label="Administrators"
              value={data?.admins ?? '—'}
              description="Admin and ICT accounts"
              icon={ShieldCheck}
              tone="teal"
            />
          </div>

          {/* Recently added */}
          <div className="rounded-3xl border border-[#D4AF37]/15 bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#0B1020]">Recently added</h3>
              <UserPlus size={16} className="text-[#0D9488]" aria-hidden />
            </div>

            {data?.recentUsers?.length ? (
              <ul className="mt-4 space-y-3">
                {data.recentUsers.slice(0, 5).map((user) => (
                  <li key={user.id} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B1020]/[0.05] text-[10px] font-bold text-[#5A6173]">
                      {initials(user.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#0B1020]">
                        {user.name}
                      </span>
                      <span className="block text-xs text-[#5A6173]">
                        {user.role} · {formatRelative(user.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyNote>
                No sign-up feed yet. Add <code>recentUsers</code> to{' '}
                <code>getEsteemOverview()</code> to list the last accounts created.
              </EmptyNote>
            )}
          </div>
        </div>
      </section>

      {/* ── Adoption ──────────────────────────────────────────────────────── */}
      <section aria-labelledby="adoption-heading" className="space-y-4">
        <SectionHeading
          id="adoption-heading"
          title="Adoption"
          description="Whether the school is actually using what you built."
          href={`${BASE}/platform-activity`}
          linkLabel="Platform activity"
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.65fr_1.35fr]">
          {/* Active users + trend */}
          <div className="rounded-3xl border border-[#D4AF37]/15 bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)] sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6173]">
              Active this week
            </p>

            <div className="mt-3 flex items-end gap-3">
              <p className="text-4xl font-bold tabular-nums text-[#0B1020]">
                {data?.activeLast7Days ?? '—'}
              </p>
              {typeof data?.activeLast7Days === 'number' && totalUsers > 0 && (
                <p className="pb-1.5 text-xs font-semibold text-[#5A6173]">
                  {Math.round((data.activeLast7Days / totalUsers) * 100)}% of accounts
                </p>
              )}
            </div>

            {data?.weeklyActivity?.length ? (
              <Sparkbars series={data.weeklyActivity} />
            ) : (
              <EmptyNote className="mt-4">
                No trend yet. Add <code>weeklyActivity</code> (8 weeks of counts) and{' '}
                <code>activeLast7Days</code> to <code>getEsteemOverview()</code>.
              </EmptyNote>
            )}
          </div>

          {/* Module usage */}
          <div className="rounded-3xl border border-[#D4AF37]/15 bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)] sm:p-6">
            <h3 className="text-sm font-bold text-[#0B1020]">Where usage sits</h3>
            <p className="mt-1 text-sm text-[#5A6173]">
              Records created per module, all time.
            </p>

            <div className="mt-5 space-y-4">
              <UsageBar
                icon={ClipboardList}
                label="Lesson plans"
                value={data?.lessonPlans ?? 0}
                max={moduleMax(data)}
                href={`${BASE}/academics/lesson-plans`}
              />
              <UsageBar
                icon={BookOpen}
                label="Assignments"
                value={data?.assignments ?? 0}
                max={moduleMax(data)}
                href={`${BASE}/academics/assignments`}
              />
              <UsageBar
                icon={FileText}
                label="Exam requests"
                value={data?.examRequests ?? 0}
                max={moduleMax(data)}
                href={`${BASE}/academics/exam-printing`}
              />
              <UsageBar
                icon={Database}
                label="CBT quizzes"
                value={data?.quizzes ?? 0}
                max={moduleMax(data)}
                href={`${BASE}/academics/quizzes`}
                pendingData={typeof data?.quizzes !== 'number'}
              />
              <UsageBar
                icon={UserRound}
                label="Admissions this term"
                value={data?.admissionsThisTerm ?? 0}
                max={moduleMax(data)}
                href={`${BASE}/admissions`}
                pendingData={typeof data?.admissionsThisTerm !== 'number'}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Commercial ────────────────────────────────────────────────────── */}
      <section aria-labelledby="commercial-heading" className="space-y-4">
        <SectionHeading
          id="commercial-heading"
          title="Commercial"
          description="Billing, support and contract position."
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Billing */}
          <SummaryCard
            icon={CreditCard}
            title="Billing"
            href={`${BASE}/billing`}
            tone="gold"
          >
            <SummaryRow
              label="Outstanding"
              value={
                account.billing.outstandingAmount > 0
                  ? formatMoney(account.billing.outstandingAmount, account.currency)
                  : 'Nothing due'
              }
              tone={account.billing.outstandingAmount > 0 ? 'warn' : 'ok'}
            />
            <SummaryRow
              label="Last invoice"
              value={
                account.billing.lastInvoiceAt
                  ? `${account.billing.lastInvoiceRef} · ${formatDate(account.billing.lastInvoiceAt)}`
                  : 'None recorded'
              }
            />
            <SummaryRow
              label="Renews"
              value={`${formatDate(account.renewalAt)} · ${renewalLabel(renewalInDays)}`}
              tone={renewalInDays <= 90 ? 'warn' : undefined}
            />
          </SummaryCard>

          {/* Support */}
          <SummaryCard
            icon={LifeBuoy}
            title="Support"
            href={`${BASE}/support`}
            tone="teal"
          >
            <SummaryRow
              label="Open tickets"
              value={String(account.support.openTickets)}
              tone={account.support.openTickets > 0 ? 'warn' : 'ok'}
            />
            <SummaryRow
              label="Oldest open"
              value={
                account.support.oldestOpenTicketAt
                  ? formatRelative(account.support.oldestOpenTicketAt)
                  : '—'
              }
            />
            <SummaryRow
              label="Last contact"
              value={
                account.support.lastContactAt
                  ? formatRelative(account.support.lastContactAt)
                  : 'Not logged'
              }
            />
          </SummaryCard>

          {/* Infrastructure */}
          <SummaryCard
            icon={Database}
            title="Infrastructure"
            href={`${BASE}/infrastructure`}
            tone="teal"
          >
            <SummaryRow
              label="Firestore"
              value={integration.status === 'connected' ? 'Operational' : 'Unavailable'}
              tone={integration.status === 'connected' ? 'ok' : 'bad'}
            />
            <SummaryRow
              label="Authentication"
              value={integration.status === 'connected' ? 'Connected' : 'Unknown'}
              tone={integration.status === 'connected' ? 'ok' : 'bad'}
            />
            <SummaryRow label="Uptime monitoring" value="Not configured" tone="warn" />
          </SummaryCard>
        </div>

        {integration.error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle size={17} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-800">
                Syntra Grid cannot reach the school Firebase project
              </p>
              <p className="mt-1 break-words text-sm text-red-700">{integration.error}</p>
              <p className="mt-2 text-xs text-red-700/80">
                Figures below the header are unavailable until the connection is
                restored. Check the service-account credentials in your environment
                variables.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Section routing ───────────────────────────────────────────────── */}
      <section aria-labelledby="sections-heading" className="space-y-4">
        <SectionHeading
          id="sections-heading"
          title="Workspace"
          description="Open a section to work with the underlying records."
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <WorkspaceCard
            href={`${BASE}/users`}
            icon={Users}
            title="Users"
            description="Students, teachers and admins. Create, edit and reset access."
            status={data ? `${totalUsers} accounts` : 'Unavailable'}
            tone="gold"
          />
          <WorkspaceCard
            href={`${BASE}/admissions`}
            icon={UserRound}
            title="Admissions"
            description="Applications, status pipeline and applicant correspondence."
            status={
              typeof data?.admissionsPending === 'number'
                ? `${data.admissionsPending} awaiting review`
                : 'Wire up counts'
            }
            tone="teal"
            attention={(data?.admissionsPending ?? 0) > 0}
          />
          <WorkspaceCard
            href={`${BASE}/academics`}
            icon={ClipboardList}
            title="Academics"
            description="Lesson plans, assignments, quizzes and exam printing."
            status={`${(data?.lessonPlans ?? 0) + (data?.assignments ?? 0)} records`}
            tone="gold"
          />
          <WorkspaceCard
            href={`${BASE}/platform-activity`}
            icon={TrendingUp}
            title="Platform activity"
            description="Sign-ins, feature usage and week-on-week adoption."
            status={
              typeof data?.activeLast30Days === 'number'
                ? `${data.activeLast30Days} active in 30d`
                : 'Wire up counts'
            }
            tone="teal"
          />
          <WorkspaceCard
            href={`${BASE}/infrastructure`}
            icon={Database}
            title="Infrastructure"
            description="Firestore, authentication, storage usage and quotas."
            status={integration.status === 'connected' ? 'Operational' : 'Unavailable'}
            tone="teal"
            attention={integration.status !== 'connected'}
          />
          <WorkspaceCard
            href={`${BASE}/billing`}
            icon={CreditCard}
            title="Billing"
            description="Invoices, payments and the renewal timeline."
            status={
              account.billing.outstandingAmount > 0
                ? formatMoney(account.billing.outstandingAmount, account.currency) + ' due'
                : 'Up to date'
            }
            tone="gold"
            attention={account.billing.outstandingAmount > 0}
          />
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────── data ───────────────────────── */

async function loadEsteemIntegration(): Promise<IntegrationState> {
  try {
    const overview = (await getEsteemOverview()) as EsteemOverviewPlus;
    return { status: 'connected', overview, error: null, checkedAt: new Date() };
  } catch (error) {
    console.error('Esteem Learning Centre integration failed:', error);
    return {
      status: 'disconnected',
      overview: null,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error while reading the school Firebase project.',
      checkedAt: new Date(),
    };
  }
}

type AttentionTone = 'critical' | 'warn' | 'info';

type AttentionItem = {
  tone: AttentionTone;
  title: string;
  detail: string;
  href?: string;
  action?: string;
};

function buildAttentionItems({
  integration,
  account,
  renewalInDays,
}: {
  integration: IntegrationState;
  account: typeof ESTEEM_ACCOUNT;
  renewalInDays: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  const data = integration.overview;

  if (integration.status !== 'connected') {
    items.push({
      tone: 'critical',
      title: 'Platform data unreachable',
      detail:
        'Syntra Grid could not read the client Firebase project, so none of the figures on this page are current.',
      href: `${BASE}/infrastructure`,
      action: 'Check connection',
    });
  }

  const pendingExams = data?.pendingExamRequests ?? 0;
  if (pendingExams > 0) {
    items.push({
      tone: 'warn',
      title: `${pendingExams} exam ${pendingExams === 1 ? 'paper' : 'papers'} waiting to be printed`,
      detail: 'Submitted by teachers and not yet actioned by admin or ICT.',
      href: `${BASE}/academics/exam-printing`,
      action: 'Review queue',
    });
  }

  const pendingAdmissions = data?.admissionsPending ?? 0;
  if (pendingAdmissions > 0) {
    items.push({
      tone: 'warn',
      title: `${pendingAdmissions} admission ${pendingAdmissions === 1 ? 'application' : 'applications'} awaiting a decision`,
      detail: 'Applicants are waiting on the school to move them through the pipeline.',
      href: `${BASE}/admissions`,
      action: 'Open admissions',
    });
  }

  if (account.support.openTickets > 0) {
    items.push({
      tone: 'warn',
      title: `${account.support.openTickets} open support ${account.support.openTickets === 1 ? 'ticket' : 'tickets'}`,
      detail: account.support.oldestOpenTicketAt
        ? `Oldest raised ${formatRelative(account.support.oldestOpenTicketAt)}.`
        : 'Raised by the client and not yet closed.',
      href: `${BASE}/support`,
      action: 'Open support',
    });
  }

  if (account.billing.outstandingAmount > 0) {
    items.push({
      tone: account.billing.lastInvoiceStatus === 'overdue' ? 'critical' : 'warn',
      title: `${formatMoney(account.billing.outstandingAmount, account.currency)} outstanding`,
      detail:
        account.billing.lastInvoiceStatus === 'overdue'
          ? 'The last invoice is past its due date.'
          : 'Invoice sent and not yet settled.',
      href: `${BASE}/billing`,
      action: 'Open billing',
    });
  }

  if (renewalInDays <= 90 && renewalInDays >= 0) {
    items.push({
      tone: renewalInDays <= 30 ? 'warn' : 'info',
      title: `Subscription renews ${renewalLabel(renewalInDays).toLowerCase()}`,
      detail: `${account.plan}, ${account.billingCycle}. Start the renewal conversation with ${account.primaryContact.name}.`,
      href: `${BASE}/billing`,
      action: 'Open billing',
    });
  } else if (renewalInDays < 0) {
    items.push({
      tone: 'critical',
      title: 'Subscription lapsed',
      detail: `Renewal date passed ${formatRelative(account.renewalAt)} with no recorded renewal.`,
      href: `${BASE}/billing`,
      action: 'Open billing',
    });
  }

  return items;
}

function moduleMax(data: EsteemOverviewPlus | null) {
  return Math.max(
    1,
    data?.lessonPlans ?? 0,
    data?.assignments ?? 0,
    data?.examRequests ?? 0,
    data?.quizzes ?? 0,
    data?.admissionsThisTerm ?? 0,
  );
}

/* ───────────────────────── formatting ───────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function renewalLabel(days: number) {
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return 'Today';
  if (days < 31) return `In ${days} days`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `In ${months} months`;
  return `In ${Math.floor(months / 12)} years`;
}

function formatRelative(iso: string) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

function formatMoney(amount: number, currency: 'NGN' | 'GBP' | 'USD') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/* ───────────────────────── components ───────────────────────── */

/**
 * The client's own crest. White tile with a hairline border rather than the
 * house gradient — a school crest carries its own colours and fights anything
 * placed behind it. Falls back to the generic icon when no logo is on file.
 */
function ClientMark({ logo, name }: { logo: string | null; name: string }) {
  if (!logo) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#14B8A6] text-[#0B1020] shadow-lg shadow-[#D4AF37]/20">
        <GraduationCap size={26} aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#0B1020]/[0.07] bg-white p-1.5 shadow-sm">
      <Image
        src={logo}
        alt={`${name} logo`}
        width={56}
        height={56}
        className="h-full w-full object-contain"
        priority
      />
    </div>
  );
}

function SectionHeading({
  id,
  title,
  description,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-base font-bold text-[#0B1020]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-[#5A6173]">{description}</p>
      </div>

      {href && linkLabel && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm font-bold text-[#0D9488] transition-colors hover:text-[#0B1020]"
        >
          {linkLabel}
          <ArrowUpRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}

function AccountStatusPill({ status }: { status: typeof ESTEEM_ACCOUNT.status }) {
  const map = {
    active: { label: 'Active client', className: 'bg-[#14B8A6]/10 text-[#0D9488]', dot: 'bg-[#14B8A6]' },
    onboarding: { label: 'Onboarding', className: 'bg-[#D4AF37]/12 text-[#A87B1B]', dot: 'bg-[#D4AF37]' },
    suspended: { label: 'Suspended', className: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
    churned: { label: 'Churned', className: 'bg-[#0B1020]/[0.06] text-[#5A6173]', dot: 'bg-[#5A6173]' },
  } as const;

  const current = map[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${current.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  );
}

function Fact({
  label,
  value,
  hint,
  hintTone = 'muted',
  mono = false,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: 'muted' | 'warn';
  mono?: boolean;
}) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6173]">
        {label}
      </dt>
      <dd
        className={`mt-1.5 truncate text-sm font-bold text-[#0B1020] ${mono ? 'font-mono tracking-tight' : ''}`}
      >
        {value}
      </dd>
      {hint && (
        <p
          className={`mt-0.5 text-xs font-semibold ${hintTone === 'warn' ? 'text-amber-600' : 'text-[#5A6173]'}`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

const ATTENTION_TONES = {
  critical: {
    wrap: 'border-red-200 bg-red-50/70',
    icon: 'bg-red-100 text-red-600',
    title: 'text-red-800',
    body: 'text-red-700',
    Icon: AlertTriangle,
  },
  warn: {
    wrap: 'border-amber-200 bg-amber-50/70',
    icon: 'bg-amber-100 text-amber-600',
    title: 'text-amber-900',
    body: 'text-amber-800',
    Icon: AlertTriangle,
  },
  info: {
    wrap: 'border-[#D4AF37]/25',
    icon: 'bg-[#D4AF37]/12 text-[#A87B1B]',
    title: 'text-[#0B1020]',
    body: 'text-[#5A6173]',
    Icon: CalendarClock,
  },
} as const;

function AttentionRow({ tone, title, detail, href, action }: AttentionItem) {
  const current = ATTENTION_TONES[tone];
  const { Icon } = current;

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${current.wrap}`}
      style={tone === 'info' ? { background: WASH_SOFT } : undefined}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${current.icon}`}
      >
        <Icon size={17} aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${current.title}`}>{title}</p>
        <p className={`mt-0.5 text-sm ${current.body}`}>{detail}</p>
      </div>

      {href && action && (
        <Link
          href={href}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#0B1020]/[0.08] bg-white px-3.5 text-xs font-bold text-[#0B1020] transition-colors hover:border-[#0B1020]/15"
        >
          {action}
          <ArrowUpRight size={13} aria-hidden />
        </Link>
      )}
    </div>
  );
}

const METRIC_TONES = {
  gold: {
    icon: 'bg-gradient-to-br from-[#F3DFA2] via-[#D4AF37] to-[#A87B1B] text-[#3A2B05]',
    value: 'text-[#A87B1B]',
    bar: 'from-[#D4AF37] to-[#A87B1B]',
  },
  teal: {
    icon: 'bg-gradient-to-br from-[#5EEAD4] via-[#14B8A6] to-[#0D9488] text-[#04312B]',
    value: 'text-[#0D9488]',
    bar: 'from-[#14B8A6] to-[#0D9488]',
  },
} as const;

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
  tone: keyof typeof METRIC_TONES;
}) {
  const current = METRIC_TONES[tone];

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-[#0B1020]/[0.06] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37]/25 hover:shadow-[0_16px_32px_rgba(11,16,32,0.08)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{ transitionTimingFunction: PREMIUM_EASE }}
    >
      <span
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${current.bar} opacity-70 transition-opacity duration-300 group-hover:opacity-100`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#5A6173]">
            {label}
          </p>
          <p className={`mt-3 text-3xl font-bold tabular-nums ${current.value}`}>{value}</p>
          <p className="mt-1 text-xs text-[#5A6173]">{description}</p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none ${current.icon}`}
          style={{ transitionTimingFunction: PREMIUM_EASE }}
        >
          <Icon size={18} strokeWidth={2.25} aria-hidden />
        </div>
      </div>
    </div>
  );
}

function Sparkbars({ series }: { series: { label: string; value: number }[] }) {
  const max = Math.max(1, ...series.map((point) => point.value));
  const latest = series[series.length - 1]?.value ?? 0;
  const previous = series[series.length - 2]?.value ?? 0;
  const delta = previous === 0 ? 0 : Math.round(((latest - previous) / previous) * 100);
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendClass =
    delta > 0 ? 'text-[#0D9488]' : delta < 0 ? 'text-amber-600' : 'text-[#5A6173]';

  return (
    <>
      <p className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold ${trendClass}`}>
        <TrendIcon size={14} aria-hidden />
        {delta === 0 ? 'Level on last week' : `${Math.abs(delta)}% on last week`}
      </p>

      <div
        className="mt-5 flex h-20 items-end gap-1.5"
        role="img"
        aria-label={`Weekly activity: ${series.map((p) => `${p.label} ${p.value}`).join(', ')}`}
      >
        {series.map((point, index) => (
          <div key={point.label} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`w-full rounded-t-sm ${
                index === series.length - 1
                  ? 'bg-gradient-to-t from-[#0D9488] to-[#14B8A6]'
                  : 'bg-[#14B8A6]/25'
              }`}
              style={{ height: `${Math.max(4, (point.value / max) * 64)}px` }}
            />
            <span className="text-[9px] font-semibold text-[#5A6173]">{point.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function UsageBar({
  icon: Icon,
  label,
  value,
  max,
  href,
  pendingData = false,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  max: number;
  href: string;
  pendingData?: boolean;
}) {
  return (
    <Link href={href} className="group block">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B1020]">
          <Icon size={14} className="text-[#5A6173]" aria-hidden />
          {label}
        </span>
        <span
          className={`text-sm font-bold tabular-nums ${pendingData ? 'text-[#5A6173]' : 'text-[#0B1020]'}`}
        >
          {pendingData ? '—' : value}
        </span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#0B1020]/[0.06]">
        <span
          className="block h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#A87B1B] transition-[width] duration-500 group-hover:from-[#14B8A6] group-hover:to-[#0D9488] motion-reduce:transition-none"
          style={{
            width: pendingData ? '0%' : `${Math.max(2, (value / max) * 100)}%`,
            transitionTimingFunction: PREMIUM_EASE,
          }}
        />
      </div>
    </Link>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  href,
  tone,
  children,
}: {
  icon: React.ElementType;
  title: string;
  href: string;
  tone: keyof typeof METRIC_TONES;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-[#D4AF37]/15 bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-bold text-[#0B1020]">
          <Icon
            size={16}
            className={tone === 'gold' ? 'text-[#A87B1B]' : 'text-[#0D9488]'}
            aria-hidden
          />
          {title}
        </h3>

        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#5A6173] transition-colors hover:text-[#0D9488]"
        >
          Open
          <ArrowUpRight size={12} aria-hidden />
        </Link>
      </div>

      <dl className="mt-4 space-y-3">{children}</dl>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  const valueClass =
    tone === 'ok'
      ? 'text-[#0D9488]'
      : tone === 'warn'
      ? 'text-amber-600'
      : tone === 'bad'
      ? 'text-red-600'
      : 'text-[#0B1020]';

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#0B1020]/[0.05] pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-[#5A6173]">{label}</dt>
      <dd className={`truncate text-sm font-bold ${valueClass}`}>{value}</dd>
    </div>
  );
}

const WORKSPACE_TONES = {
  gold: {
    idle: 'bg-[#D4AF37]/10 text-[#A87B1B]',
    hover:
      'group-hover:bg-gradient-to-br group-hover:from-[#D4AF37] group-hover:to-[#A87B1B] group-hover:text-white',
    badge: 'bg-[#D4AF37]/10 text-[#A87B1B]',
    arrow: 'group-hover:text-[#A87B1B]',
  },
  teal: {
    idle: 'bg-[#14B8A6]/10 text-[#0D9488]',
    hover:
      'group-hover:bg-gradient-to-br group-hover:from-[#14B8A6] group-hover:to-[#0D9488] group-hover:text-white',
    badge: 'bg-[#14B8A6]/10 text-[#0D9488]',
    arrow: 'group-hover:text-[#0D9488]',
  },
} as const;

function WorkspaceCard({
  href,
  icon: Icon,
  title,
  description,
  status,
  tone = 'teal',
  attention = false,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  status: string;
  tone?: keyof typeof WORKSPACE_TONES;
  attention?: boolean;
}) {
  const current = WORKSPACE_TONES[tone];

  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-[#0B1020]/[0.06] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37]/25 hover:shadow-[0_14px_28px_rgba(11,16,32,0.07)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{ transitionTimingFunction: PREMIUM_EASE }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300 ${current.idle} ${current.hover}`}
        >
          <Icon size={18} aria-hidden />
        </div>
        <ArrowUpRight
          size={15}
          className={`text-[#5A6173]/45 transition-colors duration-200 ${current.arrow}`}
          aria-hidden
        />
      </div>

      <h3 className="mt-4 text-sm font-bold text-[#0B1020]">{title}</h3>
      <p className="mt-1 min-h-10 text-xs leading-5 text-[#5A6173]">{description}</p>

      <span
        className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
          attention ? 'bg-amber-100 text-amber-700' : current.badge
        }`}
      >
        {status}
      </span>
    </Link>
  );
}

function EmptyNote({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`flex items-start gap-2 rounded-xl bg-[#0B1020]/[0.03] p-3 text-xs leading-5 text-[#5A6173] [&_code]:rounded [&_code]:bg-white [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_code]:text-[#0B1020] ${className}`}
    >
      <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * To light up the remaining panels, extend getEsteemOverview() to return:
 *
 *   activeLast7Days     users with lastLoginAt within 7 days
 *   activeLast30Days    same, 30 days
 *   admissionsPending   admissions where status in ['submitted','under_review']
 *   admissionsThisTerm  admissions created since the current term start
 *   quizzes             count of quizzes
 *   quizAttempts        count of attempts
 *   recentUsers         last 5 users by createdAt desc → { id, name, role, createdAt }
 *   weeklyActivity      8 buckets → { label: 'W-7'…'This', value: distinct active users }
 *
 * Counting with getCountFromServer() keeps reads to one per aggregate rather
 * than pulling whole collections.
 * ────────────────────────────────────────────────────────────────────────── */