'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CloudCog,
  Download,
  FileSignature,
  Gauge,
  Globe2,
  Headphones,
  LayoutGrid,
  MoreHorizontal,
  MousePointerClick,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';

type Period = '30D' | '3M' | '6M' | '1Y';

type MetricTone = 'teal' | 'gold' | 'blue' | 'violet';

type RevenueSeries = {
  label: string;
  revenue: number;
  expenses: number;
  target: number;
};

type ClientPerformance = {
  name: string;
  initials: string;
  product: string;
  revenue: number;
  growth: number;
  usage: number;
  health: number;
  supportTickets: number;
};

type ProjectPerformance = {
  name: string;
  client: string;
  progress: number;
  margin: number;
  health: 'Healthy' | 'Attention' | 'At risk';
  delivery: string;
};

const revenueByPeriod: Record<Period, RevenueSeries[]> = {
  '30D': [
    { label: '1 Aug', revenue: 3200, expenses: 1100, target: 3500 },
    { label: '4 Aug', revenue: 4600, expenses: 1400, target: 4200 },
    { label: '7 Aug', revenue: 3900, expenses: 1250, target: 4500 },
    { label: '10 Aug', revenue: 6200, expenses: 1750, target: 5000 },
    { label: '13 Aug', revenue: 5400, expenses: 1580, target: 5600 },
    { label: '16 Aug', revenue: 7100, expenses: 1930, target: 6200 },
    { label: '19 Aug', revenue: 6800, expenses: 2100, target: 6700 },
    { label: '22 Aug', revenue: 8300, expenses: 2240, target: 7200 },
    { label: '25 Aug', revenue: 7600, expenses: 2030, target: 7600 },
    { label: '28 Aug', revenue: 9400, expenses: 2480, target: 8100 },
    { label: '30 Aug', revenue: 8900, expenses: 2320, target: 8500 },
    { label: 'Today', revenue: 10800, expenses: 2760, target: 9000 },
  ],
  '3M': [
    { label: 'Week 1', revenue: 13800, expenses: 4200, target: 14000 },
    { label: 'Week 2', revenue: 16400, expenses: 4900, target: 15500 },
    { label: 'Week 3', revenue: 15100, expenses: 4550, target: 16500 },
    { label: 'Week 4', revenue: 18200, expenses: 5300, target: 17500 },
    { label: 'Week 5', revenue: 20500, expenses: 6100, target: 19000 },
    { label: 'Week 6', revenue: 19800, expenses: 5700, target: 20500 },
    { label: 'Week 7', revenue: 23100, expenses: 6600, target: 21800 },
    { label: 'Week 8', revenue: 24700, expenses: 6900, target: 22800 },
    { label: 'Week 9', revenue: 23800, expenses: 6750, target: 24100 },
    { label: 'Week 10', revenue: 26900, expenses: 7300, target: 25400 },
    { label: 'Week 11', revenue: 28100, expenses: 7600, target: 26800 },
    { label: 'Week 12', revenue: 31200, expenses: 8200, target: 28200 },
  ],
  '6M': [
    { label: 'Mar', revenue: 52000, expenses: 16400, target: 54000 },
    { label: 'Apr', revenue: 58400, expenses: 17900, target: 57000 },
    { label: 'May', revenue: 63100, expenses: 18800, target: 61000 },
    { label: 'Jun', revenue: 69800, expenses: 20700, target: 65000 },
    { label: 'Jul', revenue: 76200, expenses: 22400, target: 70000 },
    { label: 'Aug', revenue: 84100, expenses: 23900, target: 75000 },
  ],
  '1Y': [
    { label: 'Sep', revenue: 41000, expenses: 14200, target: 43000 },
    { label: 'Oct', revenue: 43800, expenses: 15100, target: 45000 },
    { label: 'Nov', revenue: 47200, expenses: 16000, target: 48000 },
    { label: 'Dec', revenue: 52100, expenses: 17400, target: 51000 },
    { label: 'Jan', revenue: 54800, expenses: 18200, target: 54000 },
    { label: 'Feb', revenue: 57900, expenses: 18900, target: 57000 },
    { label: 'Mar', revenue: 61200, expenses: 19700, target: 60000 },
    { label: 'Apr', revenue: 65900, expenses: 21100, target: 64000 },
    { label: 'May', revenue: 70200, expenses: 21900, target: 68000 },
    { label: 'Jun', revenue: 74800, expenses: 22800, target: 71000 },
    { label: 'Jul', revenue: 79300, expenses: 23400, target: 75000 },
    { label: 'Aug', revenue: 84100, expenses: 23900, target: 79000 },
  ],
};

const clientPerformance: ClientPerformance[] = [
  {
    name: 'RentWise',
    initials: 'RW',
    product: 'Property Technology Platform',
    revenue: 32600,
    growth: 18.4,
    usage: 92,
    health: 98,
    supportTickets: 3,
  },
  {
    name: 'Esteem Learning Centre',
    initials: 'EL',
    product: 'School Management Platform',
    revenue: 28100,
    growth: 14.7,
    usage: 87,
    health: 99,
    supportTickets: 2,
  },
  {
    name: 'Meldex Industries',
    initials: 'MI',
    product: 'Corporate Website and CMS',
    revenue: 12400,
    growth: 9.2,
    usage: 64,
    health: 100,
    supportTickets: 1,
  },
  {
    name: 'Northstar Retail',
    initials: 'NR',
    product: 'Commerce Maintenance',
    revenue: 11000,
    growth: -3.1,
    usage: 58,
    health: 94,
    supportTickets: 5,
  },
];

