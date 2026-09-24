/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileText,
  Globe2,
  LayoutDashboard,
  Loader2,
  MapPin,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Target,
  UserCheck,
  UserRound,
  Users,
  Video,
  X,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type RecruitmentSection =
  | 'overview'
  | 'jobs'
  | 'candidates'
  | 'pipeline'
  | 'interviews'
  | 'offers'
  | 'talent-pool';

type DepartmentOption = {
  id: string;
  name: string;
  code: string | null;
  colour: string | null;
};

type HiringManagerOption = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  avatarUrl: string | null;
  departmentId: string | null;
};

type RecruitmentOptions = {
  departments: DepartmentOption[];
  hiringManagers: HiringManagerOption[];
  employmentTypes: string[];
  workArrangements: string[];
  currencies: string[];
  jobStatuses: string[];
  candidateSources: string[];
  applicationStages: string[];
};

type RecruitmentMetrics = {
  openRoles: number;
  totalCandidates: number;
  activeApplications: number;
  interviewsThisWeek: number;
  pendingOffers: number;
  hiresThisMonth: number;
  talentPool: number;
};

type PipelineItem = {
  stage: string;
  count: number;
};

type RecentApplication = {
  id: string;
  applicationRef: string | null;
  stage: string;
  status: string;
  appliedAt: string;
  rating: number | null;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  jobOpening: {
    id: string;
    jobRef: string | null;
    title: string;
  };
};

type UpcomingInterview = {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string;
  durationMinutes: number | null;
  timezone: string | null;
  meetingUrl: string | null;
  location: string | null;
  application: {
    id: string;
    candidate: {
      id: string;
      firstName: string;
      lastName: string;
      preferredName: string | null;
      avatarUrl: string | null;
    };
    jobOpening: {
      id: string;
      title: string;
    };
  };
};

type RecruitmentOverview = {
  metrics: RecruitmentMetrics;
  pipeline: PipelineItem[];
  recentApplications: RecentApplication[];
  upcomingInterviews: UpcomingInterview[];
  generatedAt: string;
};

type JobListItem = {
  id: string;
  jobRef: string | null;
  title: string;
  description: string | null;
  employmentType: string;
  workArrangement: string | null;
  country: string | null;
  city: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  currency: string | null;
  vacancies: number;
  status: string;
  openedAt: string | null;
  closesAt: string | null;
  targetStartDate: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  department: {
    id: string;
    name: string;
    code: string | null;
    colour: string | null;
  } | null;
  hiringManager: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  applicationCount: number;
};

type JobApplicationSummary = {
  id: string;
  applicationRef: string | null;
  stage: string;
  status: string;
  rating: number | null;
  appliedAt: string;
  stageChangedAt: string;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    currentJobTitle: string | null;
    currentCompany: string | null;
    source: string;
  };
  owner: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
  _count: {
    interviews: number;
    offers: number;
  };
};

type JobDetail = Omit<JobListItem, 'applicationCount'> & {
  responsibilities: string | null;
  requirements: string | null;
  benefits: string | null;
  closedAt: string | null;
  hiringManager: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatarUrl: string | null;
    role: string;
  } | null;
  applications: JobApplicationSummary[];
};

type StageCount = {
  stage: string;
  count: number;
};

type JobForm = {
  title: string;
  departmentId: string;
  hiringManagerId: string;
  description: string;
  responsibilities: string;
  requirements: string;
  benefits: string;
  employmentType: string;
  workArrangement: string;
  country: string;
  city: string;
  salaryMin: string;
  salaryMax: string;
  currency: string;
  vacancies: string;
  status: 'DRAFT' | 'OPEN';
  openedAt: string;
  closesAt: string;
  targetStartDate: string;
  published: boolean;
};

type JobFieldErrors = Partial<Record<keyof JobForm, string>>;

type JobSort = 'newest' | 'closing' | 'applicants' | 'title';

type Tone = 'neutral' | 'green' | 'amber' | 'blue' | 'red' | 'purple';

type ToastState = {
  id: number;
  tone: 'success' | 'error';
  message: string;
} | null;

type Notify = (tone: 'success' | 'error', message: string) => void;

type DropdownOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  keywords?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
};

type Person = {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const SECTIONS: Array<{
  id: RecruitmentSection;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { id: 'candidates', label: 'Candidates', icon: Users },
  { id: 'pipeline', label: 'Pipeline', icon: Target },
  { id: 'interviews', label: 'Interviews', icon: CalendarClock },
  { id: 'offers', label: 'Offers', icon: FileText },
  { id: 'talent-pool', label: 'Talent pool', icon: Sparkles },
];

const PIPELINE_ORDER = [
  'APPLIED',
  'SCREENING',
  'SHORTLISTED',
  'INTERVIEW',
  'ASSESSMENT',
  'FINAL_INTERVIEW',
  'OFFER',
  'HIRED',
];

const DEFAULT_EMPLOYMENT_TYPES = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACTOR',
  'INTERN',
  'TEMPORARY',
];

const DEFAULT_CURRENCIES = ['GBP', 'NGN', 'USD', 'EUR'];

const DEFAULT_JOB_STATUSES = [
  'DRAFT',
  'OPEN',
  'PAUSED',
  'CLOSED',
  'FILLED',
  'CANCELLED',
];

const JOB_SORT_OPTIONS: Array<DropdownOption<JobSort>> = [
  { value: 'newest', label: 'Newest first' },
  { value: 'closing', label: 'Closing soonest' },
  { value: 'applicants', label: 'Most applicants' },
  { value: 'title', label: 'Title A to Z' },
];

const JOB_STEPS = [
  { id: 1, label: 'Role' },
  { id: 2, label: 'Work' },
  { id: 3, label: 'Plan' },
  { id: 4, label: 'Details' },
] as const;

const EMPTY_JOB_FORM: JobForm = {
  title: '',
  departmentId: '',
  hiringManagerId: '',
  description: '',
  responsibilities: '',
  requirements: '',
  benefits: '',
  employmentType: 'FULL_TIME',
  workArrangement: 'HYBRID',
  country: '',
  city: '',
  salaryMin: '',
  salaryMax: '',
  currency: 'GBP',
  vacancies: '1',
  status: 'DRAFT',
  openedAt: '',
  closesAt: '',
  targetStartDate: '',
  published: false,
};

const JOB_DRAFT_KEY = 'syntragrid.recruitment.job-draft';
const SECTION_KEY = 'syntragrid.recruitment.section';

const TONES: Record<Tone, { badge: string; dot: string }> = {
  neutral: {
    badge: 'border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]',
    dot: 'bg-[var(--text-subtle)]',
  },
  green: {
    badge:
      'border-[color:var(--success-border,rgba(16,185,129,0.25))] bg-[var(--success-soft,rgba(16,185,129,0.1))] text-[var(--success,#047857)]',
    dot: 'bg-[var(--success,#10b981)]',
  },
  amber: {
    badge:
      'border-[color:var(--warning-border,rgba(245,158,11,0.25))] bg-[var(--warning-soft,rgba(245,158,11,0.1))] text-[var(--warning,#b45309)]',
    dot: 'bg-[var(--warning,#f59e0b)]',
  },
  blue: {
    badge: 'border-blue-500/20 bg-blue-500/10 text-blue-700',
    dot: 'bg-blue-500',
  },
  red: {
    badge: 'border-red-500/20 bg-red-500/10 text-red-700',
    dot: 'bg-red-500',
  },
  purple: {
    badge: 'border-violet-500/20 bg-violet-500/10 text-violet-700',
    dot: 'bg-violet-500',
  },
};

/* =============================================================================
 * HELPERS
 * =============================================================================
 */

function prettyEnum(value?: string | null, fallback = 'Not set') {
  if (!value) {
    return fallback;
  }

  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function personName(person: Person) {
  const first = person.preferredName?.trim() || person.firstName?.trim();
  const full = [first, person.lastName?.trim()].filter(Boolean).join(' ');

  return full || person.email || 'Unknown';
}

function formatDate(
  value?: string | null,
  fallback = 'Not set',
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  }).format(date);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function relativeDate(value?: string | null) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return formatDate(value);
}

