'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  FileSpreadsheet,
  Landmark,
  MoreHorizontal,
  PiggyBank,
  ReceiptText,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';

type Period = '7D' | '30D' | '3M' | '6M' | '1Y';

type TransactionStatus = 'Paid' | 'Pending' | 'Overdue';

interface Transaction {
  id: string;
  tenant: string;
  initials: string;
  property: string;
  unit: string;
  amount: number;
  date: string;
  paymentMethod: string;
  status: TransactionStatus;
}

interface OutstandingPayment {
  id: string;
  tenant: string;
  initials: string;
  property: string;
  amount: number;
  dueDate: string;
  overdueDays: number;
}

interface Expense {
  id: string;
  category: string;
  property: string;
  description: string;
  amount: number;
  date: string;
}

interface Deposit {
  id: string;
  tenant: string;
  property: string;
  amount: number;
  status: 'Held' | 'Partially refunded' | 'Refunded';
}

const periodRevenue: Record<Period, number[]> = {
  '7D': [260000, 420000, 310000, 680000, 540000, 820000, 740000],
  '30D': [
    210000, 360000, 290000, 470000, 650000, 510000, 760000, 580000,
    840000, 720000, 930000, 690000,
  ],
  '3M': [
    2300000, 3100000, 2750000, 3800000, 3400000, 4300000, 3950000,
    5100000, 4700000, 5800000, 5250000, 6200000,
  ],
  '6M': [
    4100000, 5300000, 4800000, 6500000, 5900000, 7200000, 6800000,
    8100000, 7600000, 8900000, 8400000, 9600000,
  ],
  '1Y': [
    7200000, 8500000, 7900000, 9300000, 8800000, 10400000, 9700000,
    11200000, 10800000, 12400000, 11700000, 13600000,
  ],
};

const periodLabels: Record<Period, string[]> = {
  '7D': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  '30D': [
    '1 Jul',
    '4 Jul',
    '7 Jul',
    '10 Jul',
    '13 Jul',
    '16 Jul',
    '19 Jul',
    '22 Jul',
    '25 Jul',
    '28 Jul',
    '30 Jul',
    'Today',
  ],
  '3M': [
    'Week 1',
    'Week 2',
    'Week 3',
    'Week 4',
    'Week 5',
    'Week 6',
    'Week 7',
    'Week 8',
    'Week 9',
    'Week 10',
    'Week 11',
    'Week 12',
  ],
  '6M': [
    'Feb',
    'Feb',
    'Mar',
    'Mar',
    'Apr',
    'Apr',
    'May',
    'May',
    'Jun',
    'Jun',
    'Jul',
    'Jul',
  ],
  '1Y': [
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
  ],
};

const transactions: Transaction[] = [
  {
    id: 'TRX-90812',
    tenant: 'Aisha Bello',
    initials: 'AB',
    property: 'Maple Court Apartments',
    unit: 'Unit 4B',
    amount: 850000,
    date: '18 Jul 2026',
    paymentMethod: 'Bank transfer',
    status: 'Paid',
  },
  {
    id: 'TRX-90811',
    tenant: 'Samuel Okafor',
    initials: 'SO',
    property: 'Victoria Island Residence',
    unit: 'Flat 2A',
    amount: 1250000,
    date: '17 Jul 2026',
    paymentMethod: 'Card payment',
    status: 'Paid',
  },
  {
    id: 'TRX-90810',
    tenant: 'Fatima Musa',
    initials: 'FM',
    property: 'Parkview Terraces',
    unit: 'House 7',
    amount: 950000,
    date: '16 Jul 2026',
    paymentMethod: 'Bank transfer',
    status: 'Pending',
  },
  {
    id: 'TRX-90809',
    tenant: 'David Eze',
    initials: 'DE',
    property: 'Lekki Garden Suites',
    unit: 'Unit 12',
    amount: 720000,
    date: '14 Jul 2026',
    paymentMethod: 'Wallet',
    status: 'Overdue',
  },
  {
    id: 'TRX-90808',
    tenant: 'Zainab Abdullahi',
    initials: 'ZA',
    property: 'Cedar Heights',
    unit: 'Flat 6C',
    amount: 680000,
    date: '12 Jul 2026',
    paymentMethod: 'Bank transfer',
    status: 'Paid',
  },
];

