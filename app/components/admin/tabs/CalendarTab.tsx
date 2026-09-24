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
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from 'framer-motion';
import {
  AlertCircle,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Code2,
  ExternalLink,
  Filter,
  Flag,
  FolderKanban,
  Headphones,
  Loader2,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Video,
  Wand2,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';

/* =============================================================================
 * TYPES
 * =============================================================================
 */

type CalendarView = 'month' | 'week' | 'agenda';

type CalendarSource = 'CALENDAR' | 'LEAVE' | 'INTERVIEW' | 'DEPLOYMENT';

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
  | 'PERSONAL'
  | 'FOCUS'
  | 'REMINDER'
  | 'OTHER'
  | 'LEAVE'
  | 'INTERVIEW';

type ManualEventType = Exclude<EventType, 'LEAVE' | 'INTERVIEW'>;

type EventPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

type EventStatus =
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'APPROVED'
  | 'RECORDED'
  | 'PENDING'
  | string;

type CalendarScope = 'PERSONAL' | 'TEAM' | 'DEPARTMENT' | 'COMPANY' | 'WORKSPACE';

type AttendanceStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';

type CalendarPerson = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  department?: { id: string; name: string } | null;
};

type CalendarAttendee = CalendarPerson & {
  status?: AttendanceStatus;
};

type CalendarItem = {
  id: string;
  source: CalendarSource;
  sourceId: string;
  title: string;
  description?: string | null;
  type: string;
  startAt: string;
  endAt?: string | null;
  allDay: boolean;
  scope?: CalendarScope | null;
  priority?: EventPriority | null;
  status: EventStatus;
  private: boolean;
  editable: boolean;
  deletable: boolean;
  owner?: CalendarPerson | null;
  department?: { id: string; name: string } | null;
  client?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  attendees?: CalendarAttendee[];
  location?: string | null;
  meetingUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

type CalendarViewer = {
  adminId?: string;
  employeeId: string;
  name: string;
  role?: string;
  departmentId?: string | null;
  departmentName?: string | null;
};

type CalendarPermissions = {
  isManager: boolean;
  canCreate: boolean;
  canCreateForOthers: boolean;
  canViewCompany: boolean;
  canFilterEmployees: boolean;
  canFilterDepartments: boolean;
};

type EmployeeOption = {
  id: string;
  name: string;
  jobTitle?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
};

type DepartmentOption = { id: string; name: string };

type ClientOption = { id: string; name: string };

type ProjectOption = {
  id: string;
  name: string;
  clientId?: string | null;
  clientName?: string | null;
};

type CalendarOptions = {
  viewer: CalendarViewer;
  permissions: CalendarPermissions;
  eventTypes: ManualEventType[];
  scopes: CalendarScope[];
  priorities: EventPriority[];
  employees: EmployeeOption[];
  departments: DepartmentOption[];
  clients: ClientOption[];
  projects: ProjectOption[];
};

type CalendarApiResponse =
  | CalendarItem[]
  | {
      items?: CalendarItem[];
      events?: CalendarItem[];
      data?: CalendarItem[];
    };

type EventTypeMeta = {
  label: string;
  icon: LucideIcon;
  dot: string;
  soft: string;
  text: string;
  border: string;
};

type NewEventForm = {
  title: string;
  type: ManualEventType;
  typeAuto: boolean;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  scope: CalendarScope;
  priority: EventPriority;
  private: boolean;
  ownerId: string;
  departmentId: string;
  clientId: string;
  projectId: string;
  attendeeIds: string[];
  location: string;
  meetingUrl: string;
  description: string;
};

type EventDraft = {
  key: number;
  date: Date;
  startTime?: string;
};

type PositionedEvent = {
  event: CalendarItem;
  start: number;
  end: number;
  lane: number;
  lanes: number;
};

type CalendarFilters = {
  employeeId: string;
  departmentId: string;
  clientId: string;
  projectId: string;
};

type ToastState = {
  id: number;
  tone: 'success' | 'error';
  message: string;
} | null;

type DropdownOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  keywords?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
};

/* =============================================================================
 * CONSTANTS
 * =============================================================================
 */

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_HEIGHT = 52;
const DEFAULT_SCROLL_HOUR = 7;
const AGENDA_DAYS = 30;
const MAX_MONTH_EVENTS = 3;
const DURATION_PRESETS = [15, 30, 60, 90, 120];

const DEFAULT_MANUAL_TYPES: ManualEventType[] = [
  'MEETING',
  'DEADLINE',
  'MILESTONE',
  'DEPLOYMENT',
  'RELEASE',
  'FINANCE',
  'SUPPORT',
  'MAINTENANCE',
  'COMPANY',
  'PERSONAL',
  'FOCUS',
  'REMINDER',
  'OTHER',
];

const ALL_DISPLAY_TYPES: EventType[] = [...DEFAULT_MANUAL_TYPES, 'LEAVE', 'INTERVIEW'];

const SOURCE_LABELS: Record<CalendarSource, string> = {
  CALENDAR: 'Calendar',
  LEAVE: 'Leave',
  INTERVIEW: 'Recruitment',
  DEPLOYMENT: 'Engineering',
};

const SCOPE_LABELS: Record<CalendarScope, { label: string; hint: string }> = {
  PERSONAL: { label: 'Only me', hint: 'Just your calendar' },
  TEAM: { label: 'My team', hint: 'People you work with' },
  DEPARTMENT: { label: 'Department', hint: 'Everyone in the department' },
  COMPANY: { label: 'Whole company', hint: 'Everyone at Syntra Grid' },
  WORKSPACE: { label: 'Workspace', hint: 'Everyone with dashboard access' },
};

const PRIORITY_LABELS: Record<EventPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

const EVENT_TYPES: Record<EventType, EventTypeMeta> = {
  MEETING: { label: 'Meeting', icon: Users, dot: 'bg-blue-500', soft: 'bg-blue-500/10', text: 'text-blue-700', border: 'border-l-blue-500' },
  DEADLINE: { label: 'Deadline', icon: Flag, dot: 'bg-red-500', soft: 'bg-red-500/10', text: 'text-red-700', border: 'border-l-red-500' },
  MILESTONE: { label: 'Milestone', icon: Sparkles, dot: 'bg-violet-500', soft: 'bg-violet-500/10', text: 'text-violet-700', border: 'border-l-violet-500' },
  DEPLOYMENT: { label: 'Deployment', icon: Code2, dot: 'bg-emerald-500', soft: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-l-emerald-500' },
  RELEASE: { label: 'Release', icon: Rocket, dot: 'bg-cyan-500', soft: 'bg-cyan-500/10', text: 'text-cyan-700', border: 'border-l-cyan-500' },
  FINANCE: { label: 'Finance', icon: CircleDollarSign, dot: 'bg-[var(--accent)]', soft: 'bg-[color:var(--accent)]/12', text: 'text-[var(--text)]', border: 'border-l-[var(--accent)]' },
  SUPPORT: { label: 'Support', icon: Headphones, dot: 'bg-orange-500', soft: 'bg-orange-500/10', text: 'text-orange-700', border: 'border-l-orange-500' },
  MAINTENANCE: { label: 'Maintenance', icon: Wrench, dot: 'bg-slate-500', soft: 'bg-slate-500/10', text: 'text-slate-700', border: 'border-l-slate-500' },
  COMPANY: { label: 'Company', icon: BriefcaseBusiness, dot: 'bg-fuchsia-500', soft: 'bg-fuchsia-500/10', text: 'text-fuchsia-700', border: 'border-l-fuchsia-500' },
  PERSONAL: { label: 'Personal', icon: CalendarDays, dot: 'bg-teal-500', soft: 'bg-teal-500/10', text: 'text-teal-700', border: 'border-l-teal-500' },
  FOCUS: { label: 'Focus', icon: Clock3, dot: 'bg-indigo-500', soft: 'bg-indigo-500/10', text: 'text-indigo-700', border: 'border-l-indigo-500' },
  REMINDER: { label: 'Reminder', icon: BellRing, dot: 'bg-yellow-500', soft: 'bg-yellow-500/10', text: 'text-yellow-800', border: 'border-l-yellow-500' },
  OTHER: { label: 'Other', icon: CalendarDays, dot: 'bg-zinc-400', soft: 'bg-zinc-500/10', text: 'text-zinc-700', border: 'border-l-zinc-400' },
  LEAVE: { label: 'Leave', icon: CalendarDays, dot: 'bg-rose-500', soft: 'bg-rose-500/10', text: 'text-rose-700', border: 'border-l-rose-500' },
  INTERVIEW: { label: 'Interview', icon: UserRound, dot: 'bg-purple-500', soft: 'bg-purple-500/10', text: 'text-purple-700', border: 'border-l-purple-500' },
};

const TYPE_KEYWORDS: Array<{ type: ManualEventType; words: string[] }> = [
  { type: 'DEPLOYMENT', words: ['deploy', 'deployment', 'rollout', 'migration', 'hotfix'] },
  { type: 'RELEASE', words: ['release', 'launch', 'ship', 'go live', 'golive'] },
  { type: 'DEADLINE', words: ['deadline', 'due', 'submit', 'submission', 'handover'] },
  { type: 'MILESTONE', words: ['milestone', 'phase', 'beta', 'kickoff', 'kick off'] },
  { type: 'FINANCE', words: ['invoice', 'payroll', 'tax', 'vat', 'budget', 'payment', 'accounts'] },
  { type: 'SUPPORT', words: ['support', 'ticket', 'incident', 'outage'] },
  { type: 'MAINTENANCE', words: ['maintenance', 'backup', 'upgrade', 'patch', 'renewal'] },
  { type: 'COMPANY', words: ['all hands', 'town hall', 'company', 'offsite', 'party', 'social'] },
  { type: 'FOCUS', words: ['focus', 'deep work', 'heads down', 'no meetings'] },
  { type: 'REMINDER', words: ['remind', 'reminder', 'follow up', 'chase'] },
  { type: 'PERSONAL', words: ['dentist', 'doctor', 'gym', 'personal', 'appointment'] },
  { type: 'MEETING', words: ['meeting', 'call', 'sync', 'standup', 'stand up', 'review', 'catch up', 'interview', '1:1', 'demo', 'workshop'] },
];

/* =============================================================================
 * HELPERS
 * =============================================================================
 */

const pad = (value: number) => String(value).padStart(2, '0');

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

function parseDate(value: string) {
  return new Date(value);
}

function eventDateKey(event: CalendarItem) {
  return toDateKey(parseDate(event.startAt));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parseDate(iso));
}