function daysUntil(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

function todayInput() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatMoney(value?: string | null, currency?: string | null) {
  if (!value) {
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return null;
  }

  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency ? `${currency} ` : ''}${amount.toLocaleString('en-GB')}`;
  }
}

function salaryLabel(job: {
  salaryMin: string | null;
  salaryMax: string | null;
  currency: string | null;
}) {
  const min = formatMoney(job.salaryMin, job.currency);
  const max = formatMoney(job.salaryMax, job.currency);

  if (min && max) return min === max ? min : `${min} to ${max}`;
  if (min) return `From ${min}`;
  if (max) return `Up to ${max}`;

  return 'Not specified';
}

function statusTone(status: string): Tone {
  switch (status) {
    case 'OPEN':
    case 'ACTIVE':
    case 'HIRED':
    case 'ACCEPTED':
    case 'COMPLETED':
    case 'FILLED':
      return 'green';
    case 'PAUSED':
    case 'SCREENING':
    case 'ASSESSMENT':
    case 'APPROVAL_PENDING':
      return 'amber';
    case 'INTERVIEW':
    case 'FINAL_INTERVIEW':
    case 'SCHEDULED':
    case 'SENT':
    case 'VIEWED':
      return 'blue';
    case 'CANCELLED':
    case 'REJECTED':
    case 'DECLINED':
    case 'WITHDRAWN':
      return 'red';
    case 'OFFER':
    case 'SHORTLISTED':
      return 'purple';
    default:
      return 'neutral';
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : 'Something went wrong.',
    );
  }

  return data as T;
}

function loadJobDraft(): { form: JobForm; restored: boolean } {
  try {
    const raw = window.localStorage.getItem(JOB_DRAFT_KEY);

    if (raw) {
      const form = { ...EMPTY_JOB_FORM, ...(JSON.parse(raw) as Partial<JobForm>) };
      return { form, restored: jobFormHasContent(form) };
    }
  } catch {
    // Storage is optional.
  }

  return { form: EMPTY_JOB_FORM, restored: false };
}

function jobFormHasContent(form: JobForm) {
  return Boolean(
    form.title.trim() ||
      form.description.trim() ||
      form.responsibilities.trim() ||
      form.requirements.trim() ||
      form.benefits.trim() ||
      form.city.trim() ||
      form.country.trim() ||
      form.salaryMin ||
      form.salaryMax ||
      form.departmentId ||
      form.hiringManagerId,
  );
}

function effectiveOpenedAt(form: JobForm) {
  if (form.openedAt) {
    return form.openedAt;
  }

  return form.status === 'OPEN' ? todayInput() : '';
}

function validateJobStep(step: number, form: JobForm): JobFieldErrors {
  const errors: JobFieldErrors = {};

  if (step === 1 && !form.title.trim()) {
    errors.title = 'Give the role a title.';
  }

  if (step === 2) {
    const vacancies = Number(form.vacancies);

    if (!Number.isInteger(vacancies) || vacancies < 1) {
      errors.vacancies = 'At least one vacancy is needed.';
    }
  }

  if (step === 3) {
    const min = form.salaryMin ? Number(form.salaryMin) : null;
    const max = form.salaryMax ? Number(form.salaryMax) : null;

    if (min !== null && (!Number.isFinite(min) || min < 0)) {
      errors.salaryMin = 'Enter a valid amount.';
    }

    if (max !== null && (!Number.isFinite(max) || max < 0)) {
      errors.salaryMax = 'Enter a valid amount.';
    }

    if (min !== null && max !== null && max < min) {
      errors.salaryMax = 'Must be at least the minimum.';
    }

    const opened = effectiveOpenedAt(form);

    if (opened && form.closesAt && form.closesAt < opened) {
      errors.closesAt = 'Must be after the open date.';
    }

    if (form.status === 'OPEN' && form.closesAt && form.closesAt < todayInput()) {
      errors.closesAt = 'This date has already passed.';
    }
  }

  return errors;
}

/* =============================================================================
 * MAIN TAB
 * =============================================================================
 */

export default function RecruitmentTab() {
  const reduceMotion = useReducedMotion();
  const theme = useThemeBridge();

  const [section, setSection] = useState<RecruitmentSection>('overview');
  const [options, setOptions] = useState<RecruitmentOptions | null>(null);
  const [overview, setOverview] = useState<RecruitmentOverview | null>(null);
  const [jobs, setJobs] = useState<JobListItem[]>([]);

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [overviewError, setOverviewError] = useState('');
  const [jobsError, setJobsError] = useState('');

  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [jobModalKey, setJobModalKey] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState>(null);

  const jobSearchRef = useRef<HTMLInputElement>(null);

  const notify = useCallback<Notify>((tone, message) => {
    setToast({ id: Date.now(), tone, message });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SECTION_KEY);

      if (SECTIONS.some((item) => item.id === stored)) {
        setSection(stored as RecruitmentSection);
      }
    } catch {
      // Storage is optional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SECTION_KEY, section);
    } catch {
      // Storage is optional.
    }
  }, [section]);

  /* ---------- Fetch ---------- */

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);

    try {
      const response = await fetch('/api/admin/recruitment/options', {
        cache: 'no-store',
        credentials: 'include',
      });

      setOptions(await readJson<RecruitmentOptions>(response));
    } catch (cause) {
      console.error('Could not load recruitment options:', cause);
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setOverviewError('');

    try {
      const response = await fetch('/api/admin/recruitment/overview', {
        cache: 'no-store',
        credentials: 'include',
      });

      setOverview(await readJson<RecruitmentOverview>(response));
    } catch (cause) {
      setOverviewError(
        cause instanceof Error ? cause.message : 'Could not load the overview.',
      );
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    setJobsError('');

    try {
      const response = await fetch('/api/admin/recruitment/jobs', {
        cache: 'no-store',
        credentials: 'include',
      });

      const data = await readJson<{ jobs: JobListItem[]; count: number }>(
        response,
      );

      setJobs(data.jobs);
    } catch (cause) {
      setJobsError(
        cause instanceof Error ? cause.message : 'Could not load jobs.',
      );
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadOptions(), loadOverview(), loadJobs()]);
    setRefreshing(false);
  }, [loadJobs, loadOptions, loadOverview]);

  useEffect(() => {
    void Promise.all([loadOptions(), loadOverview(), loadJobs()]);
  }, [loadJobs, loadOptions, loadOverview]);

  /* ---------- Actions ---------- */

  const openNewJob = useCallback(() => {
    setJobModalKey((key) => key + 1);
    setJobModalOpen(true);
  }, []);

  const openJob = useCallback((id: string) => {
    setSelectedJobId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /* ---------- Keyboard ---------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || jobModalOpen || selectedJobId) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (typing || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openNewJob();
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        setSection('jobs');
        window.requestAnimationFrame(() => jobSearchRef.current?.focus());
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [jobModalOpen, openNewJob, selectedJobId]);

  /* ---------- Render ---------- */

  const counts: Partial<Record<RecruitmentSection, number>> = {
    jobs: overview?.metrics.openRoles,
    candidates: overview?.metrics.totalCandidates,
    interviews: overview?.metrics.interviewsThisWeek,
    offers: overview?.metrics.pendingOffers,
    'talent-pool': overview?.metrics.talentPool,
  };

  let content: ReactNode;

  if (selectedJobId) {
    content = (
      <JobWorkspace
        key={selectedJobId}
        jobId={selectedJobId}
        options={options}
        onBack={() => setSelectedJobId(null)}
        onChanged={() => {
          void loadJobs();
          void loadOverview();
        }}
        notify={notify}
      />
    );
  } else {
    content = (
      <>
        <section className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
          <div className="flex flex-col gap-3 px-2 pt-2 sm:px-3 lg:flex-row lg:items-center lg:justify-between lg:pr-4 lg:pt-0">
            <SectionNav
              value={section}
              onChange={setSection}
              counts={counts}
            />

            <div className="flex items-center justify-end gap-2 px-2 pb-3 lg:px-0 lg:pb-0">
              <button
                type="button"
                onClick={() => void refreshAll()}
                disabled={refreshing}
                aria-label="Refresh recruitment"
                title="Refresh"
                className={cx(
                  'flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:opacity-60',
                  focusRing,
                )}
              >
                <RefreshCw
                  size={14}
                  strokeWidth={1.9}
                  className={cx(refreshing && 'animate-spin')}
                />
              </button>

              <button
                type="button"
                onClick={openNewJob}
                className={cx(
                  'inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] pl-4 pr-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90',
                  focusRing,
                )}
              >
                <Plus size={15} strokeWidth={2} />
                New job
                <kbd className="ml-1 hidden h-5 min-w-5 items-center justify-center rounded-md bg-white/15 px-1.5 text-[9px] font-semibold text-white/90 sm:inline-flex">
                  N
                </kbd>
              </button>
            </div>
          </div>
        </section>

        <div className="mt-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
            >
              {section === 'overview' ? (
                <OverviewSection
                  data={overview}
                  loading={loadingOverview}
                  error={overviewError}
                  onRetry={() => void loadOverview()}
                  onSectionChange={setSection}
                  onNewJob={openNewJob}
                />
              ) : null}

              {section === 'jobs' ? (
                <JobsSection
                  jobs={jobs}
                  options={options}
                  loading={loadingJobs}
                  error={jobsError}
                  searchRef={jobSearchRef}
                  onRetry={() => void loadJobs()}
                  onNewJob={openNewJob}
                  onOpenJob={openJob}
                />
              ) : null}

              {section === 'pipeline' ? (
                <PipelineSection
                  pipeline={overview?.pipeline ?? []}
                  loading={loadingOverview && !overview}
                />
              ) : null}

              {section === 'candidates' ? (
                <PlannedSection
                  icon={Users}
                  title="Candidate profiles are next"
                  description="Every candidate in one place with their applications, documents, notes and history."
                  features={[
                    'Candidate profiles',
                    'CV and document storage',
                    'Notes and ratings',
                    'Activity history',
                  ]}
                />
              ) : null}

              {section === 'interviews' ? (
                <PlannedSection
                  icon={CalendarClock}
                  title="The interview centre is on the way"
                  description="Schedule interviews, assign interviewers and collect structured feedback for every candidate."
                  features={[
                    'Scheduling',
                    'Interviewer assignment',
                    'Scorecards',
                    'Calendar sync',
                  ]}
                />
              ) : null}

              {section === 'offers' ? (
                <PlannedSection
                  icon={FileText}
                  title="Offer management is on the way"
                  description="Prepare, approve, send and track offers, then turn accepted candidates into employees in one step."
                  features={[
                    'Offer drafting',
                    'Approval flow',
                    'Send and track',
                    'Convert to employee',
                  ]}
                />
              ) : null}

              {section === 'talent-pool' ? (
                <PlannedSection
                  icon={Sparkles}
                  title="Keep strong candidates close"
                  description="People worth considering for future Syntra Grid roles, kept without leaving an old application open."
                  features={[
                    'Saved candidates',
                    'Skills tags',
                    'Future role matching',
                    'Reach out later',
                  ]}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </>
    );
  }

  return (
    <PortalTheme.Provider value={theme.vars}>
      <div ref={theme.ref} className="mx-auto w-full min-w-0 max-w-[1600px]">
        {content}

        <NewJobModal
          open={jobModalOpen}
          formKey={jobModalKey}
          options={options}
          loadingOptions={loadingOptions}
          onClose={() => setJobModalOpen(false)}
          onCreated={(job, openAfter) => {
            setJobModalOpen(false);
            setJobs((current) => [
              { ...job, applicationCount: job.applicationCount ?? 0 },
              ...current.filter((item) => item.id !== job.id),
            ]);
            notify('success', `${job.title} created`);
            void loadOverview();
            void loadJobs();

            if (openAfter) {
              openJob(job.id);
            } else {
              setSection('jobs');
            }
          }}
        />

        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </PortalTheme.Provider>
  );
}

/* =============================================================================
 * SECTION NAVIGATION
 * =============================================================================
 */

function SectionNav({
  value,
  onChange,
  counts,
}: {
  value: RecruitmentSection;
  onChange: (value: RecruitmentSection) => void;
  counts: Partial<Record<RecruitmentSection, number>>;
}) {
  const reduceMotion = useReducedMotion();
  const id = useId();

  return (
    <div className="min-w-0 overflow-x-auto [scrollbar-width:none]">
      <div role="tablist" aria-label="Recruitment sections" className="flex min-w-max">
        {SECTIONS.map((item) => {
          const active = item.id === value;
          const count = counts[item.id];
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(item.id)}
              className={cx(
                'relative inline-flex h-12 items-center gap-2 px-3.5 text-[11px] font-semibold transition-colors lg:h-14',
                active
                  ? 'text-[var(--text)]'
                  : 'text-[var(--text-subtle)] hover:text-[var(--text)]',
                focusRing,
              )}
            >
              <Icon
                size={14}
                strokeWidth={active ? 2 : 1.8}
                className={active ? 'text-[var(--accent)]' : undefined}
              />
              {item.label}

              {typeof count === 'number' && count > 0 ? (
                <CountPill value={count} />
              ) : null}

              {active ? (
                <motion.span
                  layoutId={`${id}-underline`}
                  className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--accent)]"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 500, damping: 38 }
                  }
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =============================================================================
 * METRICS GRID
 * =============================================================================
 */

function MetricsGrid({
  items,
  columns,
}: {
  items: Array<{
    label: string;
    value: string | number;
    helper: string;
    icon: LucideIcon;
    onClick?: () => void;
  }>;
  columns: string;
}) {
  return (
    <div className={cx('grid gap-px bg-[var(--line)]', columns)}>
      {items.map((metric) => {
        const Icon = metric.icon;

        const inner = (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                {metric.label}
              </p>
              <p className="mt-1.5 truncate text-[22px] font-semibold tabular-nums tracking-[-0.04em] text-[var(--text)]">
                {metric.value}
              </p>
              <p className="mt-0.5 truncate text-[9px] text-[var(--text-subtle)]">
                {metric.helper}
              </p>
            </div>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent)]">
              <Icon size={15} strokeWidth={1.8} />
            </div>
          </div>
        );

        return metric.onClick ? (
          <button
            key={metric.label}
            type="button"
            onClick={metric.onClick}
            className={cx(
              'group min-w-0 bg-[var(--surface)] px-4 py-4 text-left transition-colors hover:bg-[var(--surface-muted)] sm:px-5',
              'focus-visible:bg-[var(--surface-muted)] focus-visible:outline-none',
            )}
          >
            {inner}
          </button>
        ) : (
          <div key={metric.label} className="min-w-0 bg-[var(--surface)] px-4 py-4 sm:px-5">
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/* =============================================================================
 * OVERVIEW
 * =============================================================================
 */

function OverviewSection({
  data,
  loading,
  error,
  onRetry,
  onSectionChange,
  onNewJob,
}: {
  data: RecruitmentOverview | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onSectionChange: (section: RecruitmentSection) => void;
  onNewJob: () => void;
}) {
  if (loading && !data) {
    return <OverviewSkeleton />;
  }

  if (error && !data) {
    return (
      <ErrorState
        title="The recruitment overview could not be loaded"
        message={error}
        onRetry={onRetry}
      />
    );
  }

  if (!data) {
    return null;
  }

  const { metrics } = data;

  return (
    <div className="space-y-4">
      {metrics.openRoles === 0 ? (
        <div className="flex flex-col gap-4 rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
              <BriefcaseBusiness size={17} strokeWidth={1.8} />
            </span>
            <div>
              <p className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--text)]">
                No roles are open right now
              </p>
              <p className="mt-0.5 text-[11px] leading-5 text-[var(--text-muted)]">
                Create a vacancy to start building your hiring pipeline.
              </p>
            </div>
          </div>

          <PrimaryButton onClick={onNewJob}>
            <Plus size={14} />
            Create a job
          </PrimaryButton>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[22px] border border-[var(--line)] shadow-sm">
        <MetricsGrid
          columns="grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6"
          items={[
            {
              label: 'Open roles',
              value: metrics.openRoles,
              helper: 'Currently hiring',
              icon: BriefcaseBusiness,
              onClick: () => onSectionChange('jobs'),
            },
            {
              label: 'Candidates',
              value: metrics.totalCandidates,
              helper: 'Active records',
              icon: Users,
              onClick: () => onSectionChange('candidates'),
            },
            {
              label: 'Applications',
              value: metrics.activeApplications,
              helper: 'In the pipeline',
              icon: Target,
              onClick: () => onSectionChange('pipeline'),
            },
            {
              label: 'Interviews',
              value: metrics.interviewsThisWeek,
              helper: 'Next 7 days',
              icon: CalendarClock,
              onClick: () => onSectionChange('interviews'),
            },
            {
              label: 'Pending offers',
              value: metrics.pendingOffers,
              helper: 'Awaiting an answer',
              icon: FileText,
              onClick: () => onSectionChange('offers'),
            },
            {
              label: 'Hired',
              value: metrics.hiresThisMonth,
              helper: 'This month',
              icon: UserCheck,
            },
          ]}
        />
      </section>

      <Panel
        title="Hiring pipeline"
        action={
          <LinkButton onClick={() => onSectionChange('pipeline')}>
            Open pipeline
          </LinkButton>
        }
      >
        <PipelineFunnel pipeline={data.pipeline} />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Recent applications"
          action={
            <LinkButton onClick={() => onSectionChange('candidates')}>
              View all
            </LinkButton>
          }
        >
          {data.recentApplications.length === 0 ? (
            <InlineEmpty
              icon={Users}
              text="New applications will appear here as they arrive."
            />
          ) : (
            <div className="-mx-2 space-y-0.5">
              {data.recentApplications.map((application) => (
                <div
                  key={application.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--surface-muted)]"
                >
                  <Avatar person={application.candidate} size="md" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-[var(--text)]">
                      {personName(application.candidate)}
                    </p>
                    <p className="truncate text-[10px] text-[var(--text-subtle)]">
                      {application.jobOpening.title}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <ToneBadge tone={statusTone(application.stage)} compact>
                      {prettyEnum(application.stage)}
                    </ToneBadge>
                    <p className="mt-1 text-[9px] text-[var(--text-subtle)]">
                      {relativeDate(application.appliedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Upcoming interviews"
          action={
            <LinkButton onClick={() => onSectionChange('interviews')}>
              Interviews
            </LinkButton>
          }
        >
          {data.upcomingInterviews.length === 0 ? (
            <InlineEmpty
              icon={CalendarClock}
              text="Nothing scheduled. Booked interviews will show here."
            />
          ) : (
            <div className="-mx-2 space-y-0.5">
              {data.upcomingInterviews.map((interview) => (
                <InterviewRow key={interview.id} interview={interview} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function InterviewRow({ interview }: { interview: UpcomingInterview }) {
  const date = new Date(interview.scheduledAt);
  const valid = !Number.isNaN(date.getTime());
  const days = daysUntil(interview.scheduledAt);

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--surface-muted)]">
      <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[13px] border border-[var(--line)] bg-[var(--surface)]">
        <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
          {valid
            ? new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date)
            : ''}
        </span>
        <span className="text-[14px] font-semibold leading-none tabular-nums text-[var(--text)]">
          {valid ? date.getDate() : ''}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-[var(--text)]">
          {personName(interview.application.candidate)}
        </p>
        <p className="truncate text-[10px] text-[var(--text-subtle)]">
          {interview.application.jobOpening.title}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[11px] font-semibold tabular-nums text-[var(--text)]">
          {valid ? formatTime(interview.scheduledAt) : 'Time not set'}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-[9px] text-[var(--text-subtle)]">
          {interview.meetingUrl ? <Video size={9} /> : null}
          {days === 0
            ? 'Today'
            : days === 1
              ? 'Tomorrow'
              : prettyEnum(interview.type)}
          {interview.durationMinutes ? ` · ${interview.durationMinutes} min` : ''}
        </p>
      </div>
    </div>
  );
}

function PipelineFunnel({
  pipeline,
  large = false,
}: {
  pipeline: PipelineItem[];
  large?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const map = new Map(pipeline.map((item) => [item.stage, item.count]));
  const counts = PIPELINE_ORDER.map((stage) => map.get(stage) ?? 0);
  const max = Math.max(1, ...counts);
  const total = counts.reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    return (
      <InlineEmpty
        icon={Target}
        text="No active applications yet. Stages fill up as candidates apply."
      />
    );
  }

  return (
    <div>
      <p className="mb-3 text-[10px] text-[var(--text-subtle)]">
        <span className="font-semibold tabular-nums text-[var(--text)]">
          {total}
        </span>{' '}
        active {total === 1 ? 'application' : 'applications'} across{' '}
        {PIPELINE_ORDER.length} stages
      </p>

      <ol className="space-y-1.5">
        {PIPELINE_ORDER.map((stage, index) => {
          const count = counts[index];
          const previous = index > 0 ? counts[index - 1] : null;
          const share = count / max;
          const conversion =
            previous && previous > 0 ? Math.round((count / previous) * 100) : null;

          return (
            <li
              key={stage}
              className={cx(
                'grid items-center gap-3',
                large
                  ? 'grid-cols-[120px_minmax(0,1fr)_40px_56px] sm:grid-cols-[150px_minmax(0,1fr)_48px_72px]'
                  : 'grid-cols-[110px_minmax(0,1fr)_36px] sm:grid-cols-[130px_minmax(0,1fr)_40px_64px]',
              )}
            >
              <span className="flex min-w-0 items-center gap-2 text-[10px] font-medium text-[var(--text-muted)]">
                <span
                  className={cx(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    TONES[statusTone(stage)].dot,
                  )}
                />
                <span className="truncate">{prettyEnum(stage)}</span>
              </span>

              <span
                className={cx(
                  'relative block overflow-hidden rounded-full bg-[var(--surface-muted)]',
                  large ? 'h-3' : 'h-2',
                )}
              >
                <motion.span
                  className={cx(
                    'absolute inset-y-0 left-0 rounded-full',
                    stage === 'HIRED'
                      ? 'bg-[var(--success,#10b981)]'
                      : 'bg-[var(--accent)]',
                  )}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${Math.max(count > 0 ? 3 : 0, share * 100)}%` }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.6, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }
                  }
                  style={{ opacity: stage === 'HIRED' ? 1 : 1 - index * 0.07 }}
                />
              </span>

              <span className="text-right text-[11px] font-semibold tabular-nums text-[var(--text)]">
                {count}
              </span>

              <span
                className={cx(
                  'text-right text-[9px] tabular-nums text-[var(--text-subtle)]',
                  large ? 'block' : 'hidden sm:block',
                )}
              >
                {conversion !== null ? `${conversion}% moved on` : ''}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-[104px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
      <div className="h-[280px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-[300px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
        <div className="h-[300px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/* =============================================================================
 * JOBS
 * =============================================================================
 */

function JobsSection({
  jobs,
  options,
  loading,
  error,
  searchRef,
  onRetry,
  onNewJob,
  onOpenJob,
}: {
  jobs: JobListItem[];
  options: RecruitmentOptions | null;
  loading: boolean;
  error: string;
  searchRef: RefObject<HTMLInputElement | null>;
  onRetry: () => void;
  onNewJob: () => void;
  onOpenJob: (id: string) => void;
}) {
  const reduceMotion = useReducedMotion();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [department, setDepartment] = useState('ALL');
  const [employmentType, setEmploymentType] = useState('ALL');
  const [sort, setSort] = useState<JobSort>('newest');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = jobs.filter((job) => {
      if (status !== 'ALL' && job.status !== status) return false;
      if (department !== 'ALL' && job.department?.id !== department) return false;
      if (employmentType !== 'ALL' && job.employmentType !== employmentType)
        return false;
      if (!query) return true;

      return [
        job.title,
        job.jobRef,
        job.description,
        job.department?.name,
        job.city,
        job.country,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

    return result.sort((a, b) => {
      switch (sort) {
        case 'closing': {
          const at = a.closesAt ? new Date(a.closesAt).getTime() : Number.MAX_SAFE_INTEGER;
          const bt = b.closesAt ? new Date(b.closesAt).getTime() : Number.MAX_SAFE_INTEGER;
          return at - bt;
        }
        case 'applicants':
          return b.applicationCount - a.applicationCount;
        case 'title':
          return a.title.localeCompare(b.title);
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [jobs, search, status, department, employmentType, sort]);

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const job of jobs) {
      map.set(job.status, (map.get(job.status) ?? 0) + 1);
    }
    return map;
  }, [jobs]);

  const statusOptions = useMemo<Array<DropdownOption<string>>>(
    () => [
      {
        value: 'ALL',
        label: 'All statuses',
        leading: (
          <span className="h-2 w-2 rounded-full border border-[var(--text-subtle)]" />
        ),
        trailing: <CountPill value={jobs.length} />,
      },
      ...(options?.jobStatuses ?? DEFAULT_JOB_STATUSES).map((value) => ({
        value,
        label: prettyEnum(value),
        leading: (
          <span className={cx('h-2 w-2 rounded-full', TONES[statusTone(value)].dot)} />
        ),
        trailing: <CountPill value={statusCounts.get(value) ?? 0} />,
      })),
    ],
    [jobs.length, options?.jobStatuses, statusCounts],
  );

  const departmentOptions = useMemo<Array<DropdownOption<string>>>(
    () => [
      { value: 'ALL', label: 'All departments', leading: <DepartmentDot department={null} /> },
      ...(options?.departments ?? []).map((item) => ({
        value: item.id,
        label: item.name,
        hint: item.code ?? undefined,
        leading: <DepartmentDot department={item} />,
      })),
    ],
    [options?.departments],
  );

  const employmentOptions = useMemo<Array<DropdownOption<string>>>(
    () => [
      { value: 'ALL', label: 'All employment' },
      ...(options?.employmentTypes ?? DEFAULT_EMPLOYMENT_TYPES).map((value) => ({
        value,
        label: prettyEnum(value),
      })),
    ],
    [options?.employmentTypes],
  );

  const hasFilters =
    Boolean(search.trim()) ||
    status !== 'ALL' ||
    department !== 'ALL' ||
    employmentType !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setStatus('ALL');
    setDepartment('ALL');
    setEmploymentType('ALL');
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="grid gap-3 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[250px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (error && jobs.length === 0) {
    return (
      <ErrorState title="Jobs could not be loaded" message={error} onRetry={onRetry} />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
          <div className="relative min-w-0 flex-1 2xl:max-w-[360px]">
            <Search
              size={15}
              strokeWidth={1.8}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
            />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search roles, references or locations"
              aria-label="Search jobs"
              className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] pl-10 pr-12 text-[11px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:bg-[var(--surface)]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
                className={cx(
                  'absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-subtle)] transition hover:bg-[var(--surface)] hover:text-[var(--text)]',
                  focusRing,
                )}
              >
                <X size={12} />
              </button>
            ) : (
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[8px] font-semibold text-[var(--text-subtle)] sm:inline-flex">
                /
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Dropdown
              value={status}
              onChange={setStatus}
              options={statusOptions}
              ariaLabel="Filter by status"
              triggerClassName="sm:w-[150px]"
              minWidth={210}
            />
            <Dropdown
              value={department}
              onChange={setDepartment}
              options={departmentOptions}
              ariaLabel="Filter by department"
              searchable={departmentOptions.length > 7}
              searchPlaceholder="Search departments"
              triggerClassName="sm:w-[170px]"
              minWidth={230}
            />
            <Dropdown
              value={employmentType}
              onChange={setEmploymentType}
              options={employmentOptions}
              ariaLabel="Filter by employment type"
              triggerClassName="sm:w-[155px]"
              minWidth={190}
            />
            <Dropdown
              value={sort}
              onChange={setSort}
              options={JOB_SORT_OPTIONS}
              ariaLabel="Sort jobs"
              triggerClassName="sm:w-[155px]"
              minWidth={190}
            />
          </div>

          <div className="flex items-center gap-2 text-[10px] font-medium text-[var(--text-subtle)] 2xl:ml-auto">
            <span>
              <span className="font-semibold text-[var(--text)]">{filtered.length}</span>{' '}
              of {jobs.length} shown
            </span>
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className={cx(
                  'inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-0.5 font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
                  focusRing,
                )}
              >
                <X size={10} />
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BriefcaseBusiness size={21} strokeWidth={1.7} />}
          title={jobs.length === 0 ? 'No jobs yet' : 'No jobs match these filters'}
          description={
            jobs.length === 0
              ? 'Create your first Syntra Grid vacancy to start receiving candidates.'
              : 'Try a different search or clear the filters to see every role.'
          }
          action={
            jobs.length === 0 ? (
              <PrimaryButton onClick={onNewJob}>
                <Plus size={14} />
                Create a job
              </PrimaryButton>
            ) : (
              <SecondaryButton onClick={clearFilters}>
                <X size={13} />
                Clear filters
              </SecondaryButton>
            )
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.map((job) => (
              <motion.div
                key={job.id}
                layout={!reduceMotion}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={
                  reduceMotion
                    ? { duration: 0.12 }
                    : { type: 'spring', stiffness: 380, damping: 34 }
                }
              >
                <JobCard job={job} onOpen={() => onOpenJob(job.id)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function ClosingChip({ job }: { job: { closesAt: string | null; status: string } }) {
  const days = daysUntil(job.closesAt);

  if (days === null || job.status !== 'OPEN') {
    return null;
  }

  if (days < 0) {
    return <ToneBadge tone="red" compact>Closing date passed</ToneBadge>;
  }

  if (days <= 7) {
    return (
      <ToneBadge tone="amber" compact>
        {days === 0 ? 'Closes today' : `Closes in ${days} ${days === 1 ? 'day' : 'days'}`}
      </ToneBadge>
    );
  }

  return null;
}

function JobCard({ job, onOpen }: { job: JobListItem; onOpen: () => void }) {
  const location = [job.city, job.country].filter(Boolean).join(', ');

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${job.title}`}
      className={cx(
        'group flex h-full w-full flex-col rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-4 text-left shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-[color:var(--text-subtle)]/40 hover:shadow-md sm:p-5',
        focusRing,
      )}
    >
      <div className="flex w-full items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <ToneBadge tone={statusTone(job.status)}>{prettyEnum(job.status)}</ToneBadge>
            {job.published ? (
              <ToneBadge tone="green">
                <Globe2 size={9} />
                Published
              </ToneBadge>
            ) : null}
            <ClosingChip job={job} />
          </div>

          <h3 className="mt-3 truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            {job.title}
          </h3>
          <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
            {job.jobRef || 'Reference assigned on save'}
            {' · '}
            Updated {relativeDate(job.updatedAt)}
          </p>
        </div>

        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--text-subtle)] transition-colors group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>

      <div className="mb-5 mt-4 flex flex-wrap items-center gap-1.5">
        <DepartmentChip department={job.department} />
        <Chip icon={<BriefcaseBusiness size={10} />}>{prettyEnum(job.employmentType)}</Chip>
        {job.workArrangement ? (
          <Chip icon={<Globe2 size={10} />}>{prettyEnum(job.workArrangement)}</Chip>
        ) : null}
        {location ? <Chip icon={<MapPin size={10} />}>{location}</Chip> : null}
      </div>

      <div className="mt-auto grid w-full grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--line)] pt-4 sm:grid-cols-4">
        <MiniStat label="Applicants" value={String(job.applicationCount)} strong />
        <MiniStat label="Vacancies" value={String(job.vacancies)} />
        <MiniStat label="Salary" value={salaryLabel(job)} />
        <MiniStat
          label="Closes"
          value={
            job.closesAt
              ? formatDate(job.closesAt, 'No deadline', { year: undefined })
              : 'No deadline'
          }
        />
      </div>

      <div className="mt-4 flex w-full items-center gap-2">
        <Avatar person={job.hiringManager} size="xs" />
        <p className="truncate text-[10px] text-[var(--text-subtle)]">
          {job.hiringManager ? (
            <>
              Hiring manager{' '}
              <span className="font-semibold text-[var(--text)]">
                {personName(job.hiringManager)}
              </span>
            </>
          ) : (
            'No hiring manager yet'
          )}
        </p>
      </div>
    </button>
  );
}

function MiniStat({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
        {label}
      </p>
      <p
        className={cx(
          'mt-1 truncate tabular-nums text-[var(--text)]',
          strong ? 'text-[16px] font-semibold tracking-[-0.03em]' : 'text-[11px] font-semibold',
        )}
      >
        {value}
      </p>
    </div>
  );
}

/* =============================================================================
 * PIPELINE
 * =============================================================================
 */

function PipelineSection({
  pipeline,
  loading,
}: {
  pipeline: PipelineItem[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="h-[380px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
    );
  }

  return (
    <div className="space-y-4">
      <Panel title="Stage by stage">
        <PipelineFunnel pipeline={pipeline} large />
      </Panel>

      <PlannedSection
        icon={Target}
        title="A drag and drop board is next"
        description="Once candidate applications are connected, every stage becomes a column you can move people between."
        features={[
          'Board view per role',
          'Move between stages',
          'Bulk actions',
          'Stage history',
        ]}
        compact
      />
    </div>
  );
}

/* =============================================================================
 * PLANNED SECTIONS
 * =============================================================================
 */

function PlannedSection({
  icon: Icon,
  title,
  description,
  features,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        'flex items-center justify-center rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-5 text-center shadow-sm',
        compact ? 'py-10' : 'min-h-[360px] py-14',
      )}
    >
      <div className="max-w-[460px]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
          <Icon size={21} strokeWidth={1.7} />
        </div>

        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">
          <Clock3 size={9} />
          Planned
        </span>

        <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">
          {title}
        </h3>
        <p className="mx-auto mt-2 max-w-[400px] text-[11px] leading-5 text-[var(--text-muted)]">
          {description}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-1.5">
          {features.map((feature) => (
            <Chip key={feature} icon={<Check size={10} className="text-[var(--accent)]" />}>
              {feature}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 * NEW JOB MODAL
 * =============================================================================
 */

function NewJobModal({
  open,
  formKey,
  options,
  loadingOptions,
  onClose,
  onCreated,
}: {
  open: boolean;
  formKey: number;
  options: RecruitmentOptions | null;
  loadingOptions: boolean;
  onClose: () => void;
  onCreated: (job: JobListItem, openAfter: boolean) => void;
}) {
  const titleId = useId();

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={titleId}>
      <NewJobWizard
        key={formKey}
        titleId={titleId}
        options={options}
        loadingOptions={loadingOptions}
        onClose={onClose}
        onCreated={onCreated}
      />
    </ModalShell>
  );
}

type JobFormUpdate = <K extends keyof JobForm>(key: K, value: JobForm[K]) => void;

function NewJobWizard({
  titleId,
  options,
  loadingOptions,
  onClose,
  onCreated,
}: {
  titleId: string;
  options: RecruitmentOptions | null;
  loadingOptions: boolean;
  onClose: () => void;
  onCreated: (job: JobListItem, openAfter: boolean) => void;
}) {
  const reduceMotion = useReducedMotion();

  const [initial] = useState(loadJobDraft);
  const [form, setForm] = useState<JobForm>(initial.form);
  const [draftRestored, setDraftRestored] = useState(initial.restored);
  const [[step, direction], setStepState] = useState<[number, number]>([1, 0]);
  const [errors, setErrors] = useState<JobFieldErrors>({});
  const [issue, setIssue] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoDepartment, setAutoDepartment] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform),
    [],
  );

  useEffect(() => {
    if (done.current) {
      return;
    }

    try {
      if (jobFormHasContent(form)) {
        window.localStorage.setItem(JOB_DRAFT_KEY, JSON.stringify(form));
      } else {
        window.localStorage.removeItem(JOB_DRAFT_KEY);
      }
    } catch {
      // Storage is optional.
    }
  }, [form]);

  const update = useCallback<JobFormUpdate>((key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
    setIssue(null);

    if (key === 'departmentId') {
      setAutoDepartment(false);
    }
  }, []);

  const goTo = useCallback((target: number) => {
    setStepState(([current]) => [target, target > current ? 1 : -1]);
    bodyRef.current?.scrollTo({ top: 0 });
  }, []);

  const next = useCallback(() => {
    const stepErrors = validateJobStep(step, form);

    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      return;
    }

    setErrors({});
    goTo(Math.min(4, step + 1));
  }, [form, goTo, step]);

  const startOver = () => {
    setForm(EMPTY_JOB_FORM);
    setErrors({});
    setIssue(null);
    setDraftRestored(false);
    goTo(1);
  };

  const submit = useCallback(
    async (openAfter: boolean) => {
      for (const target of [1, 2, 3]) {
        const stepErrors = validateJobStep(target, form);

        if (Object.keys(stepErrors).length) {
          setErrors(stepErrors);
          goTo(target);
          return;
        }
      }

      setSaving(true);
      setIssue(null);

      try {
        const response = await fetch('/api/admin/recruitment/jobs', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: form.title.trim(),
            departmentId: form.departmentId || null,
            hiringManagerId: form.hiringManagerId || null,
            description: form.description.trim(),
            responsibilities: form.responsibilities.trim(),
            requirements: form.requirements.trim(),
            benefits: form.benefits.trim(),
            employmentType: form.employmentType,
            workArrangement: form.workArrangement || null,
            country: form.country.trim(),
            city: form.city.trim(),
            salaryMin: form.salaryMin || null,
            salaryMax: form.salaryMax || null,
            currency: form.currency || null,
            vacancies: Number(form.vacancies),
            status: form.status,
            openedAt: effectiveOpenedAt(form) || null,
            closesAt: form.closesAt || null,
            targetStartDate: form.targetStartDate || null,
            published: form.status === 'OPEN' && form.published,
          }),
        });

        const data = await readJson<{ job: JobListItem }>(response);

        done.current = true;

        try {
          window.localStorage.removeItem(JOB_DRAFT_KEY);
        } catch {
          // Storage is optional.
        }

        onCreated(data.job, openAfter);
      } catch (cause) {
        setIssue(cause instanceof Error ? cause.message : 'Could not create the job.');
      } finally {
        setSaving(false);
      }
    },
    [form, goTo, onCreated],
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (step < 4) {
      next();
    } else {
      void submit(false);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();

      if (step < 4) {
        next();
      } else if (!saving) {
        void submit(false);
      }
    }
  };

  const department = options?.departments.find((item) => item.id === form.departmentId);

  const slide = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: (dir: number) => ({ opacity: 0, x: dir * 28 }),
        animate: { opacity: 1, x: 0 },
        exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
      };

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      noValidate
      className="flex max-h-[92dvh] min-h-0 flex-col sm:max-h-[min(88dvh,880px)]"
    >
      <div className="border-b border-[var(--line)] px-5 pb-4 pt-4 sm:px-7 sm:pt-6">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
            <BriefcaseBusiness size={22} strokeWidth={1.8} />
          </span>

          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id={titleId}
              className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]"
            >
              New job
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
              {form.title.trim()
                ? [form.title.trim(), department?.name].filter(Boolean).join(', ')
                : 'The role you type will appear here.'}
            </p>

            {draftRestored ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-2 py-1 text-[9px] text-[var(--text-muted)]">
                <RotateCcw size={10} />
                Picked up where you left off
                <button
                  type="button"
                  onClick={startOver}
                  className={cx(
                    'rounded font-semibold text-[var(--accent)] hover:opacity-70',
                    focusRing,
                  )}
                >
                  Start over
                </button>
              </div>
            ) : null}
          </div>

          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        <JobStepper step={step} onJump={(target) => target < step && goTo(target)} />
      </div>

      <div
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-5 sm:px-7"
      >
        <AnimatePresence initial={false}>
          {issue ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3 text-[10px] leading-5 text-red-600"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="flex-1">{issue}</span>
              <button
                type="button"
                onClick={() => setIssue(null)}
                aria-label="Dismiss"
                className={cx('rounded p-0.5 hover:bg-red-500/10', focusRing)}
              >
                <X size={12} />
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={
              reduceMotion ? { duration: 0.12 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
            }
          >
            {step === 1 ? (
              <RoleStep
                form={form}
                errors={errors}
                update={update}
                setForm={setForm}
                options={options}
                loadingOptions={loadingOptions}
                autoDepartment={autoDepartment}
                setAutoDepartment={setAutoDepartment}
              />
            ) : null}
            {step === 2 ? (
              <WorkStep form={form} errors={errors} update={update} options={options} />
            ) : null}
            {step === 3 ? (
              <PlanStep form={form} errors={errors} update={update} options={options} />
            ) : null}
            {step === 4 ? (
              <DetailsStep form={form} update={update} options={options} onEdit={goTo} />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="border-t border-[var(--line)] bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <p className="hidden items-center gap-1.5 text-[9px] text-[var(--text-subtle)] sm:flex">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>Enter</Kbd>
            {step < 4 ? 'to continue' : 'to create'}
          </p>

          <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            <button
              type="button"
              onClick={
                step === 1
                  ? onClose
                  : () => {
                      setErrors({});
                      goTo(step - 1);
                    }
              }
              disabled={saving}
              className={cx(
                'inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50 sm:flex-none',
                focusRing,
              )}
            >
              {step === 1 ? null : <ArrowLeft size={13} />}
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step === 4 ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void submit(true)}
                className={cx(
                  'hidden h-10 items-center justify-center rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50 sm:inline-flex',
                  focusRing,
                )}
              >
                Create and open
              </button>
            ) : null}

            <button
              type="submit"
              disabled={saving || loadingOptions}
              className={cx(
                'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[140px] sm:flex-none',
                focusRing,
              )}
            >
              {step < 4 ? (
                <>
                  Continue
                  <ArrowRight size={13} />
                </>
              ) : saving ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Creating
                </>
              ) : (
                <>
                  <Check size={13} />
                  Create job
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function JobStepper({ step, onJump }: { step: number; onJump: (step: number) => void }) {
  const reduceMotion = useReducedMotion();

  return (
    <ol className="mt-5 grid grid-cols-4 gap-2">
      {JOB_STEPS.map((item) => {
        const active = step === item.id;
        const complete = step > item.id;

        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onJump(item.id)}
              disabled={!complete}
              aria-current={active ? 'step' : undefined}
              className={cx('block w-full rounded-md text-left disabled:cursor-default', focusRing)}
            >
              <span className="relative block h-1 overflow-hidden rounded-full bg-[var(--line)]">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
                  initial={false}
                  animate={{ width: complete || active ? '100%' : '0%' }}
                  transition={
                    reduceMotion ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
                  }
                />
              </span>
              <span
                className={cx(
                  'mt-2 flex items-center gap-1 text-[10px] font-semibold',
                  active || complete ? 'text-[var(--text)]' : 'text-[var(--text-subtle)]',
                )}
              >
                {complete ? (
                  <Check size={10} strokeWidth={2.6} className="text-[var(--accent)]" />
                ) : (
                  <span className="tabular-nums">{item.id}.</span>
                )}
                {item.label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function RoleStep({
  form,
  errors,
  update,
  setForm,
  options,
  loadingOptions,
  autoDepartment,
  setAutoDepartment,
}: {
  form: JobForm;
  errors: JobFieldErrors;
  update: JobFormUpdate;
  setForm: Dispatch<SetStateAction<JobForm>>;
  options: RecruitmentOptions | null;
  loadingOptions: boolean;
  autoDepartment: boolean;
  setAutoDepartment: (value: boolean) => void;
}) {
  const departmentOptions = useMemo<Array<DropdownOption<string>>>(
    () => [
      {
        value: '',
        label: 'No department',
        hint: 'Assign later',
        leading: <DepartmentDot department={null} />,
      },
      ...(options?.departments ?? []).map((item) => ({
        value: item.id,
        label: item.name,
        hint: item.code ?? undefined,
        leading: <DepartmentDot department={item} />,
      })),
    ],
    [options?.departments],
  );

  const managerOptions = useMemo<Array<DropdownOption<string>>>(() => {
    const departmentsById = new Map(
      (options?.departments ?? []).map((item) => [item.id, item.name]),
    );

    const managers = [...(options?.hiringManagers ?? [])].sort((a, b) => {
      const aSame = Boolean(form.departmentId) && a.departmentId === form.departmentId;
      const bSame = Boolean(form.departmentId) && b.departmentId === form.departmentId;

      if (aSame !== bSame) {
        return aSame ? -1 : 1;
      }

      return personName(a).localeCompare(personName(b));
    });

    return [
      {
        value: '',
        label: 'No hiring manager',
        hint: 'Assign later',
        leading: <Avatar person={null} size="xs" />,
      },
      ...managers.map((manager) => ({
        value: manager.id,
        label: personName(manager),
        hint: [
          prettyEnum(manager.role),
          form.departmentId && manager.departmentId === form.departmentId
            ? 'Same department'
            : manager.departmentId
              ? departmentsById.get(manager.departmentId)
              : undefined,
        ]
          .filter(Boolean)
          .join(' · '),
        keywords: manager.email,
        leading: <Avatar person={manager} size="xs" />,
      })),
    ];
  }, [options?.departments, options?.hiringManagers, form.departmentId]);

  const chooseManager = (id: string) => {
    const manager = options?.hiringManagers.find((item) => item.id === id);

    if (manager?.departmentId && !form.departmentId) {
      setForm((current) => ({
        ...current,
        hiringManagerId: id,
        departmentId: manager.departmentId ?? '',
      }));
      setAutoDepartment(true);
      return;
    }

    update('hiringManagerId', id);
  };

  return (
    <div>
      <StepIntro
        icon={<BriefcaseBusiness size={16} />}
        title="What is the role?"
        description="The title, where it sits and who is hiring for it."
      />

      <Field label="Job title" required error={errors.title} className="mt-5">
        <input
          data-autofocus
          value={form.title}
          onChange={(event) => update('title', event.target.value)}
          placeholder="Type the job title, e.g. Product Designer"
          autoComplete="off"
          maxLength={120}
          aria-invalid={Boolean(errors.title)}
          className={cx(inputClass(errors.title), 'h-12 text-[14px] font-semibold')}
        />
      </Field>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Department"
          as="div"
          hint={autoDepartment ? 'Set from the hiring manager' : undefined}
        >
          <Dropdown
            value={form.departmentId}
            onChange={(value) => update('departmentId', value)}
            options={departmentOptions}
            ariaLabel="Department"
            searchable={departmentOptions.length > 6}
            searchPlaceholder="Search departments"
            disabled={loadingOptions}
            loading={loadingOptions}
            minWidth={260}
          />
        </Field>

        <Field
          label="Hiring manager"
          as="div"
          hint={form.departmentId ? 'Same department listed first' : undefined}
        >
          <Dropdown
            value={form.hiringManagerId}
            onChange={chooseManager}
            options={managerOptions}
            ariaLabel="Hiring manager"
            searchable={managerOptions.length > 6}
            searchPlaceholder="Search people"
            emptyText="Nobody matches that search."
            disabled={loadingOptions}
            loading={loadingOptions}
            minWidth={280}
          />
        </Field>
      </div>

      <Field label="About the role" className="mt-4">
        <textarea
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          rows={4}
          maxLength={3000}
          placeholder="What this person will do and why the role matters"
          className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
        />
      </Field>
    </div>
  );
}

function WorkStep({
  form,
  errors,
  update,
  options,
}: {
  form: JobForm;
  errors: JobFieldErrors;
  update: JobFormUpdate;
  options: RecruitmentOptions | null;
}) {
  const vacancies = Number(form.vacancies) || 1;

  const employmentOptions = useMemo<Array<DropdownOption<string>>>(
    () =>
      (options?.employmentTypes ?? DEFAULT_EMPLOYMENT_TYPES).map((value) => ({
        value,
        label: prettyEnum(value),
      })),
    [options?.employmentTypes],
  );

  return (
    <div>
      <StepIntro
        icon={<Building2 size={16} />}
        title="How will they work?"
        description="Contract type, where they work from and how many people you need."
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Employment type" required as="div">
          <Dropdown
            value={form.employmentType}
            onChange={(value) => update('employmentType', value)}
            options={employmentOptions}
            ariaLabel="Employment type"
          />
        </Field>

        <Field label="Vacancies" required as="div" error={errors.vacancies}>
          <div
            className={cx(
              'flex h-10 items-center rounded-xl border bg-[var(--surface)]',
              errors.vacancies ? 'border-red-500/60' : 'border-[var(--line)]',
            )}
          >
            <button
              type="button"
              onClick={() => update('vacancies', String(Math.max(1, vacancies - 1)))}
              disabled={vacancies <= 1}
              aria-label="One fewer vacancy"
              className={cx(
                'flex h-full w-10 items-center justify-center text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-40',
                focusRing,
              )}
            >
              <Minus size={13} />
            </button>
            <input
              type="number"
              min={1}
              step={1}
              value={form.vacancies}
              onChange={(event) => update('vacancies', event.target.value)}
              aria-label="Number of vacancies"
              className="h-full min-w-0 flex-1 bg-transparent text-center text-[12px] font-semibold tabular-nums text-[var(--text)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => update('vacancies', String(vacancies + 1))}
              aria-label="One more vacancy"
              className={cx(
                'flex h-full w-10 items-center justify-center text-[var(--text-muted)] transition hover:text-[var(--text)]',
                focusRing,
              )}
            >
              <Plus size={13} />
            </button>
          </div>
        </Field>
      </div>

      <Field label="Work arrangement" as="div" className="mt-4">
        <Segmented
          value={form.workArrangement}
          onChange={(value) => update('workArrangement', value)}
          ariaLabel="Work arrangement"
          options={[
            { value: '', label: 'Not set' },
            { value: 'REMOTE', label: 'Remote' },
            { value: 'HYBRID', label: 'Hybrid' },
            { value: 'ONSITE', label: 'On site' },
          ]}
        />
      </Field>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="City" hint={form.workArrangement === 'REMOTE' ? 'Optional for remote roles' : undefined}>
          <input
            value={form.city}
            onChange={(event) => update('city', event.target.value)}
            placeholder="Leeds"
            className={inputClass()}
          />
        </Field>

        <Field label="Country">
          <input
            value={form.country}
            onChange={(event) => update('country', event.target.value)}
            placeholder="United Kingdom"
            className={inputClass()}
          />
        </Field>
      </div>
    </div>
  );
}

function PlanStep({
  form,
  errors,
  update,
  options,
}: {
  form: JobForm;
  errors: JobFieldErrors;
  update: JobFormUpdate;
  options: RecruitmentOptions | null;
}) {
  const currencyOptions = useMemo<Array<DropdownOption<string>>>(
    () =>
      (options?.currencies ?? DEFAULT_CURRENCIES).map((value) => ({
        value,
        label: value,
        hint: formatMoney('0', value)?.replace(/[\d.,\s]/g, '') || undefined,
      })),
    [options?.currencies],
  );

  const preview = salaryLabel({
    salaryMin: form.salaryMin || null,
    salaryMax: form.salaryMax || null,
    currency: form.currency,
  });

  const autoOpen = form.status === 'OPEN' && !form.openedAt;

  return (
    <div>
      <StepIntro
        icon={<CalendarDays size={16} />}
        title="When and for how much?"
        description="Whether it goes live now, the key dates and the pay range."
      />

      <Field label="Status" as="div" className="mt-5">
        <Segmented
          value={form.status}
          onChange={(value) => {
            update('status', value);
            if (value === 'DRAFT') {
              update('published', false);
            }
          }}
          ariaLabel="Job status"
          options={[
            {
              value: 'DRAFT',
              label: 'Save as draft',
              leading: <span className={cx('h-1.5 w-1.5 rounded-full', TONES.neutral.dot)} />,
            },
            {
              value: 'OPEN',
              label: 'Open now',
              leading: <span className={cx('h-1.5 w-1.5 rounded-full', TONES.green.dot)} />,
            },
          ]}
        />
      </Field>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Open date" hint={autoOpen ? 'Today, automatically' : undefined}>
          <input
            type="date"
            value={form.openedAt || (autoOpen ? todayInput() : '')}
            onChange={(event) => update('openedAt', event.target.value)}
            className={cx(inputClass(), '[color-scheme:light]', autoOpen && 'text-[var(--text-subtle)]')}
          />
        </Field>

        <Field label="Closing date" error={errors.closesAt}>
          <input
            type="date"
            value={form.closesAt}
            min={effectiveOpenedAt(form) || undefined}
            onChange={(event) => update('closesAt', event.target.value)}
            aria-invalid={Boolean(errors.closesAt)}
            className={cx(inputClass(errors.closesAt), '[color-scheme:light]')}
          />
        </Field>

        <Field label="Target start">
          <input
            type="date"
            value={form.targetStartDate}
            onChange={(event) => update('targetStartDate', event.target.value)}
            className={cx(inputClass(), '[color-scheme:light]')}
          />
        </Field>
      </div>

      <div className="mt-5 rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold text-[var(--text)]">Salary range</p>
          <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--text-muted)]">
            <CircleDollarSign size={11} className="text-[var(--accent)]" />
            {preview}
          </p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)]">
          <Field label="Currency" as="div">
            <Dropdown
              value={form.currency}
              onChange={(value) => update('currency', value)}
              options={currencyOptions}
              ariaLabel="Currency"
              minWidth={160}
            />
          </Field>

          <Field label="Minimum" error={errors.salaryMin}>
            <input
              type="number"
              min={0}
              step={500}
              inputMode="numeric"
              value={form.salaryMin}
              onChange={(event) => update('salaryMin', event.target.value)}
              placeholder="40000"
              aria-invalid={Boolean(errors.salaryMin)}
              className={cx(inputClass(errors.salaryMin), 'bg-white tabular-nums')}
            />
          </Field>

          <Field label="Maximum" error={errors.salaryMax}>
            <input
              type="number"
              min={0}
              step={500}
              inputMode="numeric"
              value={form.salaryMax}
              onChange={(event) => update('salaryMax', event.target.value)}
              placeholder="55000"
              aria-invalid={Boolean(errors.salaryMax)}
              className={cx(inputClass(errors.salaryMax), 'bg-white tabular-nums')}
            />
          </Field>
        </div>
      </div>

      <div
        className={cx(
          'mt-4 flex items-center justify-between gap-4 rounded-[18px] border border-[var(--line)] p-4 transition-opacity',
          form.status !== 'OPEN' && 'opacity-60',
        )}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text)]">
            <Globe2 size={14} strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-[var(--text)]">Publish the role</p>
            <p className="mt-0.5 text-[10px] leading-5 text-[var(--text-muted)]">
              {form.status === 'OPEN'
                ? 'Makes it ready for the careers page once that is connected.'
                : 'Only open roles can be published.'}
            </p>
          </div>
        </div>

        <Switch
          checked={form.status === 'OPEN' && form.published}
          disabled={form.status !== 'OPEN'}
          onChange={(value) => update('published', value)}
          label="Publish the role"
        />
      </div>
    </div>
  );
}

function DetailsStep({
  form,
  update,
  options,
  onEdit,
}: {
  form: JobForm;
  update: JobFormUpdate;
  options: RecruitmentOptions | null;
  onEdit: (step: number) => void;
}) {
  const department = options?.departments.find((item) => item.id === form.departmentId);
  const manager = options?.hiringManagers.find((item) => item.id === form.hiringManagerId);
  const opened = effectiveOpenedAt(form);

  return (
    <div>
      <StepIntro
        icon={<FileText size={16} />}
        title="Finish the details"
        description="Optional, but it helps everyone judge candidates the same way. Check the summary before creating."
      />

      <div className="mt-5 rounded-[18px] border border-[var(--line)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              {form.title || 'Untitled role'}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
              {[department?.name, prettyEnum(form.employmentType), prettyEnum(form.workArrangement, '')]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <ToneBadge tone={form.status === 'OPEN' ? 'green' : 'neutral'}>
            {form.status === 'OPEN' ? 'Open' : 'Draft'}
          </ToneBadge>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <SummaryRow label="Hiring manager" value={manager ? personName(manager) : 'Not assigned'} onEdit={() => onEdit(1)} />
          <SummaryRow
            label="Vacancies and location"
            value={[
              `${form.vacancies || 1} ${Number(form.vacancies) === 1 ? 'vacancy' : 'vacancies'}`,
              [form.city.trim(), form.country.trim()].filter(Boolean).join(', '),
            ]
              .filter(Boolean)
              .join(', ')}
            onEdit={() => onEdit(2)}
          />
          <SummaryRow
            label="Dates"
            value={`${opened ? `Opens ${formatDate(opened)}` : 'No open date'}${form.closesAt ? `, closes ${formatDate(form.closesAt)}` : ''}`}
            onEdit={() => onEdit(3)}
          />
          <SummaryRow
            label="Salary"
            value={salaryLabel({
              salaryMin: form.salaryMin || null,
              salaryMax: form.salaryMax || null,
              currency: form.currency,
            })}
            onEdit={() => onEdit(3)}
          />
        </div>
      </div>

      <Field label="Responsibilities" className="mt-5">
        <textarea
          value={form.responsibilities}
          onChange={(event) => update('responsibilities', event.target.value)}
          rows={4}
          placeholder="The main things they will own, one per line"
          className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
        />
      </Field>

      <Field label="Requirements" className="mt-4">
        <textarea
          value={form.requirements}
          onChange={(event) => update('requirements', event.target.value)}
          rows={4}
          placeholder="Experience, skills and qualifications, one per line"
          className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
        />
      </Field>

      <Field label="Benefits" className="mt-4">
        <textarea
          value={form.benefits}
          onChange={(event) => update('benefits', event.target.value)}
          rows={3}
          placeholder="What Syntra Grid offers, one per line"
          className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
        />
      </Field>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[9px] font-medium text-[var(--text-subtle)]">{label}</p>
        <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--text)]">{value}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${label.toLowerCase()}`}
        className={cx(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-white hover:text-[var(--accent)]',
          focusRing,
        )}
      >
        <Pencil size={11} />
      </button>
    </div>
  );
}

/* =============================================================================
 * JOB WORKSPACE
 * =============================================================================
 */

function JobWorkspace({
  jobId,
  options,
  onBack,
  onChanged,
  notify,
}: {
  jobId: string;
  options: RecruitmentOptions | null;
  onBack: () => void;
  onChanged: () => void;
  notify: Notify;
}) {
  const reduceMotion = useReducedMotion();
  const tabsId = useId();

  const [job, setJob] = useState<JobDetail | null>(null);
  const [stageCounts, setStageCounts] = useState<StageCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'details' | 'applicants'>('details');
  const [updating, setUpdating] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [stageFilter, setStageFilter] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/recruitment/jobs/${jobId}`, {
        cache: 'no-store',
        credentials: 'include',
      });

      const data = await readJson<{ job: JobDetail; stageCounts: StageCount[] }>(response);

      setJob(data.job);
      setStageCounts(data.stageCounts ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this job.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = useCallback(
    async (status: string) => {
      if (!job || status === job.status) {
        return;
      }

      setUpdating(true);

      try {
        const response = await fetch(`/api/admin/recruitment/jobs/${job.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });

        await readJson(response);
        await load();
        setConfirmCancel(false);
        notify('success', `Role marked as ${prettyEnum(status).toLowerCase()}`);
        onChanged();
      } catch (cause) {
        notify('error', cause instanceof Error ? cause.message : 'Could not update the job.');
      } finally {
        setUpdating(false);
      }
    },
    [job, load, notify, onChanged],
  );

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-lg px-1 text-[11px] font-semibold text-[var(--text-muted)] transition hover:text-[var(--text)]',
        focusRing,
      )}
    >
      <ArrowLeft size={14} />
      Back to jobs
    </button>
  );

  if (loading && !job) {
    return (
      <div className="space-y-4">
        {backButton}
        <div className="h-[260px] animate-pulse rounded-[26px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
          <div className="h-[340px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
          <div className="h-[340px] animate-pulse rounded-[22px] border border-[var(--line)] bg-[var(--surface)] motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="space-y-4">
        {backButton}
        <ErrorState title="This job could not be opened" message={error} onRetry={() => void load()} />
      </div>
    );
  }

  if (!job) {
    return null;
  }

  const location = [job.city, job.country].filter(Boolean).join(', ');
  const statuses = options?.jobStatuses ?? DEFAULT_JOB_STATUSES;

  const statusOptions: Array<DropdownOption<string>> = statuses.map((value) => ({
    value,
    label: prettyEnum(value),
    leading: <span className={cx('h-2 w-2 rounded-full', TONES[statusTone(value)].dot)} />,
    hint:
      value === 'OPEN'
        ? 'Accepting candidates'
        : value === 'PAUSED'
          ? 'Hidden, pipeline kept'
          : value === 'FILLED'
            ? 'All vacancies filled'
            : value === 'CANCELLED'
              ? 'Role will not be filled'
              : value === 'CLOSED'
                ? 'No longer accepting'
                : undefined,
  }));

  const filteredApplications =
    stageFilter === 'ALL'
      ? job.applications
      : job.applications.filter((item) => item.stage === stageFilter);

  return (
    <div className="space-y-4">
      {backButton}

      <section className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        <div className="px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
                <BriefcaseBusiness size={22} strokeWidth={1.8} />
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-[var(--text)] sm:text-[26px]">
                    {job.title}
                  </h2>
                  <ToneBadge tone={statusTone(job.status)}>{prettyEnum(job.status)}</ToneBadge>
                  {job.published ? (
                    <ToneBadge tone="green">
                      <Globe2 size={9} />
                      Published
                    </ToneBadge>
                  ) : null}
                  <ClosingChip job={job} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {job.jobRef ? <Chip icon={<FileText size={10} />}>{job.jobRef}</Chip> : null}
                  <DepartmentChip department={job.department} />
                  <Chip icon={<BriefcaseBusiness size={10} />}>{prettyEnum(job.employmentType)}</Chip>
                  {job.workArrangement ? (
                    <Chip icon={<Globe2 size={10} />}>{prettyEnum(job.workArrangement)}</Chip>
                  ) : null}
                  {location ? <Chip icon={<MapPin size={10} />}>{location}</Chip> : null}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[190px]">
                <Dropdown
                  value={job.status}
                  onChange={(value) => {
                    if (value === 'CANCELLED') {
                      setConfirmCancel(true);
                    } else {
                      void changeStatus(value);
                    }
                  }}
                  options={statusOptions}
                  ariaLabel="Change job status"
                  disabled={updating}
                  loading={updating}
                  minWidth={240}
                />
              </div>

              {job.status !== 'OPEN' && job.status !== 'CANCELLED' && job.status !== 'FILLED' ? (
                <PrimaryButton onClick={() => void changeStatus('OPEN')}>
                  <CheckCircle2 size={13} />
                  Open role
                </PrimaryButton>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--line)]">
          <MetricsGrid
            columns="grid-cols-2 lg:grid-cols-4"
            items={[
              {
                label: 'Applicants',
                value: job.applications.length,
                helper: 'For this role',
                icon: Users,
                onClick: () => setTab('applicants'),
              },
              {
                label: 'Vacancies',
                value: job.vacancies,
                helper: job.vacancies === 1 ? 'Person needed' : 'People needed',
                icon: UserCheck,
              },
              {
                label: 'Salary',
                value: salaryLabel(job),
                helper: job.currency ?? 'Currency not set',
                icon: CircleDollarSign,
              },
              {
                label: 'Closes',
                value: job.closesAt ? formatDate(job.closesAt, '', { year: undefined }) : 'Open ended',
                helper: job.closesAt ? formatDate(job.closesAt) : 'No closing date',
                icon: CalendarClock,
              },
            ]}
          />
        </div>

        <div className="overflow-x-auto border-t border-[var(--line)] px-2 sm:px-4 [scrollbar-width:none]">
          <div role="tablist" aria-label="Job sections" className="flex min-w-max">
            {(
              [
                { id: 'details', label: 'Details' },
                { id: 'applicants', label: 'Applicants', count: job.applications.length },
              ] as const
            ).map((item) => {
              const active = tab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={cx(
                    'relative inline-flex items-center gap-1.5 px-4 py-3.5 text-[11px] font-semibold transition-colors',
                    active ? 'text-[var(--text)]' : 'text-[var(--text-subtle)] hover:text-[var(--text)]',
                    focusRing,
                  )}
                >
                  {item.label}
                  {'count' in item && item.count ? <CountPill value={item.count} /> : null}
                  {active ? (
                    <motion.span
                      layoutId={`${tabsId}-underline`}
                      className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--accent)]"
                      transition={
                        reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }
                      }
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
        >
          {tab === 'details' ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
              <div className="space-y-4">
                {[
                  { title: 'About the role', text: job.description },
                  { title: 'Responsibilities', text: job.responsibilities },
                  { title: 'Requirements', text: job.requirements },
                  { title: 'Benefits', text: job.benefits },
                ].some((item) => item.text?.trim()) ? (
                  [
                    { title: 'About the role', text: job.description },
                    { title: 'Responsibilities', text: job.responsibilities },
                    { title: 'Requirements', text: job.requirements },
                    { title: 'Benefits', text: job.benefits },
                  ]
                    .filter((item) => item.text?.trim())
                    .map((item) => (
                      <Panel key={item.title} title={item.title}>
                        <RichText
                          text={item.text ?? ''}
                          list={item.title !== 'About the role'}
                        />
                      </Panel>
                    ))
                ) : (
                  <EmptyState
                    icon={<FileText size={21} strokeWidth={1.7} />}
                    title="No role description yet"
                    description="Add a description, responsibilities and requirements so everyone assesses candidates the same way."
                  />
                )}
              </div>

              <div className="space-y-4">
                <Panel title="Key details">
                  <DetailLine label="Department" value={<DepartmentChip department={job.department} />} />
                  <DetailLine label="Location" value={location || 'Not specified'} />
                  <DetailLine label="Opened" value={formatDate(job.openedAt)} />
                  <DetailLine label="Closes" value={formatDate(job.closesAt, 'No closing date')} />
                  <DetailLine label="Target start" value={formatDate(job.targetStartDate)} />
                  {job.closedAt ? <DetailLine label="Closed" value={formatDate(job.closedAt)} /> : null}
                  <DetailLine label="Created" value={formatDate(job.createdAt)} />
                  <DetailLine label="Last updated" value={relativeDate(job.updatedAt)} />
                </Panel>

                <Panel title="Hiring manager">
                  {job.hiringManager ? (
                    <div className="flex items-center gap-3">
                      <Avatar person={job.hiringManager} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-[var(--text)]">
                          {personName(job.hiringManager)}
                        </p>
                        <a
                          href={`mailto:${job.hiringManager.email}`}
                          className={cx(
                            'block truncate rounded text-[10px] text-[var(--text-subtle)] hover:text-[var(--accent)] hover:underline',
                            focusRing,
                          )}
                        >
                          {job.hiringManager.email}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--text-subtle)]">Nobody assigned yet.</p>
                  )}
                </Panel>
              </div>
            </div>
          ) : (
            <Panel
              title="Applicants"
              action={<CountPill value={job.applications.length} />}
            >
              {job.applications.length > 0 ? (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  <StageFilterPill
                    active={stageFilter === 'ALL'}
                    onClick={() => setStageFilter('ALL')}
                    label="All"
                    count={job.applications.length}
                  />
                  {stageCounts
                    .filter((item) => item.count > 0)
                    .map((item) => (
                      <StageFilterPill
                        key={item.stage}
                        active={stageFilter === item.stage}
                        onClick={() => setStageFilter(item.stage)}
                        label={prettyEnum(item.stage)}
                        count={item.count}
                        tone={statusTone(item.stage)}
                      />
                    ))}
                </div>
              ) : null}

              {job.applications.length === 0 ? (
                <InlineEmpty
                  icon={Users}
                  text={
                    job.status === 'OPEN'
                      ? 'No applications yet. They will appear here as candidates apply.'
                      : 'No applications. Open the role to start receiving candidates.'
                  }
                />
              ) : filteredApplications.length === 0 ? (
                <InlineEmpty icon={Users} text="Nobody is at this stage right now." />
              ) : (
                <div className="-mx-2 space-y-0.5">
                  {filteredApplications.map((application) => (
                    <ApplicantRow key={application.id} application={application} />
                  ))}
                </div>
              )}
            </Panel>
          )}
        </motion.div>
      </AnimatePresence>

      <ConfirmDialog
        open={confirmCancel}
        busy={updating}
        icon={<XCircle size={18} strokeWidth={1.8} />}
        title={`Cancel ${job.title}?`}
        description="The role stops accepting candidates and moves to Cancelled. Applicants and their history are kept."
        note={
          job.applications.length > 0
            ? `${job.applications.length} ${job.applications.length === 1 ? 'person has' : 'people have'} applied. Let them know separately.`
            : undefined
        }
        cancelLabel="Keep role"
        confirmLabel="Cancel role"
        busyLabel="Cancelling"
        onCancel={() => {
          if (!updating) {
            setConfirmCancel(false);
          }
        }}
        onConfirm={() => void changeStatus('CANCELLED')}
      />
    </div>
  );
}