const outstandingPayments: OutstandingPayment[] = [
  {
    id: 'OUT-1',
    tenant: 'David Eze',
    initials: 'DE',
    property: 'Lekki Garden Suites · Unit 12',
    amount: 720000,
    dueDate: '8 Jul 2026',
    overdueDays: 10,
  },
  {
    id: 'OUT-2',
    tenant: 'Grace Thomas',
    initials: 'GT',
    property: 'Maple Court Apartments · Unit 2A',
    amount: 850000,
    dueDate: '12 Jul 2026',
    overdueDays: 6,
  },
  {
    id: 'OUT-3',
    tenant: 'Kabiru Lawal',
    initials: 'KL',
    property: 'Cedar Heights · Flat 3B',
    amount: 680000,
    dueDate: '16 Jul 2026',
    overdueDays: 2,
  },
];

const expenses: Expense[] = [
  {
    id: 'EXP-1',
    category: 'Repairs',
    property: 'Maple Court Apartments',
    description: 'Kitchen plumbing repair',
    amount: 185000,
    date: '17 Jul 2026',
  },
  {
    id: 'EXP-2',
    category: 'Maintenance',
    property: 'Parkview Terraces',
    description: 'Generator servicing',
    amount: 240000,
    date: '15 Jul 2026',
  },
  {
    id: 'EXP-3',
    category: 'Utilities',
    property: 'Victoria Island Residence',
    description: 'Shared electricity bill',
    amount: 320000,
    date: '13 Jul 2026',
  },
  {
    id: 'EXP-4',
    category: 'Cleaning',
    property: 'Cedar Heights',
    description: 'Common-area cleaning',
    amount: 95000,
    date: '10 Jul 2026',
  },
];

const deposits: Deposit[] = [
  {
    id: 'DEP-1',
    tenant: 'Aisha Bello',
    property: 'Maple Court Apartments · Unit 4B',
    amount: 850000,
    status: 'Held',
  },
  {
    id: 'DEP-2',
    tenant: 'Samuel Okafor',
    property: 'Victoria Island Residence · Flat 2A',
    amount: 1250000,
    status: 'Held',
  },
  {
    id: 'DEP-3',
    tenant: 'Zainab Abdullahi',
    property: 'Cedar Heights · Flat 6C',
    amount: 680000,
    status: 'Partially refunded',
  },
];

const financeStats = [
  {
    label: 'Total revenue',
    value: '₦15.40M',
    comparison: '+12.4%',
    comparisonLabel: 'from last month',
    icon: CircleDollarSign,
    positive: true,
    iconClassName: 'bg-[#E8F7F1] text-[#18775C]',
  },
  {
    label: 'Outstanding rent',
    value: '₦2.25M',
    comparison: '3 payments',
    comparisonLabel: 'need attention',
    icon: Clock3,
    positive: false,
    iconClassName: 'bg-[#FFF4DD] text-[#A66C00]',
  },
  {
    label: 'Total expenses',
    value: '₦4.20M',
    comparison: '-6.8%',
    comparisonLabel: 'from last month',
    icon: ReceiptText,
    positive: true,
    iconClassName: 'bg-[#F0EDFF] text-[#6750A4]',
  },
  {
    label: 'Net income',
    value: '₦11.20M',
    comparison: '+18.1%',
    comparisonLabel: 'from last month',
    icon: TrendingUp,
    positive: true,
    iconClassName: 'bg-[#EAF2FF] text-[#2B66BA]',
  },
];