const projectPerformance: ProjectPerformance[] = [
  {
    name: 'RentWise Platform',
    client: 'RentWise',
    progress: 78,
    margin: 42,
    health: 'Healthy',
    delivery: '14 Sep 2026',
  },
  {
    name: 'Esteem Mobile App',
    client: 'Esteem Learning Centre',
    progress: 64,
    margin: 37,
    health: 'Healthy',
    delivery: '2 Oct 2026',
  },
  {
    name: 'Meldex CMS',
    client: 'Meldex Industries',
    progress: 46,
    margin: 31,
    health: 'Attention',
    delivery: '21 Oct 2026',
  },
  {
    name: 'Northstar Maintenance',
    client: 'Northstar Retail',
    progress: 83,
    margin: 18,
    health: 'At risk',
    delivery: '31 Aug 2026',
  },
];

const acquisitionChannels = [
  { label: 'Referrals', value: 38, leads: 24 },
  { label: 'Organic search', value: 27, leads: 17 },
  { label: 'Direct outreach', value: 21, leads: 13 },
  { label: 'LinkedIn', value: 9, leads: 6 },
  { label: 'Other', value: 5, leads: 3 },
];

const pipelineStages = [
  { label: 'New leads', value: 38, amount: 148000 },
  { label: 'Qualified', value: 24, amount: 112000 },
  { label: 'Proposal sent', value: 14, amount: 79000 },
  { label: 'Negotiation', value: 8, amount: 49000 },
  { label: 'Won', value: 5, amount: 32000 },
];

const geographicRevenue = [
  { label: 'United Kingdom', value: 48, amount: 40400 },
  { label: 'Nigeria', value: 39, amount: 32800 },
  { label: 'Europe', value: 8, amount: 6700 },
  { label: 'Other markets', value: 5, amount: 4200 },
];

const supportAnalytics = [
  { label: 'Authentication', value: 31 },
  { label: 'File uploads', value: 24 },
  { label: 'Reporting', value: 19 },
  { label: 'Billing', value: 14 },
  { label: 'Other', value: 12 },
];

const teamPerformance = [
  {
    name: 'Hassan Ahmad',
    role: 'Owner',
    completed: 38,
    response: '18m',
    satisfaction: 98,
    utilisation: 84,
  },
  {
    name: 'Technical Support',
    role: 'Support',
    completed: 47,
    response: '12m',
    satisfaction: 96,
    utilisation: 79,
  },
  {
    name: 'Development Team',
    role: 'Engineering',
    completed: 29,
    response: '34m',
    satisfaction: 95,
    utilisation: 88,
  },
  {
    name: 'Finance Team',
    role: 'Finance',
    completed: 21,
    response: '42m',
    satisfaction: 99,
    utilisation: 68,
  },
];