function ApplicantRow({ application }: { application: JobApplicationSummary }) {
  const { candidate } = application;
  const current = [candidate.currentJobTitle, candidate.currentCompany]
    .filter(Boolean)
    .join(' at ');

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--surface-muted)]">
      <Avatar person={candidate} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[11px] font-semibold text-[var(--text)]">
            {personName(candidate)}
          </p>
          {typeof application.rating === 'number' && application.rating > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-semibold text-[var(--accent)]">
              <Star size={9} fill="currentColor" />
              {application.rating}
            </span>
          ) : null}
        </div>
        <p className="truncate text-[10px] text-[var(--text-subtle)]">
          {current || candidate.email || 'Candidate'}
        </p>
      </div>

      <div className="hidden shrink-0 items-center gap-1.5 md:flex">
        <Chip>{prettyEnum(candidate.source)}</Chip>
        {application._count.interviews > 0 ? (
          <Chip icon={<CalendarClock size={10} />}>{application._count.interviews}</Chip>
        ) : null}
        {application._count.offers > 0 ? (
          <Chip icon={<FileText size={10} />}>{application._count.offers}</Chip>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <ToneBadge tone={statusTone(application.stage)} compact>
          {prettyEnum(application.stage)}
        </ToneBadge>
        <p className="mt-1 text-[9px] text-[var(--text-subtle)]">
          Applied {relativeDate(application.appliedAt)}
        </p>
      </div>
    </div>
  );
}

