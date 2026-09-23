'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

import {
  BellRing,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Code2,
  Filter,
  Flag,
  FolderKanban,
  Headphones,
  Lock,
  MapPin,
  Plus,
  Rocket,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Users,
  Video,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';

/* ============================================================================
   TYPES
============================================================================ */

type CalendarView = 'month' | 'week' | 'agenda';

type EventType =
  | 'MEETING'
  | 'DEADLINE'
  | 'MILESTONE'
  | 'DEPLOYMENT'
  | 'RELEASE'
  | 'FINANCE'
  | 'SUPPORT'
  | 'MAINTENANCE'
  | 'COMPANY'
  | 'PERSONAL';

type EventPriority = 'LOW' | 'NORMAL' | 'HIGH';
type EventStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
type CalendarScope = 'PERSONAL' | 'TEAM' | 'COMPANY' | 'WORKSPACE';
type WorkspaceId = 'syntra' | 'rentwise' | 'esteem' | 'meldex' | 'zing';

type Person = { id: string; name: string; initials: string };

type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  startAt: string;
  endAt?: string;
  allDay: boolean;
  scope: CalendarScope;
  workspaceId?: WorkspaceId;
  workspaceLabel?: string;
  project?: string;
  owner: string;
  ownerInitials: string;
  createdBy?: string;
  attendees?: Person[];
  location?: string;
  meetingUrl?: string;
  priority: EventPriority;
  status: EventStatus;
  private?: boolean;
};

type EventTypeMeta = {
  label: string;
  icon: LucideIcon;
  dotClass: string;
  softClass: string;
  textClass: string;
  borderClass: string;
};

type NewEventForm = {
  title: string;
  type: EventType;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  workspaceId: WorkspaceId;
  location: string;
  description: string;
  priority: EventPriority;
};

type EventDraft = { date: Date; startTime?: string };

type Toast = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type PositionedEvent = {
  event: CalendarEvent;
  start: number;
  end: number;
  lane: number;
  lanes: number;
};

/* ============================================================================
   CONSTANTS
============================================================================ */

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_HEIGHT = 52;
const DEFAULT_SCROLL_HOUR = 7;
const AGENDA_DAYS = 30;
const MAX_MONTH_EVENTS = 3;
const DURATION_PRESETS = [15, 30, 60, 90, 120];

const WORKSPACES: Array<{ id: WorkspaceId; label: string; short: string }> = [
  { id: 'syntra', label: 'Syntra Grid', short: 'SG' },
  { id: 'rentwise', label: 'RentWise', short: 'RW' },
  { id: 'esteem', label: 'Esteem Learning Centre', short: 'EL' },
  { id: 'meldex', label: 'Meldex Industries', short: 'MI' },
  { id: 'zing', label: 'Zing', short: 'ZG' },
];

const EVENT_TYPES: Record<EventType, EventTypeMeta> = {
  MEETING: {
    label: 'Meeting',
    icon: Users,
    dotClass: 'bg-blue-500',
    softClass: 'bg-blue-500/10',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-l-blue-500',
  },
  DEADLINE: {
    label: 'Deadline',
    icon: Flag,
    dotClass: 'bg-red-500',
    softClass: 'bg-red-500/10',
    textClass: 'text-red-600 dark:text-red-400',
    borderClass: 'border-l-red-500',
  },
  MILESTONE: {
    label: 'Milestone',
    icon: Sparkles,
    dotClass: 'bg-violet-500',
    softClass: 'bg-violet-500/10',
    textClass: 'text-violet-600 dark:text-violet-400',
    borderClass: 'border-l-violet-500',
  },
  DEPLOYMENT: {
    label: 'Deployment',
    icon: Code2,
    dotClass: 'bg-emerald-500',
    softClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-l-emerald-500',
  },
  RELEASE: {
    label: 'Release',
    icon: Rocket,
    dotClass: 'bg-cyan-500',
    softClass: 'bg-cyan-500/10',
    textClass: 'text-cyan-600 dark:text-cyan-400',
    borderClass: 'border-l-cyan-500',
  },
  FINANCE: {
    label: 'Finance',
    icon: CircleDollarSign,
    dotClass: 'bg-amber-500',
    softClass: 'bg-amber-500/10',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-l-amber-500',
  },
  SUPPORT: {
    label: 'Support',
    icon: Headphones,
    dotClass: 'bg-orange-500',
    softClass: 'bg-orange-500/10',
    textClass: 'text-orange-600 dark:text-orange-400',
    borderClass: 'border-l-orange-500',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    icon: Wrench,
    dotClass: 'bg-slate-500',
    softClass: 'bg-slate-500/10',
    textClass: 'text-slate-600 dark:text-slate-400',
    borderClass: 'border-l-slate-500',
  },
  COMPANY: {
    label: 'Company',
    icon: BriefcaseBusiness,
    dotClass: 'bg-fuchsia-500',
    softClass: 'bg-fuchsia-500/10',
    textClass: 'text-fuchsia-600 dark:text-fuchsia-400',
    borderClass: 'border-l-fuchsia-500',
  },
  PERSONAL: {
    label: 'Personal',
    icon: CalendarDays,
    dotClass: 'bg-teal-500',
    softClass: 'bg-teal-500/10',
    textClass: 'text-teal-600 dark:text-teal-400',
    borderClass: 'border-l-teal-500',
  },
};

const ALL_TYPES = Object.keys(EVENT_TYPES) as EventType[];

/* Shared class strings ---------------------------------------------------- */

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]';

const PILL_BUTTON = `
  inline-flex h-9 items-center gap-2 rounded-full
  border border-[var(--line)] bg-[var(--surface)] px-3.5
  text-[12px] font-medium text-[var(--text-muted)]
  transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)]
  ${FOCUS_RING}
`;

const PRIMARY_BUTTON = `
  inline-flex h-9 items-center gap-2 rounded-full
  bg-[var(--primary)] px-4
  text-[12px] font-semibold text-[var(--primary-foreground)]
  shadow-[0_1px_2px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.12)]
  transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md active:translate-y-0
  ${FOCUS_RING}
`;

const INPUT = `
  h-10 w-full rounded-xl
  border border-[var(--line)] bg-[var(--surface)] px-3
  text-[13px] text-[var(--text)] outline-none transition
  placeholder:text-[var(--text-subtle)]
  hover:border-[var(--text-subtle)]/40
  focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10
`;

const CARD =
  'overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]';

/* Motion ------------------------------------------------------------------
   Enter is slower with a soft deceleration; exit is quicker and accelerates
   away, so closing feels responsive rather than sluggish. EXIT_MS must match
   the exit duration below. */

const EXIT_MS = 220;
const MOTION_ENTER = 'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';
const MOTION_EXIT = 'duration-[220ms] ease-[cubic-bezier(0.4,0,1,1)]';

/* ============================================================================
   DATE HELPERS
============================================================================ */