function minutesFromIso(iso: string) {
  const date = parseDate(iso);
  return date.getHours() * 60 + date.getMinutes();
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
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return null;
}

function eventType(event: CalendarItem): EventType {
  if (event.source === 'LEAVE') return 'LEAVE';
  if (event.source === 'INTERVIEW') return 'INTERVIEW';
  if (event.source === 'DEPLOYMENT') return 'DEPLOYMENT';
  if (ALL_DISPLAY_TYPES.includes(event.type as EventType)) return event.type as EventType;
  return 'OTHER';
}

function eventMeta(event: CalendarItem) {
  return EVENT_TYPES[eventType(event)];
}

function sortEvents(a: CalendarItem, b: CalendarItem) {
  const aTime = parseDate(a.startAt).getTime();
  const bTime = parseDate(b.startAt).getTime();
  if (aTime !== bTime) return aTime - bTime;
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.title.localeCompare(b.title);
}

function eventTimeLabel(event: CalendarItem) {
  if (event.allDay) return 'All day';
  if (event.endAt) return `${formatTime(event.startAt)} to ${formatTime(event.endAt)}`;
  return formatTime(event.startAt);
}

function eventDuration(event: CalendarItem) {
  if (event.allDay || !event.endAt) return null;
  return Math.max(0, Math.round((parseDate(event.endAt).getTime() - parseDate(event.startAt).getTime()) / 60_000));
}

function nameInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function displayTitle(event: CalendarItem) {
  return event.title || 'Untitled event';
}

function normalizeCalendarItems(response: CalendarApiResponse) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.events)) return response.events;
  if (Array.isArray(response.data)) return response.data;
  return [];
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    if (body && typeof body === 'object') {
      if (typeof body.error === 'string') return body.error;
      if (typeof body.message === 'string') return body.message;
    }
  } catch {
    // Use fallback.
  }
  return fallback;
}

function localDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

function suggestEventType(title: string): ManualEventType | null {
  const text = ` ${title.toLowerCase()} `;

  for (const group of TYPE_KEYWORDS) {
    if (group.words.some((word) => text.includes(` ${word}`))) {
      return group.type;
    }
  }

  return null;
}

function nextHalfHour() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutesToTime(Math.min(Math.ceil((minutes + 1) / 30) * 30, 23 * 60));
}

function safeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function layoutDay(events: CalendarItem[]): PositionedEvent[] {
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

/* =============================================================================
 * MAIN
 * =============================================================================
 */

export default function CalendarTab() {
  const theme = useThemeBridge();

  const [now, setNow] = useState(() => new Date());
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState<CalendarView>('month');

  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [options, setOptions] = useState<CalendarOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<CalendarFilters>({
    employeeId: '',
    departmentId: '',
    clientId: '',
    projectId: '',
  });
  const [enabledTypes, setEnabledTypes] = useState<Set<EventType>>(() => new Set(ALL_DISPLAY_TYPES));

  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((tone: 'success' | 'error', message: string) => {
    setToast({ id: Date.now(), tone, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('syntragrid.calendar.view');
      if (stored === 'month' || stored === 'week' || stored === 'agenda') setView(stored);
    } catch {
      // Storage is optional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('syntragrid.calendar.view', view);
    } catch {
      // Storage is optional.
    }
  }, [view]);

  const today = useMemo(() => startOfDay(now), [now]);

  /* ---------- Range ---------- */

  const visibleRange = useMemo(() => {
    if (view === 'month') {
      const gridStart = startOfWeekMonday(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
      return { start: gridStart, end: addDays(gridStart, 42) };
    }

    if (view === 'week') {
      const start = startOfWeekMonday(currentDate);
      return { start, end: addDays(start, 7) };
    }

    const start = startOfDay(currentDate);
    return { start, end: addDays(start, AGENDA_DAYS) };
  }, [currentDate, view]);

  /* ---------- Data ---------- */

  const loadOptions = useCallback(async () => {
    const response = await fetch('/api/admin/calendar/options', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, 'Could not load calendar options.'));
    }

    const body = (await response.json()) as CalendarOptions;
    setOptions(body);
    setFilters((current) =>
      current.employeeId
        ? current
        : { ...current, employeeId: body.permissions?.canFilterEmployees ? '' : body.viewer.employeeId },
    );
  }, []);

  const loadEvents = useCallback(
    async (quiet = false) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);

      setError('');

      try {
        const params = new URLSearchParams();
        params.set('start', visibleRange.start.toISOString());
        params.set('end', visibleRange.end.toISOString());
        if (filters.employeeId) params.set('employeeId', filters.employeeId);
        if (filters.departmentId) params.set('departmentId', filters.departmentId);
        if (filters.clientId) params.set('clientId', filters.clientId);
        if (filters.projectId) params.set('projectId', filters.projectId);

        const response = await fetch(`/api/admin/calendar?${params.toString()}`, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(await readApiError(response, 'Could not load the calendar.'));
        }

        const body = (await response.json()) as CalendarApiResponse;
        setEvents(normalizeCalendarItems(body).sort(sortEvents));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load the calendar.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters, visibleRange],
  );

  useEffect(() => {
    void loadOptions().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Could not load calendar options.');
    });
  }, [loadOptions]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  /* ---------- Derived ---------- */

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const hiddenTypeCount = ALL_DISPLAY_TYPES.length - enabledTypes.size;

  const employeeLocked = Boolean(options && !options.permissions.canFilterEmployees);

  const activeFilterCount =
    [employeeLocked ? '' : filters.employeeId, filters.departmentId, filters.clientId, filters.projectId].filter(
      Boolean,
    ).length + (hiddenTypeCount > 0 ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0 || search.trim().length > 0;

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events
      .filter((event) => {
        if (!enabledTypes.has(eventType(event))) return false;
        if (!query) return true;

        return [
          event.title,
          event.description,
          event.owner?.name,
          event.department?.name,
          event.client?.name,
          event.project?.name,
          event.location,
          SOURCE_LABELS[event.source],
          ...(event.attendees ?? []).map((attendee) => attendee.name),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);
      })
      .sort(sortEvents);
  }, [enabledTypes, events, search]);

  /*
   * Multi day all day items (leave, for example) appear on every day they
   * cover, not only on their first day.
   */
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const rangeStart = startOfDay(visibleRange.start);

    const add = (key: string, event: CalendarItem) => {
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    };

    filteredEvents.forEach((event) => {
      const first = startOfDay(parseDate(event.startAt));
      const last =
        event.allDay && event.endAt ? startOfDay(parseDate(event.endAt)) : first;

      if (last <= first) {
        add(eventDateKey(event), event);
        return;
      }

      let cursor = first < rangeStart ? rangeStart : first;
      let guard = 0;

      while (cursor <= last && cursor < visibleRange.end && guard < 62) {
        add(toDateKey(cursor), event);
        cursor = addDays(cursor, 1);
        guard += 1;
      }
    });

    return map;
  }, [filteredEvents, visibleRange]);

  const selectedDayEvents = eventsByDate.get(toDateKey(selectedDate)) ?? [];

  const upcomingEvents = useMemo(() => {
    const nowTime = now.getTime();

    return filteredEvents
      .filter(
        (event) =>
          event.status !== 'CANCELLED' && parseDate(event.endAt ?? event.startAt).getTime() >= nowTime,
      )
      .slice(0, 5);
  }, [filteredEvents, now]);

  const rangeSummary = useMemo(() => {
    const inRange = filteredEvents.filter((event) => {
      const time = parseDate(event.startAt).getTime();
      return (
        time >= visibleRange.start.getTime() &&
        time < visibleRange.end.getTime() &&
        event.status !== 'CANCELLED'
      );
    });

    return {
      total: inRange.length,
      high: inRange.filter((event) => event.priority === 'HIGH' || event.priority === 'URGENT').length,
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
      primary: `${formatShortDate(visibleRange.start)} to ${formatShortDate(lastDay)}`,
      secondary: String(lastDay.getFullYear()),
    };
  }, [currentDate, view, visibleRange]);

  const summaryText = loading
    ? 'Loading your schedule'
    : rangeSummary.total === 0
      ? 'Nothing scheduled in this period'
      : `${rangeSummary.total} ${rangeSummary.total === 1 ? 'event' : 'events'}${
          rangeSummary.high ? `, ${rangeSummary.high} high priority` : ''
        }`;

  /* ---------- Navigation ---------- */

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

  /* ---------- Actions ---------- */

  const canCreate = options?.permissions.canCreate ?? false;

  const openCreate = useCallback(
    (date: Date, startTime?: string) => {
      if (!options?.permissions.canCreate) return;
      setSelectedDate(startOfDay(date));
      setDraft({ key: Date.now(), date, startTime });
      setCreateOpen(true);
    },
    [options],
  );

  const openEvent = useCallback((event: CalendarItem) => {
    setSelectedEventId(event.id);
    setDetailOpen(true);
  }, []);

  const toggleType = useCallback((type: EventType) => {
    setEnabledTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const setAllTypes = useCallback((enabled: boolean) => {
    setEnabledTypes(enabled ? new Set(ALL_DISPLAY_TYPES) : new Set());
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setFilters({
      employeeId: options && !options.permissions.canFilterEmployees ? options.viewer.employeeId : '',
      departmentId: '',
      clientId: '',
      projectId: '',
    });
    setEnabledTypes(new Set(ALL_DISPLAY_TYPES));
  }, [options]);

  /* ---------- Shortcuts ---------- */

  const shortcutRef = useRef<(event: KeyboardEvent) => void>(() => undefined);

  shortcutRef.current = (event: KeyboardEvent) => {
    if (createOpen || detailOpen || event.defaultPrevented) return;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchRef.current?.focus();
      return;
    }

    const target = event.target as HTMLElement | null;
    const typing =
      !!target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

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
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => shortcutRef.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------- Render ---------- */

  return (
    <PortalTheme.Provider value={theme.vars}>
      <div ref={theme.ref} className="mx-auto w-full min-w-0 max-w-[1800px] space-y-4">
        <section className="rounded-[26px] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex shrink-0 items-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1">
                <NavButton label="Previous period" hint="Left arrow" icon={ChevronLeft} onClick={() => navigate(-1)} />
                <button
                  type="button"
                  onClick={goToday}
                  title="Go to today (T)"
                  className={cx(
                    'h-8 rounded-lg px-3 text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]',
                    focusRing,
                  )}
                >
                  Today
                </button>
                <NavButton label="Next period" hint="Right arrow" icon={ChevronRight} onClick={() => navigate(1)} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-[20px] font-semibold leading-tight tracking-[-0.03em] text-[var(--text)]">
                    {title.primary}{' '}
                    <span className="font-normal text-[var(--text-subtle)]">{title.secondary}</span>
                  </h2>
                  {refreshing ? <Loader2 size={13} className="animate-spin text-[var(--text-subtle)]" /> : null}
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]" aria-live="polite">
                  {summaryText}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 transition focus-within:border-[var(--accent)] focus-within:bg-[var(--surface)] xl:w-[230px] xl:flex-none">
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
                  placeholder="Search events or people"
                  aria-label="Search calendar"
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className={cx('rounded p-0.5 text-[var(--text-subtle)] hover:text-[var(--text)]', focusRing)}
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <Kbd>/</Kbd>
                )}
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                  disabled={!options}
                  className={cx(
                    'inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[11px] font-semibold transition disabled:opacity-60',
                    activeFilterCount || filtersOpen
                      ? 'border-[var(--accent)] text-[var(--text)]'
                      : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]',
                    focusRing,
                  )}
                >
                  <Filter size={13} />
                  Filters
                  {activeFilterCount > 0 ? (
                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-md bg-[var(--accent)] px-1 text-[9px] font-bold tabular-nums text-white">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>

                <AnimatePresence>
                  {filtersOpen && options ? (
                    <FilterPopover
                      options={options}
                      filters={filters}
                      enabledTypes={enabledTypes}
                      onFiltersChange={setFilters}
                      onToggleType={toggleType}
                      onSetAllTypes={setAllTypes}
                      onReset={clearFilters}
                      onClose={() => setFiltersOpen(false)}
                    />
                  ) : null}
                </AnimatePresence>
              </div>

              <ViewSwitcher value={view} onChange={setView} />

              <button
                type="button"
                onClick={() => void loadEvents(true)}
                disabled={refreshing}
                aria-label="Refresh calendar"
                title="Refresh"
                className={cx(
                  'flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)] disabled:opacity-60',
                  focusRing,
                )}
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              </button>

              <button
                type="button"
                onClick={() => openCreate(selectedDate)}
                disabled={!canCreate}
                className={cx(
                  'inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent)] pl-4 pr-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50',
                  focusRing,
                )}
              >
                <Plus size={14} strokeWidth={2.2} />
                New event
                <kbd className="ml-1 hidden h-5 min-w-5 items-center justify-center rounded-md bg-white/15 px-1.5 text-[9px] font-semibold text-white/90 sm:inline-flex">
                  N
                </kbd>
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {hasActiveFilters ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <ActiveFilters
                  options={options}
                  filters={filters}
                  employeeLocked={employeeLocked}
                  search={search}
                  hiddenTypeCount={hiddenTypeCount}
                  enabledTypeCount={enabledTypes.size}
                  onSearchClear={() => setSearch('')}
                  onFiltersChange={setFilters}
                  onSetAllTypes={setAllTypes}
                  onClearAll={clearFilters}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="flex items-center gap-2 text-[11px] font-medium text-red-600">
              <AlertCircle size={14} />
              {error}
            </p>
            <SecondaryButton onClick={() => void loadEvents()}>
              <RefreshCw size={12} />
              Try again
            </SecondaryButton>
          </div>
        ) : null}

        <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="relative min-w-0 overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm">
            <AnimatePresence>{loading ? <CalendarLoadingOverlay /> : null}</AnimatePresence>

            <div className="overflow-x-auto">
              {view === 'month' ? (
                <MonthView
                  currentDate={currentDate}
                  today={today}
                  selectedDate={selectedDate}
                  eventsByDate={eventsByDate}
                  canCreate={canCreate}
                  onSelectDate={selectDate}
                  onCreate={openCreate}
                  onSelectEvent={openEvent}
                />
              ) : null}

              {view === 'week' ? (
                <WeekView
                  currentDate={currentDate}
                  today={today}
                  now={now}
                  eventsByDate={eventsByDate}
                  canCreate={canCreate}
                  onSelectDate={selectDate}
                  onCreate={openCreate}
                  onSelectEvent={openEvent}
                />
              ) : null}

              {view === 'agenda' ? (
                <AgendaView
                  startDate={currentDate}
                  today={today}
                  eventsByDate={eventsByDate}
                  hasActiveFilters={hasActiveFilters}
                  canCreate={canCreate}
                  onClearFilters={clearFilters}
                  onCreate={() => openCreate(selectedDate)}
                  onSelectEvent={openEvent}
                />
              ) : null}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3">
              <div className="flex flex-wrap items-center gap-0.5">
                {ALL_DISPLAY_TYPES.map((type) => {
                  const meta = EVENT_TYPES[type];
                  const enabled = enabledTypes.has(type);

                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={enabled}
                      onClick={() => toggleType(type)}
                      className={cx(
                        'flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium transition',
                        enabled
                          ? 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)]'
                          : 'text-[var(--text-subtle)] line-through opacity-50',
                        focusRing,
                      )}
                    >
                      <span className={cx('h-2 w-2 rounded-full', meta.dot)} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <p className="hidden text-[10px] text-[var(--text-subtle)] lg:block">
                Leave, interviews and deployments sync in automatically
              </p>
            </footer>
          </div>

          <aside className="min-w-0 overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-sm 2xl:self-start">
            <div className="grid divide-y divide-[var(--line)] md:grid-cols-2 md:divide-x md:divide-y-0 2xl:grid-cols-1 2xl:divide-x-0 2xl:divide-y">
              <MiniCalendar selectedDate={selectedDate} today={today} eventsByDate={eventsByDate} onSelect={jumpToDate} />

              <div className="md:row-span-2 2xl:row-span-1">
                <SelectedDayPanel
                  date={selectedDate}
                  today={today}
                  events={selectedDayEvents}
                  canCreate={canCreate}
                  onCreate={() => openCreate(selectedDate)}
                  onSelectEvent={openEvent}
                />
              </div>

              <UpcomingPanel events={upcomingEvents} today={today} onSelectEvent={openEvent} />
            </div>
          </aside>
        </section>

        {options && draft ? (
          <CreateEventModal
            open={createOpen}
            draft={draft}
            options={options}
            onClose={() => setCreateOpen(false)}
            onCreated={async (message) => {
              setCreateOpen(false);
              notify('success', message);
              await loadEvents(true);
            }}
          />
        ) : null}

        <EventDetailModal
          open={detailOpen}
          event={selectedEvent}
          today={today}
          onClose={() => setDetailOpen(false)}
          onChanged={async (message) => {
            setDetailOpen(false);
            notify('success', message);
            await loadEvents(true);
          }}
        />

        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </PortalTheme.Provider>
  );
}

