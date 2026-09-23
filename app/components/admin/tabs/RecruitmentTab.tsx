"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  Filter,
  Globe2,
  LayoutDashboard,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  UserCheck,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";

/* =============================================================================
   TYPES
============================================================================= */

type RecruitmentSection =
  | "overview"
  | "jobs"
  | "candidates"
  | "pipeline"
  | "interviews"
  | "offers"
  | "talent-pool";

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

type JobDetail = Omit<JobListItem, "applicationCount"> & {
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

  status: string;

  openedAt: string;
  closesAt: string;
  targetStartDate: string;

  published: boolean;
};

/* =============================================================================
   CONSTANTS
============================================================================= */

const SECTIONS: Array<{
  id: RecruitmentSection;
  label: string;
  icon: ReactNode;
}> = [
  {
    id: "overview",
    label: "Overview",
    icon: <LayoutDashboard size={16} />,
  },
  {
    id: "jobs",
    label: "Jobs",
    icon: <BriefcaseBusiness size={16} />,
  },
  {
    id: "candidates",
    label: "Candidates",
    icon: <Users size={16} />,
  },
  {
    id: "pipeline",
    label: "Pipeline",
    icon: <Target size={16} />,
  },
  {
    id: "interviews",
    label: "Interviews",
    icon: <CalendarClock size={16} />,
  },
  {
    id: "offers",
    label: "Offers",
    icon: <FileText size={16} />,
  },
  {
    id: "talent-pool",
    label: "Talent Pool",
    icon: <Sparkles size={16} />,
  },
];

const PIPELINE_ORDER = [
  "APPLIED",
  "SCREENING",
  "SHORTLISTED",
  "INTERVIEW",
  "ASSESSMENT",
  "FINAL_INTERVIEW",
  "OFFER",
  "HIRED",
];

const EMPTY_JOB_FORM: JobForm = {
  title: "",
  departmentId: "",
  hiringManagerId: "",

  description: "",
  responsibilities: "",
  requirements: "",
  benefits: "",

  employmentType: "FULL_TIME",
  workArrangement: "HYBRID",

  country: "",
  city: "",

  salaryMin: "",
  salaryMax: "",
  currency: "GBP",

  vacancies: "1",

  status: "DRAFT",

  openedAt: "",
  closesAt: "",
  targetStartDate: "",

  published: false,
};

/* =============================================================================
   HELPERS
============================================================================= */

function cx(
  ...classes: Array<string | false | null | undefined>
) {
  return classes.filter(Boolean).join(" ");
}