function StageFilterPill({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: Tone;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold transition-colors',
        active
          ? 'border-[var(--accent)] bg-[var(--surface)] text-[var(--text)]'
          : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]',
        focusRing,
      )}
    >
      {tone ? <span className={cx('h-1.5 w-1.5 rounded-full', TONES[tone].dot)} /> : null}
      {label}
      <span className="tabular-nums text-[var(--text-subtle)]">{count}</span>
    </button>
  );
}

function RichText({ text, list = false }: { text: string; list?: boolean }) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletPattern = /^([•*·]|\d+[.)])\s+/;
  const looksLikeList =
    list && lines.length > 1 && lines.every((line) => line.length < 220);

  if (looksLikeList) {
    return (
      <ul className="space-y-2">
        {lines.map((line, index) => (
          <li key={index} className="flex gap-2.5 text-[12px] leading-6 text-[var(--text-muted)]">
            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
            <span>{line.replace(bulletPattern, '').replace(/^-\s+/, '')}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className="whitespace-pre-wrap text-[12px] leading-6 text-[var(--text-muted)]">{text}</p>
  );
}

/* =============================================================================
 * RECRUITMENT UI
 * =============================================================================
 */

function ToneBadge({
  tone,
  compact = false,
  children,
}: {
  tone: Tone;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-bold uppercase tracking-[0.08em]',
        compact ? 'px-2 py-1 text-[7px]' : 'px-2.5 py-1 text-[8px]',
        TONES[tone].badge,
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', TONES[tone].dot)} />
      {children}
    </span>
  );
}

function DepartmentDot({ department }: { department: DepartmentOption | null }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-muted)]">
      {department ? (
        <span
          className={cx(
            'h-2 w-2 rounded-full',
            colourDotClass(department.colour ?? suggestColour(department.name)),
          )}
        />
      ) : (
        <Building2 size={11} strokeWidth={1.8} />
      )}
    </span>
  );
}