const pad = (value: number) => String(value).padStart(2, '0');

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfWeekMonday(date: Date) {
  const copy = startOfDay(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy;
}

function isSameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

const eventDateKey = (event: CalendarEvent) => event.startAt.slice(0, 10);

/** Event times are stored as local ISO strings (YYYY-MM-DDTHH:mm:ss). */
const formatTime = (iso: string) => iso.slice(11, 16);

function minutesFromIso(iso: string) {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(total: number) {
  const clamped = Math.min(Math.max(total, 0), 23 * 60 + 59);
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date);
}

function relativeDayLabel(date: Date, today: Date) {
  const diff = Math.round((startOfDay(date).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return null;
}

function sortEvents(a: CalendarEvent, b: CalendarEvent) {
  const dayA = eventDateKey(a);
  const dayB = eventDateKey(b);
  if (dayA !== dayB) return dayA.localeCompare(dayB);
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.startAt.localeCompare(b.startAt);
}

function eventTimeLabel(event: CalendarEvent) {
  if (event.allDay) return 'All day';
  return event.endAt
    ? `${formatTime(event.startAt)} – ${formatTime(event.endAt)}`
    : formatTime(event.startAt);
}

function eventDuration(event: CalendarEvent) {
  if (event.allDay || !event.endAt) return null;
  return minutesFromIso(event.endAt) - minutesFromIso(event.startAt);
}

const displayTitle = (event: CalendarEvent) => (event.private ? 'Busy' : event.title);

/** Lays out overlapping timed events into side-by-side lanes. */
function layoutDay(events: CalendarEvent[]): PositionedEvent[] {
  const timed = events
    .filter((event) => !event.allDay)
    .map((event) => {
      const start = minutesFromIso(event.startAt);
      const rawEnd = event.endAt ? minutesFromIso(event.endAt) : start + 30;
      const end = Math.min(Math.max(rawEnd, start + 15), 24 * 60);
      return { event, start, end, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: PositionedEvent[] = [];
  let cluster: PositionedEvent[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const laneEnds: number[] = [];
    cluster.forEach((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.end);
      } else {
        laneEnds[lane] = item.end;
      }
      item.lane = lane;
    });
    cluster.forEach((item) => {
      item.lanes = laneEnds.length;
    });
    result.push(...cluster);
    cluster = [];
  };

  timed.forEach((item) => {
    if (cluster.length && item.start >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  });
  if (cluster.length) flush();

  return result;
}

/* ============================================================================
   HOOKS
============================================================================ */

function useEscape(handler: () => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') ref.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function useBodyScrollLock() {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
}

/**
 * Drives enter + exit transitions for overlays.
 * `visible` flips to true on the frame after mount (so the enter transition runs),
 * and `close(after)` flips it back, waits for the exit transition, then calls `after`
 * (usually the parent's unmount callback). Repeat calls while closing are ignored.
 */
function usePresence(exitMs = EXIT_MS) {
  const [visible, setVisible] = useState(false);
  const closingRef = useRef(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const close = useCallback(
    (after: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      setVisible(false);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      timeoutRef.current = window.setTimeout(after, reduced ? 0 : exitMs);
    },
    [exitMs],
  );

  return { visible, close };
}

/* ============================================================================
   DEMO DATA

   Local for V1. Later:
   GET    /api/calendar/events
   POST   /api/calendar/events
   PATCH  /api/calendar/events/[id]
   DELETE /api/calendar/events/[id]
============================================================================ */

function buildInitialEvents(): CalendarEvent[] {
  const today = new Date();
  const at = (offset: number, time: string) => `${toDateKey(addDays(today, offset))}T${time}:00`;
  const hassan: Person = { id: 'person-1', name: 'Hassan', initials: 'HA' };

  return [
    {
      id: 'event-1',
      title: 'RentWise product review',
      description:
        'Review the current estate management work, mobile application progress and next delivery priorities.',
      type: 'MEETING',
      startAt: at(0, '10:00'),
      endAt: at(0, '11:00'),
      allDay: false,
      scope: 'WORKSPACE',
      workspaceId: 'rentwise',
      workspaceLabel: 'RentWise',
      project: 'RentWise Platform',
      owner: 'Hassan',
      ownerInitials: 'HA',
      createdBy: 'Executive Office',
      attendees: [
        hassan,
        { id: 'person-2', name: 'Product Lead', initials: 'PL' },
        { id: 'person-3', name: 'Engineering', initials: 'EN' },
      ],
      meetingUrl: 'Internal meeting',
      priority: 'NORMAL',
      status: 'SCHEDULED',
    },
    {
      id: 'event-2',
      title: 'Zing mobile production release',
      description: 'Planned production release for the latest passenger and driver application build.',
      type: 'DEPLOYMENT',
      startAt: at(1, '18:00'),
      endAt: at(1, '19:30'),
      allDay: false,
      scope: 'WORKSPACE',
      workspaceId: 'zing',
      workspaceLabel: 'Zing',
      project: 'Zing Mobile',
      owner: 'Engineering',
      ownerInitials: 'EN',
      createdBy: 'Engineering',
      attendees: [hassan, { id: 'person-4', name: 'Mobile Team', initials: 'MT' }],
      priority: 'HIGH',
      status: 'SCHEDULED',
    },
    {
      id: 'event-3',
      title: 'Finance reconciliation',
      description: 'Monthly internal reconciliation and outstanding client invoice review.',
      type: 'FINANCE',
      startAt: at(2, '09:30'),
      endAt: at(2, '10:30'),
      allDay: false,
      scope: 'TEAM',
      workspaceId: 'syntra',
      workspaceLabel: 'Syntra Grid',
      owner: 'Finance',
      ownerInitials: 'FN',
      createdBy: 'Finance',
      attendees: [hassan, { id: 'person-5', name: 'Finance Team', initials: 'FT' }],
      location: 'Finance workspace',
      priority: 'NORMAL',
      status: 'SCHEDULED',
    },
    {
      id: 'event-4',
      title: 'Esteem support follow-up',
      description: 'Follow up on current school platform support items and confirm outstanding actions.',
      type: 'SUPPORT',
      startAt: at(3, '13:00'),
      endAt: at(3, '13:45'),
      allDay: false,
      scope: 'WORKSPACE',
      workspaceId: 'esteem',
      workspaceLabel: 'Esteem Learning Centre',
      owner: 'Client Success',
      ownerInitials: 'CS',
      createdBy: 'Client Success',
      attendees: [hassan, { id: 'person-6', name: 'Client Success', initials: 'CS' }],
      priority: 'NORMAL',
      status: 'SCHEDULED',
    },
    {
      id: 'event-5',
      title: 'Meldex website milestone',
      description: 'Review current website milestone and client-facing delivery status.',
      type: 'MILESTONE',
      startAt: at(5, '00:00'),
      allDay: true,
      scope: 'WORKSPACE',
      workspaceId: 'meldex',
      workspaceLabel: 'Meldex Industries',
      project: 'Meldex Website',
      owner: 'Delivery',
      ownerInitials: 'DL',
      createdBy: 'Delivery',
      priority: 'NORMAL',
      status: 'SCHEDULED',
    },
    {
      id: 'event-6',
      title: 'Company operations review',
      description:
        'Weekly company-wide review covering clients, delivery, engineering and commercial priorities.',
      type: 'COMPANY',
      startAt: at(7, '09:00'),
      endAt: at(7, '10:00'),
      allDay: false,
      scope: 'COMPANY',
      workspaceId: 'syntra',
      workspaceLabel: 'Syntra Grid',
      owner: 'Hassan',
      ownerInitials: 'HA',
      createdBy: 'Hassan',
      attendees: [hassan, { id: 'person-7', name: 'Leadership', initials: 'LD' }],
      priority: 'HIGH',
      status: 'SCHEDULED',
    },
    {
      id: 'event-7',
      title: 'Infrastructure maintenance',
      description: 'Routine production systems maintenance window.',
      type: 'MAINTENANCE',
      startAt: at(9, '22:00'),
      endAt: at(9, '23:00'),
      allDay: false,
      scope: 'COMPANY',
      workspaceId: 'syntra',
      workspaceLabel: 'Syntra Grid',
      owner: 'Engineering',
      ownerInitials: 'EN',
      createdBy: 'Engineering',
      priority: 'HIGH',
      status: 'SCHEDULED',
    },
    {
      id: 'event-8',
      title: 'Personal focus block',
      description: 'Protected planning and focus time.',
      type: 'PERSONAL',
      startAt: at(4, '15:00'),
      endAt: at(4, '17:00'),
      allDay: false,
      scope: 'PERSONAL',
      owner: 'Hassan',
      ownerInitials: 'HA',
      createdBy: 'Hassan',
      private: true,
      priority: 'NORMAL',
      status: 'SCHEDULED',
    },
  ];
}

/* ============================================================================
   MAIN COMPONENT
============================================================================ */

export default function CalendarTab() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const todayKey = toDateKey(now);
  const today = useMemo(() => fromDateKey(todayKey), [todayKey]);

  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [view, setView] = useState<CalendarView>('month');
  const [events, setEvents] = useState<CalendarEvent[]>(buildInitialEvents);
  const [search, setSearch] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceId | 'all'>('all');
  const [enabledTypes, setEnabledTypes] = useState<Set<EventType>>(() => new Set(ALL_TYPES));
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  /* ---------------------------------------------------------------- filters */

  const hiddenTypeCount = ALL_TYPES.length - enabledTypes.size;
  const activeFilterCount = (selectedWorkspace !== 'all' ? 1 : 0) + (hiddenTypeCount > 0 ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || search.trim().length > 0;

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events
      .filter((event) => {
        if (!enabledTypes.has(event.type)) return false;
        if (selectedWorkspace !== 'all' && event.workspaceId !== selectedWorkspace) return false;

        if (query) {
          const haystack = [
            event.private ? '' : event.title,
            event.private ? '' : event.description,
            event.workspaceLabel,
            event.project,
            event.owner,
            event.createdBy,
            event.location,
            ...(event.attendees?.map((person) => person.name) ?? []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          if (!haystack.includes(query)) return false;
        }

        return true;
      })
      .sort(sortEvents);
  }, [enabledTypes, events, search, selectedWorkspace]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((event) => {
      const key = eventDateKey(event);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    });
    return map;
  }, [filteredEvents]);

  /* ---------------------------------------------------------- visible range */

  const visibleRange = useMemo(() => {
    if (view === 'month') {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      return { start, end: addMonths(start, 1) };
    }
    if (view === 'week') {
      const start = startOfWeekMonday(currentDate);
      return { start, end: addDays(start, 7) };
    }
    const start = startOfDay(currentDate);
    return { start, end: addDays(start, AGENDA_DAYS) };
  }, [currentDate, view]);

  const rangeSummary = useMemo(() => {
    const startKey = toDateKey(visibleRange.start);
    const endKey = toDateKey(visibleRange.end);
    const inRange = filteredEvents.filter((event) => {
      const key = eventDateKey(event);
      return key >= startKey && key < endKey && event.status !== 'CANCELLED';
    });
    return {
      total: inRange.length,
      high: inRange.filter((event) => event.priority === 'HIGH').length,
    };
  }, [filteredEvents, visibleRange]);

  const title = useMemo(() => {
    if (view === 'month') {
      return {
        primary: MONTHS[currentDate.getMonth()],
        secondary: String(currentDate.getFullYear()),
      };
    }
    const lastDay = addDays(visibleRange.end, -1);
    return {
      primary: `${formatShortDate(visibleRange.start)} – ${formatShortDate(lastDay)}`,
      secondary: String(lastDay.getFullYear()),
    };
  }, [currentDate, view, visibleRange]);

  const summaryText =
    rangeSummary.total === 0
      ? 'Nothing scheduled in this period'
      : `${rangeSummary.total} ${rangeSummary.total === 1 ? 'event' : 'events'}${
          rangeSummary.high ? `, ${rangeSummary.high} high priority` : ''
        }`;

  /* --------------------------------------------------------------- sidebar */

  const selectedDayEvents = eventsByDate.get(toDateKey(selectedDate)) ?? [];

  const upcomingEvents = useMemo(() => {
    const nowIso = `${todayKey}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    return filteredEvents
      .filter((event) => {
        if (event.status === 'CANCELLED') return false;
        if (event.allDay) return eventDateKey(event) >= todayKey;
        return (event.endAt ?? event.startAt) >= nowIso;
      })
      .slice(0, 6);
  }, [filteredEvents, now, todayKey]);

  /* ------------------------------------------------------------ navigation */

  const goToday = useCallback(() => {
    const date = new Date();
    setCurrentDate(date);
    setSelectedDate(startOfDay(date));
  }, []);

  const navigate = useCallback(
    (direction: 1 | -1) => {
      setCurrentDate((date) => {
        if (view === 'month') return addMonths(date, direction);
        if (view === 'week') return addDays(date, direction * 7);
        return addDays(date, direction * AGENDA_DAYS);
      });
    },
    [view],
  );

  const selectDate = useCallback(
    (date: Date) => {
      setSelectedDate(startOfDay(date));
      if (view === 'month' && !isSameMonth(date, currentDate)) setCurrentDate(date);
    },
    [currentDate, view],
  );

  const jumpToDate = useCallback((date: Date) => {
    setSelectedDate(startOfDay(date));
    setCurrentDate(date);
  }, []);

  /* ----------------------------------------------------------------- CRUD */

  const openCreate = useCallback((date: Date, startTime?: string) => {
    setSelectedDate(startOfDay(date));
    setDraft({ date, startTime });
  }, []);

  const showToast = useCallback((next: Omit<Toast, 'id'>) => {
    setToast({ ...next, id: Date.now() });
  }, []);

  const createEvent = useCallback(
    (event: CalendarEvent) => {
      setEvents((current) => [...current, event]);
      setDraft(null);
      setSelectedDate(fromDateKey(eventDateKey(event)));
      showToast({ message: `“${event.title}” added to the calendar` });
    },
    [showToast],
  );

  const updateEvent = useCallback((id: string, patch: Partial<CalendarEvent>) => {
    setEvents((current) => current.map((event) => (event.id === id ? { ...event, ...patch } : event)));
  }, []);

  const deleteEvent = useCallback(
    (id: string) => {
      const removed = events.find((event) => event.id === id);
      if (!removed) return;
      setEvents((current) => current.filter((event) => event.id !== id));
      setSelectedEventId(null);
      showToast({
        message: 'Event deleted',
        actionLabel: 'Undo',
        onAction: () => setEvents((current) => [...current, removed]),
      });
    },
    [events, showToast],
  );

  /* -------------------------------------------------------------- filters */

  const toggleType = useCallback((type: EventType) => {
    setEnabledTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const setAllTypes = useCallback((enabled: boolean) => {
    setEnabledTypes(enabled ? new Set(ALL_TYPES) : new Set());
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setSelectedWorkspace('all');
    setEnabledTypes(new Set(ALL_TYPES));
  }, []);

  /* ------------------------------------------------- keyboard shortcuts */

  const shortcutRef = useRef<(event: KeyboardEvent) => void>(() => undefined);

  // eslint-disable-next-line react-hooks/refs
  shortcutRef.current = (event: KeyboardEvent) => {
    if (draft || selectedEvent) return;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchRef.current?.focus();
      return;
    }

    const target = event.target as HTMLElement | null;
    const typing =
      !!target &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

    if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

    switch (event.key) {
      case '/':
        event.preventDefault();
        searchRef.current?.focus();
        break;
      case 't':
        goToday();
        break;
      case 'n':
        event.preventDefault();
        openCreate(selectedDate);
        break;
      case 'm':
        setView('month');
        break;
      case 'w':
        setView('week');
        break;
      case 'a':
        setView('agenda');
        break;
      case 'ArrowLeft':
        navigate(-1);
        break;
      case 'ArrowRight':
        navigate(1);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => shortcutRef.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------------------------------------------------------------- render */

  return (
    <div className="min-w-0 space-y-4">
      {/* ================================================================
          COMMAND BAR
      ================================================================ */}

      <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex shrink-0 items-center rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <IconButton label="Previous period" hint="←" icon={ChevronLeft} onClick={() => navigate(-1)} />
            <button
              type="button"
              onClick={goToday}
              title="Go to today (T)"
              className={`h-8 rounded-full px-3.5 text-[12px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)] ${FOCUS_RING}`}
            >
              Today
            </button>
            <IconButton label="Next period" hint="→" icon={ChevronRight} onClick={() => navigate(1)} />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-[21px] font-semibold leading-tight tracking-[-0.03em] text-[var(--text)]">
              {title.primary}{' '}
              <span className="font-normal text-[var(--text-subtle)]">{title.secondary}</span>
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]" aria-live="polite">
              {summaryText}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label
            className={`group flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 transition focus-within:border-[var(--primary)] focus-within:ring-4 focus-within:ring-[var(--primary)]/10 xl:w-[240px] xl:flex-none`}
          >
            <Search size={14} className="shrink-0 text-[var(--text-subtle)]" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSearch('');
                  event.currentTarget.blur();
                }
              }}
              placeholder="Search events, people, clients"
              aria-label="Search calendar"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className={`rounded-full p-0.5 text-[var(--text-subtle)] hover:text-[var(--text)] ${FOCUS_RING}`}
              >
                <X size={13} />
              </button>
            ) : (
              <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
            )}
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-haspopup="dialog"
              className={`${PILL_BUTTON} ${
                activeFilterCount ? 'border-[var(--primary)]/40 text-[var(--text)]' : ''
              }`}
            >
              <Filter size={13} />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-semibold tabular-nums text-[var(--primary-foreground)]">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filtersOpen && (
              <FilterPopover
                selectedWorkspace={selectedWorkspace}
                enabledTypes={enabledTypes}
                onWorkspaceChange={setSelectedWorkspace}
                onToggleType={toggleType}
                onSetAllTypes={setAllTypes}
                onReset={clearFilters}
                onClose={() => setFiltersOpen(false)}
              />
            )}
          </div>

          <ViewSwitcher value={view} onChange={setView} />

          <button type="button" onClick={() => openCreate(selectedDate)} className={PRIMARY_BUTTON}>
            <Plus size={14} strokeWidth={2.4} />
            New event
            <Kbd inverted className="hidden sm:inline-flex">
              N
            </Kbd>
          </button>
        </div>
      </header>

      {/* ================================================================
          ACTIVE FILTER CHIPS
      ================================================================ */}

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-[var(--text-subtle)]">Showing</span>

          {search.trim() && (
            <FilterChip label={`Matches “${search.trim()}”`} onRemove={() => setSearch('')} />
          )}

          {selectedWorkspace !== 'all' && (
            <FilterChip
              label={WORKSPACES.find((item) => item.id === selectedWorkspace)?.label ?? ''}
              onRemove={() => setSelectedWorkspace('all')}
            />
          )}

          {hiddenTypeCount > 0 && (
            <FilterChip
              label={`${enabledTypes.size} of ${ALL_TYPES.length} event types`}
              onRemove={() => setAllTypes(true)}
            />
          )}

          <button
            type="button"
            onClick={clearFilters}
            className={`ml-1 rounded-full px-2 py-1 text-[12px] font-medium text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline ${FOCUS_RING}`}
          >
            Clear all
          </button>
        </div>
      )}

      {/* ================================================================
          BODY
      ================================================================ */}

      <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className={`${CARD} min-w-0 rounded-[24px]`}>
          <div className="overflow-x-auto">
            {view === 'month' && (
              <MonthView
                currentDate={currentDate}
                today={today}
                selectedDate={selectedDate}
                eventsByDate={eventsByDate}
                onSelectDate={selectDate}
                onCreate={openCreate}
                onSelectEvent={(event) => setSelectedEventId(event.id)}
              />
            )}

            {view === 'week' && (
              <WeekView
                currentDate={currentDate}
                today={today}
                now={now}
                eventsByDate={eventsByDate}
                onSelectDate={selectDate}
                onCreate={openCreate}
                onSelectEvent={(event) => setSelectedEventId(event.id)}
              />
            )}

            {view === 'agenda' && (
              <AgendaView
                startDate={currentDate}
                today={today}
                eventsByDate={eventsByDate}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={clearFilters}
                onCreate={() => openCreate(selectedDate)}
                onSelectEvent={(event) => setSelectedEventId(event.id)}
              />
            )}
          </div>

          {/* Legend doubles as a quick type filter */}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface-muted)]/40 px-4 py-3">
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Toggle event types">
              {ALL_TYPES.map((type) => {
                const meta = EVENT_TYPES[type];
                const enabled = enabledTypes.has(type);
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={enabled}
                    onClick={() => toggleType(type)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] transition ${FOCUS_RING} ${
                      enabled
                        ? 'text-[var(--text-muted)] hover:bg-[var(--surface)]'
                        : 'text-[var(--text-subtle)] line-through decoration-[var(--text-subtle)]/60 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${meta.dotClass} ${enabled ? '' : 'opacity-40'}`} />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            <p className="hidden text-[11.5px] text-[var(--text-subtle)] lg:block">
              {view === 'month'
                ? 'Double-click a day to add an event'
                : view === 'week'
                  ? 'Click an empty slot to add an event'
                  : 'Use ← → to move between periods'}
            </p>
          </footer>
        </div>

        <aside className="grid min-w-0 content-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-1">
          <MiniCalendar
            selectedDate={selectedDate}
            today={today}
            eventsByDate={eventsByDate}
            onSelect={jumpToDate}
          />

          <SelectedDayPanel
            date={selectedDate}
            today={today}
            events={selectedDayEvents}
            onCreate={() => openCreate(selectedDate)}
            onSelectEvent={(event) => setSelectedEventId(event.id)}
          />

          <UpcomingPanel
            events={upcomingEvents}
            today={today}
            onSelectEvent={(event) => setSelectedEventId(event.id)}
          />
        </aside>
      </section>

      {/* ================================================================
          OVERLAYS
      ================================================================ */}

      {draft && (
        <CreateEventModal
          initialDate={draft.date}
          initialStartTime={draft.startTime}
          onClose={() => setDraft(null)}
          onCreate={createEvent}
        />
      )}

      {selectedEvent && (
        <EventDrawer
          event={selectedEvent}
          today={today}
          onClose={() => setSelectedEventId(null)}
          onDelete={() => deleteEvent(selectedEvent.id)}
          onToggleComplete={() =>
            updateEvent(selectedEvent.id, {
              status: selectedEvent.status === 'COMPLETED' ? 'SCHEDULED' : 'COMPLETED',
            })
          }
        />
      )}

      {toast && (
        <ToastBar
          key={toast.id}
          toast={toast}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}

/* ============================================================================
   MONTH VIEW
============================================================================ */

function MonthView({
  currentDate,
  today,
  selectedDate,
  eventsByDate,
  onSelectDate,
  onCreate,
  onSelectEvent,
}: {
  currentDate: Date;
  today: Date;
  selectedDate: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onSelectDate: (date: Date) => void;
  onCreate: (date: Date) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const days = useMemo(() => {
    const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const gridStart = startOfWeekMonday(first);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [currentDate]);

  return (
    <div className="min-w-[760px]">
      <div className="grid grid-cols-7 border-b border-[var(--line)]">
        {WEEK_DAYS.map((day, index) => (
          <div
            key={day}
            className={`px-3 py-2.5 text-[11.5px] font-medium ${
              index >= 5 ? 'text-[var(--text-subtle)]' : 'text-[var(--text-muted)]'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((date, index) => {
          const key = toDateKey(date);
          return (
            <DayCell
              key={key}
              date={date}
              events={eventsByDate.get(key) ?? []}
              inMonth={date.getMonth() === currentDate.getMonth()}
              isToday={isSameDate(date, today)}
              isSelected={isSameDate(date, selectedDate)}
              isWeekend={index % 7 >= 5}
              isLastColumn={index % 7 === 6}
              isLastRow={index >= 35}
              onSelect={() => onSelectDate(date)}
              onCreate={() => onCreate(date)}
              onSelectEvent={onSelectEvent}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  date,
  events,
  inMonth,
  isToday,
  isSelected,
  isWeekend,
  isLastColumn,
  isLastRow,
  onSelect,
  onCreate,
  onSelectEvent,
}: {
  date: Date;
  events: CalendarEvent[];
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  isLastColumn: boolean;
  isLastRow: boolean;
  onSelect: () => void;
  onCreate: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const visible = events.slice(0, MAX_MONTH_EVENTS);
  const remaining = events.length - visible.length;
  const label = date.getDate() === 1 ? formatShortDate(date) : String(date.getDate());

  const background = isSelected
    ? 'bg-[var(--accent-tint)]'
    : isWeekend
      ? 'bg-[var(--surface-muted)]/35 hover:bg-[var(--surface-muted)]/70'
      : 'hover:bg-[var(--surface-muted)]/45';

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onCreate}
      className={`group relative flex min-h-[126px] cursor-default flex-col gap-1 border-[var(--line)] p-1.5 transition-colors ${background} ${
        isLastColumn ? '' : 'border-r'
      } ${isLastRow ? '' : 'border-b'}`}
    >
      {isSelected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-[var(--primary)]/30"
        />
      )}

      <div className={`flex items-center justify-between ${inMonth ? '' : 'opacity-50'}`}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          aria-pressed={isSelected}
          aria-label={`${formatLongDate(date)}, ${events.length} ${events.length === 1 ? 'event' : 'events'}`}
          className={`flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12.5px] font-semibold tabular-nums transition-colors ${FOCUS_RING} ${
            isToday
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
              : 'text-[var(--text)] hover:bg-[var(--surface-muted)]'
          }`}
        >
          {label}
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCreate();
          }}
          aria-label={`Add event on ${formatLongDate(date)}`}
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-subtle)] opacity-0 transition hover:bg-[var(--surface)] hover:text-[var(--text)] group-hover:opacity-100 focus-visible:opacity-100 ${FOCUS_RING}`}
        >
          <Plus size={13} />
        </button>
      </div>

      <div className={`space-y-px ${inMonth ? '' : 'opacity-50'}`}>
        {visible.map((event) => (
          <MonthEventChip key={event.id} event={event} onClick={() => onSelectEvent(event)} />
        ))}
      </div>

      {remaining > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          className={`self-start rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)] ${FOCUS_RING}`}
        >
          {remaining} more
        </button>
      )}
    </div>
  );
}

function MonthEventChip({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const meta = EVENT_TYPES[event.type];
  const inactive = event.status !== 'SCHEDULED';

  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick();
      }}
      onDoubleClick={(clickEvent) => clickEvent.stopPropagation()}
      title={`${eventTimeLabel(event)}  ${displayTitle(event)}`}
      className={`flex w-full items-center gap-1.5 overflow-hidden rounded-md px-1.5 py-[3px] text-left transition-colors ${FOCUS_RING} ${
        event.allDay
          ? `border-l-2 ${meta.borderClass} ${meta.softClass} hover:brightness-95`
          : 'hover:bg-[var(--surface)]'
      } ${inactive ? 'opacity-55' : ''}`}
    >
      {!event.allDay && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dotClass}`} />}
      {!event.allDay && (
        <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--text-subtle)]">
          {formatTime(event.startAt)}
        </span>
      )}
      {event.private && <Lock size={10} className="shrink-0 text-[var(--text-subtle)]" />}
      <span
        className={`truncate text-[11.5px] font-medium ${
          event.allDay ? meta.textClass : 'text-[var(--text)]'
        } ${event.status === 'CANCELLED' ? 'line-through' : ''}`}
      >
        {displayTitle(event)}
      </span>
    </button>
  );
}

/* ============================================================================
   WEEK VIEW (time grid)
============================================================================ */

const WEEK_GRID = 'grid grid-cols-[60px_repeat(7,minmax(0,1fr))]';

function WeekView({
  currentDate,
  today,
  now,
  eventsByDate,
  onSelectDate,
  onCreate,
  onSelectEvent,
}: {
  currentDate: Date;
  today: Date;
  now: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onSelectDate: (date: Date) => void;
  onCreate: (date: Date, startTime?: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_HEIGHT;
  }, []);

  const columns = useMemo(() => {
    const start = startOfWeekMonday(currentDate);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index);
      const key = toDateKey(date);
      const dayEvents = eventsByDate.get(key) ?? [];
      return {
        date,
        key,
        allDay: dayEvents.filter((event) => event.allDay),
        timed: layoutDay(dayEvents),
      };
    });
  }, [currentDate, eventsByDate]);

  const hasAllDay = columns.some((column) => column.allDay.length > 0);
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;

  return (
    <div className="min-w-[860px]">
      {/* Day headers */}
      <div className={`${WEEK_GRID} border-b border-[var(--line)]`}>
        <div />
        {columns.map(({ date, key }, index) => {
          const isToday = isSameDate(date, today);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`flex items-center justify-center gap-2 border-l border-[var(--line)] py-3 transition-colors hover:bg-[var(--surface-muted)]/50 ${FOCUS_RING}`}
            >
              <span
                className={`text-[11.5px] font-medium ${
                  isToday ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {WEEK_DAYS[index]}
              </span>
              <span
                className={`flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-[15px] font-semibold tabular-nums tracking-[-0.02em] ${
                  isToday
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
                    : 'text-[var(--text)]'
                }`}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* All-day row */}
      {hasAllDay && (
        <div className={`${WEEK_GRID} border-b border-[var(--line)] bg-[var(--surface-muted)]/35`}>
          <div className="flex items-start justify-end px-2 py-2 text-[10.5px] text-[var(--text-subtle)]">
            All day
          </div>
          {columns.map((column) => (
            <div key={column.key} className="space-y-1 border-l border-[var(--line)] p-1.5">
              {column.allDay.map((event) => (
                <MonthEventChip key={event.id} event={event} onClick={() => onSelectEvent(event)} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Time grid */}
      <div ref={scrollRef} className="max-h-[640px] overflow-y-auto overscroll-contain">
        <div className={`${WEEK_GRID} relative`} style={{ height: 24 * HOUR_HEIGHT }}>
          <div className="relative">
            {HOURS.slice(1).map((hour) => (
              <span
                key={hour}
                className="absolute right-2.5 -translate-y-1/2 text-[10.5px] tabular-nums text-[var(--text-subtle)]"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {pad(hour)}:00
              </span>
            ))}
          </div>

          {columns.map(({ date, key, timed }) => {
            const isToday = isSameDate(date, today);
            return (
              <div
                key={key}
                className={`relative border-l border-[var(--line)] ${
                  isToday ? 'bg-[var(--accent-tint)]/35' : ''
                }`}
              >
                {HOURS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    tabIndex={-1}
                    aria-label={`Add event on ${formatShortDate(date)} at ${pad(hour)}:00`}
                    onClick={() => onCreate(date, `${pad(hour)}:00`)}
                    className="block w-full border-t border-[var(--line)]/60 transition-colors first:border-t-0 hover:bg-[var(--surface-muted)]/60"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {timed.map((item) => (
                  <TimeGridEvent key={item.event.id} item={item} onClick={() => onSelectEvent(item.event)} />
                ))}

                {isToday && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-30" style={{ top: nowTop }}>
                    <div className="relative h-[2px] bg-[var(--primary)]">
                      <span className="absolute -left-[5px] -top-[4px] h-2.5 w-2.5 rounded-full bg-[var(--primary)] ring-2 ring-[var(--surface)]" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimeGridEvent({ item, onClick }: { item: PositionedEvent; onClick: () => void }) {
  const { event, start, end, lane, lanes } = item;
  const meta = EVENT_TYPES[event.type];
  const top = (start / 60) * HOUR_HEIGHT + 1;
  const height = Math.max(((end - start) / 60) * HOUR_HEIGHT - 3, 22);
  const compact = height < 44;

  return (
    <div
      className="absolute z-10 rounded-lg bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-shadow hover:z-20 hover:shadow-md"
      style={{
        top,
        height,
        left: `calc(${(lane / lanes) * 100}% + 3px)`,
        width: `calc(${100 / lanes}% - 6px)`,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        title={`${eventTimeLabel(event)}  ${displayTitle(event)}`}
        className={`flex h-full w-full flex-col overflow-hidden rounded-lg border-l-[3px] px-2 text-left ${FOCUS_RING} ${meta.softClass} ${meta.borderClass} ${
          compact ? 'justify-center' : 'py-1.5'
        } ${event.status !== 'SCHEDULED' ? 'opacity-60' : ''}`}
      >
        <span
          className={`flex items-center gap-1 truncate text-[11.5px] font-semibold ${meta.textClass} ${
            event.status === 'CANCELLED' ? 'line-through' : ''
          }`}
        >
          {event.private && <Lock size={10} className="shrink-0" />}
          {compact && <span className="font-normal tabular-nums opacity-80">{formatTime(event.startAt)}</span>}
          <span className="truncate">{displayTitle(event)}</span>
        </span>
        {!compact && (
          <span className="mt-0.5 truncate text-[10.5px] tabular-nums text-[var(--text-muted)]">
            {formatTime(event.startAt)} – {minutesToTime(end)}
          </span>
        )}
      </button>
    </div>
  );
}

/* ============================================================================
   AGENDA VIEW
============================================================================ */

function AgendaView({
  startDate,
  today,
  eventsByDate,
  hasActiveFilters,
  onClearFilters,
  onCreate,
  onSelectEvent,
}: {
  startDate: Date;
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const groups = useMemo(() => {
    const start = startOfDay(startDate);
    const result: Array<{ date: Date; items: CalendarEvent[] }> = [];
    for (let index = 0; index < AGENDA_DAYS; index += 1) {
      const date = addDays(start, index);
      const items = eventsByDate.get(toDateKey(date));
      if (items?.length) result.push({ date, items });
    }
    return result;
  }, [eventsByDate, startDate]);

  if (groups.length === 0) {
    return (
      <EmptySchedule
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        onCreate={onCreate}
      />
    );
  }

  return (
    <div className="min-h-[600px] min-w-[560px] divide-y divide-[var(--line)]">
      {groups.map(({ date, items }) => {
        const relative = relativeDayLabel(date, today);
        const isToday = relative === 'Today';
        return (
          <section key={toDateKey(date)} className="grid grid-cols-[120px_minmax(0,1fr)] gap-4 px-4 py-4 lg:px-5">
            <div className="pt-1">
              <p
                className={`text-[26px] font-semibold leading-none tabular-nums tracking-[-0.04em] ${
                  isToday ? 'text-[var(--primary)]' : 'text-[var(--text)]'
                }`}
              >
                {date.getDate()}
              </p>
              <p className="mt-1.5 text-[12px] font-medium text-[var(--text)]">
                {relative ?? formatWeekday(date)}
              </p>
              <p className="text-[11.5px] text-[var(--text-subtle)]">
                {MONTHS[date.getMonth()]} {date.getFullYear()}
              </p>
            </div>

            <div className="space-y-1">
              {items.map((event) => (
                <AgendaRow key={event.id} event={event} onClick={() => onSelectEvent(event)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AgendaRow({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const meta = EVENT_TYPES[event.type];
  const Icon = meta.icon;
  const duration = eventDuration(event);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-[var(--surface-muted)]/70 ${FOCUS_RING} ${
        event.status !== 'SCHEDULED' ? 'opacity-60' : ''
      }`}
    >
      <span className="w-[64px] shrink-0">
        <span className="block text-[12.5px] font-semibold tabular-nums text-[var(--text)]">
          {event.allDay ? 'All day' : formatTime(event.startAt)}
        </span>
        {duration !== null && (
          <span className="mt-0.5 block text-[11px] text-[var(--text-subtle)]">{formatDuration(duration)}</span>
        )}
      </span>

      <span className={`h-10 w-[3px] shrink-0 rounded-full ${meta.dotClass}`} />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {event.private && <Lock size={12} className="shrink-0 text-[var(--text-subtle)]" />}
          <span
            className={`truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--text)] ${
              event.status === 'CANCELLED' ? 'line-through' : ''
            }`}
          >
            {displayTitle(event)}
          </span>
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-muted)]">
          <span className={`inline-flex items-center gap-1 ${meta.textClass}`}>
            <Icon size={12} />
            {meta.label}
          </span>
          {event.workspaceLabel && (
            <span className="inline-flex items-center gap-1">
              <BriefcaseBusiness size={12} className="text-[var(--text-subtle)]" />
              {event.workspaceLabel}
            </span>
          )}
          {event.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} className="text-[var(--text-subtle)]" />
              {event.location}
            </span>
          )}
        </span>
      </span>

      {event.attendees && event.attendees.length > 0 && !event.private && (
        <AvatarStack people={event.attendees} />
      )}

      <PriorityBadge priority={event.priority} />
      <StatusBadge status={event.status} />
    </button>
  );
}

/* ============================================================================
   SIDEBAR
============================================================================ */

function MiniCalendar({
  selectedDate,
  today,
  eventsByDate,
  onSelect,
}: {
  selectedDate: Date;
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onSelect: (date: Date) => void;
}) {
  const [month, setMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonth((current) =>
      isSameMonth(current, selectedDate)
        ? current
        : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    );
  }, [selectedDate]);

  const days = useMemo(() => {
    const start = startOfWeekMonday(month);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [month]);

  return (
    <section className={`${CARD} p-3.5`}>
      <div className="mb-2 flex items-center justify-between pl-1">
        <p className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--text)]">
          {MONTHS[month.getMonth()]} <span className="font-normal text-[var(--text-subtle)]">{month.getFullYear()}</span>
        </p>
        <div className="flex items-center">
          <IconButton label="Previous month" icon={ChevronLeft} size="sm" onClick={() => setMonth((m) => addMonths(m, -1))} />
          <IconButton label="Next month" icon={ChevronRight} size="sm" onClick={() => setMonth((m) => addMonths(m, 1))} />
        </div>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEK_DAYS.map((day) => (
          <span key={day} className="pb-1 text-[10.5px] text-[var(--text-subtle)]">
            {day.slice(0, 2)}
          </span>
        ))}

        {days.map((date) => {
          const key = toDateKey(date);
          const hasEvents = (eventsByDate.get(key)?.length ?? 0) > 0;
          const isToday = isSameDate(date, today);
          const isSelected = isSameDate(date, selectedDate);
          const inMonth = date.getMonth() === month.getMonth();

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(date)}
              aria-label={formatLongDate(date)}
              aria-pressed={isSelected}
              className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12px] tabular-nums transition-colors ${FOCUS_RING} ${
                isSelected
                  ? 'bg-[var(--primary)] font-semibold text-[var(--primary-foreground)]'
                  : isToday
                    ? 'font-semibold text-[var(--primary)] hover:bg-[var(--surface-muted)]'
                    : inMonth
                      ? 'text-[var(--text)] hover:bg-[var(--surface-muted)]'
                      : 'text-[var(--text-subtle)]/60 hover:bg-[var(--surface-muted)]'
              }`}
            >
              {date.getDate()}
              {hasEvents && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--text-subtle)]" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SelectedDayPanel({
  date,
  today,
  events,
  onCreate,
  onSelectEvent,
}: {
  date: Date;
  today: Date;
  events: CalendarEvent[];
  onCreate: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const relative = relativeDayLabel(date, today);

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--text)]">
            {relative ?? formatWeekday(date)}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-muted)]">
            {relative ? formatLongDate(date) : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`}
          </p>
        </div>

        <button
          type="button"
          onClick={onCreate}
          aria-label="Add event on this day"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)] transition-colors hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] ${FOCUS_RING}`}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="p-2">
        {events.length === 0 ? (
          <div className="flex min-h-[150px] flex-col items-center justify-center px-6 text-center">
            <p className="text-[12.5px] font-medium text-[var(--text)]">Nothing scheduled</p>
            <p className="mt-1 max-w-[220px] text-[11.5px] leading-5 text-[var(--text-muted)]">
              This day is clear. Add a meeting, deadline or focus block.
            </p>
            <button type="button" onClick={onCreate} className={`${PILL_BUTTON} mt-3 h-8 text-[11.5px]`}>
              <Plus size={12} />
              Add event
            </button>
          </div>
        ) : (
          events.map((event) => (
            <SidebarEventRow key={event.id} event={event} onClick={() => onSelectEvent(event)} />
          ))
        )}
      </div>
    </section>
  );
}

function UpcomingPanel({
  events,
  today,
  onSelectEvent,
}: {
  events: CalendarEvent[];
  today: Date;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  return (
    <section className={CARD}>
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5">
        <div>
          <p className="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--text)]">Coming up</p>
          <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">Next {events.length || ''} on your schedule</p>
        </div>
        <BellRing size={15} className="text-[var(--text-subtle)]" />
      </div>

      <div className="p-2">
        {events.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-[var(--text-muted)]">
            No upcoming events match your filters.
          </p>
        ) : (
          events.map((event) => {
            const date = fromDateKey(eventDateKey(event));
            return (
              <SidebarEventRow
                key={event.id}
                event={event}
                dateLabel={relativeDayLabel(date, today) ?? formatShortDate(date)}
                onClick={() => onSelectEvent(event)}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

function SidebarEventRow({
  event,
  dateLabel,
  onClick,
}: {
  event: CalendarEvent;
  dateLabel?: string;
  onClick: () => void;
}) {
  const meta = EVENT_TYPES[event.type];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-stretch gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-muted)]/70 ${FOCUS_RING} ${
        event.status !== 'SCHEDULED' ? 'opacity-60' : ''
      }`}
    >
      <span className="w-[44px] shrink-0 pt-px">
        {dateLabel && <span className="block text-[10.5px] text-[var(--text-subtle)]">{dateLabel}</span>}
        <span className="block text-[11.5px] font-semibold tabular-nums text-[var(--text)]">
          {event.allDay ? 'All day' : formatTime(event.startAt)}
        </span>
      </span>

      <span className={`w-[3px] shrink-0 rounded-full ${meta.dotClass}`} />

      <span className="min-w-0 flex-1 py-px">
        <span className="flex items-center gap-1.5">
          {event.private && <Lock size={11} className="shrink-0 text-[var(--text-subtle)]" />}
          <span
            className={`truncate text-[12.5px] font-medium text-[var(--text)] ${
              event.status === 'CANCELLED' ? 'line-through' : ''
            }`}
          >
            {displayTitle(event)}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">
          {event.workspaceLabel ?? meta.label}
        </span>
      </span>

      {event.priority === 'HIGH' && (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-label="High priority" />
      )}
    </button>
  );
}

/* ============================================================================
   VIEW SWITCHER
============================================================================ */

function ViewSwitcher({ value, onChange }: { value: CalendarView; onChange: (view: CalendarView) => void }) {
  const options: Array<{ value: CalendarView; label: string; key: string }> = [
    { value: 'month', label: 'Month', key: 'M' },
    { value: 'week', label: 'Week', key: 'W' },
    { value: 'agenda', label: 'Agenda', key: 'A' },
  ];

  return (
    <div
      role="tablist"
      aria-label="Calendar view"
      className="flex h-9 items-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)]/60 p-[3px]"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            title={`${option.label} view (${option.key})`}
            onClick={() => onChange(option.value)}
            className={`h-full rounded-full px-3.5 text-[12px] font-medium transition-all ${FOCUS_RING} ${
              selected
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-[0_1px_2px_rgba(15,23,42,0.08),0_0_0_1px_var(--line)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
   FILTERS
============================================================================ */

function FilterPopover({
  selectedWorkspace,
  enabledTypes,
  onWorkspaceChange,
  onToggleType,
  onSetAllTypes,
  onReset,
  onClose,
}: {
  selectedWorkspace: WorkspaceId | 'all';
  enabledTypes: Set<EventType>;
  onWorkspaceChange: (value: WorkspaceId | 'all') => void;
  onToggleType: (type: EventType) => void;
  onSetAllTypes: (enabled: boolean) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const { visible, close } = usePresence();
  const requestClose = () => close(onClose);
  useEscape(requestClose);

  const allEnabled = enabledTypes.size === ALL_TYPES.length;
  const workspaceOptions: Array<{ id: WorkspaceId | 'all'; label: string; short: string }> = [
    { id: 'all', label: 'All workspaces', short: '∗' },
    ...WORKSPACES,
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Close filters"
        tabIndex={-1}
        onClick={requestClose}
        className="fixed inset-0 z-[60] cursor-default"
      />

      <div
        role="dialog"
        aria-label="Calendar filters"
        className={`absolute right-0 top-[calc(100%+8px)] z-[70] w-[320px] origin-top-right overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--surface-elevated)] shadow-[var(--shadow-popover)] transition-[opacity,transform] motion-reduce:transition-none ${
          visible
            ? `translate-y-0 scale-100 opacity-100 ${MOTION_ENTER}`
            : `-translate-y-1 scale-[0.96] opacity-0 ${MOTION_EXIT}`
        }`}
      >
        <div className="p-3">
          <p className="px-1 pb-1.5 text-[12px] font-semibold text-[var(--text)]">Workspace</p>
          <div className="space-y-px">
            {workspaceOptions.map((workspace) => {
              const selected = selectedWorkspace === workspace.id;
              return (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => onWorkspaceChange(workspace.id)}
                  aria-pressed={selected}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors ${FOCUS_RING} ${
                    selected ? 'bg-[var(--surface-muted)]' : 'hover:bg-[var(--surface-muted)]/60'
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[9.5px] font-semibold text-[var(--text-muted)]">
                    {workspace.short}
                  </span>
                  <span className="flex-1 truncate text-[12.5px] text-[var(--text)]">{workspace.label}</span>
                  {selected && <Check size={14} className="text-[var(--primary)]" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[var(--line)] p-3">
          <div className="flex items-center justify-between px-1 pb-1.5">
            <p className="text-[12px] font-semibold text-[var(--text)]">Event types</p>
            <button
              type="button"
              onClick={() => onSetAllTypes(!allEnabled)}
              className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] ${FOCUS_RING}`}
            >
              {allEnabled ? 'Hide all' : 'Show all'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-px">
            {ALL_TYPES.map((type) => {
              const meta = EVENT_TYPES[type];
              const enabled = enabledTypes.has(type);
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={enabled}
                  onClick={() => onToggleType(type)}
                  className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-left transition ${FOCUS_RING} hover:bg-[var(--surface-muted)]/70`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                      enabled ? `${meta.dotClass} border-transparent text-white` : 'border-[var(--line)] bg-[var(--surface)]'
                    }`}
                  >
                    {enabled && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span
                    className={`truncate text-[12px] ${
                      enabled ? 'text-[var(--text)]' : 'text-[var(--text-subtle)]'
                    }`}
                  >
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--surface-muted)]/40 px-3 py-2.5">
          <button
            type="button"
            onClick={onReset}
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] ${FOCUS_RING}`}
          >
            <RotateCcw size={12} />
            Reset filters
          </button>
          <button type="button" onClick={requestClose} className={`${PRIMARY_BUTTON} h-8 px-3.5 text-[11.5px]`}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] pl-3 pr-1 text-[12px] text-[var(--text)]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] ${FOCUS_RING}`}
      >
        <X size={11} />
      </button>
    </span>
  );
}

/* ============================================================================
   CREATE EVENT MODAL
============================================================================ */

function CreateEventModal({
  initialDate,
  initialStartTime,
  onClose,
  onCreate,
}: {
  initialDate: Date;
  initialStartTime?: string;
  onClose: () => void;
  onCreate: (event: CalendarEvent) => void;
}) {
  const { visible, close } = usePresence();
  const requestClose = () => close(onClose);
  useEscape(requestClose);
  useBodyScrollLock();

  const formRef = useRef<HTMLFormElement>(null);
  const start = initialStartTime ?? '09:00';

  const [form, setForm] = useState<NewEventForm>({
    title: '',
    type: 'MEETING',
    date: toDateKey(initialDate),
    startTime: start,
    endTime: minutesToTime(timeToMinutes(start) + 60),
    allDay: false,
    workspaceId: 'syntra',
    location: '',
    description: '',
    priority: 'NORMAL',
  });

  const [error, setError] = useState('');

  const update = <K extends keyof NewEventForm>(key: K, value: NewEventForm[K]) => {
    setError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  // Moving the start keeps the chosen duration intact.
  const setStartTime = (value: string) => {
    if (!value) return;
    setError('');
    setForm((current) => {
      const duration = Math.max(timeToMinutes(current.endTime) - timeToMinutes(current.startTime), 15);
      return { ...current, startTime: value, endTime: minutesToTime(timeToMinutes(value) + duration) };
    });
  };

  const duration = timeToMinutes(form.endTime) - timeToMinutes(form.startTime);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setError('Add a title so people know what this event is.');
      return;
    }
    if (!form.allDay && duration <= 0) {
      setError('End time must be after the start time.');
      return;
    }

    const workspace = WORKSPACES.find((item) => item.id === form.workspaceId);

    const created: CalendarEvent = {
      id: `event-${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      type: form.type,
      startAt: `${form.date}T${form.allDay ? '00:00' : form.startTime}:00`,
      endAt: form.allDay ? undefined : `${form.date}T${form.endTime}:00`,
      allDay: form.allDay,
      scope: form.workspaceId === 'syntra' ? 'COMPANY' : 'WORKSPACE',
      workspaceId: form.workspaceId,
      workspaceLabel: workspace?.label,
      owner: 'Hassan',
      ownerInitials: 'HA',
      createdBy: 'Hassan',
      location: form.location.trim() || undefined,
      priority: form.priority,
      status: 'SCHEDULED',
    };

    // Let the modal animate out, then hand the event to the calendar.
    close(() => onCreate(created));
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const selectedMeta = EVENT_TYPES[form.type];

  return (
    <ModalShell visible={visible} onClose={requestClose} labelledBy="create-event-title">
      <form
        ref={formRef}
        onSubmit={submit}
        onKeyDown={onKeyDown}
        noValidate
        className="flex max-h-[calc(100dvh-32px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface-elevated)] shadow-[var(--shadow-popover)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 pb-2 pt-5">
          <h3 id="create-event-title" className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
            New event
          </h3>
          <IconButton label="Close" icon={X} onClick={requestClose} />
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
          {/* Title */}
          <div className="flex items-start gap-3">
            <span
              className={`mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${selectedMeta.softClass} ${selectedMeta.textClass}`}
            >
              <selectedMeta.icon size={16} />
            </span>
            <input
              autoFocus
              value={form.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="Add a title"
              aria-label="Event title"
              aria-invalid={!!error && !form.title.trim()}
              className="h-12 w-full border-b border-[var(--line)] bg-transparent text-[20px] font-semibold tracking-[-0.025em] text-[var(--text)] outline-none transition-colors placeholder:font-medium placeholder:text-[var(--text-subtle)] focus:border-[var(--primary)]"
            />
          </div>

          {/* Type */}
          <Field label="Type">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Event type">
              {ALL_TYPES.map((type) => {
                const meta = EVENT_TYPES[type];
                const selected = form.type === type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => update('type', type)}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors ${FOCUS_RING} ${
                      selected
                        ? `border-transparent ${meta.softClass} ${meta.textClass}`
                        : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* When */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Date" className="min-w-[160px] flex-1">
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => event.target.value && update('date', event.target.value)}
                  className={INPUT}
                />
              </Field>

              {!form.allDay && (
                <>
                  <Field label="Starts" className="w-[120px]">
                    <input
                      type="time"
                      step={300}
                      value={form.startTime}
                      onChange={(event) => setStartTime(event.target.value)}
                      className={`${INPUT} tabular-nums`}
                    />
                  </Field>
                  <Field label="Ends" className="w-[120px]">
                    <input
                      type="time"
                      step={300}
                      value={form.endTime}
                      onChange={(event) => event.target.value && update('endTime', event.target.value)}
                      aria-invalid={duration <= 0}
                      className={`${INPUT} tabular-nums ${duration <= 0 ? 'border-red-500/60' : ''}`}
                    />
                  </Field>
                </>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <Toggle checked={form.allDay} onChange={(checked) => update('allDay', checked)} label="All day" />

              {!form.allDay && (
                <div className="flex flex-wrap items-center gap-1" aria-label="Duration">
                  {DURATION_PRESETS.map((minutes) => {
                    const selected = duration === minutes;
                    return (
                      <button
                        key={minutes}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          update('endTime', minutesToTime(timeToMinutes(form.startTime) + minutes))
                        }
                        className={`h-7 rounded-full px-2.5 text-[11.5px] tabular-nums transition-colors ${FOCUS_RING} ${
                          selected
                            ? 'bg-[var(--primary)] font-semibold text-[var(--primary-foreground)]'
                            : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {formatDuration(minutes)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Workspace + priority */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Workspace">
              <select
                value={form.workspaceId}
                onChange={(event) => update('workspaceId', event.target.value as WorkspaceId)}
                className={INPUT}
              >
                {WORKSPACES.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Priority">
              <div className="grid h-10 grid-cols-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]/50 p-[3px]" role="radiogroup" aria-label="Priority">
                {(['LOW', 'NORMAL', 'HIGH'] as EventPriority[]).map((priority) => {
                  const selected = form.priority === priority;
                  return (
                    <button
                      key={priority}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => update('priority', priority)}
                      className={`rounded-[9px] text-[12px] font-medium capitalize transition-all ${FOCUS_RING} ${
                        selected
                          ? `bg-[var(--surface)] shadow-[0_1px_2px_rgba(15,23,42,0.08)] ${
                              priority === 'HIGH' ? 'text-red-500' : 'text-[var(--text)]'
                            }`
                          : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {priority.toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <Field label="Location or meeting link" optional>
            <div className="relative">
              <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
              <input
                value={form.location}
                onChange={(event) => update('location', event.target.value)}
                placeholder="Office, Google Meet, Teams"
                className={`${INPUT} pl-9`}
              />
            </div>
          </Field>

          <Field label="Notes" optional>
            <textarea
              value={form.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Agenda, context or instructions for attendees"
              rows={3}
              className={`${INPUT} h-auto resize-none py-2.5 leading-5`}
            />
          </Field>

          <div className="flex items-start gap-2.5 rounded-xl bg-[var(--surface-muted)]/60 px-3.5 py-3">
            <Users size={14} className="mt-0.5 shrink-0 text-[var(--text-subtle)]" />
            <p className="text-[11.5px] leading-5 text-[var(--text-muted)]">
              Inviting attendees, scheduling for other staff and visibility controls will appear here once roles are
              connected.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-500/10 px-3.5 py-2.5 text-[12px] font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface-muted)]/35 px-6 py-3.5">
          <p className="hidden items-center gap-1.5 text-[11.5px] text-[var(--text-subtle)] sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>Enter</Kbd>
            to create
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={requestClose} className={`${PILL_BUTTON} border-transparent bg-transparent`}>
              Cancel
            </button>
            <button type="submit" className={PRIMARY_BUTTON}>
              <Plus size={14} strokeWidth={2.4} />
              Create event
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}

/* ============================================================================
   EVENT DRAWER
============================================================================ */

function EventDrawer({
  event,
  today,
  onClose,
  onDelete,
  onToggleComplete,
}: {
  event: CalendarEvent;
  today: Date;
  onClose: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
}) {
  const { visible, close } = usePresence();
  const requestClose = () => close(onClose);
  // Slide the panel away first, then delete, so the undo toast appears on a settled screen.
  const requestDelete = () => close(onDelete);
  useEscape(requestClose);
  useBodyScrollLock();

  const [confirmDelete, setConfirmDelete] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setConfirmDelete(false), [event.id]);

  const meta = EVENT_TYPES[event.type];
  const Icon = meta.icon;
  const date = fromDateKey(eventDateKey(event));
  const relative = relativeDayLabel(date, today);
  const duration = eventDuration(event);
  const completed = event.status === 'COMPLETED';

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-labelledby="event-drawer-title">
      <button
        type="button"
        aria-label="Close event details"
        tabIndex={-1}
        onClick={requestClose}
        className={`absolute inset-0 cursor-default bg-black/30 backdrop-blur-[3px] transition-opacity motion-reduce:transition-none ${
          visible ? `opacity-100 ${MOTION_ENTER}` : `opacity-0 ${MOTION_EXIT}`
        }`}
      />

      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-[var(--line)] bg-[var(--surface-elevated)] shadow-[var(--shadow-popover)] transition-transform will-change-transform motion-reduce:transition-none ${
          visible ? `translate-x-0 ${MOTION_ENTER}` : `translate-x-full ${MOTION_EXIT}`
        }`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-4">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${meta.softClass} ${meta.textClass}`}>
            <Icon size={12} />
            {meta.label}
          </span>
          <IconButton label="Close" icon={X} onClick={requestClose} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {/* Title */}
          <div className="pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={event.priority} />
              <StatusBadge status={event.status} />
              {event.private && (
                <span className="inline-flex items-center gap-1 text-[11.5px] text-[var(--text-subtle)]">
                  <Lock size={11} />
                  Private
                </span>
              )}
            </div>
            <h3
              id="event-drawer-title"
              className={`mt-2 text-[22px] font-semibold leading-tight tracking-[-0.03em] text-[var(--text)] ${
                event.status === 'CANCELLED' ? 'line-through decoration-[var(--text-subtle)]' : ''
              }`}
            >
              {event.private ? 'Private event' : event.title}
            </h3>
          </div>

          {/* When */}
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--surface-muted)]">
              <span className="text-[10.5px] font-medium text-[var(--text-muted)]">
                {MONTHS[date.getMonth()].slice(0, 3)}
              </span>
              <span className="text-[20px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-[var(--text)]">
                {date.getDate()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-[var(--text)]">
                {relative ? `${relative}, ${formatWeekday(date)}` : formatLongDate(date)}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] tabular-nums text-[var(--text-muted)]">
                <Clock3 size={12} />
                {eventTimeLabel(event)}
                {duration !== null && <span className="text-[var(--text-subtle)]">({formatDuration(duration)})</span>}
              </p>
            </div>
          </div>

          {/* Details */}
          <dl className="mt-5 space-y-3.5">
            {event.workspaceLabel && <DetailRow icon={BriefcaseBusiness} label="Workspace" value={event.workspaceLabel} />}
            {event.project && <DetailRow icon={FolderKanban} label="Project" value={event.project} />}
            {event.location && <DetailRow icon={MapPin} label="Location" value={event.location} />}
            {event.meetingUrl && <DetailRow icon={Video} label="Meeting" value={event.meetingUrl} />}
            <DetailRow icon={Users} label="Owner" value={event.owner} />
            {event.createdBy && event.createdBy !== event.owner && (
              <DetailRow icon={Sparkles} label="Created by" value={event.createdBy} />
            )}
          </dl>

          {event.attendees && event.attendees.length > 0 && !event.private && (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <p className="text-[12px] font-semibold text-[var(--text)]">
                Attendees <span className="font-normal text-[var(--text-subtle)]">{event.attendees.length}</span>
              </p>
              <ul className="mt-3 space-y-2">
                {event.attendees.map((person) => (
                  <li key={person.id} className="flex items-center gap-2.5">
                    <Avatar person={person} />
                    <span className="text-[12.5px] text-[var(--text)]">{person.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {event.description && !event.private && (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <p className="text-[12px] font-semibold text-[var(--text)]">Notes</p>
              <p className="mt-2 max-w-[62ch] text-[13px] leading-6 text-[var(--text-muted)]">{event.description}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-5 py-3.5">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[var(--text-muted)]">Delete this event?</span>
              <button
                type="button"
                onClick={requestDelete}
                className={`h-8 rounded-full bg-red-500 px-3 text-[12px] font-semibold text-white hover:bg-red-600 ${FOCUS_RING}`}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className={`h-8 rounded-full px-3 text-[12px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] ${FOCUS_RING}`}
              >
                Keep
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-red-500 transition-colors hover:bg-red-500/10 ${FOCUS_RING}`}
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}

          {!confirmDelete && (
            <div className="flex items-center gap-2">
              {event.status !== 'CANCELLED' && (
                <button type="button" onClick={onToggleComplete} className={PILL_BUTTON}>
                  {completed ? <RotateCcw size={13} /> : <Check size={13} />}
                  {completed ? 'Reopen' : 'Mark complete'}
                </button>
              )}
              <button type="button" onClick={requestClose} className={PRIMARY_BUTTON}>
                Done
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

/* ============================================================================
   PRIMITIVES
============================================================================ */

function ModalShell({
  children,
  visible,
  onClose,
  labelledBy,
}: {
  children: ReactNode;
  visible: boolean;
  onClose: () => void;
  labelledBy: string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 cursor-default bg-black/35 backdrop-blur-[4px] transition-opacity motion-reduce:transition-none ${
          visible ? `opacity-100 ${MOTION_ENTER}` : `opacity-0 ${MOTION_EXIT}`
        }`}
      />
      <div
        className={`relative z-10 flex w-full justify-center transition-[opacity,transform] will-change-transform motion-reduce:transition-none ${
          visible
            ? `translate-y-0 scale-100 opacity-100 ${MOTION_ENTER}`
            : `translate-y-3 scale-[0.97] opacity-0 ${MOTION_EXIT}`
        }`}
      >
        {children}
      </div>
    </div>
  );
}

const TOAST_LIFETIME_MS = 5000;

function ToastBar({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { visible, close } = usePresence();
  // Keep the latest callback in a ref so parent re-renders don't restart the timer.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });
  const dismiss = useCallback(() => close(() => onDismissRef.current()), [close]);

  useEffect(() => {
    const id = window.setTimeout(dismiss, TOAST_LIFETIME_MS);
    return () => window.clearTimeout(id);
  }, [dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 z-[250] flex -translate-x-1/2 items-center gap-3 rounded-full bg-[var(--text)] py-2 pl-4 pr-2 text-[12.5px] text-[var(--surface)] shadow-[var(--shadow-popover)] transition-[opacity,transform] motion-reduce:transition-none ${
        visible ? `translate-y-0 opacity-100 ${MOTION_ENTER}` : `translate-y-3 opacity-0 ${MOTION_EXIT}`
      }`}
    >
      <span className="max-w-[320px] truncate">{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.();
            dismiss();
          }}
          className="rounded-full px-2.5 py-1 text-[12px] font-semibold hover:bg-white/10"
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex h-6 w-6 items-center justify-center rounded-full opacity-70 hover:bg-white/10 hover:opacity-100"
      >
        <X size={12} />
      </button>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={15} className="shrink-0 text-[var(--text-subtle)]" />
      <dt className="w-[88px] shrink-0 text-[12px] text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 truncate text-[12.5px] font-medium text-[var(--text)]">{value}</dd>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: EventPriority }) {
  if (priority === 'NORMAL') return null;
  const high = priority === 'HIGH';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        high ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-[var(--surface-muted)] text-[var(--text-subtle)]'
      }`}
    >
      {high && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
      {high ? 'High priority' : 'Low priority'}
    </span>
  );
}

function StatusBadge({ status }: { status: EventStatus }) {
  if (status === 'SCHEDULED') return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        status === 'COMPLETED'
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
      }`}
    >
      {status === 'COMPLETED' && <Check size={11} />}
      {status === 'COMPLETED' ? 'Completed' : 'Cancelled'}
    </span>
  );
}

function Avatar({ person }: { person: Person }) {
  return (
    <span
      title={person.name}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] text-[10px] font-semibold text-[var(--text-muted)]"
    >
      {person.initials}
    </span>
  );
}

function AvatarStack({ people, max = 3 }: { people: Person[]; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="hidden shrink-0 items-center md:flex" aria-label={`${people.length} attendees`}>
      {shown.map((person, index) => (
        <span key={person.id} className={index ? '-ml-2' : ''}>
          <span className="block rounded-full ring-2 ring-[var(--surface)]">
            <Avatar person={person} />
          </span>
        </span>
      ))}
      {extra > 0 && <span className="ml-1.5 text-[11px] text-[var(--text-subtle)]">+{extra}</span>}
    </span>
  );
}

function Field({
  label,
  optional = false,
  className = '',
  children,
}: {
  label: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-[var(--text-muted)]">
        {label}
        {optional && <span className="text-[11px] font-normal text-[var(--text-subtle)]">Optional</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2.5 rounded-full py-1 pr-1 text-[12.5px] font-medium text-[var(--text)] ${FOCUS_RING}`}
    >
      <span
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-[var(--primary)]' : 'bg-[var(--line)]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
      {label}
    </button>
  );
}

function IconButton({
  label,
  hint,
  icon: Icon,
  size = 'md',
  onClick,
}: {
  label: string;
  hint?: string;
  icon: LucideIcon;
  size?: 'sm' | 'md';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={hint ? `${label} (${hint})` : label}
      onClick={onClick}
      className={`flex shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text)] ${FOCUS_RING} ${
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
      }`}
    >
      <Icon size={size === 'sm' ? 13 : 14} />
    </button>
  );
}

function Kbd({
  children,
  inverted = false,
  className = '',
}: {
  children: ReactNode;
  inverted?: boolean;
  className?: string;
}) {
  return (
    <kbd
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 font-sans text-[10.5px] font-medium ${
        inverted
          ? 'bg-white/15 text-[var(--primary-foreground)]'
          : 'border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text-subtle)]'
      } ${className}`}
    >
      {children}
    </kbd>
  );
}

function EmptySchedule({
  hasActiveFilters,
  onClearFilters,
  onCreate,
}: {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-subtle)]">
        <CalendarDays size={20} />
      </span>
      <p className="mt-4 text-[14px] font-semibold text-[var(--text)]">
        {hasActiveFilters ? 'No events match your filters' : 'Nothing scheduled in the next 30 days'}
      </p>
      <p className="mt-1 max-w-[300px] text-[12.5px] leading-5 text-[var(--text-muted)]">
        {hasActiveFilters
          ? 'Try a different workspace or event type, or clear the filters to see everything.'
          : 'Add meetings, deadlines and releases to keep the team on the same page.'}
      </p>
      <div className="mt-4 flex items-center gap-2">
        {hasActiveFilters && (
          <button type="button" onClick={onClearFilters} className={PILL_BUTTON}>
            Clear filters
          </button>
        )}
        <button type="button" onClick={onCreate} className={PRIMARY_BUTTON}>
          <Plus size={14} />
          New event
        </button>
      </div>
    </div>
  );
}