/* =============================================================================
 * ACTIVE FILTERS
 * =============================================================================
 */

function ActiveFilters({
  options,
  filters,
  employeeLocked,
  search,
  hiddenTypeCount,
  enabledTypeCount,
  onSearchClear,
  onFiltersChange,
  onSetAllTypes,
  onClearAll,
}: {
  options: CalendarOptions | null;
  filters: CalendarFilters;
  employeeLocked: boolean;
  search: string;
  hiddenTypeCount: number;
  enabledTypeCount: number;
  onSearchClear: () => void;
  onFiltersChange: (filters: CalendarFilters) => void;
  onSetAllTypes: (enabled: boolean) => void;
  onClearAll: () => void;
}) {
  const employee = employeeLocked ? null : options?.employees.find((item) => item.id === filters.employeeId);
  const department = options?.departments.find((item) => item.id === filters.departmentId);
  const client = options?.clients.find((item) => item.id === filters.clientId);
  const project = options?.projects.find((item) => item.id === filters.projectId);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] pt-3">
      <span className="text-[10px] text-[var(--text-subtle)]">Showing</span>

      {search.trim() ? <FilterChip label={`Matches "${search.trim()}"`} onRemove={onSearchClear} /> : null}
      {employee ? <FilterChip label={employee.name} onRemove={() => onFiltersChange({ ...filters, employeeId: '' })} /> : null}
      {department ? <FilterChip label={department.name} onRemove={() => onFiltersChange({ ...filters, departmentId: '' })} /> : null}
      {client ? <FilterChip label={client.name} onRemove={() => onFiltersChange({ ...filters, clientId: '', projectId: '' })} /> : null}
      {project ? <FilterChip label={project.name} onRemove={() => onFiltersChange({ ...filters, projectId: '' })} /> : null}
      {hiddenTypeCount > 0 ? (
        <FilterChip label={`${enabledTypeCount} of ${ALL_DISPLAY_TYPES.length} event types`} onRemove={() => onSetAllTypes(true)} />
      ) : null}

      <button
        type="button"
        onClick={onClearAll}
        className={cx(
          'ml-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)] hover:opacity-80',
          focusRing,
        )}
      >
        Clear all
      </button>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] pl-2 pr-0.5 text-[10px] font-medium text-[var(--text)]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className={cx(
          'flex h-5 w-5 items-center justify-center rounded text-[var(--text-subtle)] hover:bg-[var(--surface)] hover:text-[var(--text)]',
          focusRing,
        )}
      >
        <X size={10} />
      </button>
    </span>
  );
}

/* =============================================================================
 * MONTH
 * =============================================================================
 */