function DepartmentChip({ department }: { department: DepartmentOption | null }) {
  if (!department) {
    return <Chip icon={<Building2 size={10} />}>No department</Chip>;
  }

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-muted)]">
      <span
        className={cx(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          colourDotClass(department.colour ?? suggestColour(department.name)),
        )}
      />
      <span className="truncate">{department.name}</span>
    </span>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed',
        checked ? 'justify-end bg-[var(--accent)]' : 'justify-start bg-[var(--line)]',
        focusRing,
      )}
    >
      <motion.span
        layout={!reduceMotion}
        transition={{ type: 'spring', stiffness: 600, damping: 36 }}
        className="h-5 w-5 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group inline-flex items-center gap-1 rounded-md text-[10px] font-semibold text-[var(--accent)] transition hover:opacity-80',
        focusRing,
      )}
    >
      {children}
      <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function InlineEmpty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]">
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <p className="max-w-[280px] text-[10px] leading-5 text-[var(--text-subtle)]">{text}</p>
    </div>
  );
}

/* =============================================================================
 * SHARED PRIMITIVES
 * Same building blocks as the Team and Departments tabs.
 * =============================================================================
 */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const COLOUR_OPTIONS = [
  'emerald',
  'blue',
  'violet',
  'amber',
  'rose',
  'cyan',
  'slate',
] as const;