function prettyEnum(value?: string | null) {
  if (!value) return "—";

  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function personName(person: {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  email?: string | null;
}) {
  const preferred = person.preferredName?.trim();

  if (preferred) {
    const surname = person.lastName?.trim();

    return [preferred, surname].filter(Boolean).join(" ");
  }

  const fullName = [
    person.firstName?.trim(),
    person.lastName?.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  return fullName || person.email || "Unknown";
}

function initialsFor(person: {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  email?: string | null;
}) {
  const first =
    person.preferredName ||
    person.firstName ||
    person.email?.charAt(0) ||
    "?";

  const second = person.lastName || "";

  return `${first.charAt(0)}${second.charAt(0)}`
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(
  value?: string | Date | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return "—";

  const date =
    value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function currencySymbol(currency?: string | null) {
  switch (currency) {
    case "NGN":
      return "₦";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    default:
      return currency ? `${currency} ` : "";
  }
}

function formatMoney(
  value?: string | null,
  currency?: string | null,
) {
  if (!value) return null;

  const amount = Number(value);

  if (!Number.isFinite(amount)) return null;

  try {
    if (currency) {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
    }
  } catch {
    // fallback below
  }

  return `${currencySymbol(currency)}${amount.toLocaleString(
    "en-GB",
  )}`;
}

function salaryLabel(job: {
  salaryMin: string | null;
  salaryMax: string | null;
  currency: string | null;
}) {
  const min = formatMoney(
    job.salaryMin,
    job.currency,
  );

  const max = formatMoney(
    job.salaryMax,
    job.currency,
  );

  if (min && max) return `${min} – ${max}`;
  if (min) return `From ${min}`;
  if (max) return `Up to ${max}`;

  return "Salary not specified";
}

function toInputDate(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(
    2,
    "0",
  );
  const day = String(date.getDate()).padStart(
    2,
    "0",
  );

  return `${year}-${month}-${day}`;
}

async function readJson<T>(
  response: Response,
): Promise<T> {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : "Something went wrong.";

    throw new Error(message);
  }

  return data as T;
}

/* =============================================================================
   SMALL UI
============================================================================= */

function Avatar({
  person,
  size = "md",
}: {
  person: {
    firstName?: string | null;
    lastName?: string | null;
    preferredName?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  };
  size?: "sm" | "md" | "lg";
}) {
  const classes = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
  }[size];

  if (person.avatarUrl) {
    return (
      <img
        src={person.avatarUrl}
        alt=""
        className={cx(
          classes,
          "shrink-0 rounded-full object-cover ring-1 ring-black/5",
        )}
      />
    );
  }

  return (
    <div
      className={cx(
        classes,
        "grid shrink-0 place-items-center rounded-full bg-neutral-100 font-semibold text-neutral-600 ring-1 ring-black/5",
      )}
    >
      {initialsFor(person)}
    </div>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?:
    | "neutral"
    | "green"
    | "amber"
    | "blue"
    | "red"
    | "purple";
}) {
  const toneClass = {
    neutral:
      "bg-neutral-100 text-neutral-600 ring-neutral-200/70",
    green:
      "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    amber:
      "bg-amber-50 text-amber-700 ring-amber-200/70",
    blue:
      "bg-blue-50 text-blue-700 ring-blue-200/70",
    red: "bg-red-50 text-red-700 ring-red-200/70",
    purple:
      "bg-violet-50 text-violet-700 ring-violet-200/70",
  }[tone];

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

function statusTone(
  status: string,
):
  | "neutral"
  | "green"
  | "amber"
  | "blue"
  | "red"
  | "purple" {
  switch (status) {
    case "OPEN":
    case "ACTIVE":
    case "HIRED":
    case "ACCEPTED":
    case "COMPLETED":
      return "green";

    case "PAUSED":
    case "SCREENING":
    case "ASSESSMENT":
    case "APPROVAL_PENDING":
      return "amber";

    case "INTERVIEW":
    case "FINAL_INTERVIEW":
    case "SCHEDULED":
    case "SENT":
    case "VIEWED":
      return "blue";

    case "CANCELLED":
    case "REJECTED":
    case "DECLINED":
    case "WITHDRAWN":
      return "red";

    case "OFFER":
    case "SHORTLISTED":
      return "purple";

    default:
      return "neutral";
  }
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group min-w-0 rounded-[22px] border border-neutral-200/80 bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition",
        onClick &&
          "hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
          {icon}
        </div>

        {onClick ? (
          <ArrowRight
            size={15}
            className="mt-1 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-600"
          />
        ) : null}
      </div>

      <div className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-neutral-950">
        {value.toLocaleString("en-GB")}
      </div>

      <div className="mt-1 text-sm font-medium text-neutral-700">
        {label}
      </div>

      {hint ? (
        <div className="mt-1 text-xs leading-5 text-neutral-400">
          {hint}
        </div>
      ) : null}
    </button>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[26px] border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-neutral-500 shadow-sm ring-1 ring-neutral-200">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-neutral-900">
        {title}
      </h3>

      <p className="mt-1.5 max-w-sm text-sm leading-6 text-neutral-500">
        {description}
      </p>

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function SpinnerBlock({
  label = "Loading recruitment…",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Loader2 size={17} className="animate-spin" />
        {label}
      </div>
    </div>
  );
}

function ErrorBlock({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[26px] border border-red-100 bg-red-50/40 p-8 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-red-500 shadow-sm">
        <X size={18} />
      </div>

      <div className="mt-4 text-sm font-semibold text-neutral-900">
        Couldn&apos;t load recruitment
      </div>

      <div className="mt-1 max-w-md text-sm leading-6 text-neutral-500">
        {message}
      </div>

      <button
        type="button"
        onClick={retry}
        className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-semibold text-white transition hover:bg-neutral-800"
      >
        <RefreshCw size={14} />
        Try again
      </button>
    </div>
  );
}

/* =============================================================================
   MAIN COMPONENT
============================================================================= */

export default function RecruitmentTab() {
  const [section, setSection] =
    useState<RecruitmentSection>("overview");

  const [options, setOptions] =
    useState<RecruitmentOptions | null>(null);

  const [overview, setOverview] =
    useState<RecruitmentOverview | null>(null);

  const [jobs, setJobs] = useState<JobListItem[]>([]);

  const [loadingOverview, setLoadingOverview] =
    useState(true);

  const [loadingJobs, setLoadingJobs] =
    useState(true);

  const [loadingOptions, setLoadingOptions] =
    useState(true);

  const [overviewError, setOverviewError] =
    useState("");

  const [jobsError, setJobsError] = useState("");

  const [newJobOpen, setNewJobOpen] =
    useState(false);

  const [selectedJobId, setSelectedJobId] =
    useState<string | null>(null);

  const [refreshKey, setRefreshKey] =
    useState(0);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);

    try {
      const response = await fetch(
        "/api/admin/recruitment/options",
        {
          cache: "no-store",
        },
      );

      const data =
        await readJson<RecruitmentOptions>(response);

      setOptions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    setOverviewError("");

    try {
      const response = await fetch(
        "/api/admin/recruitment/overview",
        {
          cache: "no-store",
        },
      );

      const data =
        await readJson<RecruitmentOverview>(response);

      setOverview(data);
    } catch (error) {
      setOverviewError(
        error instanceof Error
          ? error.message
          : "Unable to load recruitment overview.",
      );
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    setJobsError("");

    try {
      const response = await fetch(
        "/api/admin/recruitment/jobs",
        {
          cache: "no-store",
        },
      );

      const data = await readJson<{
        jobs: JobListItem[];
        count: number;
      }>(response);

      setJobs(data.jobs);
    } catch (error) {
      setJobsError(
        error instanceof Error
          ? error.message
          : "Unable to load jobs.",
      );
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      loadOptions(),
      loadOverview(),
      loadJobs(),
    ]);
  }, [
    loadJobs,
    loadOptions,
    loadOverview,
    refreshKey,
  ]);

  const refreshAll = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  return (
    <div className="min-w-0">
      <RecruitmentHeader
        section={section}
        onNewJob={() => setNewJobOpen(true)}
        onRefresh={refreshAll}
      />

      <RecruitmentNavigation
        section={section}
        onChange={setSection}
        metrics={overview?.metrics}
      />

      <div className="mt-6">
        {section === "overview" ? (
          <OverviewSection
            data={overview}
            loading={loadingOverview}
            error={overviewError}
            onRetry={loadOverview}
            onSectionChange={setSection}
            onNewJob={() => setNewJobOpen(true)}
          />
        ) : null}

        {section === "jobs" ? (
          <JobsSection
            jobs={jobs}
            options={options}
            loading={loadingJobs}
            error={jobsError}
            onRetry={loadJobs}
            onNewJob={() => setNewJobOpen(true)}
            onSelectJob={setSelectedJobId}
          />
        ) : null}

        {section === "candidates" ? (
          <ComingSection
            icon={<Users size={21} />}
            eyebrow="Candidates"
            title="Candidate management"
            description="Candidate profiles, applications, documents, notes and activity will live here. This is the next Recruitment module we'll connect."
          />
        ) : null}

        {section === "pipeline" ? (
          <PipelinePreview
            pipeline={overview?.pipeline ?? []}
          />
        ) : null}

        {section === "interviews" ? (
          <ComingSection
            icon={<CalendarClock size={21} />}
            eyebrow="Interviews"
            title="Interview centre"
            description="Schedule interviews, assign interviewers, collect structured feedback and keep every candidate interview in one place."
          />
        ) : null}

        {section === "offers" ? (
          <ComingSection
            icon={<FileText size={21} />}
            eyebrow="Offers"
            title="Offer management"
            description="Prepare, approve, send and track employment offers before successful candidates are converted into employees."
          />
        ) : null}

        {section === "talent-pool" ? (
          <ComingSection
            icon={<Sparkles size={21} />}
            eyebrow="Talent Pool"
            title="Keep strong candidates close"
            description="Candidates worth considering for future Syntra Grid roles will be retained here without keeping an old application active."
          />
        ) : null}
      </div>

      <NewJobDrawer
        open={newJobOpen}
        options={options}
        loadingOptions={loadingOptions}
        onClose={() => setNewJobOpen(false)}
        onCreated={(job) => {
          setJobs((current) => [job, ...current]);
          setNewJobOpen(false);
          setSection("jobs");
          refreshAll();
        }}
      />

      <JobDetailDrawer
        jobId={selectedJobId}
        onClose={() => setSelectedJobId(null)}
        onChanged={() => {
          void loadJobs();
          void loadOverview();
        }}
      />
    </div>
  );
}

/* =============================================================================
   HEADER
============================================================================= */

function RecruitmentHeader({
  section,
  onNewJob,
  onRefresh,
}: {
  section: RecruitmentSection;
  onNewJob: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
          <UsersRound size={14} />
          Company
          <ChevronRight size={13} />
          Recruitment
        </div>

        <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.045em] text-neutral-950">
          Recruitment
        </h1>

        <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
          Manage Syntra Grid&apos;s roles, candidates,
          interviews, offers and hiring pipeline.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-500 transition hover:border-neutral-300 hover:text-neutral-900"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>

        <button
          type="button"
          onClick={onNewJob}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
        >
          <Plus size={16} />
          New job
        </button>
      </div>
    </div>
  );
}

/* =============================================================================
   NAVIGATION
============================================================================= */

function RecruitmentNavigation({
  section,
  onChange,
  metrics,
}: {
  section: RecruitmentSection;
  onChange: (value: RecruitmentSection) => void;
  metrics?: RecruitmentMetrics;
}) {
  function countFor(id: RecruitmentSection) {
    switch (id) {
      case "jobs":
        return metrics?.openRoles;
      case "candidates":
        return metrics?.totalCandidates;
      case "interviews":
        return metrics?.interviewsThisWeek;
      case "offers":
        return metrics?.pendingOffers;
      case "talent-pool":
        return metrics?.talentPool;
      default:
        return undefined;
    }
  }

  return (
    <div className="mt-6 overflow-x-auto border-b border-neutral-200">
      <div className="flex min-w-max gap-1">
        {SECTIONS.map((item) => {
          const active = section === item.id;
          const count = countFor(item.id);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={cx(
                "relative flex h-11 items-center gap-2 px-3 text-sm font-medium transition",
                active
                  ? "text-neutral-950"
                  : "text-neutral-500 hover:text-neutral-800",
              )}
            >
              <span
                className={cx(
                  active
                    ? "text-neutral-900"
                    : "text-neutral-400",
                )}
              >
                {item.icon}
              </span>

              {item.label}

              {typeof count === "number" &&
              count > 0 ? (
                <span
                  className={cx(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    active
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-500",
                  )}
                >
                  {count}
                </span>
              ) : null}

              {active ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-neutral-950" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =============================================================================
   OVERVIEW
============================================================================= */

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
    return <SpinnerBlock />;
  }

  if (error && !data) {
    return (
      <ErrorBlock
        message={error}
        retry={onRetry}
      />
    );
  }

  if (!data) return null;

  const { metrics } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          icon={<BriefcaseBusiness size={17} />}
          label="Open roles"
          value={metrics.openRoles}
          hint="Currently hiring"
          onClick={() => onSectionChange("jobs")}
        />

        <MetricCard
          icon={<Users size={17} />}
          label="Candidates"
          value={metrics.totalCandidates}
          hint="Active records"
          onClick={() =>
            onSectionChange("candidates")
          }
        />

        <MetricCard
          icon={<Target size={17} />}
          label="Applications"
          value={metrics.activeApplications}
          hint="In active pipelines"
          onClick={() =>
            onSectionChange("pipeline")
          }
        />

        <MetricCard
          icon={<CalendarClock size={17} />}
          label="Interviews"
          value={metrics.interviewsThisWeek}
          hint="Next 7 days"
          onClick={() =>
            onSectionChange("interviews")
          }
        />

        <MetricCard
          icon={<FileText size={17} />}
          label="Pending offers"
          value={metrics.pendingOffers}
          hint="Awaiting outcome"
          onClick={() => onSectionChange("offers")}
        />

        <MetricCard
          icon={<UserCheck size={17} />}
          label="Hired"
          value={metrics.hiresThisMonth}
          hint="This month"
        />
      </div>

      <PipelineOverview
        pipeline={data.pipeline}
        onOpen={() => onSectionChange("pipeline")}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <RecentApplications
          applications={data.recentApplications}
          onOpenCandidates={() =>
            onSectionChange("candidates")
          }
        />

        <UpcomingInterviews
          interviews={data.upcomingInterviews}
          onOpen={() =>
            onSectionChange("interviews")
          }
        />
      </div>

      {metrics.openRoles === 0 ? (
        <div className="flex flex-col gap-4 rounded-[24px] border border-neutral-200 bg-neutral-950 p-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">
              No roles are currently open
            </div>

            <div className="mt-1 text-sm text-white/55">
              Create the first vacancy and start
              building your recruitment pipeline.
            </div>
          </div>

          <button
            type="button"
            onClick={onNewJob}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-neutral-950"
          >
            <Plus size={14} />
            Create job
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PipelineOverview({
  pipeline,
  onOpen,
}: {
  pipeline: PipelineItem[];
  onOpen: () => void;
}) {
  const map = new Map(
    pipeline.map((item) => [item.stage, item.count]),
  );

  const total = pipeline.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  return (
    <div className="rounded-[26px] border border-neutral-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-950">
            Hiring pipeline
          </h2>

          <p className="mt-1 text-xs text-neutral-500">
            {total} active application
            {total === 1 ? "" : "s"} across all stages.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 transition hover:text-neutral-950"
        >
          Open pipeline
          <ArrowRight size={13} />
        </button>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        {PIPELINE_ORDER.map((stage, index) => {
          const count = map.get(stage) ?? 0;

          return (
            <div
              key={stage}
              className="relative rounded-2xl bg-neutral-50 p-3 ring-1 ring-inset ring-neutral-100"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                {index + 1}
              </div>

              <div className="mt-3 text-xl font-semibold tracking-[-0.03em] text-neutral-950">
                {count}
              </div>

              <div className="mt-1 truncate text-[11px] font-medium text-neutral-600">
                {prettyEnum(stage)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentApplications({
  applications,
  onOpenCandidates,
}: {
  applications: RecentApplication[];
  onOpenCandidates: () => void;
}) {
  return (
    <div className="rounded-[26px] border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-neutral-950">
            Recent applications
          </div>

          <div className="mt-0.5 text-xs text-neutral-400">
            Latest people entering the pipeline
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCandidates}
          className="text-xs font-semibold text-neutral-500 hover:text-neutral-950"
        >
          View all
        </button>
      </div>

      {applications.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-neutral-400">
          No applications yet.
        </div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {applications.map((application) => (
            <div
              key={application.id}
              className="flex items-center gap-3 px-5 py-3.5"
            >
              <Avatar
                person={application.candidate}
                size="sm"
              />

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-neutral-800">
                  {personName(application.candidate)}
                </div>

                <div className="mt-0.5 truncate text-xs text-neutral-400">
                  {application.jobOpening.title}
                </div>
              </div>

              <div className="hidden text-right sm:block">
                <Pill
                  tone={statusTone(
                    application.stage,
                  )}
                >
                  {prettyEnum(application.stage)}
                </Pill>

                <div className="mt-1.5 text-[10px] text-neutral-400">
                  {formatDate(application.appliedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UpcomingInterviews({
  interviews,
  onOpen,
}: {
  interviews: UpcomingInterview[];
  onOpen: () => void;
}) {
  return (
    <div className="rounded-[26px] border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
        <div>
          <div className="text-sm font-semibold text-neutral-950">
            Upcoming interviews
          </div>

          <div className="mt-0.5 text-xs text-neutral-400">
            Next scheduled conversations
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="text-xs font-semibold text-neutral-500 hover:text-neutral-950"
        >
          Calendar
        </button>
      </div>

      {interviews.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-neutral-400">
          No upcoming interviews.
        </div>
      ) : (
        <div className="divide-y divide-neutral-100">
          {interviews.map((interview) => (
            <div
              key={interview.id}
              className="flex items-center gap-3 px-5 py-3.5"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-500">
                <CalendarClock size={15} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-neutral-800">
                  {personName(
                    interview.application.candidate,
                  )}
                </div>

                <div className="mt-0.5 truncate text-xs text-neutral-400">
                  {
                    interview.application.jobOpening
                      .title
                  }
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-semibold text-neutral-700">
                  {formatDateTime(
                    interview.scheduledAt,
                  )}
                </div>

                <div className="mt-1 text-[10px] text-neutral-400">
                  {prettyEnum(interview.type)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =============================================================================
   JOBS
============================================================================= */

function JobsSection({
  jobs,
  options,
  loading,
  error,
  onRetry,
  onNewJob,
  onSelectJob,
}: {
  jobs: JobListItem[];
  options: RecruitmentOptions | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onNewJob: () => void;
  onSelectJob: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [department, setDepartment] =
    useState("ALL");
  const [employmentType, setEmploymentType] =
    useState("ALL");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return jobs.filter((job) => {
      if (
        query &&
        ![
          job.title,
          job.jobRef,
          job.description,
          job.department?.name,
          job.city,
          job.country,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query),
          )
      ) {
        return false;
      }

      if (
        status !== "ALL" &&
        job.status !== status
      ) {
        return false;
      }

      if (
        department !== "ALL" &&
        job.department?.id !== department
      ) {
        return false;
      }

      if (
        employmentType !== "ALL" &&
        job.employmentType !== employmentType
      ) {
        return false;
      }

      return true;
    });
  }, [
    jobs,
    search,
    status,
    department,
    employmentType,
  ]);

  if (loading && jobs.length === 0) {
    return <SpinnerBlock label="Loading jobs…" />;
  }

  if (error && jobs.length === 0) {
    return (
      <ErrorBlock
        message={error}
        retry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.025em] text-neutral-950">
            Job openings
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Create and manage vacancies across Syntra
            Grid.
          </p>
        </div>

        <button
          type="button"
          onClick={onNewJob}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          <Plus size={16} />
          New job
        </button>
      </div>

      <div className="rounded-[24px] border border-neutral-200 bg-white p-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_180px_200px_190px]">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search jobs…"
              className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white"
            />
          </div>

          <FilterSelect
            value={status}
            onChange={setStatus}
            options={[
              {
                value: "ALL",
                label: "All statuses",
              },
              ...(options?.jobStatuses ?? []).map(
                (item) => ({
                  value: item,
                  label: prettyEnum(item),
                }),
              ),
            ]}
          />

          <FilterSelect
            value={department}
            onChange={setDepartment}
            options={[
              {
                value: "ALL",
                label: "All departments",
              },
              ...(options?.departments ?? []).map(
                (item) => ({
                  value: item.id,
                  label: item.name,
                }),
              ),
            ]}
          />

          <FilterSelect
            value={employmentType}
            onChange={setEmploymentType}
            options={[
              {
                value: "ALL",
                label: "All employment",
              },
              ...(options?.employmentTypes ?? []).map(
                (item) => ({
                  value: item,
                  label: prettyEnum(item),
                }),
              ),
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BriefcaseBusiness size={20} />}
          title={
            jobs.length === 0
              ? "No jobs yet"
              : "No matching jobs"
          }
          description={
            jobs.length === 0
              ? "Create your first Syntra Grid vacancy to start receiving candidates."
              : "Try changing your search or filters."
          }
          action={
            jobs.length === 0 ? (
              <button
                type="button"
                onClick={onNewJob}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-xs font-semibold text-white"
              >
                <Plus size={14} />
                Create job
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onClick={() => onSelectJob(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-10 w-full appearance-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 pr-9 text-sm text-neutral-700 outline-none transition focus:border-neutral-400 focus:bg-white"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
      />
    </div>
  );
}

function JobCard({
  job,
  onClick,
}: {
  job: JobListItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-[24px] border border-neutral-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={statusTone(job.status)}>
              {prettyEnum(job.status)}
            </Pill>

            {job.published ? (
              <Pill tone="green">
                <Globe2 size={10} />
                Published
              </Pill>
            ) : null}
          </div>

          <h3 className="mt-4 truncate text-base font-semibold tracking-[-0.02em] text-neutral-950">
            {job.title}
          </h3>

          <div className="mt-1 text-xs font-medium text-neutral-400">
            {job.jobRef || "No job reference"}
          </div>
        </div>

        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-neutral-50 text-neutral-400 transition group-hover:bg-neutral-950 group-hover:text-white">
          <ArrowRight size={15} />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <Building2 size={13} />
          {job.department?.name || "No department"}
        </span>

        <span className="inline-flex items-center gap-1.5">
          <BriefcaseBusiness size={13} />
          {prettyEnum(job.employmentType)}
        </span>

        {job.workArrangement ? (
          <span className="inline-flex items-center gap-1.5">
            <Globe2 size={13} />
            {prettyEnum(job.workArrangement)}
          </span>
        ) : null}

        {job.city || job.country ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={13} />
            {[job.city, job.country]
              .filter(Boolean)
              .join(", ")}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 border-t border-neutral-100 pt-4 sm:grid-cols-4">
        <JobMiniStat
          label="Applicants"
          value={String(job.applicationCount)}
        />

        <JobMiniStat
          label="Vacancies"
          value={String(job.vacancies)}
        />

        <JobMiniStat
          label="Salary"
          value={salaryLabel(job)}
        />

        <JobMiniStat
          label="Closes"
          value={
            job.closesAt
              ? formatDate(job.closesAt, {
                  year: undefined,
                })
              : "No deadline"
          }
        />
      </div>

      {job.hiringManager ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2.5">
          <Avatar
            person={job.hiringManager}
            size="sm"
          />

          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-400">
              Hiring manager
            </div>

            <div className="truncate text-xs font-semibold text-neutral-700">
              {personName(job.hiringManager)}
            </div>
          </div>
        </div>
      ) : null}
    </button>
  );
}

function JobMiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-neutral-400">
        {label}
      </div>

      <div className="mt-1 truncate text-xs font-semibold text-neutral-700">
        {value}
      </div>
    </div>
  );
}

/* =============================================================================
   PIPELINE PREVIEW
============================================================================= */

function PipelinePreview({
  pipeline,
}: {
  pipeline: PipelineItem[];
}) {
  const map = new Map(
    pipeline.map((item) => [item.stage, item.count]),
  );

  return (
    <div>
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.025em] text-neutral-950">
          Hiring pipeline
        </h2>

        <p className="mt-1 text-sm text-neutral-500">
          Candidate movement across every recruitment
          stage.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PIPELINE_ORDER.map((stage, index) => (
          <div
            key={stage}
            className="rounded-[22px] border border-neutral-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-neutral-100 text-[10px] font-bold text-neutral-500">
                {index + 1}
              </span>

              <Pill tone={statusTone(stage)}>
                {prettyEnum(stage)}
              </Pill>
            </div>

            <div className="mt-8 text-3xl font-semibold tracking-[-0.05em] text-neutral-950">
              {map.get(stage) ?? 0}
            </div>

            <div className="mt-1 text-xs text-neutral-400">
              active candidate
              {(map.get(stage) ?? 0) === 1
                ? ""
                : "s"}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <EmptyState
          icon={<Target size={20} />}
          title="Kanban pipeline comes next"
          description="Once the Candidates and Applications APIs are connected, this becomes the drag-and-manage recruitment board."
        />
      </div>
    </div>
  );
}

/* =============================================================================
   COMING SECTIONS
============================================================================= */

function ComingSection({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-400">
          {eyebrow}
        </div>

        <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-neutral-950">
          {title}
        </h2>
      </div>

      <EmptyState
        icon={icon}
        title={title}
        description={description}
      />
    </div>
  );
}

/* =============================================================================
   NEW JOB DRAWER
============================================================================= */

function NewJobDrawer({
  open,
  options,
  loadingOptions,
  onClose,
  onCreated,
}: {
  open: boolean;
  options: RecruitmentOptions | null;
  loadingOptions: boolean;
  onClose: () => void;
  onCreated: (job: JobListItem) => void;
}) {
  const [form, setForm] =
    useState<JobForm>(EMPTY_JOB_FORM);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(EMPTY_JOB_FORM);
      setError("");
    }
  }, [open]);

  if (!open) return null;

  function update<K extends keyof JobForm>(
    key: K,
    value: JobForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit() {
    if (!form.title.trim()) {
      setError("Job title is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/recruitment/jobs",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: form.title,
            departmentId:
              form.departmentId || null,
            hiringManagerId:
              form.hiringManagerId || null,

            description: form.description,
            responsibilities:
              form.responsibilities,
            requirements: form.requirements,
            benefits: form.benefits,

            employmentType:
              form.employmentType,
            workArrangement:
              form.workArrangement || null,

            country: form.country,
            city: form.city,

            salaryMin: form.salaryMin || null,
            salaryMax: form.salaryMax || null,
            currency: form.currency || null,

            vacancies: Number(form.vacancies),

            status: form.status,

            openedAt: form.openedAt || null,
            closesAt: form.closesAt || null,
            targetStartDate:
              form.targetStartDate || null,

            published: form.published,
          }),
        },
      );

      const data = await readJson<{
        job: JobListItem;
      }>(response);

      onCreated({
        ...data.job,
        applicationCount:
          data.job.applicationCount ?? 0,
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create job.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <DrawerShell
      title="Create job"
      subtitle="Add a new Syntra Grid vacancy."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={saving || loadingOptions}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2
                size={15}
                className="animate-spin"
              />
            ) : (
              <Plus size={15} />
            )}

            Create job
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <FormSection
          title="Role"
          description="Core information about the vacancy."
        >
          <FormField
            label="Job title"
            required
          >
            <input
              value={form.title}
              onChange={(event) =>
                update("title", event.target.value)
              }
              placeholder="e.g. Product Designer"
              className={inputClass}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Department">
              <select
                value={form.departmentId}
                onChange={(event) =>
                  update(
                    "departmentId",
                    event.target.value,
                  )
                }
                className={inputClass}
              >
                <option value="">
                  No department
                </option>

                {options?.departments.map(
                  (department) => (
                    <option
                      key={department.id}
                      value={department.id}
                    >
                      {department.name}
                    </option>
                  ),
                )}
              </select>
            </FormField>

            <FormField label="Hiring manager">
              <select
                value={form.hiringManagerId}
                onChange={(event) =>
                  update(
                    "hiringManagerId",
                    event.target.value,
                  )
                }
                className={inputClass}
              >
                <option value="">
                  No hiring manager
                </option>

                {options?.hiringManagers.map(
                  (manager) => (
                    <option
                      key={manager.id}
                      value={manager.id}
                    >
                      {personName(manager)}
                    </option>
                  ),
                )}
              </select>
            </FormField>
          </div>

          <FormField label="Description">
            <textarea
              value={form.description}
              onChange={(event) =>
                update(
                  "description",
                  event.target.value,
                )
              }
              rows={4}
              placeholder="Describe the role and its purpose…"
              className={textareaClass}
            />
          </FormField>
        </FormSection>

        <FormSection
          title="Employment"
          description="How this person will work with Syntra Grid."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Employment type"
              required
            >
              <select
                value={form.employmentType}
                onChange={(event) =>
                  update(
                    "employmentType",
                    event.target.value,
                  )
                }
                className={inputClass}
              >
                {(
                  options?.employmentTypes ?? [
                    "FULL_TIME",
                    "PART_TIME",
                    "CONTRACTOR",
                    "INTERN",
                    "TEMPORARY",
                  ]
                ).map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {prettyEnum(value)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Work arrangement">
              <select
                value={form.workArrangement}
                onChange={(event) =>
                  update(
                    "workArrangement",
                    event.target.value,
                  )
                }
                className={inputClass}
              >
                <option value="">Not set</option>

                {(
                  options?.workArrangements ?? [
                    "REMOTE",
                    "HYBRID",
                    "ONSITE",
                  ]
                ).map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {prettyEnum(value)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="City">
              <input
                value={form.city}
                onChange={(event) =>
                  update("city", event.target.value)
                }
                placeholder="e.g. London"
                className={inputClass}
              />
            </FormField>

            <FormField label="Country">
              <input
                value={form.country}
                onChange={(event) =>
                  update(
                    "country",
                    event.target.value,
                  )
                }
                placeholder="e.g. United Kingdom"
                className={inputClass}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection
          title="Compensation"
          description="Optional salary range for the role."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Currency">
              <select
                value={form.currency}
                onChange={(event) =>
                  update(
                    "currency",
                    event.target.value,
                  )
                }
                className={inputClass}
              >
                {(
                  options?.currencies ?? [
                    "GBP",
                    "NGN",
                    "USD",
                    "EUR",
                  ]
                ).map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Minimum">
              <input
                type="number"
                min="0"
                value={form.salaryMin}
                onChange={(event) =>
                  update(
                    "salaryMin",
                    event.target.value,
                  )
                }
                placeholder="0"
                className={inputClass}
              />
            </FormField>

            <FormField label="Maximum">
              <input
                type="number"
                min="0"
                value={form.salaryMax}
                onChange={(event) =>
                  update(
                    "salaryMax",
                    event.target.value,
                  )
                }
                placeholder="0"
                className={inputClass}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection
          title="Hiring plan"
          description="Vacancies, dates and initial job status."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Vacancies"
              required
            >
              <input
                type="number"
                min="1"
                step="1"
                value={form.vacancies}
                onChange={(event) =>
                  update(
                    "vacancies",
                    event.target.value,
                  )
                }
                className={inputClass}
              />
            </FormField>

            <FormField label="Status">
              <select
                value={form.status}
                onChange={(event) =>
                  update(
                    "status",
                    event.target.value,
                  )
                }
                className={inputClass}
              >
                {(
                  options?.jobStatuses ?? [
                    "DRAFT",
                    "OPEN",
                    "PAUSED",
                    "CLOSED",
                    "FILLED",
                    "CANCELLED",
                  ]
                ).map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {prettyEnum(value)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Open date">
              <input
                type="date"
                value={form.openedAt}
                onChange={(event) =>
                  update(
                    "openedAt",
                    event.target.value,
                  )
                }
                className={inputClass}
              />
            </FormField>

            <FormField label="Closing date">
              <input
                type="date"
                value={form.closesAt}
                onChange={(event) =>
                  update(
                    "closesAt",
                    event.target.value,
                  )
                }
                className={inputClass}
              />
            </FormField>

            <FormField label="Target start">
              <input
                type="date"
                value={form.targetStartDate}
                onChange={(event) =>
                  update(
                    "targetStartDate",
                    event.target.value,
                  )
                }
                className={inputClass}
              />
            </FormField>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-neutral-200 p-4">
            <div>
              <div className="text-sm font-semibold text-neutral-800">
                Publish role
              </div>

              <div className="mt-1 text-xs leading-5 text-neutral-400">
                Mark this vacancy as published and
                available for future careers-page
                integration.
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={form.published}
              onClick={() =>
                update(
                  "published",
                  !form.published,
                )
              }
              className={cx(
                "relative h-6 w-11 shrink-0 rounded-full transition",
                form.published
                  ? "bg-neutral-950"
                  : "bg-neutral-200",
              )}
            >
              <span
                className={cx(
                  "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition",
                  form.published
                    ? "left-6"
                    : "left-1",
                )}
              />
            </button>
          </label>
        </FormSection>

        <FormSection
          title="Job details"
          description="Information used during candidate evaluation."
        >
          <FormField label="Responsibilities">
            <textarea
              value={form.responsibilities}
              onChange={(event) =>
                update(
                  "responsibilities",
                  event.target.value,
                )
              }
              rows={5}
              placeholder="Main responsibilities…"
              className={textareaClass}
            />
          </FormField>

          <FormField label="Requirements">
            <textarea
              value={form.requirements}
              onChange={(event) =>
                update(
                  "requirements",
                  event.target.value,
                )
              }
              rows={5}
              placeholder="Experience, skills and requirements…"
              className={textareaClass}
            />
          </FormField>

          <FormField label="Benefits">
            <textarea
              value={form.benefits}
              onChange={(event) =>
                update(
                  "benefits",
                  event.target.value,
                )
              }
              rows={4}
              placeholder="Benefits and additional details…"
              className={textareaClass}
            />
          </FormField>
        </FormSection>
      </div>
    </DrawerShell>
  );
}

/* =============================================================================
   JOB DETAIL DRAWER
============================================================================= */

function JobDetailDrawer({
  jobId,
  onClose,
  onChanged,
}: {
  jobId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [job, setJob] =
    useState<JobDetail | null>(null);

  const [stageCounts, setStageCounts] = useState<
    StageCount[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] =
    useState(false);

  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!jobId) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/recruitment/jobs/${jobId}`,
        {
          cache: "no-store",
        },
      );

      const data = await readJson<{
        job: JobDetail;
        stageCounts: StageCount[];
      }>(response);

      setJob(data.job);
      setStageCounts(data.stageCounts);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load job.",
      );
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) {
      void load();
    } else {
      setJob(null);
      setStageCounts([]);
      setError("");
    }
  }, [jobId, load]);

  if (!jobId) return null;

  async function updateStatus(status: string) {
    if (!job) return;

    setActioning(true);

    try {
      const response = await fetch(
        `/api/admin/recruitment/jobs/${job.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
          }),
        },
      );

      await readJson(response);
      await load();
      onChanged();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update job.",
      );
    } finally {
      setActioning(false);
    }
  }

  return (
    <DrawerShell
      title={job?.title || "Job opening"}
      subtitle={
        job?.jobRef || "Recruitment job detail"
      }
      onClose={onClose}
      wide
      footer={
        job ? (
          <>
            {job.status !== "CANCELLED" &&
            job.status !== "FILLED" ? (
              <button
                type="button"
                disabled={actioning}
                onClick={() =>
                  updateStatus("CANCELLED")
                }
                className="h-10 rounded-xl border border-neutral-200 px-4 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancel role
              </button>
            ) : (
              <div />
            )}

            {job.status !== "OPEN" ? (
              <button
                type="button"
                disabled={actioning}
                onClick={() => updateStatus("OPEN")}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {actioning ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                Open role
              </button>
            ) : (
              <button
                type="button"
                disabled={actioning}
                onClick={() =>
                  updateStatus("PAUSED")
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Pause role
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white"
          >
            Close
          </button>
        )
      }
    >
      {loading && !job ? (
        <SpinnerBlock label="Loading job…" />
      ) : error && !job ? (
        <ErrorBlock
          message={error}
          retry={load}
        />
      ) : job ? (
        <div className="space-y-6">
          {error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-xs text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={statusTone(job.status)}>
              {prettyEnum(job.status)}
            </Pill>

            <Pill>
              {prettyEnum(job.employmentType)}
            </Pill>

            {job.workArrangement ? (
              <Pill>
                {prettyEnum(job.workArrangement)}
              </Pill>
            ) : null}

            {job.published ? (
              <Pill tone="green">
                <Globe2 size={10} />
                Published
              </Pill>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailStat
              label="Applicants"
              value={String(job.applications.length)}
            />

            <DetailStat
              label="Vacancies"
              value={String(job.vacancies)}
            />

            <DetailStat
              label="Salary"
              value={salaryLabel(job)}
            />

            <DetailStat
              label="Closing date"
              value={
                job.closesAt
                  ? formatDate(job.closesAt)
                  : "No deadline"
              }
            />
          </div>

          <div className="rounded-[22px] border border-neutral-200 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailLine
                icon={<Building2 size={15} />}
                label="Department"
                value={
                  job.department?.name ||
                  "Not assigned"
                }
              />

              <DetailLine
                icon={<MapPin size={15} />}
                label="Location"
                value={
                  [job.city, job.country]
                    .filter(Boolean)
                    .join(", ") || "Not specified"
                }
              />

              <DetailLine
                icon={<Clock3 size={15} />}
                label="Opened"
                value={formatDate(job.openedAt)}
              />

              <DetailLine
                icon={<CalendarClock size={15} />}
                label="Target start"
                value={formatDate(
                  job.targetStartDate,
                )}
              />
            </div>

            {job.hiringManager ? (
              <div className="mt-4 border-t border-neutral-100 pt-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                  Hiring manager
                </div>

                <div className="flex items-center gap-3">
                  <Avatar
                    person={job.hiringManager}
                    size="sm"
                  />

                  <div>
                    <div className="text-sm font-semibold text-neutral-800">
                      {personName(
                        job.hiringManager,
                      )}
                    </div>

                    <div className="text-xs text-neutral-400">
                      {job.hiringManager.email}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <JobTextSection
            title="About the role"
            text={job.description}
          />

          <JobTextSection
            title="Responsibilities"
            text={job.responsibilities}
          />

          <JobTextSection
            title="Requirements"
            text={job.requirements}
          />

          <JobTextSection
            title="Benefits"
            text={job.benefits}
          />

          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">
                  Applicants
                </h3>

                <p className="mt-1 text-xs text-neutral-400">
                  Candidates attached to this vacancy.
                </p>
              </div>

              <div className="text-xs font-semibold text-neutral-500">
                {job.applications.length}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {stageCounts.map((item) => (
                <Pill
                  key={item.stage}
                  tone={statusTone(item.stage)}
                >
                  {prettyEnum(item.stage)}
                  <span className="opacity-60">
                    {item.count}
                  </span>
                </Pill>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-[20px] border border-neutral-200">
              {job.applications.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-neutral-400">
                  No candidates have applied for this
                  role yet.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {job.applications.map(
                    (application) => (
                      <div
                        key={application.id}
                        className="flex items-center gap-3 px-4 py-3.5"
                      >
                        <Avatar
                          person={
                            application.candidate
                          }
                          size="sm"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-neutral-800">
                            {personName(
                              application.candidate,
                            )}
                          </div>

                          <div className="mt-0.5 truncate text-xs text-neutral-400">
                            {application.candidate
                              .currentJobTitle ||
                              application.candidate
                                .email ||
                              "Candidate"}
                          </div>
                        </div>

                        <div className="text-right">
                          <Pill
                            tone={statusTone(
                              application.stage,
                            )}
                          >
                            {prettyEnum(
                              application.stage,
                            )}
                          </Pill>

                          <div className="mt-1.5 text-[10px] text-neutral-400">
                            {formatDate(
                              application.appliedAt,
                            )}
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </DrawerShell>
  );
}

function DetailStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-3.5 ring-1 ring-inset ring-neutral-100">
      <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-neutral-400">
        {label}
      </div>

      <div className="mt-2 truncate text-sm font-semibold text-neutral-800">
        {value}
      </div>
    </div>
  );
}

function DetailLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-neutral-400">
        {icon}
      </div>

      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.07em] text-neutral-400">
          {label}
        </div>

        <div className="mt-1 text-sm font-medium text-neutral-700">
          {value}
        </div>
      </div>
    </div>
  );
}

function JobTextSection({
  title,
  text,
}: {
  title: string;
  text: string | null;
}) {
  if (!text) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-neutral-900">
        {title}
      </h3>

      <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-neutral-600">
        {text}
      </div>
    </div>
  );
}

/* =============================================================================
   DRAWER + FORMS
============================================================================= */

function DrawerShell({
  title,
  subtitle,
  onClose,
  footer,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
      />

      <div
        className={cx(
          "absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.10)]",
          wide
            ? "max-w-3xl"
            : "max-w-2xl",
        )}
      >
        <div className="flex h-[74px] shrink-0 items-center justify-between border-b border-neutral-200 px-5 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-[-0.02em] text-neutral-950">
              {title}
            </h2>

            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-neutral-400">
                {subtitle}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">
          {children}
        </div>

        <div className="flex min-h-[70px] shrink-0 items-center justify-between gap-3 border-t border-neutral-200 bg-white px-5 py-3 sm:px-6">
          {footer}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100";

const textareaClass =
  "w-full resize-y rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm leading-6 text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100";

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-neutral-900">
          {title}
        </h3>

        {description ? (
          <p className="mt-1 text-xs leading-5 text-neutral-400">
            {description}
          </p>
        ) : null}
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-neutral-600">
        {label}
        {required ? (
          <span className="ml-1 text-red-400">*</span>
        ) : null}
      </div>

      {children}
    </label>
  );
}