function MonthView({
  currentDate,
  today,
  selectedDate,
  eventsByDate,
  canCreate,
  onSelectDate,
  onCreate,
  onSelectEvent,
}: {
  currentDate: Date;
  today: Date;
  selectedDate: Date;
  eventsByDate: Map<string, CalendarItem[]>;
  canCreate: boolean;
  onSelectDate: (date: Date) => void;
  onCreate: (date: Date) => void;
  onSelectEvent: (event: CalendarItem) => void;
}) {
  const days = useMemo(() => {
    const gridStart = startOfWeekMonday(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [currentDate]);

  return (
    <div className="min-w-[760px]">
      <div className="grid grid-cols-7 border-b border-[var(--line)]">
        {WEEK_DAYS.map((day, index) => (
          <div
            key={day}
            className={cx(
              'px-3 py-2.5 text-[9px] font-bold uppercase tracking-[0.12em]',
              index >= 5 ? 'text-[var(--text-subtle)]/70' : 'text-[var(--text-subtle)]',
            )}
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
              canCreate={canCreate}
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
  canCreate,
  onSelect,
  onCreate,
  onSelectEvent,
}: {
  date: Date;
  events: CalendarItem[];
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  isLastColumn: boolean;
  isLastRow: boolean;
  canCreate: boolean;
  onSelect: () => void;
  onCreate: () => void;
  onSelectEvent: (event: CalendarItem) => void;
}) {
  const visible = events.slice(0, MAX_MONTH_EVENTS);
  const remaining = events.length - visible.length;
  const label = date.getDate() === 1 ? formatShortDate(date) : String(date.getDate());

  return (
    <div
      onClick={onSelect}
      onDoubleClick={canCreate ? onCreate : undefined}
      className={cx(
        'group relative flex min-h-[122px] cursor-default flex-col gap-1 border-[var(--line)] p-1.5 transition-colors',
        isSelected
          ? 'bg-[color:var(--accent)]/[0.06]'
          : isWeekend
            ? 'bg-[var(--surface-muted)]/40 hover:bg-[var(--surface-muted)]/70'
            : 'hover:bg-[var(--surface-muted)]/50',
        !isLastColumn && 'border-r',
        !isLastRow && 'border-b',
      )}
    >
      {isSelected ? (
        <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-[color:var(--accent)]/40" />
      ) : null}

      <div className={cx('flex items-center justify-between', !inMonth && 'opacity-45')}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          className={cx(
            'flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
            isToday ? 'bg-[var(--accent)] text-white' : 'text-[var(--text)] hover:bg-[var(--surface-muted)]',
            focusRing,
          )}
        >
          {label}
        </button>

        {canCreate ? (
          <button
            type="button"
            aria-label={`Add an event on ${formatLongDate(date)}`}
            onClick={(event) => {
              event.stopPropagation();
              onCreate();
            }}
            className={cx(
              'flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-subtle)] opacity-0 transition hover:bg-[var(--surface)] hover:text-[var(--accent)] group-hover:opacity-100 focus-visible:opacity-100',
              focusRing,
            )}
          >
            <Plus size={12} />
          </button>
        ) : null}
      </div>

      <div className={cx('space-y-px', !inMonth && 'opacity-45')}>
        {visible.map((event) => (
          <MonthEventChip key={event.id} event={event} onClick={() => onSelectEvent(event)} />
        ))}
      </div>

      {remaining > 0 ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          className={cx(
            'self-start rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--accent)]',
            focusRing,
          )}
        >
          {remaining} more
        </button>
      ) : null}
    </div>
  );
}

function MonthEventChip({ event, onClick }: { event: CalendarItem; onClick: () => void }) {
  const meta = eventMeta(event);

  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick();
      }}
      onDoubleClick={(doubleClick) => doubleClick.stopPropagation()}
      title={`${eventTimeLabel(event)}, ${displayTitle(event)}`}
      className={cx(
        'flex w-full items-center gap-1.5 overflow-hidden rounded-md px-1.5 py-[3px] text-left transition-colors',
        event.allDay ? `border-l-2 ${meta.border} ${meta.soft}` : 'hover:bg-[var(--surface)]',
        event.status === 'CANCELLED' && 'opacity-50 line-through',
        focusRing,
      )}
    >
      {!event.allDay ? <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} /> : null}
      {!event.allDay ? (
        <span className="shrink-0 text-[9.5px] tabular-nums text-[var(--text-subtle)]">{formatTime(event.startAt)}</span>
      ) : null}
      {event.private ? <Lock size={9} className="shrink-0 text-[var(--text-subtle)]" /> : null}
      <span className={cx('truncate text-[10.5px] font-medium', event.allDay ? meta.text : 'text-[var(--text)]')}>
        {displayTitle(event)}
      </span>
    </button>
  );
}

/* =============================================================================
 * WEEK
 * =============================================================================
 */

const WEEK_GRID = 'grid grid-cols-[56px_repeat(7,minmax(0,1fr))]';