const propertyPerformance = [
  {
    name: 'Victoria Island Residence',
    units: '8 occupied units',
    revenue: 4250000,
    percentage: 92,
  },
  {
    name: 'Maple Court Apartments',
    units: '6 occupied units',
    revenue: 3680000,
    percentage: 79,
  },
  {
    name: 'Parkview Terraces',
    units: '5 occupied units',
    revenue: 2950000,
    percentage: 64,
  },
  {
    name: 'Cedar Heights',
    units: '4 occupied units',
    revenue: 2180000,
    percentage: 47,
  },
];

const paymentBreakdown = [
  {
    label: 'Collected',
    value: 15400000,
    percentage: 71,
    className: 'bg-[#17775B]',
  },
  {
    label: 'Outstanding',
    value: 2250000,
    percentage: 15,
    className: 'bg-[#D99B2B]',
  },
  {
    label: 'Expenses',
    value: 4200000,
    percentage: 14,
    className: 'bg-[#69756F]',
  },
];

function formatCurrency(amount: number, compact = false) {
  if (compact) {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusClasses(status: TransactionStatus) {
  switch (status) {
    case 'Paid':
      return 'bg-[#E8F7F1] text-[#18775C] ring-[#CDEADE]';
    case 'Pending':
      return 'bg-[#FFF6E5] text-[#9A6906] ring-[#F4E2B8]';
    case 'Overdue':
      return 'bg-[#FFF0EE] text-[#B8473A] ring-[#F2D3CE]';
  }
}

function getDepositClasses(status: Deposit['status']) {
  switch (status) {
    case 'Held':
      return 'bg-[#E8F7F1] text-[#18775C]';
    case 'Partially refunded':
      return 'bg-[#FFF6E5] text-[#9A6906]';
    case 'Refunded':
      return 'bg-[#EDF2F0] text-[#66736D]';
  }
}

export default function FinancePage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('30D');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'All statuses' | TransactionStatus
  >('All statuses');

  const chartData = periodRevenue[selectedPeriod];
  const chartLabels = periodLabels[selectedPeriod];

  const maxChartValue = Math.max(...chartData);

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const matchesSearch =
        !normalizedSearch ||
        transaction.tenant.toLowerCase().includes(normalizedSearch) ||
        transaction.property.toLowerCase().includes(normalizedSearch) ||
        transaction.unit.toLowerCase().includes(normalizedSearch) ||
        transaction.id.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === 'All statuses' ||
        transaction.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter]);

  return (
    <main className="min-h-screen bg-[#F7F9F8] pb-12 text-[#102A22]">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        <header className="flex flex-col gap-5 border-b border-[#DDE5E1] bg-white px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8A7160]">
              <Landmark className="h-4 w-4" />
              Financial management
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#102A22] sm:text-3xl">
              Finance
            </h1>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5F6F68]">
              Monitor rental income, expenses, outstanding balances and
              property performance from one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D8E1DD] bg-white px-4 text-sm font-semibold text-[#29443A] shadow-sm transition hover:border-[#BAC9C2] hover:bg-[#F8FAF9]"
            >
              <CalendarDays className="h-4 w-4" />
              1–18 July 2026
              <ChevronDown className="h-4 w-4 text-[#7A8A83]" />
            </button>

            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D8E1DD] bg-white px-4 text-sm font-semibold text-[#29443A] shadow-sm transition hover:border-[#BAC9C2] hover:bg-[#F8FAF9]"
            >
              <Download className="h-4 w-4" />
              Export
            </button>

            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#153C30] px-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(21,60,48,0.2)] transition hover:bg-[#0F3026]"
            >
              <ArrowDownLeft className="h-4 w-4" />
              Record payment
            </button>
          </div>
        </header>

        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {financeStats.map((stat) => {
              const Icon = stat.icon;

              return (
                <article
                  key={stat.label}
                  className="rounded-2xl border border-[#DFE6E3] bg-white p-5 shadow-[0_8px_28px_rgba(27,51,43,0.05)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconClassName}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <button
                      type="button"
                      aria-label={`View ${stat.label} options`}
                      className="rounded-lg p-1.5 text-[#8C9A94] transition hover:bg-[#F2F5F3] hover:text-[#29443A]"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>

                  <p className="mt-5 text-sm font-medium text-[#6C7B75]">
                    {stat.label}
                  </p>

                  <p className="mt-1 text-2xl font-bold tracking-tight text-[#102A22]">
                    {stat.value}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        stat.positive ? 'text-[#18775C]' : 'text-[#B77813]'
                      }`}
                    >
                      {stat.positive ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      {stat.comparison}
                    </span>

                    <span className="text-[#8A9791]">
                      {stat.comparisonLabel}
                    </span>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
            <article className="overflow-hidden rounded-2xl border border-[#DFE6E3] bg-white shadow-[0_8px_28px_rgba(27,51,43,0.05)]">
              <div className="flex flex-col gap-4 border-b border-[#E6ECE9] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-[#8A7160]" />
                    <h2 className="text-base font-bold text-[#17352B]">
                      Revenue overview
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-[#788680]">
                    Rental income received across all properties.
                  </p>
                </div>

                <div className="flex w-fit items-center rounded-xl bg-[#F1F5F3] p-1">
                  {(['7D', '30D', '3M', '6M', '1Y'] as Period[]).map(
                    (period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setSelectedPeriod(period)}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          selectedPeriod === period
                            ? 'bg-white text-[#183D31] shadow-sm'
                            : 'text-[#76857E] hover:text-[#29443A]'
                        }`}
                      >
                        {period}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[#75837D]">
                      Revenue for selected period
                    </p>

                    <div className="mt-1 flex items-center gap-3">
                      <p className="text-3xl font-bold tracking-tight text-[#102A22]">
                        {formatCurrency(
                          chartData.reduce((total, value) => total + value, 0),
                          true,
                        )}
                      </p>

                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F7F1] px-2.5 py-1 text-xs font-bold text-[#18775C]">
                        <TrendingUp className="h-3.5 w-3.5" />
                        12.4%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 text-xs font-medium text-[#697871]">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#1C7D61]" />
                      Revenue
                    </span>

                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#D8B269]" />
                      Target
                    </span>
                  </div>
                </div>

                <div className="relative h-[310px]">
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                    {[100, 75, 50, 25, 0].map((line) => (
                      <div
                        key={line}
                        className="relative border-t border-dashed border-[#E4EAE7]"
                      >
                        <span className="absolute -top-2.5 left-0 bg-white pr-2 text-[10px] font-medium text-[#9AA69F]">
                          {formatCurrency((maxChartValue * line) / 100, true)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 top-2 flex items-end gap-2 pl-10 sm:gap-3">
                    {chartData.map((value, index) => {
                      const height = Math.max(
                        8,
                        Math.round((value / maxChartValue) * 88),
                      );

                      return (
                        <div
                          key={`${selectedPeriod}-${index}`}
                          className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                        >
                          <div className="relative flex h-[88%] w-full items-end justify-center">
                            <div className="absolute bottom-0 left-1/2 h-[73%] w-[48%] -translate-x-1/2 rounded-t-md border border-[#E2D2AF] bg-[#F5EEDC]" />

                            <div
                              className="relative z-10 w-[48%] min-w-[8px] max-w-[34px] rounded-t-md bg-gradient-to-t from-[#155844] to-[#2B9474] transition-all duration-500 group-hover:from-[#0F4737] group-hover:to-[#247D63]"
                              style={{ height: `${height}%` }}
                            >
                              <div className="pointer-events-none absolute -top-11 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#102A22] px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-lg group-hover:block">
                                {formatCurrency(value)}
                                <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-[#102A22]" />
                              </div>
                            </div>
                          </div>

                          <span className="mt-3 max-w-full truncate text-[10px] font-medium text-[#86938D]">
                            {chartLabels[index]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-[#DFE6E3] bg-white p-5 shadow-[0_8px_28px_rgba(27,51,43,0.05)] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <WalletCards className="h-5 w-5 text-[#8A7160]" />
                    <h2 className="text-base font-bold text-[#17352B]">
                      Cash flow
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-[#788680]">
                    July financial distribution.
                  </p>
                </div>

                <button
                  type="button"
                  className="rounded-lg p-1.5 text-[#8C9A94] transition hover:bg-[#F2F5F3] hover:text-[#29443A]"                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-7 flex justify-center">
                <div
                  className="relative flex h-48 w-48 items-center justify-center rounded-full"
                  style={{
                    background:
                      'conic-gradient(#17775B 0deg 255deg, #D99B2B 255deg 309deg, #69756F 309deg 360deg)',
                  }}
                >
                  <div className="flex h-[138px] w-[138px] flex-col items-center justify-center rounded-full bg-white shadow-inner">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8B9892]">
                      Net income
                    </span>

                    <strong className="mt-1 text-2xl font-bold text-[#17352B]">
                      ₦11.2M
                    </strong>

                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#18775C]">
                      <TrendingUp className="h-3.5 w-3.5" />
                      18.1%
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-7 space-y-4">
                {paymentBreakdown.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${item.className}`}
                        />

                        <span className="text-sm font-medium text-[#596A63]">
                          {item.label}
                        </span>
                      </div>

                      <span className="text-sm font-bold text-[#233E34]">
                        {formatCurrency(item.value, true)}
                      </span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EDF1EF]">
                      <div
                        className={`h-full rounded-full ${item.className}`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#D8E1DD] bg-white text-sm font-semibold text-[#29443A] transition hover:bg-[#F6F9F7]"
              >
                View cash-flow report
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </article>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#DFE6E3] bg-white shadow-[0_8px_28px_rgba(27,51,43,0.05)]">
            <div className="flex flex-col gap-4 border-b border-[#E6ECE9] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-[#8A7160]" />

                  <h2 className="text-base font-bold text-[#17352B]">
                    Recent transactions
                  </h2>
                </div>

                <p className="mt-1 text-sm text-[#788680]">
                  Review incoming rent and other property payments.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A9791]" />

                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search transactions"
                    className="h-11 w-full rounded-xl border border-[#D8E1DD] bg-white pl-10 pr-4 text-sm text-[#253E35] outline-none transition placeholder:text-[#9AA59F] focus:border-[#7D9A8E] focus:ring-4 focus:ring-[#DCEAE4] sm:w-64"
                  />
                </label>

                <label className="relative block">
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as
                          | 'All statuses'
                          | TransactionStatus,
                      )
                    }
                    className="h-11 w-full appearance-none rounded-xl border border-[#D8E1DD] bg-white px-4 pr-10 text-sm font-semibold text-[#40554D] outline-none transition focus:border-[#7D9A8E] focus:ring-4 focus:ring-[#DCEAE4] sm:w-40"
                  >
                    <option>All statuses</option>
                    <option>Paid</option>
                    <option>Pending</option>
                    <option>Overdue</option>
                  </select>

                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8982]" />
                </label>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E6ECE9] bg-[#F9FBFA] text-left">
                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-[0.08em] text-[#74837C]">
                      Tenant
                    </th>

                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-[0.08em] text-[#74837C]">
                      Property
                    </th>

                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-[0.08em] text-[#74837C]">
                      Date
                    </th>

                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-[0.08em] text-[#74837C]">
                      Method
                    </th>

                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-[0.08em] text-[#74837C]">
                      Amount
                    </th>

                    <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-[0.08em] text-[#74837C]">
                      Status
                    </th>

                    <th className="px-6 py-3.5 text-right text-xs font-bold uppercase tracking-[0.08em] text-[#74837C]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="border-b border-[#EDF1EF] transition last:border-b-0 hover:bg-[#FBFCFB]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#E9F1ED] text-xs font-bold text-[#315B4C]">
                            {transaction.initials}
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-[#233E34]">
                              {transaction.tenant}
                            </p>

                            <p className="mt-0.5 text-xs text-[#89968F]">
                              {transaction.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-[#344D44]">
                          {transaction.property}
                        </p>

                        <p className="mt-0.5 text-xs text-[#89968F]">
                          {transaction.unit}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm text-[#5F7069]">
                        {transaction.date}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-2 text-sm text-[#5F7069]">
                          {transaction.paymentMethod === 'Card payment' ? (
                            <CreditCard className="h-4 w-4 text-[#89968F]" />
                          ) : transaction.paymentMethod === 'Wallet' ? (
                            <WalletCards className="h-4 w-4 text-[#89968F]" />
                          ) : (
                            <Landmark className="h-4 w-4 text-[#89968F]" />
                          )}

                          {transaction.paymentMethod}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-sm font-bold text-[#213C32]">
                        {formatCurrency(transaction.amount)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${getStatusClasses(
                            transaction.status,
                          )}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {transaction.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          aria-label={`View ${transaction.id}`}
                          className="rounded-lg p-2 text-[#829089] transition hover:bg-[#EEF3F0] hover:text-[#29443A]"
                        >
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-14 text-center">
                        <Search className="mx-auto h-8 w-8 text-[#AAB4AF]" />

                        <p className="mt-3 text-sm font-semibold text-[#455A52]">
                          No matching transactions
                        </p>

                        <p className="mt-1 text-sm text-[#87938D]">
                          Try changing your search or status filter.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#E6ECE9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-[#7B8982]">
                Showing{' '}
                <span className="font-semibold text-[#344D44]">
                  {filteredTransactions.length}
                </span>{' '}
                of {transactions.length} transactions
              </p>

              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-bold text-[#276A54] transition hover:text-[#174B3A]"
              >
                View all transactions
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article className="overflow-hidden rounded-2xl border border-[#DFE6E3] bg-white shadow-[0_8px_28px_rgba(27,51,43,0.05)]">
              <div className="flex items-center justify-between gap-4 border-b border-[#E6ECE9] px-5 py-5 sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-[#C78318]" />

                    <h2 className="text-base font-bold text-[#17352B]">
                      Outstanding payments
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-[#788680]">
                    Rent payments requiring your attention.
                  </p>
                </div>

                <span className="rounded-full bg-[#FFF3DD] px-3 py-1 text-xs font-bold text-[#A66C00]">
                  {outstandingPayments.length} overdue
                </span>
              </div>

              <div className="divide-y divide-[#EDF1EF]">
                {outstandingPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col gap-4 px-5 py-5 sm:px-6"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#FFF0E9] text-xs font-bold text-[#A45532]">
                        {payment.initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-bold text-[#263F36]">
                              {payment.tenant}
                            </p>

                            <p className="mt-1 truncate text-xs text-[#788680]">
                              {payment.property}
                            </p>
                          </div>

                          <p className="text-base font-bold text-[#233E34]">
                            {formatCurrency(payment.amount)}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 text-[#7D8B84]">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Due {payment.dueDate}
                          </span>

                          <span className="rounded-full bg-[#FFF0EE] px-2 py-1 font-bold text-[#B8473A]">
                            {payment.overdueDays} days overdue
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 sm:justify-end">
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-[#D8E1DD] px-3 text-xs font-bold text-[#42574F] transition hover:bg-[#F6F9F7]"
                      >
                        Send reminder
                      </button>

                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#173D31] px-3 text-xs font-bold text-white transition hover:bg-[#102F26]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark as paid
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#E6ECE9] px-5 py-4 sm:px-6">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#276A54] transition hover:text-[#174B3A]"
                >
                  View all outstanding payments
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-[#DFE6E3] bg-white shadow-[0_8px_28px_rgba(27,51,43,0.05)]">
              <div className="flex items-center justify-between gap-4 border-b border-[#E6ECE9] px-5 py-5 sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-[#8A7160]" />

                    <h2 className="text-base font-bold text-[#17352B]">
                      Property performance
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-[#788680]">
                    Revenue contribution by property.
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="View property performance options"
                  className="rounded-lg p-1.5 text-[#8C9A94] transition hover:bg-[#F2F5F3] hover:text-[#29443A]"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                {propertyPerformance.map((property, index) => (
                  <div key={property.name}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#EDF3F0] text-xs font-bold text-[#365B4D]">
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#2A4339]">
                            {property.name}
                          </p>

                          <p className="mt-0.5 text-xs text-[#84918B]">
                            {property.units}
                          </p>
                        </div>
                      </div>

                      <p className="flex-none text-sm font-bold text-[#213C32]">
                        {formatCurrency(property.revenue, true)}
                      </p>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EDF1EF]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1A6B53] to-[#35A17D]"
                        style={{ width: `${property.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#E6ECE9] px-5 py-4 sm:px-6">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#276A54] transition hover:text-[#174B3A]"
                >
                  Open performance analytics
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </article>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <article className="overflow-hidden rounded-2xl border border-[#DFE6E3] bg-white shadow-[0_8px_28px_rgba(27,51,43,0.05)]">
              <div className="flex flex-col gap-4 border-b border-[#E6ECE9] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-[#8A7160]" />

                    <h2 className="text-base font-bold text-[#17352B]">
                      Recent expenses
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-[#788680]">
                    Operating costs recorded this month.
                  </p>
                </div>

                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D8E1DD] px-3.5 text-sm font-bold text-[#3D554B] transition hover:bg-[#F6F9F7]"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  Add expense
                </button>
              </div>

              <div className="divide-y divide-[#EDF1EF]">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-start gap-3 px-5 py-4 sm:px-6"
                  >
                    <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#F3EFE8] text-[#8B6944]">
                      <ReceiptText className="h-[18px] w-[18px]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-[#29443A]">
                              {expense.description}
                            </p>

                            <span className="rounded-full bg-[#F1F4F2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#718078]">
                              {expense.category}
                            </span>
                          </div>

                          <p className="mt-1 truncate text-xs text-[#839089]">
                            {expense.property} · {expense.date}
                          </p>
                        </div>

                        <p className="flex-none text-sm font-bold text-[#A04F40]">
                          -{formatCurrency(expense.amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-[#E6ECE9] px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs font-medium text-[#839089]">
                    Total expenses
                  </p>

                  <p className="mt-0.5 text-base font-bold text-[#29443A]">
                    {formatCurrency(
                      expenses.reduce(
                        (total, expense) => total + expense.amount,
                        0,
                      ),
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#276A54] transition hover:text-[#174B3A]"
                >
                  View expenses
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </article>

            <article className="rounded-2xl border border-[#DFE6E3] bg-white p-5 shadow-[0_8px_28px_rgba(27,51,43,0.05)] sm:p-6">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-[#8A7160]" />

                <h2 className="text-base font-bold text-[#17352B]">
                  Financial reports
                </h2>
              </div>

              <p className="mt-1 text-sm leading-6 text-[#788680]">
                Generate downloadable reports for your records, accountants or
                property owners.
              </p>

              <div className="mt-6 space-y-3">
                {[
                  {
                    title: 'Monthly income statement',
                    description: 'Revenue, expenses and net profit',
                    icon: BarChart3,
                  },
                  {
                    title: 'Rent collection report',
                    description: 'Paid, pending and overdue rent',
                    icon: Banknote,
                  },
                  {
                    title: 'Property performance report',
                    description: 'Income by property and unit',
                    icon: Building2,
                  },
                  {
                    title: 'Security deposit report',
                    description: 'Held and refunded deposits',
                    icon: ShieldCheck,
                  },
                ].map((report) => {
                  const Icon = report.icon;

                  return (
                    <button
                      key={report.title}
                      type="button"
                      className="group flex w-full items-center gap-3 rounded-xl border border-[#E1E7E4] p-3.5 text-left transition hover:border-[#BFD0C8] hover:bg-[#F9FBFA]"
                    >
                      <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#EDF3F0] text-[#36604F] transition group-hover:bg-[#E2EEE8]">
                        <Icon className="h-[18px] w-[18px]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[#29443A]">
                          {report.title}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-[#84918B]">
                          {report.description}
                        </p>
                      </div>

                      <Download className="h-4 w-4 flex-none text-[#8C9993] transition group-hover:text-[#276A54]" />
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173D31] text-sm font-bold text-white transition hover:bg-[#102F26]"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Generate custom report
              </button>
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <article className="overflow-hidden rounded-2xl border border-[#DFE6E3] bg-white shadow-[0_8px_28px_rgba(27,51,43,0.05)]">
              <div className="flex items-center justify-between gap-4 border-b border-[#E6ECE9] px-5 py-5 sm:px-6">
                <div>
                  <div className="flex items-center gap-2">
                    <PiggyBank className="h-5 w-5 text-[#8A7160]" />

                    <h2 className="text-base font-bold text-[#17352B]">
                      Security deposits
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-[#788680]">
                    Tenant deposits currently held or refunded.
                  </p>
                </div>

                <span className="text-sm font-bold text-[#29443A]">
                  ₦2.78M held
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-[#E6ECE9] bg-[#F9FBFA] text-left">
                      <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-[0.08em] text-[#74837C]">
                        Tenant
                      </th>

                      <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-[0.08em] text-[#74837C]">
                        Property
                      </th>

                      <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-[0.08em] text-[#74837C]">
                        Deposit
                      </th>

                      <th className="px-6 py-3.5 text-xs font-bold uppercase tracking-[0.08em] text-[#74837C]">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {deposits.map((deposit) => (
                      <tr
                        key={deposit.id}
                        className="border-b border-[#EDF1EF] last:border-b-0"
                      >
                        <td className="px-6 py-4 text-sm font-bold text-[#29443A]">
                          {deposit.tenant}
                        </td>

                        <td className="px-6 py-4 text-sm text-[#63736C]">
                          {deposit.property}
                        </td>

                        <td className="px-6 py-4 text-sm font-bold text-[#29443A]">
                          {formatCurrency(deposit.amount)}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${getDepositClasses(
                              deposit.status,
                            )}`}
                          >
                            {deposit.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="relative overflow-hidden rounded-2xl bg-[#153C30] p-6 text-white shadow-[0_12px_34px_rgba(21,60,48,0.22)]">
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/10" />
              <div className="absolute -right-4 top-8 h-24 w-24 rounded-full border border-white/10" />

              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                  <Landmark className="h-5 w-5 text-[#E9D7A7]" />
                </div>

                <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-white/55">
                  Available balance
                </p>

                <p className="mt-2 text-3xl font-bold tracking-tight">
                  ₦8,940,000
                </p>

                <div className="mt-3 flex items-center gap-2 text-xs text-white/65">
                  <CheckCircle2 className="h-4 w-4 text-[#7DDBB8]" />
                  All cleared payments
                </div>

                <div className="mt-7 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-[#173D31] transition hover:bg-[#EDF4F1]"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    Withdraw
                  </button>

                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 text-sm font-bold text-white transition hover:bg-white/10"
                  >
                    <Banknote className="h-4 w-4" />
                    History
                  </button>
                </div>

                <div className="mt-6 border-t border-white/10 pt-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/55">Pending clearance</span>
                    <span className="font-bold text-white">₦950,000</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-white/55">Last withdrawal</span>
                    <span className="font-bold text-white">10 Jul 2026</span>
                  </div>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </div>
    </main>
  );
}