function colourDotClass(colour?: string | null) {
  switch (colour) {
    case 'emerald':
      return 'bg-emerald-500';
    case 'blue':
      return 'bg-blue-500';
    case 'violet':
      return 'bg-violet-500';
    case 'amber':
      return 'bg-amber-500';
    case 'rose':
      return 'bg-rose-500';
    case 'cyan':
      return 'bg-cyan-500';
    case 'slate':
      return 'bg-slate-500';
    default:
      return 'bg-[var(--accent)]';
  }
}

function suggestColour(name: string) {
  const key = name.trim().toLowerCase();

  if (!key) {
    return null;
  }

  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }

  return COLOUR_OPTIONS[hash % COLOUR_OPTIONS.length];
}

function initials(first?: string | null, last?: string | null) {
  const a = first?.trim().charAt(0) ?? '';
  const b = last?.trim().charAt(0) ?? '';

  return `${a}${b}`.toUpperCase();
}

const BRIDGED_VARS = [
  '--accent',
  '--accent-soft',
  '--surface',
  '--surface-muted',
  '--line',
  '--text',
  '--text-muted',
  '--text-subtle',
  '--success',
  '--success-soft',
  '--success-border',
  '--warning',
  '--warning-soft',
  '--warning-border',
] as const;

/* Solid white modal with black text and clearly visible borders. */