function WeekView({
  currentDate,
  today,
  now,
  eventsByDate,
  canCreate,
  onSelectDate,
  onCreate,
  onSelectEvent,
}: {
  currentDate: Date;
  today: Date;
  now: Date;
  eventsByDate: Map<string, CalendarItem[]>;
  canCreate: boolean;
  onSelectDate: (date: Date) => void;
  onCreate: (date: Date, startTime?: string) => void;
  onSelectEvent: (event: CalendarItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const hour = Math.max(0, Math.min(now.getHours() - 1, DEFAULT_SCROLL_HOUR + 3));
      scrollRef.current.scrollTop = Math.min(hour, DEFAULT_SCROLL_HOUR) * HOUR_HEIGHT;
    }
    // Only on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className={cx(WEEK_GRID, 'border-b border-[var(--line)]')}>
        <div />
        {columns.map(({ date, key }, index) => {
          const isToday = isSameDate(date, today);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(date)}
              className={cx(
                'flex items-center justify-center gap-2 border-l border-[var(--line)] py-2.5 transition-colors hover:bg-[var(--surface-muted)]/60',
                focusRing,
              )}
            >
              <span
                className={cx(
                  'text-[9px] font-bold uppercase tracking-[0.12em]',
                  isToday ? 'text-[var(--accent)]' : 'text-[var(--text-subtle)]',
                )}
              >
                {WEEK_DAYS[index]}
              </span>
              <span
                className={cx(
                  'flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[13px] font-semibold tabular-nums',
                  isToday ? 'bg-[var(--accent)] text-white' : 'text-[var(--text)]',
                )}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {hasAllDay ? (
        <div className={cx(WEEK_GRID, 'border-b border-[var(--line)] bg-[var(--surface-muted)]/40')}>
          <div className="flex items-start justify-end px-2 py-2 text-[9px] text-[var(--text-subtle)]">All day</div>
          {columns.map((column) => (
            <div key={column.key} className="space-y-1 border-l border-[var(--line)] p-1.5">
              {column.allDay.map((event) => (
                <MonthEventChip key={event.id} event={event} onClick={() => onSelectEvent(event)} />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div ref={scrollRef} className="max-h-[640px] overflow-y-auto overscroll-contain">
        <div className={cx(WEEK_GRID, 'relative')} style={{ height: 24 * HOUR_HEIGHT }}>
          <div className="relative">
            {HOURS.slice(1).map((hour) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[9.5px] tabular-nums text-[var(--text-subtle)]"
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
                className={cx('relative border-l border-[var(--line)]', isToday && 'bg-[color:var(--accent)]/[0.035]')}
              >
                {HOURS.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    disabled={!canCreate}
                    onClick={() => onCreate(date, `${pad(hour)}:00`)}
                    className="block w-full border-t border-[var(--line)]/60 transition-colors first:border-t-0 enabled:hover:bg-[var(--surface-muted)]/60"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {timed.map((item) => (
                  <TimeGridEvent key={item.event.id} item={item} onClick={() => onSelectEvent(item.event)} />
                ))}

                {isToday ? (
                  <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: nowTop }}>
                    <div className="relative h-[2px] bg-[var(--accent)]">
                      <span className="absolute -left-[5px] -top-[4px] h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--surface)]" />
                    </div>
                  </div>
                ) : null}
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
  const meta = eventMeta(event);
  const top = (start / 60) * HOUR_HEIGHT + 1;
  const height = Math.max(((end - start) / 60) * HOUR_HEIGHT - 3, 22);
  const compact = height < 44;

  return (
    <div
      className="absolute z-10 rounded-lg bg-[var(--surface)] shadow-sm transition-shadow hover:z-20 hover:shadow-md"
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
        className={cx(
          'flex h-full w-full flex-col overflow-hidden rounded-lg border-l-[3px] px-2 text-left',
          meta.soft,
          meta.border,
          compact ? 'justify-center' : 'py-1.5',
          event.status === 'CANCELLED' && 'opacity-50',
          focusRing,
        )}
      >
        <span className={cx('flex items-center gap-1 truncate text-[10.5px] font-semibold', meta.text)}>
          {event.private ? <Lock size={9} className="shrink-0" /> : null}
          {compact ? <span className="font-normal tabular-nums opacity-80">{formatTime(event.startAt)}</span> : null}
          <span className="truncate">{displayTitle(event)}</span>
        </span>
        {!compact ? (
          <span className="mt-0.5 truncate text-[9.5px] tabular-nums text-[var(--text-muted)]">
            {formatTime(event.startAt)} to {minutesToTime(end)}
          </span>
        ) : null}
      </button>
    </div>
  );
}

/* =============================================================================
 * AGENDA
 * =============================================================================
 */

function AgendaView({
  startDate,
  today,
  eventsByDate,
  hasActiveFilters,
  canCreate,
  onClearFilters,
  onCreate,
  onSelectEvent,
}: {
  startDate: Date;
  today: Date;
  eventsByDate: Map<string, CalendarItem[]>;
  hasActiveFilters: boolean;
  canCreate: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
  onSelectEvent: (event: CalendarItem) => void;
}) {
  const groups = useMemo(() => {
    const start = startOfDay(startDate);
    const result: Array<{ date: Date; items: CalendarItem[] }> = [];

    for (let index = 0; index < AGENDA_DAYS; index += 1) {
      const date = addDays(start, index);
      const items = eventsByDate.get(toDateKey(date));
      if (items?.length) result.push({ date, items });
    }

    return result;
  }, [eventsByDate, startDate]);

  if (!groups.length) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-[15px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
          <CalendarDays size={19} strokeWidth={1.8} />
        </span>
        <p className="mt-4 text-[14px] font-semibold text-[var(--text)]">
          {hasActiveFilters ? 'No events match your filters' : 'Nothing in the next 30 days'}
        </p>
        <p className="mt-1 max-w-[320px] text-[11px] leading-5 text-[var(--text-muted)]">
          {hasActiveFilters
            ? 'Try a different person, client, project or event type.'
            : 'Add an event, or wait for leave, interviews and deployments to appear automatically.'}
        </p>
        <div className="mt-4 flex items-center gap-2">
          {hasActiveFilters ? <SecondaryButton onClick={onClearFilters}>Clear filters</SecondaryButton> : null}
          {canCreate ? (
            <PrimaryButton onClick={onCreate}>
              <Plus size={13} />
              New event
            </PrimaryButton>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[560px] min-w-[560px] divide-y divide-[var(--line)]">
      {groups.map(({ date, items }) => {
        const relative = relativeDayLabel(date, today);

        return (
          <section key={toDateKey(date)} className="grid grid-cols-[110px_minmax(0,1fr)] gap-4 px-4 py-4 lg:px-5">
            <div className="pt-1">
              <p
                className={cx(
                  'text-[24px] font-semibold leading-none tabular-nums tracking-[-0.03em]',
                  relative === 'Today' ? 'text-[var(--accent)]' : 'text-[var(--text)]',
                )}
              >
                {date.getDate()}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold text-[var(--text)]">{relative ?? formatWeekday(date)}</p>
              <p className="text-[10px] text-[var(--text-subtle)]">
                {MONTHS[date.getMonth()]} {date.getFullYear()}
              </p>
            </div>

            <div className="space-y-0.5">
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

function AgendaRow({ event, onClick }: { event: CalendarItem; onClick: () => void }) {
  const meta = eventMeta(event);
  const Icon = meta.icon;
  const duration = eventDuration(event);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group flex w-full items-center gap-4 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-muted)]',
        event.status === 'CANCELLED' && 'opacity-60',
        focusRing,
      )}
    >
      <span className="w-[60px] shrink-0">
        <span className="block text-[11px] font-semibold tabular-nums text-[var(--text)]">
          {event.allDay ? 'All day' : formatTime(event.startAt)}
        </span>
        {duration !== null ? (
          <span className="mt-0.5 block text-[9.5px] text-[var(--text-subtle)]">{formatDuration(duration)}</span>
        ) : null}
      </span>

      <span className={cx('h-9 w-[3px] shrink-0 rounded-full', meta.dot)} />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {event.private ? <Lock size={11} className="shrink-0 text-[var(--text-subtle)]" /> : null}
          <span className="truncate text-[12px] font-semibold text-[var(--text)]">{displayTitle(event)}</span>
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--text-muted)]">
          <span className={cx('inline-flex items-center gap-1 font-medium', meta.text)}>
            <Icon size={11} />
            {meta.label}
          </span>
          {event.client ? (
            <span className="inline-flex items-center gap-1">
              <BriefcaseBusiness size={11} />
              {event.client.name}
            </span>
          ) : null}
          {event.project ? (
            <span className="inline-flex items-center gap-1">
              <FolderKanban size={11} />
              {event.project.name}
            </span>
          ) : null}
          {event.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} />
              {event.location}
            </span>
          ) : null}
          {event.meetingUrl && event.source !== 'DEPLOYMENT' ? (
            <span className="inline-flex items-center gap-1">
              <Video size={11} />
              Online
            </span>
          ) : null}
        </span>
      </span>

      {event.attendees?.length ? <AvatarStack people={event.attendees} /> : null}
      <PriorityBadge priority={event.priority} />
      <SourceBadge source={event.source} />
    </button>
  );
}

/* =============================================================================
 * SIDE PANEL
 * =============================================================================
 */

function MiniCalendar({
  selectedDate,
  today,
  eventsByDate,
  onSelect,
}: {
  selectedDate: Date;
  today: Date;
  eventsByDate: Map<string, CalendarItem[]>;
  onSelect: (date: Date) => void;
}) {
  const [month, setMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  useEffect(() => {
    setMonth((current) =>
      isSameMonth(current, selectedDate) ? current : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    );
  }, [selectedDate]);

  const days = useMemo(() => {
    const start = startOfWeekMonday(month);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [month]);

  return (
    <section className="p-4">
      <div className="mb-2 flex items-center justify-between pl-1">
        <p className="text-[12px] font-semibold text-[var(--text)]">
          {MONTHS[month.getMonth()]} <span className="font-normal text-[var(--text-subtle)]">{month.getFullYear()}</span>
        </p>
        <div className="flex">
          <NavButton label="Previous month" icon={ChevronLeft} size="sm" onClick={() => setMonth((value) => addMonths(value, -1))} />
          <NavButton label="Next month" icon={ChevronRight} size="sm" onClick={() => setMonth((value) => addMonths(value, 1))} />
        </div>
      </div>

      <div className="grid grid-cols-7 text-center">
        {WEEK_DAYS.map((day) => (
          <span key={day} className="pb-1 text-[9px] font-semibold text-[var(--text-subtle)]">
            {day.slice(0, 2)}
          </span>
        ))}

        {days.map((date) => {
          const key = toDateKey(date);
          const hasEvents = (eventsByDate.get(key)?.length ?? 0) > 0;
          const selected = isSameDate(date, selectedDate);
          const current = isSameDate(date, today);
          const inMonth = date.getMonth() === month.getMonth();

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(date)}
              aria-label={formatLongDate(date)}
              aria-pressed={selected}
              className={cx(
                'relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[11px] tabular-nums',
                selected
                  ? 'bg-[var(--accent)] font-semibold text-white'
                  : current
                    ? 'font-semibold text-[var(--accent)] hover:bg-[var(--surface-muted)]'
                    : inMonth
                      ? 'text-[var(--text)] hover:bg-[var(--surface-muted)]'
                      : 'text-[var(--text-subtle)]/60',
                focusRing,
              )}
            >
              {date.getDate()}
              {hasEvents && !selected ? (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--accent)]/70" />
              ) : null}
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
  canCreate,
  onCreate,
  onSelectEvent,
}: {
  date: Date;
  today: Date;
  events: CalendarItem[];
  canCreate: boolean;
  onCreate: () => void;
  onSelectEvent: (event: CalendarItem) => void;
}) {
  const relative = relativeDayLabel(date, today);

  return (
    <section className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-[var(--text)]">{relative ?? formatWeekday(date)}</p>
          <p className="mt-0.5 truncate text-[10px] text-[var(--text-subtle)]">{formatLongDate(date)}</p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={onCreate}
            aria-label="Add an event on this day"
            className={cx(
              'flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]',
              focusRing,
            )}
          >
            <Plus size={13} />
          </button>
        ) : null}
      </div>

      <div className="-mx-2 mt-2">
        {events.length ? (
          events.map((event) => <SidebarEventRow key={event.id} event={event} onClick={() => onSelectEvent(event)} />)
        ) : (
          <p className="px-2 py-5 text-[10px] text-[var(--text-subtle)]">
            Nothing scheduled.{canCreate ? ' Double click a day to add something.' : ''}
          </p>
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
  events: CalendarItem[];
  today: Date;
  onSelectEvent: (event: CalendarItem) => void;
}) {
  return (
    <section className="p-4">
      <p className="text-[12px] font-semibold text-[var(--text)]">Coming up</p>
      <div className="-mx-2 mt-2">
        {events.length ? (
          events.map((event) => {
            const date = parseDate(event.startAt);
            return (
              <SidebarEventRow
                key={event.id}
                event={event}
                dateLabel={relativeDayLabel(date, today) ?? formatShortDate(date)}
                onClick={() => onSelectEvent(event)}
              />
            );
          })
        ) : (
          <p className="px-2 py-5 text-[10px] text-[var(--text-subtle)]">Nothing else coming up.</p>
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
  event: CalendarItem;
  dateLabel?: string;
  onClick: () => void;
}) {
  const meta = eventMeta(event);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-stretch gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--surface-muted)]',
        focusRing,
      )}
    >
      <span className="w-[46px] shrink-0 pt-px">
        {dateLabel ? <span className="block text-[9px] text-[var(--text-subtle)]">{dateLabel}</span> : null}
        <span className="block text-[10.5px] font-semibold tabular-nums text-[var(--text)]">
          {event.allDay ? 'All day' : formatTime(event.startAt)}
        </span>
      </span>
      <span className={cx('w-[3px] shrink-0 rounded-full', meta.dot)} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {event.private ? <Lock size={10} className="text-[var(--text-subtle)]" /> : null}
          <span className="truncate text-[11px] font-semibold text-[var(--text)]">{displayTitle(event)}</span>
        </span>
        <span className="mt-0.5 block truncate text-[9.5px] text-[var(--text-subtle)]">
          {event.client?.name ?? event.project?.name ?? meta.label}
        </span>
      </span>
      {event.priority === 'HIGH' || event.priority === 'URGENT' ? (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-label="High priority" />
      ) : null}
    </button>
  );
}

/* =============================================================================
 * VIEW SWITCHER
 * =============================================================================
 */

function ViewSwitcher({ value, onChange }: { value: CalendarView; onChange: (value: CalendarView) => void }) {
  const reduceMotion = useReducedMotion();
  const id = useId();

  const items: Array<{ value: CalendarView; label: string; key: string }> = [
    { value: 'month', label: 'Month', key: 'M' },
    { value: 'week', label: 'Week', key: 'W' },
    { value: 'agenda', label: 'Agenda', key: 'A' },
  ];

  return (
    <div role="radiogroup" aria-label="Calendar view" className="flex h-10 items-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1">
      {items.map((item) => {
        const selected = value === item.value;

        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={`${item.label} (${item.key})`}
            onClick={() => onChange(item.value)}
            className={cx(
              'relative h-full rounded-lg px-3 text-[11px] font-semibold transition-colors',
              selected ? 'text-[var(--text)]' : 'text-[var(--text-subtle)] hover:text-[var(--text)]',
              focusRing,
            )}
          >
            {selected ? (
              <motion.span
                layoutId={`${id}-view`}
                className="absolute inset-0 rounded-lg bg-[var(--surface)] shadow-sm"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }}
              />
            ) : null}
            <span className="relative">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* =============================================================================
 * FILTER POPOVER
 * =============================================================================
 */

function FilterPopover({
  options,
  filters,
  enabledTypes,
  onFiltersChange,
  onToggleType,
  onSetAllTypes,
  onReset,
  onClose,
}: {
  options: CalendarOptions;
  filters: CalendarFilters;
  enabledTypes: Set<EventType>;
  onFiltersChange: (filters: CalendarFilters) => void;
  onToggleType: (type: EventType) => void;
  onSetAllTypes: (enabled: boolean) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest('[data-portal-panel]')) return;
      if (target.closest('[aria-expanded]')?.textContent?.includes('Filters')) return;
      onCloseRef.current();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onCloseRef.current();
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const allEnabled = enabledTypes.size === ALL_DISPLAY_TYPES.length;
  const projects = filters.clientId
    ? options.projects.filter((project) => project.clientId === filters.clientId)
    : options.projects;

  const employeeOptions: Array<DropdownOption<string>> = [
    { value: '', label: 'Everyone', leading: <PersonAvatar name="" /> },
    ...options.employees.map((employee) => ({
      value: employee.id,
      label: employee.name,
      hint: employee.jobTitle ?? employee.departmentName ?? undefined,
      leading: <PersonAvatar name={employee.name} />,
    })),
  ];

  const departmentOptions: Array<DropdownOption<string>> = [
    { value: '', label: 'All departments' },
    ...options.departments.map((item) => ({ value: item.id, label: item.name })),
  ];

  const clientOptions: Array<DropdownOption<string>> = [
    { value: '', label: 'All clients' },
    ...options.clients.map((item) => ({ value: item.id, label: item.name })),
  ];

  const projectOptions: Array<DropdownOption<string>> = [
    { value: '', label: 'All projects' },
    ...projects.map((item) => ({ value: item.id, label: item.name, hint: item.clientName ?? undefined })),
  ];

  return (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-label="Calendar filters"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
      transition={reduceMotion ? { duration: 0.1 } : { type: 'spring', stiffness: 480, damping: 34 }}
      style={{ transformOrigin: 'top right' }}
      className="absolute right-0 top-[calc(100%+8px)] z-[70] w-[340px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)] shadow-xl"
    >
      <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
        {options.permissions.canFilterEmployees ? (
          <Field label="Person" as="div">
            <Dropdown
              value={filters.employeeId}
              onChange={(value) => onFiltersChange({ ...filters, employeeId: value })}
              options={employeeOptions}
              ariaLabel="Filter by person"
              searchable={employeeOptions.length > 7}
              searchPlaceholder="Search people"
            />
          </Field>
        ) : null}

        {options.permissions.canFilterDepartments ? (
          <Field label="Department" as="div">
            <Dropdown
              value={filters.departmentId}
              onChange={(value) => onFiltersChange({ ...filters, departmentId: value })}
              options={departmentOptions}
              ariaLabel="Filter by department"
              searchable={departmentOptions.length > 7}
              searchPlaceholder="Search departments"
            />
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Client" as="div">
            <Dropdown
              value={filters.clientId}
              onChange={(value) => onFiltersChange({ ...filters, clientId: value, projectId: '' })}
              options={clientOptions}
              ariaLabel="Filter by client"
              searchable={clientOptions.length > 7}
              searchPlaceholder="Search clients"
              minWidth={220}
            />
          </Field>
          <Field label="Project" as="div">
            <Dropdown
              value={filters.projectId}
              onChange={(value) => onFiltersChange({ ...filters, projectId: value })}
              options={projectOptions}
              ariaLabel="Filter by project"
              searchable={projectOptions.length > 7}
              searchPlaceholder="Search projects"
              minWidth={220}
            />
          </Field>
        </div>

        <div className="border-t border-[var(--line)] pt-3">
          <div className="flex items-center justify-between pb-2">
            <p className="text-[11px] font-semibold text-[var(--text)]">Event types</p>
            <button
              type="button"
              onClick={() => onSetAllTypes(!allEnabled)}
              className={cx('rounded text-[10px] font-semibold text-[var(--accent)] hover:opacity-80', focusRing)}
            >
              {allEnabled ? 'Hide all' : 'Show all'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-0.5">
            {ALL_DISPLAY_TYPES.map((type) => {
              const meta = EVENT_TYPES[type];
              const enabled = enabledTypes.has(type);

              return (
                <button
                  key={type}
                  type="button"
                  role="checkbox"
                  aria-checked={enabled}
                  onClick={() => onToggleType(type)}
                  className={cx(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--surface-muted)]',
                    focusRing,
                  )}
                >
                  <span
                    className={cx(
                      'flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors',
                      enabled ? cx(meta.dot, 'border-transparent text-white') : 'border-[var(--line)]',
                    )}
                  >
                    {enabled ? <Check size={10} strokeWidth={3} /> : null}
                  </span>
                  <span className="truncate text-[11px] text-[var(--text)]">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3">
        <button
          type="button"
          onClick={onReset}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-md text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)]',
            focusRing,
          )}
        >
          <RotateCcw size={11} />
          Reset
        </button>
        <PrimaryButton onClick={onClose}>Done</PrimaryButton>
      </div>
    </motion.div>
  );
}

/* =============================================================================
 * CREATE EVENT
 * =============================================================================
 */

function CreateEventModal({
  open,
  draft,
  options,
  onClose,
  onCreated,
}: {
  open: boolean;
  draft: EventDraft;
  options: CalendarOptions;
  onClose: () => void;
  onCreated: (message: string) => Promise<void>;
}) {
  const titleId = useId();

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={titleId}>
      <CreateEventForm key={draft.key} titleId={titleId} draft={draft} options={options} onClose={onClose} onCreated={onCreated} />
    </ModalShell>
  );
}

function CreateEventForm({
  titleId,
  draft,
  options,
  onClose,
  onCreated,
}: {
  titleId: string;
  draft: EventDraft;
  options: CalendarOptions;
  onClose: () => void;
  onCreated: (message: string) => Promise<void>;
}) {
  const reduceMotion = useReducedMotion();

  const allowedScopes: CalendarScope[] = options.scopes?.length ? options.scopes : ['PERSONAL'];
  const allowedTypes: ManualEventType[] = options.eventTypes?.length ? options.eventTypes : DEFAULT_MANUAL_TYPES;
  const allowedPriorities: EventPriority[] = options.priorities?.length
    ? options.priorities
    : ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

  const [form, setForm] = useState<NewEventForm>(() => {
    const start =
      draft.startTime ?? (isSameDate(draft.date, new Date()) ? nextHalfHour() : '09:00');

    return {
      title: '',
      type: allowedTypes.includes('MEETING') ? 'MEETING' : (allowedTypes[0] ?? 'OTHER'),
      typeAuto: true,
      date: toDateKey(draft.date),
      startTime: start,
      endTime: minutesToTime(timeToMinutes(start) + 60),
      allDay: false,
      scope: allowedScopes.includes('PERSONAL') ? 'PERSONAL' : allowedScopes[0],
      priority: allowedPriorities.includes('NORMAL') ? 'NORMAL' : allowedPriorities[0],
      private: false,
      ownerId: options.viewer.employeeId,
      departmentId: '',
      clientId: '',
      projectId: '',
      attendeeIds: [],
      location: '',
      meetingUrl: '',
      description: '',
    };
  });

  const [issue, setIssue] = useState('');
  const [titleError, setTitleError] = useState('');
  const [saving, setSaving] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [attendeeQuery, setAttendeeQuery] = useState('');

  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform),
    [],
  );

  const suggested = suggestEventType(form.title);
  const type: ManualEventType =
    form.typeAuto && suggested && allowedTypes.includes(suggested) ? suggested : form.type;
  const meta = EVENT_TYPES[type];
  const TypeIcon = meta.icon;
  const duration = timeToMinutes(form.endTime) - timeToMinutes(form.startTime);

  const update = <K extends keyof NewEventForm>(key: K, value: NewEventForm[K]) => {
    setIssue('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  const setStartTime = (value: string) => {
    if (!value) return;
    setForm((current) => {
      const length = Math.max(timeToMinutes(current.endTime) - timeToMinutes(current.startTime), 15);
      return { ...current, startTime: value, endTime: minutesToTime(timeToMinutes(value) + length) };
    });
  };

  const projects = form.clientId
    ? options.projects.filter((project) => project.clientId === form.clientId)
    : options.projects;

  const employeesById = useMemo(() => new Map(options.employees.map((item) => [item.id, item])), [options.employees]);

  const attendeeMatches = useMemo(() => {
    const query = attendeeQuery.trim().toLowerCase();
    return options.employees
      .filter((employee) => employee.id !== form.ownerId)
      .filter(
        (employee) =>
          !query ||
          [employee.name, employee.jobTitle, employee.departmentName].filter(Boolean).join(' ').toLowerCase().includes(query),
      )
      .slice(0, 30);
  }, [attendeeQuery, form.ownerId, options.employees]);

  const toggleAttendee = (id: string) => {
    setForm((current) => ({
      ...current,
      attendeeIds: current.attendeeIds.includes(id)
        ? current.attendeeIds.filter((value) => value !== id)
        : [...current.attendeeIds, id],
    }));
  };

  const scopeOptions: Array<DropdownOption<CalendarScope>> = allowedScopes.map((scope) => ({
    value: scope,
    label: SCOPE_LABELS[scope]?.label ?? scope,
    hint: SCOPE_LABELS[scope]?.hint,
  }));

  const ownerOptions: Array<DropdownOption<string>> = options.employees.map((employee) => ({
    value: employee.id,
    label: employee.id === options.viewer.employeeId ? `${employee.name} (you)` : employee.name,
    hint: employee.jobTitle ?? employee.departmentName ?? undefined,
    leading: <PersonAvatar name={employee.name} />,
  }));

  const departmentOptions: Array<DropdownOption<string>> = [
    { value: '', label: 'None' },
    ...options.departments.map((item) => ({ value: item.id, label: item.name })),
  ];

  const clientOptions: Array<DropdownOption<string>> = [
    { value: '', label: 'None' },
    ...options.clients.map((item) => ({ value: item.id, label: item.name })),
  ];

  const projectOptions: Array<DropdownOption<string>> = [
    { value: '', label: 'None' },
    ...projects.map((item) => ({ value: item.id, label: item.name, hint: item.clientName ?? undefined })),
  ];

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (saving) return;

    if (!form.title.trim()) {
      setTitleError('Give the event a title.');
      return;
    }

    if (!form.allDay && duration <= 0) {
      setIssue('The end time needs to be after the start time.');
      return;
    }

    setSaving(true);
    setIssue('');

    try {
      const response = await fetch('/api/admin/calendar', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          type,
          startAt: localDateTime(form.date, form.allDay ? '00:00' : form.startTime),
          endAt: form.allDay ? null : localDateTime(form.date, form.endTime),
          allDay: form.allDay,
          scope: form.scope,
          priority: form.priority,
          private: form.private,
          ownerId: form.ownerId,
          departmentId: form.departmentId || null,
          clientId: form.clientId || null,
          projectId: form.projectId || null,
          attendeeIds: form.attendeeIds,
          location: form.location.trim() || null,
          meetingUrl: safeUrl(form.meetingUrl),
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not create the event.'));
      }

      await onCreated(`${form.title.trim()} added to the calendar`);
    } catch (submitError) {
      setIssue(submitError instanceof Error ? submitError.message : 'Could not create the event.');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void submit();
    }
  };

  const dateLabel = formatLongDate(new Date(`${form.date}T00:00:00`));
  const hasExtras =
    form.clientId || form.projectId || form.departmentId || form.location || form.meetingUrl || form.description;

  return (
    <form
      onSubmit={submit}
      onKeyDown={onKeyDown}
      noValidate
      className="flex max-h-[92dvh] min-h-0 flex-col sm:max-h-[min(88dvh,880px)]"
    >
      <div className="border-b border-[var(--line)] px-5 pb-5 pt-4 sm:px-7 sm:pt-6">
        <div className="flex items-start gap-4">
          <span className={cx('relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-[var(--line)]', meta.soft, meta.text)}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={type}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                className="flex"
              >
                <TypeIcon size={21} strokeWidth={1.8} />
              </motion.span>
            </AnimatePresence>
          </span>

          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              New event
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
              {dateLabel}
              {form.allDay ? ', all day' : `, ${form.startTime} to ${form.endTime}`}
            </p>
          </div>

          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 flex items-center gap-1 text-[9px] font-semibold text-[var(--text-muted)]">
            Event title <span className="text-[var(--accent)]">*</span>
          </span>
          <input
            data-autofocus
            value={form.title}
            onChange={(event) => {
              update('title', event.target.value);
              setTitleError('');
            }}
            placeholder="Type a title, e.g. Weekly sync with Zing"
            aria-invalid={Boolean(titleError)}
            className={cx(inputClass(titleError || undefined), 'h-11 text-[13px] font-semibold')}
          />
        </label>
        {titleError ? <p className="mt-1 text-[9px] font-medium text-red-600">{titleError}</p> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[9px] font-semibold text-[var(--text-muted)]">Type</span>
          {form.typeAuto && suggested ? (
            <span className="inline-flex items-center gap-1 text-[8px] font-semibold text-[var(--accent)]">
              <Wand2 size={9} />
              Matched to the title
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allowedTypes.map((item) => {
            const itemMeta = EVENT_TYPES[item];
            const selected = type === item;

            return (
              <button
                key={item}
                type="button"
                aria-pressed={selected}
                onClick={() => setForm((current) => ({ ...current, type: item, typeAuto: false }))}
                className={cx(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10.5px] font-semibold transition-colors',
                  selected
                    ? cx('border-transparent', itemMeta.soft, itemMeta.text)
                    : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]',
                  focusRing,
                )}
              >
                <span className={cx('h-2 w-2 rounded-full', itemMeta.dot)} />
                {itemMeta.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-[18px] border border-[var(--line)] p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Date" className="min-w-[160px] flex-1">
              <input
                type="date"
                value={form.date}
                onChange={(event) => event.target.value && update('date', event.target.value)}
                className={cx(inputClass(), '[color-scheme:light]')}
              />
            </Field>

            {!form.allDay ? (
              <>
                <Field label="Starts" className="w-[118px]">
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className={cx(inputClass(), '[color-scheme:light] tabular-nums')}
                  />
                </Field>
                <Field label="Ends" className="w-[118px]">
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) => update('endTime', event.target.value)}
                    className={cx(inputClass(duration <= 0 ? 'bad' : undefined), '[color-scheme:light] tabular-nums')}
                  />
                </Field>
              </>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-[11px] font-semibold text-[var(--text)]">
              <Switch checked={form.allDay} onChange={(value) => update('allDay', value)} label="All day" />
              All day
            </label>

            {!form.allDay ? (
              <div className="flex flex-wrap items-center gap-1">
                {DURATION_PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => update('endTime', minutesToTime(timeToMinutes(form.startTime) + minutes))}
                    className={cx(
                      'h-7 rounded-lg px-2.5 text-[10px] font-semibold tabular-nums transition-colors',
                      duration === minutes
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-muted)] hover:bg-[var(--surface-muted)]',
                      focusRing,
                    )}
                  >
                    {formatDuration(minutes)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Who can see it" as="div">
            <Dropdown value={form.scope} onChange={(value) => update('scope', value)} options={scopeOptions} ariaLabel="Visibility" minWidth={240} />
          </Field>

          <Field label="Priority" as="div">
            <Segmented
              value={form.priority}
              onChange={(value) => update('priority', value)}
              ariaLabel="Priority"
              options={allowedPriorities.map((value) => ({
                value,
                label: PRIORITY_LABELS[value],
                leading:
                  value === 'HIGH' || value === 'URGENT' ? (
                    <span className={cx('h-1.5 w-1.5 rounded-full', value === 'URGENT' ? 'bg-red-600' : 'bg-red-400')} />
                  ) : undefined,
              }))}
            />
          </Field>
        </div>

        {options.permissions.canCreateForOthers ? (
          <Field label="Whose calendar" as="div" className="mt-4">
            <Dropdown
              value={form.ownerId}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  ownerId: value,
                  attendeeIds: current.attendeeIds.filter((id) => id !== value),
                }))
              }
              options={ownerOptions}
              ariaLabel="Event owner"
              searchable={ownerOptions.length > 7}
              searchPlaceholder="Search people"
              minWidth={280}
            />
          </Field>
        ) : null}

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[9px] font-semibold text-[var(--text-muted)]">People</span>
            {form.attendeeIds.length ? (
              <span className="text-[9px] text-[var(--text-subtle)]">{form.attendeeIds.length} invited</span>
            ) : null}
          </div>

          {form.attendeeIds.length ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {form.attendeeIds.map((id) => {
                const person = employeesById.get(id);
                if (!person) return null;
                return (
                  <span key={id} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] py-0.5 pl-0.5 pr-1 text-[10px] font-semibold text-[var(--text)]">
                    <PersonAvatar name={person.name} />
                    {person.name}
                    <button
                      type="button"
                      onClick={() => toggleAttendee(id)}
                      aria-label={`Remove ${person.name}`}
                      className={cx('flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-subtle)] hover:bg-white hover:text-[var(--text)]', focusRing)}
                    >
                      <X size={10} />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[14px] border border-[var(--line)]">
            <div className="relative border-b border-[var(--line)]">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
              <input
                value={attendeeQuery}
                onChange={(event) => setAttendeeQuery(event.target.value)}
                placeholder="Invite people by name"
                aria-label="Search people to invite"
                className="h-9 w-full bg-transparent pl-8 pr-3 text-[11px] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
              />
            </div>
            <div className="max-h-[164px] overflow-y-auto p-1">
              {attendeeMatches.length ? (
                attendeeMatches.map((employee) => {
                  const selected = form.attendeeIds.includes(employee.id);
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      role="checkbox"
                      aria-checked={selected}
                      onClick={() => toggleAttendee(employee.id)}
                      className={cx('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--surface-muted)]', focusRing)}
                    >
                      <PersonAvatar name={employee.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-[var(--text)]">{employee.name}</span>
                        <span className="block truncate text-[9.5px] text-[var(--text-subtle)]">
                          {employee.jobTitle ?? employee.departmentName ?? 'Team'}
                        </span>
                      </span>
                      <span
                        className={cx(
                          'flex h-4 w-4 items-center justify-center rounded-[5px] border',
                          selected ? 'border-transparent bg-[var(--accent)] text-white' : 'border-[var(--line)]',
                        )}
                      >
                        {selected ? <Check size={10} strokeWidth={3} /> : null}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-4 text-center text-[10px] text-[var(--text-subtle)]">Nobody matches that name.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            aria-expanded={moreOpen}
            className={cx('flex w-full items-center justify-between rounded-xl py-2 text-left', focusRing)}
          >
            <span>
              <span className="block text-[11px] font-semibold text-[var(--text)]">Where, links and notes</span>
              <span className="mt-0.5 block text-[9px] text-[var(--text-subtle)]">
                {hasExtras ? 'Details added' : 'Location, meeting link, client, project and notes'}
              </span>
            </span>
            <ChevronDown size={15} className={cx('text-[var(--text-subtle)] transition-transform duration-200', moreOpen && 'rotate-180')} />
          </button>

          <AnimatePresence initial={false}>
            {moreOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.26, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pb-1 pt-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Location" hint="Optional">
                      <input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="Office, venue or address" className={inputClass()} />
                    </Field>
                    <Field label="Meeting link" hint="Optional">
                      <input value={form.meetingUrl} onChange={(event) => update('meetingUrl', event.target.value)} placeholder="meet.google.com/abc" className={inputClass()} />
                    </Field>
                  </div>

                  {options.permissions.isManager ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Client" as="div" hint="Optional">
                          <Dropdown
                            value={form.clientId}
                            onChange={(value) => setForm((current) => ({ ...current, clientId: value, projectId: '' }))}
                            options={clientOptions}
                            ariaLabel="Client"
                            searchable={clientOptions.length > 7}
                            searchPlaceholder="Search clients"
                          />
                        </Field>
                        <Field label="Project" as="div" hint={form.projectId && !form.clientId ? undefined : 'Optional'}>
                          <Dropdown
                            value={form.projectId}
                            onChange={(value) => {
                              const project = options.projects.find((item) => item.id === value);
                              setForm((current) => ({
                                ...current,
                                projectId: value,
                                clientId: project?.clientId && !current.clientId ? project.clientId : current.clientId,
                              }));
                            }}
                            options={projectOptions}
                            ariaLabel="Project"
                            searchable={projectOptions.length > 7}
                            searchPlaceholder="Search projects"
                          />
                        </Field>
                      </div>
                      <Field label="Department" as="div" hint="Optional">
                        <Dropdown
                          value={form.departmentId}
                          onChange={(value) => update('departmentId', value)}
                          options={departmentOptions}
                          ariaLabel="Department"
                          searchable={departmentOptions.length > 7}
                          searchPlaceholder="Search departments"
                        />
                      </Field>
                    </>
                  ) : null}

                  <Field label="Notes" hint="Optional">
                    <textarea
                      value={form.description}
                      onChange={(event) => update('description', event.target.value)}
                      rows={3}
                      placeholder="Agenda, prep or anything people should know"
                      className={cx(inputClass(), 'h-auto resize-none py-2.5 leading-5')}
                    />
                  </Field>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-[18px] border border-[var(--line)] px-4 py-3">
          <div className="flex items-start gap-3">
            <Lock size={14} className="mt-0.5 shrink-0 text-[var(--text-subtle)]" />
            <div>
              <p className="text-[11px] font-semibold text-[var(--text)]">Private</p>
              <p className="mt-0.5 text-[10px] leading-4 text-[var(--text-subtle)]">Others only see that you are busy.</p>
            </div>
          </div>
          <Switch checked={form.private} onChange={(value) => update('private', value)} label="Private event" />
        </div>

        {issue ? (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3 text-[10px] font-medium leading-5 text-red-600">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            {issue}
          </p>
        ) : null}
      </div>

      <div className="border-t border-[var(--line)] bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <p className="hidden items-center gap-1.5 text-[9px] text-[var(--text-subtle)] sm:flex">
            <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>Enter</Kbd>
            to create
          </p>
          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={cx('h-10 flex-1 rounded-xl border border-[var(--line)] px-4 text-[10px] font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] disabled:opacity-50 sm:flex-none', focusRing)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cx('inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60 sm:min-w-[140px] sm:flex-none', focusRing)}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {saving ? 'Creating' : 'Create event'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* =============================================================================
 * EVENT DETAIL
 * =============================================================================
 */

function EventDetailModal({
  open,
  event,
  today,
  onClose,
  onChanged,
}: {
  open: boolean;
  event: CalendarItem | null;
  today: Date;
  onClose: () => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const titleId = useId();

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={titleId}>
      {event ? <EventDetail key={event.id} titleId={titleId} event={event} today={today} onClose={onClose} onChanged={onChanged} /> : null}
    </ModalShell>
  );
}

function EventDetail({
  titleId,
  event,
  today,
  onClose,
  onChanged,
}: {
  titleId: string;
  event: CalendarItem;
  today: Date;
  onClose: () => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [issue, setIssue] = useState('');

  const meta = eventMeta(event);
  const Icon = meta.icon;
  const date = parseDate(event.startAt);
  const relative = relativeDayLabel(date, today);
  const duration = eventDuration(event);
  const canDelete = event.source === 'CALENDAR' && event.deletable;
  const meetingHref = event.meetingUrl ? safeUrl(event.meetingUrl) : null;

  const remove = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setIssue('');

    try {
      const response = await fetch(`/api/admin/calendar/events/${encodeURIComponent(event.sourceId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Could not delete this event.'));
      }

      await onChanged('Event removed from the calendar');
    } catch (deleteError) {
      setIssue(deleteError instanceof Error ? deleteError.message : 'Could not delete this event.');
      setDeleting(false);
    }
  };

  const details: Array<{ icon: LucideIcon; label: string; value: string }> = [
    event.owner ? { icon: UserRound, label: 'Owner', value: event.owner.name } : null,
    event.department ? { icon: Building2, label: 'Department', value: event.department.name } : null,
    event.client ? { icon: BriefcaseBusiness, label: 'Client', value: event.client.name } : null,
    event.project ? { icon: FolderKanban, label: 'Project', value: event.project.name } : null,
    event.location ? { icon: MapPin, label: 'Location', value: event.location } : null,
    event.scope ? { icon: Users, label: 'Visible to', value: SCOPE_LABELS[event.scope]?.label ?? event.scope } : null,
  ].filter((item): item is { icon: LucideIcon; label: string; value: string } => Boolean(item));

  const notice =
    event.source === 'LEAVE'
      ? 'This absence comes from Leave. Change it from the original leave request.'
      : event.source === 'INTERVIEW'
        ? 'This interview comes from Recruitment and is read only here.'
        : event.source === 'DEPLOYMENT'
          ? 'This deployment is synced from Engineering and is read only here.'
          : null;

  return (
    <div className="flex max-h-[92dvh] min-h-0 flex-col sm:max-h-[min(88dvh,820px)]">
      <div className="flex items-start gap-4 border-b border-[var(--line)] px-5 pb-5 pt-4 sm:px-7 sm:pt-6">
        <span className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-[var(--line)]', meta.soft, meta.text)}>
          <Icon size={19} strokeWidth={1.8} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cx('text-[9px] font-bold uppercase tracking-[0.1em]', meta.text)}>{meta.label}</span>
            <SourceBadge source={event.source} />
            <PriorityBadge priority={event.priority} />
            {event.private ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[var(--text-subtle)]">
                <Lock size={9} />
                Private
              </span>
            ) : null}
            {event.status === 'CANCELLED' ? (
              <span className="rounded-md border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-red-700">
                Cancelled
              </span>
            ) : null}
          </div>
          <h2 id={titleId} className="mt-1 text-[18px] font-semibold leading-tight tracking-[-0.03em] text-[var(--text)]">
            {displayTitle(event)}
          </h2>
        </div>

        <IconButton label="Close" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[16px] border border-[var(--line)]">
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--accent)]">
              {MONTHS[date.getMonth()].slice(0, 3)}
            </span>
            <span className="text-[20px] font-semibold leading-none tabular-nums text-[var(--text)]">{date.getDate()}</span>
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--text)]">
              {relative ? `${relative}, ${formatWeekday(date)}` : formatLongDate(date)}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <Clock3 size={11} />
              {eventTimeLabel(event)}
              {duration !== null ? <span className="text-[var(--text-subtle)]">· {formatDuration(duration)}</span> : null}
            </p>
          </div>

          {meetingHref ? (
            <a
              href={meetingHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cx('ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3.5 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90', focusRing)}
            >
              {event.source === 'DEPLOYMENT' ? <Rocket size={13} /> : <Video size={13} />}
              {event.source === 'DEPLOYMENT' ? 'Open deployment' : 'Join'}
              <ExternalLink size={10} className="opacity-70" />
            </a>
          ) : null}
        </div>

        {details.length ? (
          <dl className="mt-5 divide-y divide-[var(--line)] rounded-[16px] border border-[var(--line)]">
            {details.map((item) => {
              const ItemIcon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 px-4 py-2.5">
                  <ItemIcon size={13} className="shrink-0 text-[var(--text-subtle)]" />
                  <dt className="w-[84px] shrink-0 text-[10px] text-[var(--text-subtle)]">{item.label}</dt>
                  <dd className="min-w-0 truncate text-[11px] font-semibold text-[var(--text)]">{item.value}</dd>
                </div>
              );
            })}
          </dl>
        ) : null}

        {event.attendees?.length ? (
          <div className="mt-5">
            <p className="text-[11px] font-semibold text-[var(--text)]">
              People <span className="font-normal text-[var(--text-subtle)]">{event.attendees.length}</span>
            </p>
            <ul className="mt-2 space-y-1.5">
              {event.attendees.map((person) => (
                <li key={person.id} className="flex items-center gap-2.5">
                  <PersonAvatar name={person.name} avatarUrl={person.avatarUrl} />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--text)]">{person.name}</span>
                  {person.status ? <AttendanceBadge status={person.status} /> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {event.description ? (
          <div className="mt-5">
            <p className="text-[11px] font-semibold text-[var(--text)]">Notes</p>
            <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-6 text-[var(--text-muted)]">{event.description}</p>
          </div>
        ) : null}

        {notice ? (
          <p className="mt-5 rounded-[14px] bg-[var(--surface-muted)] px-4 py-3 text-[10px] leading-5 text-[var(--text-muted)]">{notice}</p>
        ) : null}

        {issue ? (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3 text-[10px] font-medium text-red-600">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            {issue}
          </p>
        ) : null}
      </div>

      <div className="border-t border-[var(--line)] bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
        <div className="flex items-center justify-between gap-2">
          {canDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-muted)]">Delete this event?</span>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void remove()}
                  className={cx('inline-flex h-9 items-center gap-1.5 rounded-xl bg-red-600 px-3 text-[10px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60', focusRing)}
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : null}
                  {deleting ? 'Deleting' : 'Delete'}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                  className={cx('h-9 rounded-xl border border-[var(--line)] px-3 text-[10px] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]', focusRing)}
                >
                  Keep
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className={cx('inline-flex h-9 items-center gap-1.5 rounded-xl px-2 text-[10px] font-semibold text-[var(--text-subtle)] transition hover:text-red-600', focusRing)}
              >
                <Trash2 size={12} />
                Delete
              </button>
            )
          ) : (
            <span className="text-[10px] text-[var(--text-subtle)]">
              {event.source === 'CALENDAR' ? 'Read only' : `Managed in ${SOURCE_LABELS[event.source]}`}
            </span>
          )}

          {!confirmDelete ? (
            <button
              type="button"
              onClick={onClose}
              className={cx('h-10 rounded-xl border border-[var(--line)] px-5 text-[10px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)]', focusRing)}
            >
              Done
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 * CALENDAR UI
 * =============================================================================
 */

function CalendarLoadingOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-[var(--surface)]/60 backdrop-blur-[1px]"
    >
      <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[11px] font-semibold text-[var(--text-muted)] shadow-sm">
        <Loader2 size={13} className="animate-spin" />
        Loading calendar
      </div>
    </motion.div>
  );
}

function NavButton({
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
      className={cx(
        'flex shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        focusRing,
      )}
    >
      <Icon size={size === 'sm' ? 13 : 14} />
    </button>
  );
}

function PriorityBadge({ priority }: { priority?: EventPriority | null }) {
  if (!priority || priority === 'NORMAL') return null;
  const high = priority === 'HIGH' || priority === 'URGENT';

  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em]',
        high ? 'bg-red-500/10 text-red-700' : 'bg-[var(--surface-muted)] text-[var(--text-subtle)]',
      )}
    >
      {high ? <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> : null}
      {priority === 'URGENT' ? 'Urgent' : priority === 'HIGH' ? 'High' : 'Low'}
    </span>
  );
}

function SourceBadge({ source }: { source: CalendarSource }) {
  if (source === 'CALENDAR') return null;

  return (
    <span className="inline-flex shrink-0 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]">
      {SOURCE_LABELS[source]}
    </span>
  );
}

function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const map: Record<AttendanceStatus, { label: string; className: string }> = {
    ACCEPTED: { label: 'Going', className: 'text-[var(--success,#047857)]' },
    DECLINED: { label: 'Declined', className: 'text-red-600' },
    TENTATIVE: { label: 'Maybe', className: 'text-[var(--warning,#b45309)]' },
    PENDING: { label: 'Invited', className: 'text-[var(--text-subtle)]' },
  };

  return <span className={cx('text-[9.5px] font-semibold', map[status].className)}>{map[status].label}</span>;
}

function PersonAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full border border-[var(--line)] object-cover" />
    );
  }

  return (
    <span
      title={name || undefined}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] text-[8px] font-bold text-[var(--text-muted)]"
    >
      {name ? nameInitials(name) : <UserRound size={10} />}
    </span>
  );
}

function AvatarStack({ people, max = 3 }: { people: CalendarAttendee[]; max?: number }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <span className="hidden shrink-0 items-center md:flex">
      {shown.map((person, index) => (
        <span key={person.id} className={cx('block rounded-full ring-2 ring-[var(--surface)]', index > 0 && '-ml-2')}>
          <PersonAvatar name={person.name} avatarUrl={person.avatarUrl} />
        </span>
      ))}
      {extra > 0 ? <span className="ml-1.5 text-[9.5px] font-semibold text-[var(--text-subtle)]">+{extra}</span> : null}
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
        'relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
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

/* =============================================================================
 * SHARED PRIMITIVES
 * Same building blocks as the Team, Departments, Recruitment and Leave tabs.
 * =============================================================================
 */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
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
                  data-portal-panel
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