const activitySeries = [324, 351, 339, 382, 376, 421, 449, 436, 478, 511, 497, 542];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('6M');
  const [currency, setCurrency] = useState<'GBP' | 'NGN'>('GBP');
  const [refreshing, setRefreshing] = useState(false);

  const revenueData = revenueByPeriod[period];

  const analytics = useMemo(() => {
    const revenue = revenueData.reduce(
      (total, item) => total + item.revenue,
      0,
    );

    const expenses = revenueData.reduce(
      (total, item) => total + item.expenses,
      0,
    );

    const target = revenueData.reduce(
      (total, item) => total + item.target,
      0,
    );

    const profit = revenue - expenses;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const targetAttainment = target > 0 ? (revenue / target) * 100 : 0;

    return {
      revenue,
      expenses,
      profit,
      margin,
      target,
      targetAttainment,
    };
  }, [revenueData]);

  async function refreshAnalytics() {
    if (refreshing) return;

    setRefreshing(true);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 900);
    });

    setRefreshing(false);
  }

  return (
    <main className="space-y-6 pb-10">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#A87B1B]">
            <BarChart3 className="h-4 w-4" />
            Business intelligence
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1020]">
            Analytics
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5A6173]">
            Analyse revenue, client growth, project profitability, platform
            usage, support performance and company-wide operational trends.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-xl border border-[#0B1020]/10 bg-white p-1">
            {(['30D', '3M', '6M', '1Y'] as Period[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                  period === item
                    ? 'bg-[#0B1020] text-white shadow-sm'
                    : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0B1020]'
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <label className="relative">
            <select
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value as 'GBP' | 'NGN')
              }
              className="h-11 appearance-none rounded-xl border border-[#0B1020]/10 bg-white px-4 pr-10 text-sm font-bold text-[#334155] outline-none focus:border-[#14B8A6]"
            >
              <option value="GBP">GBP</option>
              <option value="NGN">NGN</option>
            </select>

            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          </label>

          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#0B1020]/10 bg-white px-4 text-sm font-bold text-[#475569] transition hover:bg-[#F8FAFC] hover:text-[#0B1020]"
          >
            <Download className="h-4 w-4" />
            Export
          </button>

          <button
            type="button"
            onClick={() => void refreshAnalytics()}
            disabled={refreshing}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B1020] px-5 text-sm font-bold text-white transition hover:bg-[#151D34] disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing ? 'animate-spin' : ''
              }`}
            />
            {refreshing ? 'Refreshing' : 'Refresh'}
          </button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total revenue"
          value={formatMoney(analytics.revenue, currency, true)}
          change={18.4}
          description="Compared with the previous period"
          icon={CircleDollarSign}
          tone="teal"
        />

        <MetricCard
          label="Net profit"
          value={formatMoney(analytics.profit, currency, true)}
          change={22.1}
          description={`${analytics.margin.toFixed(1)}% profit margin`}
          icon={WalletCards}
          tone="gold"
        />

        <MetricCard
          label="Active clients"
          value="12"
          change={9.1}
          description="3 clients added this period"
          icon={Building2}
          tone="blue"
        />

        <MetricCard
          label="Recurring revenue"
          value={formatMoney(28400, currency, true)}
          change={14.8}
          description="Monthly recurring contracts"
          icon={RefreshCw}
          tone="violet"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
        <RevenueAnalytics
          data={revenueData}
          currency={currency}
          analytics={analytics}
        />

        <BusinessScorecard analytics={analytics} />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <InsightCard
          icon={Users}
          label="Client retention"
          value="94.7%"
          description="Clients retained over the last 12 months"
          progress={94.7}
          footer="+3.2% from last year"
        />

        <InsightCard
          icon={Target}
          label="Proposal conversion"
          value="35.7%"
          description="Proposals successfully converted into contracts"
          progress={35.7}
          footer="5 deals won this period"
        />

        <InsightCard
          icon={Gauge}
          label="Delivery efficiency"
          value="87.2%"
          description="Projects delivered within planned timelines"
          progress={87.2}
          footer="2 projects require attention"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)]">
        <ClientPerformanceTable currency={currency} />

        <PortfolioDistribution currency={currency} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ProjectPerformancePanel />

        <SalesPipeline currency={currency} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <PlatformUsageAnalytics />

        <AcquisitionAnalytics />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <SupportPerformance />

        <ContractAnalytics currency={currency} />

        <DeploymentAnalytics />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <TeamPerformance />

        <GeographicRevenue currency={currency} />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <ExecutiveInsight
          icon={Sparkles}
          title="Strongest growth driver"
          value="RentWise"
          description="RentWise generated 38.8% of portfolio revenue and recorded the fastest usage growth."
        />

        <ExecutiveInsight
          icon={Clock3}
          title="Primary operational risk"
          value="Delivery capacity"
          description="Engineering utilisation is approaching 90%, which may affect upcoming delivery timelines."
        />

        <ExecutiveInsight
          icon={TrendingUp}
          title="Recommended focus"
          value="Recurring contracts"
          description="Annual maintenance and support agreements are producing the highest-margin recurring revenue."
        />
      </section>
    </main>
  );
}

function RevenueAnalytics({
  data,
  currency,
  analytics,
}: {
  data: RevenueSeries[];
  currency: 'GBP' | 'NGN';
  analytics: {
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
    target: number;
    targetAttainment: number;
  };
}) {
  const maximum = Math.max(
    ...data.flatMap((item) => [
      item.revenue,
      item.expenses,
      item.target,
    ]),
  );

  const revenuePoints = createChartPoints(
    data.map((item) => item.revenue),
    maximum,
  );

  const expensePoints = createChartPoints(
    data.map((item) => item.expenses),
    maximum,
  );

  const targetPoints = createChartPoints(
    data.map((item) => item.target),
    maximum,
  );

  return (
    <article className="overflow-hidden rounded-3xl border border-[#0B1020]/[0.07] bg-white shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
      <div className="flex flex-col gap-4 border-b border-[#0B1020]/[0.06] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#A87B1B]" />

            <h2 className="text-base font-bold text-[#0B1020]">
              Financial performance
            </h2>
          </div>

          <p className="mt-1 text-sm text-[#5A6173]">
            Revenue, operating expenses and performance against target.
          </p>
        </div>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0B1020]"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      <div className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <ChartSummary
            label="Revenue"
            value={formatMoney(analytics.revenue, currency, true)}
            detail="+18.4%"
            detailClassName="text-[#0D9488]"
          />

          <ChartSummary
            label="Operating expenses"
            value={formatMoney(analytics.expenses, currency, true)}
            detail="-4.8%"
            detailClassName="text-[#0D9488]"
          />

          <ChartSummary
            label="Target attainment"
            value={`${analytics.targetAttainment.toFixed(1)}%`}
            detail={
              analytics.targetAttainment >= 100
                ? 'Above target'
                : 'Below target'
            }
            detailClassName={
              analytics.targetAttainment >= 100
                ? 'text-[#0D9488]'
                : 'text-amber-700'
            }
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-5 text-xs font-semibold text-[#64748B]">
          <Legend colourClassName="bg-[#0D9488]" label="Revenue" />
          <Legend colourClassName="bg-[#D4AF37]" label="Target" />
          <Legend colourClassName="bg-[#1E4E8C]" label="Expenses" />
        </div>

        <div className="relative mt-5 h-[320px] overflow-hidden rounded-2xl bg-[#FAFAF9]">
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            {[100, 75, 50, 25, 0].map((line) => (
              <div key={line} className="relative border-t border-dashed border-[#0B1020]/[0.07]">
                <span className="absolute -top-2.5 left-0 bg-[#FAFAF9] pr-2 text-[10px] font-semibold text-[#94A3B8]">
                  {formatMoney((maximum * line) / 100, currency, true)}
                </span>
              </div>
            ))}
          </div>

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-x-8 bottom-10 top-6 h-[calc(100%-4rem)] w-[calc(100%-4rem)]"
          >
            <defs>
              <linearGradient
                id="revenue-fill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#14B8A6"
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  stopColor="#14B8A6"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            <polygon
              points={`0,100 ${revenuePoints} 100,100`}
              fill="url(#revenue-fill)"
            />

            <polyline
              points={targetPoints}
              fill="none"
              stroke="#D4AF37"
              strokeWidth="2"
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />

            <polyline
              points={expensePoints}
              fill="none"
              stroke="#1E4E8C"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <polyline
              points={revenuePoints}
              fill="none"
              stroke="#0D9488"
              strokeWidth="2.6"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="absolute bottom-4 left-8 right-8 flex justify-between">
            {data.map((item, index) => (
              <span
                key={`${item.label}-${index}`}
                className="max-w-[54px] truncate text-[9px] font-semibold text-[#94A3B8]"
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function BusinessScorecard({
  analytics,
}: {
  analytics: {
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
    target: number;
    targetAttainment: number;
  };
}) {
  const score = Math.round(
    Math.min(
      100,
      analytics.margin * 1.1 +
        analytics.targetAttainment * 0.35 +
        28,
    ),
  );

  return (
    <article className="relative overflow-hidden rounded-3xl bg-[#0B1020] p-6 text-white shadow-[0_16px_45px_rgba(11,16,32,0.2)]">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border border-white/10" />
      <div className="absolute -right-4 top-14 h-28 w-28 rounded-full border border-white/10" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[#E9D7A7]">
              <Sparkles className="h-4 w-4" />
              Executive score
            </div>

            <h2 className="mt-3 text-xl font-bold">
              Business performance
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/60">
              Combined financial, commercial and operational performance.
            </p>
          </div>

          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/70">
            Excellent
          </span>
        </div>

        <div className="mt-8 flex justify-center">
          <div
            className="relative flex h-52 w-52 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#14B8A6 0deg ${
                score * 3.6
              }deg, rgba(255,255,255,0.08) ${
                score * 3.6
              }deg 360deg)`,
            }}
          >
            <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full bg-[#0B1020]">
              <span className="text-5xl font-bold tracking-tight">
                {score}
              </span>

              <span className="mt-1 text-xs font-bold uppercase tracking-[0.15em] text-white/45">
                out of 100
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          <ScoreRow
            label="Financial strength"
            value={Math.min(100, Math.round(analytics.margin * 2.1))}
          />

          <ScoreRow
            label="Growth performance"
            value={88}
          />

          <ScoreRow
            label="Client health"
            value={94}
          />

          <ScoreRow
            label="Delivery performance"
            value={87}
          />
        </div>
      </div>
    </article>
  );
}