const MODAL_VARS = {
  '--surface': '#FFFFFF',
  '--surface-muted': '#F4F4F5',
  '--line': '#D4D4D8',
  '--text': '#0A0A0A',
  '--text-muted': '#27272A',
  '--text-subtle': '#52525B',
} as CSSProperties;

const PortalTheme = createContext<CSSProperties>({});

const subscribeNoop = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

function useThemeBridge() {
  const ref = useRef<HTMLDivElement>(null);
  const [vars, setVars] = useState<CSSProperties>({});

  useEffect(() => {
    const read = () => {
      const element = ref.current;

      if (!element) {
        return;
      }

      const computed = window.getComputedStyle(element);
      const next: Record<string, string> = {};

      for (const name of BRIDGED_VARS) {
        const value = computed.getPropertyValue(name).trim();

        if (value) {
          next[name] = value;
        }
      }

      setVars((previous) =>
        JSON.stringify(previous) === JSON.stringify(next)
          ? previous
          : (next as CSSProperties),
      );
    };

    read();

    const observer = new MutationObserver(read);
    const options = {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'style'],
    };

    observer.observe(document.documentElement, options);
    observer.observe(document.body, options);

    return () => observer.disconnect();
  }, []);

  return { ref, vars };
}

function focusableIn(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
}

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]';

const inputBase =
  'h-10 w-full rounded-xl border bg-[var(--surface)] px-3 text-[11px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60';

function inputClass(error?: string) {
  return cx(
    inputBase,
    error
      ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/10'
      : 'border-[var(--line)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/10',
  );
}