function ClientPerformanceTable({
  currency,
}: {
  currency: 'GBP' | 'NGN';
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-[#0B1020]/[0.07] bg-white">
      <div className="flex items-start justify-between border-b border-[#0B1020]/[0.06] px-5 py-5 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#A87B1B]" />

            <h2 className="text-base font-bold text-[#0B1020]">
              Client performance
            </h2>
          </div>

          <p className="mt-1 text-sm text-[#5A6173]">
            Revenue, usage, growth and service health by client.
          </p>
        </div>

        <button className="flex h-9 w-9 items-center justify-center rounded-xl text-[#64748B] hover:bg-[#F8FAFC]">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-[#0B1020]/[0.06] bg-[#FAFAF9] text-left">
              <TableHeading>Client</TableHeading>
              <TableHeading>Revenue</TableHeading>
              <TableHeading>Growth</TableHeading>
              <TableHeading>Usage</TableHeading>
              <TableHeading>Health</TableHeading>
              <TableHeading>Support</TableHeading>
            </tr>
          </thead>

          <tbody>
            {clientPerformance.map((client) => (
              <tr
                key={client.name}
                className="border-b border-[#0B1020]/[0.06] last:border-0 hover:bg-[#FAFAF9]/70"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1020]/[0.05] text-xs font-bold text-[#0B1020]">
                      {client.initials}
                    </div>

                    <div>
                      <p className="text-sm font-bold text-[#0B1020]">
                        {client.name}
                      </p>

                      <p className="mt-0.5 text-xs text-[#64748B]">
                        {client.product}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4 text-sm font-bold text-[#334155]">
                  {formatMoney(client.revenue, currency, true)}
                </td>

                <td className="px-5 py-4">
                  <ChangeValue value={client.growth} />
                </td>

                <td className="px-5 py-4">
                  <ProgressValue value={client.usage} />
                </td>

                <td className="px-5 py-4">
                  <HealthBadge value={client.health} />
                </td>

                <td className="px-5 py-4 text-sm font-bold text-[#475569]">
                  {client.supportTickets} tickets
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function PortfolioDistribution({
  currency,
}: {
  currency: 'GBP' | 'NGN';
}) {
  const total = clientPerformance.reduce(
    (sum, client) => sum + client.revenue,
    0,
  );

  let currentDegree = 0;

  const segments = clientPerformance.map((client, index) => {
    const share = (client.revenue / total) * 100;
    const degrees = share * 3.6;
    const start = currentDegree;
    const end = currentDegree + degrees;
    // eslint-disable-next-line react-hooks/immutability
    currentDegree = end;

    const colours = ['#0D9488', '#D4AF37', '#1E4E8C', '#7C3AED'];

    return {
      ...client,
      share,
      start,
      end,
      colour: colours[index],
    };
  });

  const gradient = segments
    .map(
      (segment) =>
        `${segment.colour} ${segment.start}deg ${segment.end}deg`,
    )
    .join(', ');

  return (
    <article className="rounded-3xl border border-[#0B1020]/[0.07] bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-5 w-5 text-[#A87B1B]" />

        <h2 className="text-base font-bold text-[#0B1020]">
          Revenue distribution
        </h2>
      </div>

      <p className="mt-1 text-sm text-[#5A6173]">
        Contribution to portfolio revenue by client.
      </p>

      <div className="mt-7 flex justify-center">
        <div
          className="flex h-52 w-52 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${gradient})`,
          }}
        >
          <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#94A3B8]">
              Portfolio
            </span>

            <strong className="mt-1 text-2xl font-bold text-[#0B1020]">
              {formatMoney(total, currency, true)}
            </strong>
          </div>
        </div>
      </div>

      <div className="mt-7 space-y-4">
        {segments.map((segment) => (
          <div
            key={segment.name}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: segment.colour }}
              />

              <span className="truncate text-sm font-semibold text-[#475569]">
                {segment.name}
              </span>
            </div>

            <div className="text-right">
              <p className="text-sm font-bold text-[#334155]">
                {segment.share.toFixed(1)}%
              </p>

              <p className="text-[10px] text-[#94A3B8]">
                {formatMoney(segment.revenue, currency, true)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function ProjectPerformancePanel() {
  return (
    <article className="overflow-hidden rounded-3xl border border-[#0B1020]/[0.07] bg-white">
      <div className="border-b border-[#0B1020]/[0.06] px-5 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="h-5 w-5 text-[#A87B1B]" />

          <h2 className="text-base font-bold text-[#0B1020]">
            Project profitability
          </h2>
        </div>

        <p className="mt-1 text-sm text-[#5A6173]">
          Delivery progress, margin and current project health.
        </p>
      </div>

      <div className="divide-y divide-[#0B1020]/[0.06]">
        {projectPerformance.map((project) => (
          <div key={project.name} className="px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold text-[#0B1020]">
                  {project.name}
                </p>

                <p className="mt-1 text-xs text-[#64748B]">
                  {project.client} · delivery {project.delivery}
                </p>
              </div>

              <ProjectHealthBadge health={project.health} />
            </div>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_70px_70px] items-end gap-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#64748B]">
                    Delivery progress
                  </span>

                  <span className="font-bold text-[#334155]">
                    {project.progress}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[#E8ECEA]">
                  <div
                    className="h-full rounded-full bg-[#14B8A6]"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
                  Margin
                </p>

                <p className="mt-1 text-sm font-bold text-[#334155]">
                  {project.margin}%
                </p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
                  Remaining
                </p>

                <p className="mt-1 text-sm font-bold text-[#334155]">
                  {100 - project.progress}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function SalesPipeline({
  currency,
}: {
  currency: 'GBP' | 'NGN';
}) {
  const maximum = pipelineStages[0].value;

  return (
    <article className="rounded-3xl border border-[#0B1020]/[0.07] bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-[#A87B1B]" />

        <h2 className="text-base font-bold text-[#0B1020]">
          Sales pipeline
        </h2>
      </div>

      <p className="mt-1 text-sm text-[#5A6173]">
        Commercial opportunities progressing towards signed contracts.
      </p>

      <div className="mt-7 space-y-4">
        {pipelineStages.map((stage, index) => {
          const width = (stage.value / maximum) * 100;

          return (
            <div key={stage.label}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-[#334155]">
                    {stage.label}
                  </p>

                  <p className="mt-0.5 text-xs text-[#94A3B8]">
                    {stage.value} opportunities
                  </p>
                </div>

                <p className="text-sm font-bold text-[#0B1020]">
                  {formatMoney(stage.amount, currency, true)}
                </p>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#F0F2F1]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${width}%`,
                    background:
                      index === pipelineStages.length - 1
                        ? '#14B8A6'
                        : `rgba(11,16,32,${
                            0.12 + index * 0.12
                          })`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl bg-[#FAFAF9] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-[#64748B]">
            Pipeline conversion
          </span>

          <span className="font-bold text-[#0B1020]">
            13.2%
          </span>
        </div>

        <p className="mt-2 text-xs leading-5 text-[#94A3B8]">
          Five of thirty-eight active leads have converted into signed
          contracts.
        </p>
      </div>
    </article>
  );
}

function PlatformUsageAnalytics() {
  const maximum = Math.max(...activitySeries);
  const points = createChartPoints(activitySeries, maximum);

  return (
    <article className="rounded-3xl border border-[#0B1020]/[0.07] bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#A87B1B]" />

            <h2 className="text-base font-bold text-[#0B1020]">
              Platform usage
            </h2>
          </div>

          <p className="mt-1 text-sm text-[#5A6173]">
            Active users across all client systems.
          </p>
        </div>

        <div className="text-right">
          <p className="text-2xl font-bold text-[#0B1020]">
            542
          </p>

          <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#0D9488]">
            <ArrowUpRight className="h-3.5 w-3.5" />
            16.8%
          </p>
        </div>
      </div>

      <div className="relative mt-6 h-52 overflow-hidden rounded-2xl bg-[#FAFAF9]">
        <div className="absolute inset-0 flex flex-col justify-between p-4">
          {[0, 1, 2, 3].map((line) => (
            <div
              key={line}
              className="border-t border-dashed border-[#0B1020]/[0.06]"
            />
          ))}
        </div>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]"
        >
          <defs>
            <linearGradient
              id="activity-fill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#1E4E8C"
                stopOpacity="0.25"
              />

              <stop
                offset="100%"
                stopColor="#1E4E8C"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          <polygon
            points={`0,100 ${points} 100,100`}
            fill="url(#activity-fill)"
          />

          <polyline
            points={points}
            fill="none"
            stroke="#1E4E8C"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="absolute bottom-3 left-4 right-4 flex justify-between text-[10px] font-semibold text-[#94A3B8]">
          <span>12 weeks ago</span>
          <span>Today</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniStatistic label="Daily active users" value="542" />
        <MiniStatistic label="Monthly active users" value="2,841" />
        <MiniStatistic label="Average session" value="14m 28s" />
      </div>
    </article>
  );
}

function AcquisitionAnalytics() {
  return (
    <article className="rounded-3xl border border-[#0B1020]/[0.07] bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <MousePointerClick className="h-5 w-5 text-[#A87B1B]" />

        <h2 className="text-base font-bold text-[#0B1020]">
          Lead acquisition
        </h2>
      </div>

      <p className="mt-1 text-sm text-[#5A6173]">
        Where new commercial opportunities are coming from.
      </p>

      <div className="mt-6 space-y-4">
        {acquisitionChannels.map((channel, index) => (
          <div key={channel.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#334155]">
                  {channel.label}
                </p>

                <p className="mt-0.5 text-xs text-[#94A3B8]">
                  {channel.leads} leads
                </p>
              </div>

              <span className="text-sm font-bold text-[#0B1020]">
                {channel.value}%
              </span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF1EF]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${channel.value}%`,
                  backgroundColor:
                    index === 0
                      ? '#14B8A6'
                      : index === 1
                        ? '#D4AF37'
                        : index === 2
                          ? '#1E4E8C'
                          : '#94A3B8',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function SupportPerformance() {
  return (
    <SmallAnalyticsCard
      icon={Headphones}
      title="Support performance"
      subtitle="Service quality and response efficiency"
    >
      <MetricPair
        label="Average response"
        value="18m"
        change="-22%"
        positive
      />

      <MetricPair
        label="Resolution time"
        value="3h 42m"
        change="-14%"
        positive
      />

      <MetricPair
        label="Client satisfaction"
        value="97.2%"
        change="+2.1%"
        positive
      />

      <div className="mt-5 space-y-3">
        {supportAnalytics.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#64748B]">
                {item.label}
              </span>

              <span className="font-bold text-[#334155]">
                {item.value}%
              </span>
            </div>

            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF1EF]">
              <div
                className="h-full rounded-full bg-[#14B8A6]"
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </SmallAnalyticsCard>
  );
}

function ContractAnalytics({
  currency,
}: {
  currency: 'GBP' | 'NGN';
}) {
  return (
    <SmallAnalyticsCard
      icon={FileSignature}
      title="Contract analytics"
      subtitle="Commercial agreements and renewals"
    >
      <MetricPair
        label="Active contracts"
        value="9"
        change="+2"
        positive
      />

      <MetricPair
        label="Contracted value"
        value={formatMoney(142000, currency, true)}
        change="+18.4%"
        positive
      />

      <MetricPair
        label="Renewal rate"
        value="91.6%"
        change="+4.3%"
        positive
      />

      <div className="mt-6 rounded-2xl border border-[#D4AF37]/20 bg-[#FFFDF7] p-4">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-5 w-5 text-[#A87B1B]" />

          <div>
            <p className="text-sm font-bold text-[#334155]">
              2 contracts expiring soon
            </p>

            <p className="mt-1 text-xs leading-5 text-[#64748B]">
              Renewal discussions should begin within the next 30 days.
            </p>
          </div>
        </div>
      </div>
    </SmallAnalyticsCard>
  );
}

function DeploymentAnalytics() {
  return (
    <SmallAnalyticsCard
      icon={CloudCog}
      title="Deployment analytics"
      subtitle="Release reliability and delivery frequency"
    >
      <MetricPair
        label="Deployments"
        value="42"
        change="+11"
        positive
      />

      <MetricPair
        label="Success rate"
        value="97.6%"
        change="+1.8%"
        positive
      />

      <MetricPair
        label="Average duration"
        value="2m 18s"
        change="-16s"
        positive
      />

      <div className="mt-6 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }, (_, index) => {
          const strength = (index * 7) % 5;

          const classes = [
            'bg-[#E8ECEA]',
            'bg-[#14B8A6]/20',
            'bg-[#14B8A6]/40',
            'bg-[#14B8A6]/65',
            'bg-[#14B8A6]',
          ];

          return (
            <div
              key={index}
              className={`h-5 rounded ${classes[strength]}`}
            />
          );
        })}
      </div>

      <p className="mt-3 text-xs text-[#94A3B8]">
        Deployment activity over the previous five weeks
      </p>
    </SmallAnalyticsCard>
  );
}

function TeamPerformance() {
  return (
    <article className="overflow-hidden rounded-3xl border border-[#0B1020]/[0.07] bg-white">
      <div className="border-b border-[#0B1020]/[0.06] px-5 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#A87B1B]" />

          <h2 className="text-base font-bold text-[#0B1020]">
            Team performance
          </h2>
        </div>

        <p className="mt-1 text-sm text-[#5A6173]">
          Work completed, response time, satisfaction and utilisation.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="border-b border-[#0B1020]/[0.06] bg-[#FAFAF9] text-left">
              <TableHeading>Team member</TableHeading>
              <TableHeading>Completed</TableHeading>
              <TableHeading>Response</TableHeading>
              <TableHeading>Satisfaction</TableHeading>
              <TableHeading>Utilisation</TableHeading>
            </tr>
          </thead>

          <tbody>
            {teamPerformance.map((member) => (
              <tr
                key={member.name}
                className="border-b border-[#0B1020]/[0.06] last:border-0"
              >
                <td className="px-5 py-4">
                  <p className="text-sm font-bold text-[#0B1020]">
                    {member.name}
                  </p>

                  <p className="mt-0.5 text-xs text-[#64748B]">
                    {member.role}
                  </p>
                </td>

                <td className="px-5 py-4 text-sm font-bold text-[#334155]">
                  {member.completed}
                </td>

                <td className="px-5 py-4 text-sm font-bold text-[#334155]">
                  {member.response}
                </td>

                <td className="px-5 py-4">
                  <HealthBadge value={member.satisfaction} />
                </td>

                <td className="px-5 py-4">
                  <ProgressValue value={member.utilisation} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function GeographicRevenue({
  currency,
}: {
  currency: 'GBP' | 'NGN';
}) {
  return (
    <article className="rounded-3xl border border-[#0B1020]/[0.07] bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Globe2 className="h-5 w-5 text-[#A87B1B]" />

        <h2 className="text-base font-bold text-[#0B1020]">
          Geographic revenue
        </h2>
      </div>

      <p className="mt-1 text-sm text-[#5A6173]">
        Revenue contribution by market.
      </p>

      <div className="mt-7 space-y-5">
        {geographicRevenue.map((market, index) => (
          <div key={market.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#334155]">
                  {market.label}
                </p>

                <p className="mt-0.5 text-xs text-[#94A3B8]">
                  {formatMoney(market.amount, currency, true)}
                </p>
              </div>

              <span className="text-sm font-bold text-[#0B1020]">
                {market.value}%
              </span>
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF1EF]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${market.value}%`,
                  backgroundColor:
                    index === 0
                      ? '#0D9488'
                      : index === 1
                        ? '#D4AF37'
                        : index === 2
                          ? '#1E4E8C'
                          : '#7C3AED',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function MetricCard({
  label,
  value,
  change,
  description,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  change: number;
  description: string;
  icon: LucideIcon;
  tone: MetricTone;
}) {
  const toneClasses: Record<
    MetricTone,
    string
  > = {
    teal: 'bg-[#14B8A6]/10 text-[#0D9488]',
    gold: 'bg-[#D4AF37]/15 text-[#A87B1B]',
    blue: 'bg-[#1E4E8C]/10 text-[#1E4E8C]',
    violet: 'bg-violet-50 text-violet-700',
  };

  return (
    <article className="rounded-3xl border border-[#0B1020]/[0.07] bg-white p-5 shadow-[0_1px_2px_rgba(11,16,32,0.04)]">
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-[#14B8A6]/[0.07] px-2.5 py-1 text-xs font-bold text-[#0D9488]">
          <ArrowUpRight className="h-3.5 w-3.5" />
          {change.toFixed(1)}%
        </span>
      </div>

      <p className="mt-5 text-sm font-semibold text-[#64748B]">
        {label}
      </p>

      <p className="mt-1 text-3xl font-bold tracking-tight text-[#0B1020]">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-[#94A3B8]">
        {description}
      </p>
    </article>
  );
}

function InsightCard({
  icon: Icon,
  label,
  value,
  description,
  progress,
  footer,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  progress: number;
  footer: string;
}) {
  return (
    <article className="rounded-3xl border border-[#0B1020]/[0.07] bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1020]/[0.05] text-[#475569]">
          <Icon className="h-5 w-5" />
        </div>

        <ArrowUpRight className="h-4 w-4 text-[#94A3B8]" />
      </div>

      <p className="mt-5 text-sm font-semibold text-[#64748B]">
        {label}
      </p>

      <p className="mt-1 text-2xl font-bold text-[#0B1020]">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-[#94A3B8]">
        {description}
      </p>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EEF1EF]">
        <div
          className="h-full rounded-full bg-[#14B8A6]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-3 text-xs font-semibold text-[#0D9488]">
        {footer}
      </p>
    </article>
  );
}

function SmallAnalyticsCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-[#0B1020]/[0.07] bg-white p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-[#A87B1B]" />

        <h2 className="text-base font-bold text-[#0B1020]">
          {title}
        </h2>
      </div>

      <p className="mt-1 text-sm text-[#5A6173]">
        {subtitle}
      </p>

      <div className="mt-6 space-y-4">
        {children}
      </div>
    </article>
  );
}

function ExecutiveInsight({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/20 bg-[#FFFDF7] p-5">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full border border-[#D4AF37]/20" />

      <div className="relative">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D4AF37]/15 text-[#A87B1B]">
          <Icon className="h-5 w-5" />
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[#A87B1B]">
          {title}
        </p>

        <h3 className="mt-2 text-xl font-bold text-[#0B1020]">
          {value}
        </h3>

        <p className="mt-2 text-sm leading-6 text-[#5A6173]">
          {description}
        </p>
      </div>
    </article>
  );
}

function ChartSummary({
  label,
  value,
  detail,
  detailClassName,
}: {
  label: string;
  value: string;
  detail: string;
  detailClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-[#0B1020]/[0.07] bg-[#FAFAF9] p-4">
      <p className="text-xs font-semibold text-[#64748B]">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold text-[#0B1020]">
        {value}
      </p>

      <p className={`mt-2 text-xs font-bold ${detailClassName}`}>
        {detail}
      </p>
    </div>
  );
}

function Legend({
  colourClassName,
  label,
}: {
  colourClassName: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${colourClassName}`}
      />

      {label}
    </span>
  );
}

function ScoreRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-white/55">
          {label}
        </span>

        <span className="font-bold text-white">
          {value}%
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#14B8A6]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function MetricPair({
  label,
  value,
  change,
  positive,
}: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-semibold text-[#64748B]">
        {label}
      </span>

      <div className="text-right">
        <p className="text-sm font-bold text-[#0B1020]">
          {value}
        </p>

        <p
          className={`mt-0.5 text-[10px] font-bold ${
            positive ? 'text-[#0D9488]' : 'text-red-600'
          }`}
        >
          {change}
        </p>
      </div>
    </div>
  );
}

function MiniStatistic({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#FAFAF9] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-[#334155]">
        {value}
      </p>
    </div>
  );
}

function ChangeValue({ value }: { value: number }) {
  const positive = value >= 0;

  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-bold ${
        positive ? 'text-[#0D9488]' : 'text-red-600'
      }`}
    >
      {positive ? (
        <ArrowUpRight className="h-4 w-4" />
      ) : (
        <ArrowDownRight className="h-4 w-4" />
      )}

      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function ProgressValue({ value }: { value: number }) {
  return (
    <div className="w-28">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-[#334155]">
          {value}%
        </span>
      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E8ECEA]">
        <div
          className="h-full rounded-full bg-[#14B8A6]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function HealthBadge({ value }: { value: number }) {
  const healthy = value >= 95;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
        healthy
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-amber-50 text-amber-700'
      }`}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      {value}%
    </span>
  );
}

function ProjectHealthBadge({
  health,
}: {
  health: ProjectPerformance['health'];
}) {
  const classes: Record<
    ProjectPerformance['health'],
    string
  > = {
    Healthy: 'bg-emerald-50 text-emerald-700',
    Attention: 'bg-amber-50 text-amber-700',
    'At risk': 'bg-red-50 text-red-700',
  };

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${classes[health]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {health}
    </span>
  );
}

function TableHeading({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <th className="px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]">
      {children}
    </th>
  );
}

function createChartPoints(
  values: number[],
  maximum: number,
) {
  return values
    .map((value, index) => {
      const x =
        (index / Math.max(values.length - 1, 1)) * 100;

      const y = 92 - (value / Math.max(maximum, 1)) * 78;

      return `${x},${y}`;
    })
    .join(' ');
}

function formatMoney(
  amount: number,
  currency: 'GBP' | 'NGN',
  compact = false,
) {
  const convertedAmount =
    currency === 'NGN' ? amount * 2050 : amount;

  return new Intl.NumberFormat(
    currency === 'NGN' ? 'en-NG' : 'en-GB',
    {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
    },
  ).format(convertedAmount);
}