function ModalShell({
  open,
  onClose,
  labelledBy,
  size = 'lg',
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  size?: 'sm' | 'lg';
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const inherited = useContext(PortalTheme);
  const modalTheme = useMemo(
    () => ({ ...inherited, ...MODAL_VARS }),
    [inherited],
  );

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;

      if (!panel) {
        return;
      }

      const target =
        panel.querySelector<HTMLElement>('[data-autofocus]') ??
        focusableIn(panel)[0];

      target?.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const panel = panelRef.current;

      if (!panel || !panel.contains(document.activeElement)) {
        return;
      }

      const items = focusableIn(panel);

      if (items.length === 0) {
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!isClient) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          key="modal"
          style={modalTheme}
          className="fixed inset-0 z-[120] flex items-end justify-center text-[var(--text)] sm:items-center sm:p-6"
        >
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-black/30 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.22 }}
            onClick={() => onCloseRef.current()}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            className={cx(
              'relative flex w-full flex-col overflow-hidden rounded-t-[26px] border border-[var(--line)] bg-white shadow-2xl sm:rounded-[26px]',
              size === 'lg' ? 'sm:max-w-[720px]' : 'sm:max-w-[440px]',
            )}
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }
            }
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : { type: 'spring', stiffness: 420, damping: 36, mass: 0.9 }
            }
          >
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[var(--line)] sm:hidden" />
            <PortalTheme.Provider value={modalTheme}>
              {children}
            </PortalTheme.Provider>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function ConfirmDialog({
  open,
  busy,
  icon,
  title,
  description,
  note,
  cancelLabel,
  confirmLabel,
  busyLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  note?: string;
  cancelLabel: string;
  confirmLabel: string;
  busyLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();

  return (
    <ModalShell open={open} onClose={onCancel} labelledBy={titleId} size="sm">
      <div className="px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-red-500/20 bg-red-500/5 text-red-600">
          {icon}
        </div>

        <h3
          id={titleId}
          className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]"
        >
          {title}
        </h3>

        <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">
          {description}
        </p>

        {note ? (
          <p className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5 text-[10px] leading-5 text-[var(--text-muted)]">
            {note}
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={cx(
              'h-10 flex-1 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50',
              focusRing,
            )}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            data-autofocus
            onClick={onConfirm}
            disabled={busy}
            className={cx(
              'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-[10px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60',
              focusRing,
            )}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : null}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function Dropdown<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = 'Select',
  searchable = false,
  searchPlaceholder = 'Search',
  emptyText = 'No results',
  disabled = false,
  loading = false,
  minWidth = 220,
  triggerClassName,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<DropdownOption<T>>;
  ariaLabel: string;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
  minWidth?: number;
  triggerClassName?: string;
}) {
  const reduceMotion = useReducedMotion();
  const isClient = useIsClient();
  const listId = useId();
  const portalTheme = useContext(PortalTheme);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: 'top' | 'bottom';
  } | null>(null);

  const selected = options.find((option) => option.value === value) ?? null;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) {
      return options;
    }

    return options.filter((option) =>
      `${option.label} ${option.hint ?? ''} ${option.keywords ?? ''}`
        .toLowerCase()
        .includes(term),
    );
  }, [options, query]);

  const measure = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, minWidth);
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const desired = 320;

    if (below < Math.min(desired, 240) && above > below) {
      setPosition({
        bottom: window.innerHeight - rect.top + 6,
        left,
        width,
        maxHeight: Math.min(desired, above - 6),
        placement: 'top',
      });
    } else {
      setPosition({
        top: rect.bottom + 6,
        left,
        width,
        maxHeight: Math.min(desired, below - 6),
        placement: 'bottom',
      });
    }
  }, [minWidth]);

  const openMenu = () => {
    if (disabled) {
      return;
    }

    measure();
    setQuery('');
    const index = options.findIndex((option) => option.value === value);
    setActive(index >= 0 ? index : 0);
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);

    if (refocus) {
      triggerRef.current?.focus();
    }
  };

  const select = (option: DropdownOption<T>) => {
    if (option.disabled) {
      return;
    }

    onChange(option.value);
    close();
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    const onReflow = (event?: Event) => {
      if (
        event?.target instanceof Node &&
        panelRef.current?.contains(event.target)
      ) {
        return;
      }

      measure();
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);

    const frame = window.requestAnimationFrame(() => {
      (searchable ? searchRef.current : listRef.current)?.focus({
        preventScroll: true,
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, measure, searchable]);

  useEffect(() => {
    if (!open) {
      return;
    }

    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const moveActive = (direction: 1 | -1) => {
    if (filtered.length === 0) {
      return;
    }

    setActive((current) => {
      let next = current;

      for (let step = 0; step < filtered.length; step += 1) {
        next = (next + direction + filtered.length) % filtered.length;

        if (!filtered[next]?.disabled) {
          return next;
        }
      }

      return current;
    });
  };

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        break;
      case 'Home':
        if (!searchable) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case 'End':
        if (!searchable) {
          event.preventDefault();
          setActive(Math.max(0, filtered.length - 1));
        }
        break;
      case 'Enter': {
        event.preventDefault();
        event.stopPropagation();
        const option = filtered[active];
        if (option) {
          select(option);
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close();
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      event.stopPropagation();

      if (!open) {
        openMenu();
      }
    }
  };

  const activeId =
    open && filtered[active] ? `${listId}-option-${active}` : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className={cx(
          'group flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border bg-[var(--surface)] px-3 text-left text-[11px] transition',
          open
            ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/10'
            : 'border-[var(--line)] hover:bg-[var(--surface-muted)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          focusRing,
          triggerClassName,
        )}
      >
        {selected?.leading ? (
          <span className="flex shrink-0 items-center">{selected.leading}</span>
        ) : null}

        <span
          className={cx(
            'min-w-0 flex-1 truncate font-semibold',
            selected ? 'text-[var(--text)]' : 'text-[var(--text-subtle)]',
          )}
        >
          {loading ? 'Loading' : (selected?.label ?? placeholder)}
        </span>

        {loading ? (
          <Loader2
            size={13}
            className="shrink-0 animate-spin text-[var(--text-subtle)]"
          />
        ) : (
          <ChevronDown
            size={14}
            className={cx(
              'shrink-0 text-[var(--text-subtle)] transition-transform duration-200',
              open && 'rotate-180 text-[var(--text)]',
            )}
          />
        )}
      </button>

      {isClient
        ? createPortal(
            <AnimatePresence>
              {open && position ? (
                <motion.div
                  ref={panelRef}
                  key="panel"
                  onKeyDown={onPanelKeyDown}
                  initial={
                    reduceMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          y: position.placement === 'top' ? 6 : -6,
                          scale: 0.97,
                        }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    reduceMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          y: position.placement === 'top' ? 4 : -4,
                          scale: 0.98,
                        }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0.1 }
                      : { type: 'spring', stiffness: 520, damping: 36 }
                  }
                  style={{
                    ...portalTheme,
                    position: 'fixed',
                    top: position.top,
                    bottom: position.bottom,
                    left: position.left,
                    width: position.width,
                    transformOrigin:
                      position.placement === 'top'
                        ? 'bottom center'
                        : 'top center',
                  }}
                  className="z-[160] flex flex-col overflow-hidden rounded-[16px] border border-[var(--line)] bg-white text-[var(--text)] shadow-xl"
                >
                  {searchable ? (
                    <div className="relative border-b border-[var(--line)] p-1.5">
                      <Search
                        size={13}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
                      />
                      <input
                        ref={searchRef}
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setActive(0);
                        }}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        aria-controls={listId}
                        aria-activedescendant={activeId}
                        className="h-9 w-full rounded-[10px] bg-[var(--surface-muted)] pl-8 pr-3 text-[11px] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
                      />
                    </div>
                  ) : null}

                  <div
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    aria-label={ariaLabel}
                    aria-activedescendant={searchable ? undefined : activeId}
                    tabIndex={searchable ? -1 : 0}
                    className="overflow-y-auto overscroll-contain p-1.5 outline-none"
                    style={{
                      maxHeight: position.maxHeight - (searchable ? 49 : 0),
                    }}
                  >
                    {filtered.length === 0 ? (
                      <p className="px-3 py-6 text-center text-[10px] text-[var(--text-subtle)]">
                        {emptyText}
                      </p>
                    ) : (
                      filtered.map((option, index) => {
                        const isSelected = option.value === value;
                        const isActive = index === active;

                        return (
                          <div
                            key={option.value || '__empty'}
                            id={`${listId}-option-${index}`}
                            data-index={index}
                            role="option"
                            aria-selected={isSelected}
                            aria-disabled={option.disabled}
                            onPointerMove={() => {
                              if (!option.disabled && active !== index) {
                                setActive(index);
                              }
                            }}
                            onClick={() => select(option)}
                            className={cx(
                              'relative flex cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[11px] transition-colors',
                              option.disabled && 'cursor-not-allowed opacity-50',
                              isActive
                                ? 'bg-[var(--surface-muted)] text-[var(--text)]'
                                : 'text-[var(--text-muted)]',
                            )}
                          >
                            {option.leading ? (
                              <span className="flex shrink-0 items-center">
                                {option.leading}
                              </span>
                            ) : null}

                            <span className="min-w-0 flex-1">
                              <span
                                className={cx(
                                  'block truncate',
                                  isSelected
                                    ? 'font-semibold text-[var(--text)]'
                                    : 'font-medium',
                                )}
                              >
                                {option.label}
                              </span>

                              {option.hint ? (
                                <span className="mt-0.5 block truncate text-[9px] text-[var(--text-subtle)]">
                                  {option.hint}
                                </span>
                              ) : null}
                            </span>

                            {option.trailing ? (
                              <span className="shrink-0">{option.trailing}</span>
                            ) : null}

                            <Check
                              size={13}
                              strokeWidth={2.2}
                              className={cx(
                                'shrink-0 text-[var(--accent)] transition-opacity',
                                isSelected ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; leading?: ReactNode }>;
  ariaLabel: string;
}) {
  const reduceMotion = useReducedMotion();
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }

    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const next =
      (index + (event.key === 'ArrowRight' ? 1 : -1) + options.length) %
      options.length;

    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="grid rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((option, index) => {
        const active = option.value === value;

        return (
          <button
            key={option.value || '__none'}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cx(
              'relative flex h-8 items-center justify-center gap-1.5 rounded-lg text-[10px] font-semibold transition-colors',
              active
                ? 'text-[var(--text)]'
                : 'text-[var(--text-subtle)] hover:text-[var(--text)]',
              focusRing,
            )}
          >
            {active ? (
              <motion.span
                layoutId={`${id}-pill`}
                className="absolute inset-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-sm"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 500, damping: 38 }
                }
              />
            ) : null}
            <span className="relative flex items-center gap-1.5">
              {option.leading}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const isClient = useIsClient();
  const portalTheme = useContext(PortalTheme);

  if (!isClient) {
    return null;
  }

  return createPortal(
    <div
      style={portalTheme}
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[200] flex justify-center px-4"
    >
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            role="status"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }
            }
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : { type: 'spring', stiffness: 460, damping: 32 }
            }
            className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-2.5 pl-3 pr-2 text-[11px] font-medium text-[var(--text)] shadow-xl"
          >
            {toast.tone === 'success' ? (
              <CheckCircle2
                size={15}
                className="text-[var(--success,var(--accent))]"
              />
            ) : (
              <AlertCircle size={15} className="text-red-500" />
            )}
            {toast.message}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className={cx(
                'ml-1 flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
                focusRing,
              )}
            >
              <X size={12} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

function Avatar({
  person,
  size = 'md',
  animateChanges = false,
}: {
  person: Person | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animateChanges?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  const sizeClass = {
    xs: 'h-6 w-6 rounded-full text-[8px]',
    sm: 'h-8 w-8 rounded-[10px] text-[9px]',
    md: 'h-10 w-10 rounded-[13px] text-[11px]',
    lg: 'h-11 w-11 rounded-[15px] text-[12px]',
    xl: 'h-14 w-14 rounded-[18px] text-[15px]',
  }[size];

  const iconSize = { xs: 10, sm: 13, md: 15, lg: 17, xl: 20 }[size];

  if (person?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatarUrl}
        alt=""
        className={cx(
          'shrink-0 border border-[var(--line)] object-cover',
          sizeClass,
        )}
      />
    );
  }

  const letters = person ? initials(person.firstName, person.lastName) : '';

  const content = letters ? (
    <span className="tracking-[0.02em]">{letters}</span>
  ) : (
    <UserRound size={iconSize} strokeWidth={1.8} />
  );

  return (
    <div
      className={cx(
        'flex shrink-0 items-center justify-center border border-[var(--line)] bg-[var(--surface-muted)] font-bold',
        letters ? 'text-[var(--text)]' : 'text-[var(--text-subtle)]',
        sizeClass,
      )}
    >
      {animateChanges ? (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={letters || 'empty'}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            transition={
              reduceMotion
                ? { duration: 0.1 }
                : { type: 'spring', stiffness: 500, damping: 28 }
            }
            className="flex"
          >
            {content}
          </motion.span>
        </AnimatePresence>
      ) : (
        content
      )}
    </div>
  );
}

function Chip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
      {icon ? <span className="shrink-0">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
  as = 'label',
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  as?: 'label' | 'div';
  className?: string;
}) {
  const Wrapper = as;

  return (
    <Wrapper className={cx('block', className)}>
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[9px] font-semibold text-[var(--text-muted)]">
          {label}
          {required ? <span className="text-[var(--accent)]">*</span> : null}
        </span>
        {hint ? (
          <span className="truncate text-[8px] text-[var(--text-subtle)]">
            {hint}
          </span>
        ) : null}
      </span>

      {children}

      <AnimatePresence initial={false}>
        {error ? (
          <motion.span
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="block overflow-hidden"
          >
            <span className="block pt-1 text-[9px] font-medium text-red-600">
              {error}
            </span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </Wrapper>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cx(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--line)] px-3.5 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 text-[9px] font-semibold text-[var(--text-muted)]">
      {children}
    </kbd>
  );
}

function CountPill({ value }: { value: number }) {
  return (
    <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-[var(--text-subtle)]">
      {value}
    </span>
  );
}

function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-5 py-12 text-center">
      <div className="max-w-[420px]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[15px] border border-red-500/20 bg-red-500/5 text-red-500">
          <AlertCircle size={19} />
        </div>

        <h3 className="mt-4 text-[14px] font-semibold text-[var(--text)]">
          {title}
        </h3>

        <p className="mt-2 text-[10px] leading-5 text-[var(--text-muted)]">
          {message}
        </p>

        <div className="mt-5 flex justify-center">
          <SecondaryButton onClick={onRetry}>
            <RefreshCw size={13} />
            Try again
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-[22px] border border-[var(--line)] bg-[var(--surface)] px-5 py-12 text-center">
      <div className="max-w-[440px]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
          {icon ?? <Users size={21} strokeWidth={1.7} />}
        </div>

        <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">
          {title}
        </h3>

        <p className="mx-auto mt-2 max-w-[380px] text-[10px] leading-5 text-[var(--text-muted)]">
          {description}
        </p>

        {action ? (
          <div className="mt-5 flex items-center justify-center">{action}</div>
        ) : null}
      </div>
    </div>
  );
}

function StepIntro({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text)]">
        {icon}
      </span>

      <div>
        <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--text)]">
          {title}
        </h3>
        <p className="mt-0.5 text-[10px] leading-5 text-[var(--text-muted)]">
          {description}
        </p>
      </div>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        'rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[12px] font-semibold tracking-[-0.01em] text-[var(--text)]">
            {title}
          </h3>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function DetailLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-[var(--line)] py-3 first:pt-0 last:border-0 last:pb-0">
      <span className="shrink-0 text-[10px] text-[var(--text-subtle)]">
        {label}
      </span>
      <span className="min-w-0 break-words text-right text-[11px] font-semibold text-[var(--text)]">
        {value}
      </span>
    </div>
  );
}