/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/refs */
"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  FolderKanban,
  Gauge,
  Headphones,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Lock,
  Maximize2,
  Megaphone,
  MessageSquareText,
  Minimize2,
  Minus,
  Moon,
  Move,
  Paintbrush,
  Palette,
  Plane,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Sun,
  SunMoon,
  Trash2,
  Upload,
  Users,
  Video,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

import Image from "next/image";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/* =============================================================================
   TYPES
============================================================================= */

type Destination =
  | "analytics"
  | "activity"
  | "calendar"
  | "notifications"
  | "quick-action"
  | "attention"
  | "projects"
  | "portfolio"
  | "support"
  | "finance"
  | "team"
  | "leave"
  | "social_media"
  | "campaigns"
  | "seo_analytics"
  | "brand_assets"
  // Real activity/notification source modules — AdminHome.tsx's
  // resolveOverviewDestination() passes these through unchanged, so a
  // notification or activity row can link straight to its own module.
  | "contracts"
  | "recruitment"
  | "invoices"
  | "timesheets"
  | "audit_logs";

/**
 * Permission summary for a restricted employee account (see
 * lib/auth/current-admin.ts getCurrentIdentity / AdminHome.tsx). Omitted
 * entirely for a full-access caller — the Owner's Overview is completely
 * unaffected by anything below and renders exactly as it did before this
 * type existed.
 */
type OverviewIdentity = {
  isFullAccess: boolean;
  employeeId: string | null;
  departmentId: string | null;
  permissions: { module: string; action: string; scope: string }[];
};

type OverviewTabProps = {
  admin?: {
    id?: string | null;
    fullName?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  identity?: OverviewIdentity;
  onNavigate?: (destination: Destination) => void;
  /** Opens the internal messaging workspace (?workspace=messages) — not
   *  a Destination/AdminTab, since "messages" is already the existing
   *  client-support tab's key. Handled separately from onNavigate. */
  onOpenMessages?: () => void;
};

type DashboardRole = "admin" | "finance" | "employee";

type Tone = "light" | "dark";

type CalendarSource = "CALENDAR" | "LEAVE" | "INTERVIEW" | "DEPLOYMENT";

type CalendarPerson = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  department?: { id: string; name: string } | null;
};

/* Subset of the CalendarItem returned by /api/admin/calendar. */
type CalendarItem = {
  id: string;
  source: CalendarSource;
  sourceId?: string;
  title: string;
  description?: string | null;
  type: string;
  startAt: string;
  endAt?: string | null;
  allDay: boolean;
  priority?: string | null;
  status?: string;
  private?: boolean;
  owner?: CalendarPerson | null;
  department?: { id: string; name: string } | null;
  client?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  attendees?: CalendarPerson[];
  location?: string | null;
  meetingUrl?: string | null;
  metadata?: Record<string, unknown> | null;
};

type CalendarApiResponse =
  | CalendarItem[]
  | { items?: CalendarItem[]; events?: CalendarItem[]; data?: CalendarItem[] };

type FeedStatus = "loading" | "live" | "sample";

/* Mirrors lib/overview/server.ts's AnalyticsPoint / ActivityItem / AttentionItem /
   DeliveryProject / WorkspaceSummary / TeammateSample / OverviewSummary — this
   client component never imports server code, so these are kept in sync by hand. */
type AnalyticsPoint = { month: string; clients: number; projects: number; total: number };

type ActivityFeedItem = {
  id: string;
  module: "contracts" | "recruitment" | "leave" | "timesheets" | "audit";
  title: string;
  description: string | null;
  actorName: string | null;
  createdAt: string;
};

type AttentionFeedItem = {
  id: string;
  kind: "overdue_invoice" | "urgent_ticket" | "expiring_offer" | "contract_renewal";
  title: string;
  detail: string;
  dueAt: string | null;
};

type DeliveryProjectItem = { id: string; name: string; status: string; clientName: string };

type WorkspaceSummaryItem = { clientId: string; clientName: string; activeProjects: number };

type TeammateSampleItem = { id: string; name: string; jobTitle: string | null; departmentName: string | null };

type OverviewSummaryPayload = {
  clients: { active: number };
  projects: { active: number };
  tickets: { open: number; urgent: number };
  employees: { total: number };
  recruitment: { pendingApplications: number; upcomingInterviews: number };
  leave: { pending: number };
  timesheets: { awaitingApproval: number };
  workload: { active: number };
  finance: {
    revenueThisMonth: number;
    receivables: number;
    currency: string;
    monzo: { connected: boolean; balanceMinor: number | null; currency: string | null };
  };
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  module: string;
  read: boolean;
  createdAt: string;
};

type Spotlight = {
  event: CalendarItem;
  state: "now" | "soon" | "later";
  minutes: number;
  progress: number;
};

/** "mix" is a gradient the user builds themselves in the Customise panel. */
type WallpaperType = "preset" | "auto" | "custom" | "gradient" | "solid" | "mix";

type WidgetTheme = "dark" | "light" | "auto";

type WidgetVisibility = {
  commandBar: boolean;
  today: boolean;
  away: boolean;
  statistics: boolean;
  analytics: boolean;
  activity: boolean;
  // Distinct from `activity` above, which employee mode repurposes for
  // Growth's MyGrowthCard. This key is Command's own Activity widget.
  commandActivity: boolean;
  notifications: boolean;
  delivery: boolean;
  attention: boolean;
  support: boolean;
  team: boolean;
  finance: boolean;
};

type WidgetKey = keyof WidgetVisibility;

/** Widget widths on the 12 column grid: 4, 6, 8 and 12 columns. */
type SizeKey = "s" | "m" | "l" | "xl";

type CustomGradient = {
  kind: "linear" | "radial" | "mesh";
  angle: number;
  stops: string[];
};

type DashboardLayout = {
  order: WidgetKey[];
  sizes: Partial<Record<WidgetKey, SizeKey>>;
  collapsed: Partial<Record<WidgetKey, boolean>>;
};

type DashboardPreferences = {
  wallpaperType: WallpaperType;
  wallpaperId: string;
  customWallpaper: string | null;
  gradientId: string;
  customGradient: CustomGradient;
  solidColor: string;
  widgetTheme: WidgetTheme;
  glassOpacity: number;
  radius: number;
  accentId: string;
  overlay: number;
  blur: number;
  grain: boolean;
  motion: boolean;
  compact: boolean;
  showGreeting: boolean;
  layoutTipSeen: boolean;
  /** Shortcut chips under the command bar. Null means the defaults. Calendar is always shown. */
  pinnedShortcuts: Destination[] | null;
  widgetVisibility: WidgetVisibility;
  layout: DashboardLayout;
};

type WallpaperPreset = {
  id: string;
  name: string;
  tone: Tone;
  background: string;
  preview: string;
};

type GradientPreset = {
  id: string;
  name: string;
  tone: Tone;
  background: string;
};

type CommandItem = {
  id: Destination;
  label: string;
  hint: string;
  keywords: string;
  icon: LucideIcon;
};

type WidgetSpec = {
  key: WidgetKey;
  label: string;
  description: string;
  icon: LucideIcon;
  sizes: SizeKey[];
  defaultSize: SizeKey;
  collapsible: boolean;
  /** Renders without a glass card of its own, e.g. the group of stat tiles. */
  group: boolean;
  render: () => ReactNode;
};

type PanelTab = "wallpaper" | "style" | "widgets";

type StatDefinition = {
  label: string;
  value: number;
  prefix: string;
  suffix: string;
  decimals: number;
  note: string;
  icon: LucideIcon;
  spark: number[];
};

/* =============================================================================
   CONFIGURATION
============================================================================= */

// Unchanged on purpose: existing wallpapers and settings carry over, and the
// new fields below fall back to their defaults when they are missing.
const STORAGE_VERSION = "v3";
const MINUTE = 60_000;
const DAY_START = 7 * 60;
const DAY_END = 21 * 60;
const LANE_HEIGHT = 30;
const LONG_PRESS_MS = 480;

const SIZE_SPANS: Record<SizeKey, number> = { s: 4, m: 6, l: 8, xl: 12 };
const SIZE_LABELS: Record<SizeKey, string> = { s: "Small", m: "Medium", l: "Large", xl: "Full width" };

const DEFAULT_VISIBILITY: WidgetVisibility = {
  commandBar: true,
  today: true,
  away: true,
  statistics: true,
  analytics: true,
  activity: true,
  commandActivity: true,
  notifications: true,
  delivery: true,
  attention: true,
  support: true,
  team: true,
  finance: true,
};

const DEFAULT_GRADIENT: CustomGradient = {
  kind: "mesh",
  angle: 145,
  stops: ["#9CC9F0", "#F5C9DA", "#C9F0D8"],
};

const EMPTY_LAYOUT: DashboardLayout = { order: [], sizes: {}, collapsed: {} };

const DEFAULT_PREFERENCES: DashboardPreferences = {
  wallpaperType: "preset",
  wallpaperId: "horizon",
  customWallpaper: null,
  gradientId: "ocean",
  customGradient: DEFAULT_GRADIENT,
  solidColor: "#A8C9DD",
  widgetTheme: "dark",
  glassOpacity: 68,
  radius: 24,
  accentId: "mint",
  overlay: 4,
  blur: 0,
  grain: true,
  motion: true,
  compact: false,
  showGreeting: true,
  layoutTipSeen: false,
  pinnedShortcuts: null,
  widgetVisibility: { ...DEFAULT_VISIBILITY },
  layout: EMPTY_LAYOUT,
};

/** The one shortcut that can't be removed. */
const LOCKED_SHORTCUT: Destination = "calendar";

/** Shown in each widget's title, menus and the Customise panel. */
const WIDGET_META: Record<
  WidgetKey,
  { label: string; employeeLabel: string; description: string; employeeDescription?: string; icon: LucideIcon }
> = {
  commandBar: { label: "Command bar", employeeLabel: "Quick actions", description: "Search and jump anywhere", icon: Search },
  today: { label: "Today and calendar", employeeLabel: "My calendar", description: "Your day, week and timeline", icon: CalendarDays },
  away: { label: "Who's away", employeeLabel: "Who's away", description: "Approved leave across the team", icon: Plane },
  statistics: { label: "Pulse statistics", employeeLabel: "My stats", description: "Key numbers at a glance", icon: Gauge },
  analytics: { label: "Analytics", employeeLabel: "Analytics", description: "Trends over time", icon: BarChart3 },
  activity: {
    label: "Activity",
    employeeLabel: "Marketing activity",
    description: "Latest events across the company",
    employeeDescription: "Posts and campaigns",
    icon: Activity,
  },
  commandActivity: { label: "Activity", employeeLabel: "Activity", description: "Operational timeline", icon: Activity },
  notifications: { label: "Notifications", employeeLabel: "Notifications", description: "Unread updates and alerts", icon: Bell },
  delivery: { label: "Projects and workspaces", employeeLabel: "Projects and workspaces", description: "Delivery progress", icon: FolderKanban },
  attention: { label: "Needs attention", employeeLabel: "Needs attention", description: "Items waiting on you", icon: AlertCircle },
  support: { label: "Support", employeeLabel: "Support", description: "Open client conversations", icon: Headphones },
  team: {
    label: "Team",
    employeeLabel: "My department",
    description: "People and availability",
    employeeDescription: "Your department colleagues",
    icon: Users,
  },
  finance: {
    label: "Finance",
    employeeLabel: "My leave",
    description: "Revenue and receivables",
    employeeDescription: "Your leave balance",
    icon: CircleDollarSign,
  },
};

/* =============================================================================
   WALLPAPERS

   Generated with CSS so there are no external image requests.
   Any background can be swapped for url("/wallpapers/your-image.jpg").
============================================================================= */

const WALLPAPERS: WallpaperPreset[] = [
  {
    id: "horizon",
    name: "Horizon",
    tone: "light",
    background: `
      radial-gradient(ellipse 55% 30% at 74% 16%, rgba(255,255,255,0.80), transparent 70%),
      radial-gradient(ellipse 40% 18% at 18% 26%, rgba(255,255,255,0.55), transparent 70%),
      radial-gradient(ellipse 30% 12% at 46% 40%, rgba(255,255,255,0.35), transparent 70%),
      linear-gradient(180deg,
        #5F98D1 0%, #8DBBE4 26%, #BFD8EC 48%, #DCE6E4 57%,
        #B9CB97 61%, #8CAD62 68%, #6C9147 80%, #4D7034 100%)
    `,
    preview: "linear-gradient(180deg,#6FA3D6,#CFE2EE 55%,#8CAD62 62%,#4D7034)",
  },
  {
    id: "dawn",
    name: "Dawn",
    tone: "light",
    background: `
      radial-gradient(ellipse 50% 30% at 50% 62%, rgba(255,214,170,0.85), transparent 70%),
      linear-gradient(180deg, #8EA6CF 0%, #C9B9CF 38%, #F0CDB6 58%, #E9C39F 64%, #9DA982 74%, #6E8559 100%)
    `,
    preview: "linear-gradient(180deg,#8EA6CF,#F0CDB6 58%,#6E8559)",
  },
  {
    id: "sky",
    name: "Open Sky",
    tone: "light",
    background: `
      radial-gradient(ellipse at 78% 12%, rgba(255,255,255,0.94) 0%, transparent 34%),
      radial-gradient(ellipse at 23% 58%, rgba(255,255,255,0.4), transparent 42%),
      linear-gradient(160deg, #82B8DE 0%, #B7D5E8 34%, #D4E3E9 53%, #9BC2D8 77%, #83AEC9 100%)
    `,
    preview: "linear-gradient(145deg,#87b9df,#d6e6ee,#8eb8cf)",
  },
  {
    id: "sunset",
    name: "Sunset",
    tone: "light",
    background: `
      radial-gradient(ellipse at 78% 23%, rgba(255,218,174,0.85), transparent 40%),
      linear-gradient(160deg, #777FAF, #BAA1B9 43%, #E3B9AA 76%, #AE8A99)
    `,
    preview: "linear-gradient(145deg,#8088b3,#d6aeb4,#e0bd9f)",
  },
  {
    id: "midnight",
    name: "Midnight",
    tone: "dark",
    background: `
      radial-gradient(1px 1px at 20% 18%, rgba(255,255,255,0.7), transparent 60%),
      radial-gradient(1px 1px at 64% 12%, rgba(255,255,255,0.6), transparent 60%),
      radial-gradient(1px 1px at 82% 30%, rgba(255,255,255,0.5), transparent 60%),
      radial-gradient(ellipse at 76% 15%, rgba(79,112,162,0.6), transparent 42%),
      linear-gradient(170deg, #0E1828, #1F3550 55%, #13202F)
    `,
    preview: "linear-gradient(145deg,#101b2c,#304862,#152437)",
  },
  {
    id: "sand",
    name: "Warm Sand",
    tone: "light",
    background: `
      radial-gradient(ellipse at 65% 15%, rgba(255,255,255,0.7), transparent 43%),
      linear-gradient(145deg, #D7C5A8, #EADFCC 48%, #BEAA8A)
    `,
    preview: "linear-gradient(145deg,#d9c6a8,#eee0ca,#baa88c)",
  },
];

const GRADIENTS: GradientPreset[] = [
  { id: "ocean", name: "Ocean", tone: "light", background: "linear-gradient(145deg,#95CAE9,#C4DFE9,#82B5D4)" },
  { id: "forest", name: "Forest", tone: "dark", background: "linear-gradient(145deg,#A0BFA6,#739785,#365D4E)" },
  { id: "lavender", name: "Lavender", tone: "light", background: "linear-gradient(145deg,#A8AADF,#D5D0EE,#A3B5DC)" },
  { id: "pearl", name: "Pearl", tone: "light", background: "linear-gradient(145deg,#F0EEE9,#DDE5E7,#B7CAD5)" },
  { id: "graphite", name: "Graphite", tone: "dark", background: "linear-gradient(145deg,#3A4350,#26313F,#111922)" },
  { id: "rose", name: "Rose", tone: "light", background: "linear-gradient(145deg,#E3C7CF,#D4BCD1,#A8B9D8)" },
  {
    id: "aurora",
    name: "Aurora",
    tone: "dark",
    background:
      "radial-gradient(at 20% 25%, #3FB8A2 0, transparent 50%), radial-gradient(at 80% 20%, #6A5ACD 0, transparent 50%), radial-gradient(at 60% 85%, #1E7FA8 0, transparent 55%), linear-gradient(160deg, #0E1B2A, #142838)",
  },
  {
    id: "peach",
    name: "Peach",
    tone: "light",
    background:
      "radial-gradient(at 25% 20%, #FFD9C2 0, transparent 55%), radial-gradient(at 80% 75%, #F7B7C5 0, transparent 55%), linear-gradient(145deg, #FBE3D2, #F4C6C6)",
  },
  { id: "mint", name: "Mint", tone: "light", background: "linear-gradient(145deg,#C8F0DD,#E6F6EE 45%,#A9DCC6)" },
  { id: "dusk", name: "Dusk", tone: "dark", background: "linear-gradient(160deg,#2B2F5B,#5B3F6E 50%,#C77A7A)" },
  {
    id: "nebula",
    name: "Nebula",
    tone: "dark",
    background:
      "radial-gradient(at 70% 30%, #B05ACB 0, transparent 50%), radial-gradient(at 25% 70%, #3B6FD8 0, transparent 50%), linear-gradient(160deg,#120F2A,#24154A)",
  },
  {
    id: "citrus",
    name: "Citrus",
    tone: "light",
    background:
      "radial-gradient(at 20% 20%, #FFF1A8 0, transparent 50%), radial-gradient(at 85% 80%, #FFC58A 0, transparent 55%), linear-gradient(145deg,#FFF6CC,#FFD9A6)",
  },
];

const SOLID_SWATCHES = [
  "#A8C9DD", "#C9D8C5", "#E9D8C4", "#D7CBE6", "#F1D3D3", "#BFD9D6",
  "#F4F1EC", "#C6CBD2", "#2E3A46", "#1F2F2A", "#3B2F45", "#0F1720",
];

/** Accent used for charts, progress bars and highlights, one shade per glass. */
const ACCENTS = [
  { id: "mint", name: "Mint", dark: "#CFEFD9", light: "#2F5B43" },
  { id: "sky", name: "Sky", dark: "#BFDFFF", light: "#1F5F99" },
  { id: "peach", name: "Peach", dark: "#FFD3B8", light: "#9A4A1E" },
  { id: "lilac", name: "Lilac", dark: "#DCCBFF", light: "#5B3FA0" },
  { id: "gold", name: "Gold", dark: "#F3DFA2", light: "#8A6414" },
  { id: "rose", name: "Rose", dark: "#FFC9D6", light: "#9C2F52" },
];

const GRAIN_IMAGE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

/* =============================================================================
   EVENT TONES (pastels that read well on glass)
============================================================================= */

const EVENT_TONES: Record<string, { label: string; color: string }> = {
  MEETING: { label: "Meeting", color: "#9CC3F0" },
  DEADLINE: { label: "Deadline", color: "#F2A3A3" },
  MILESTONE: { label: "Milestone", color: "#C4B1F2" },
  DEPLOYMENT: { label: "Deployment", color: "#9FDCB8" },
  RELEASE: { label: "Release", color: "#93D9E6" },
  FINANCE: { label: "Finance", color: "#E8D08F" },
  SUPPORT: { label: "Support", color: "#F2BE8C" },
  MAINTENANCE: { label: "Maintenance", color: "#B8C2CC" },
  COMPANY: { label: "Company", color: "#E6A9E0" },
  PERSONAL: { label: "Personal", color: "#8FD6C8" },
  FOCUS: { label: "Focus", color: "#AEB6F2" },
  REMINDER: { label: "Reminder", color: "#F0DC8A" },
  OTHER: { label: "Other", color: "#C9CED3" },
  LEAVE: { label: "Leave", color: "#F2A9BC" },
  INTERVIEW: { label: "Interview", color: "#C9A9F2" },
};

const AVATAR_PALETTE = ["#CFE3F7", "#D9F0DF", "#F6E3C8", "#EAD9F5", "#F7D6DC", "#D6EEF0"];

/* =============================================================================
   HELPERS
============================================================================= */

const pad = (value: number) => String(value).padStart(2, "0");

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
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

function startOfWeekMonday(date: Date) {
  const copy = startOfDay(date);
  const day = copy.getDay();
  copy.setDate(copy.getDate() + (day === 0 ? -6 : 1 - day));
  return copy;
}

function getRole(value?: string | null): DashboardRole {
  const role = (value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (["admin", "super_admin", "administrator", "founder", "ceo", "owner", "director"].includes(role)) {
    return "admin";
  }

  if (["finance", "accountant", "finance_manager", "financial_manager", "bursar"].includes(role)) {
    return "finance";
  }

  return "employee";
}

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function formatIn(minutes: number) {
  const value = Math.max(0, Math.round(minutes));
  if (value < 1) return "under a minute";
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function formatAgo(milliseconds: number) {
  const minutes = Math.floor(milliseconds / MINUTE);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function avatarColor(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function luminance(hex: string) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return 1;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100;
  const l = lightness / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`.toUpperCase();
}

/** A harmonious palette for the Shuffle button: mostly pastel, sometimes deep. */
function randomPalette(count: number) {
  const hue = Math.floor(Math.random() * 360);
  const deep = Math.random() < 0.3;
  const steps = [0, 42, 110];
  return steps
    .slice(0, count)
    .map((step, position) =>
      hslToHex((hue + step) % 360, deep ? 55 : 68, deep ? [26, 34, 20][position] : [80, 72, 84][position]),
    );
}

function buildCustomGradient(gradient: CustomGradient) {
  const stops = gradient.stops.length ? gradient.stops : DEFAULT_GRADIENT.stops;
  const [first, second = first, third = second] = stops;

  if (gradient.kind === "radial") {
    return `radial-gradient(circle at 30% 25%, ${stops.join(", ")})`;
  }

  if (gradient.kind === "mesh") {
    return [
      `radial-gradient(at 18% 22%, ${first} 0, transparent 55%)`,
      `radial-gradient(at 82% 18%, ${second} 0, transparent 55%)`,
      `radial-gradient(at 55% 88%, ${third} 0, transparent 60%)`,
      `linear-gradient(${gradient.angle}deg, ${first}, ${second})`,
    ].join(", ");
  }

  return `linear-gradient(${gradient.angle}deg, ${stops.join(", ")})`;
}

function gradientTone(gradient: CustomGradient): Tone {
  const stops = gradient.stops.length ? gradient.stops : DEFAULT_GRADIENT.stops;
  const average = stops.reduce((sum, stop) => sum + luminance(stop), 0) / stops.length;
  return average > 0.58 ? "light" : "dark";
}

function autoWallpaperId(hour: number) {
  if (hour < 5) return "midnight";
  if (hour < 8) return "dawn";
  if (hour < 17) return "horizon";
  if (hour < 20) return "sunset";
  return "midnight";
}

function resolveWallpaper(preferences: DashboardPreferences, hour: number): { background: string; tone: Tone } {
  if (preferences.wallpaperType === "custom" && preferences.customWallpaper) {
    return { background: `url("${preferences.customWallpaper}")`, tone: "dark" };
  }

  if (preferences.wallpaperType === "solid") {
    return {
      background: preferences.solidColor,
      tone: luminance(preferences.solidColor) > 0.55 ? "light" : "dark",
    };
  }

  if (preferences.wallpaperType === "mix") {
    return {
      background: buildCustomGradient(preferences.customGradient),
      tone: gradientTone(preferences.customGradient),
    };
  }

  if (preferences.wallpaperType === "gradient") {
    const gradient = GRADIENTS.find((item) => item.id === preferences.gradientId) ?? GRADIENTS[0];
    return { background: gradient.background, tone: gradient.tone };
  }

  const id = preferences.wallpaperType === "auto" ? autoWallpaperId(hour) : preferences.wallpaperId;
  const preset = WALLPAPERS.find((item) => item.id === id) ?? WALLPAPERS[0];
  return { background: preset.background, tone: preset.tone };
}

function wallpaperStyleFor(background: string, blur: number): CSSProperties {
  const solid = background.trim().startsWith("#");
  // Longhand only: React warns when the background shorthand is mixed
  // with backgroundSize or backgroundPosition. Size and position live in CSS.
  return {
    backgroundColor: solid ? background : undefined,
    backgroundImage: solid ? "none" : background,
    filter: blur > 0 ? `blur(${blur}px)` : undefined,
    transform: blur > 0 ? "scale(1.05)" : undefined,
  };
}

function getStorageKey(admin?: OverviewTabProps["admin"]) {
  const identifier = admin?.id?.trim() || admin?.email?.trim().toLowerCase();
  if (!identifier) return null;
  return `syntragrid.command.preferences.${STORAGE_VERSION}.${identifier}`;
}

function freshLayout(): DashboardLayout {
  return { order: [], sizes: {}, collapsed: {} };
}

function freshDefaults(): DashboardPreferences {
  return {
    ...DEFAULT_PREFERENCES,
    customGradient: { ...DEFAULT_GRADIENT, stops: [...DEFAULT_GRADIENT.stops] },
    widgetVisibility: { ...DEFAULT_VISIBILITY },
    layout: freshLayout(),
  };
}

function isHexColour(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Shared by both the localStorage loader and the server-preferences
 *  reconciliation path — merges an arbitrary raw object onto fresh
 *  defaults, defensively, the same way regardless of where it came from. */
function mergePreferencesFromRaw(parsed: unknown): DashboardPreferences {
  if (!parsed || typeof parsed !== "object") return freshDefaults();

  const record = parsed as Record<string, unknown>;
  const savedGradient = (record.customGradient as Record<string, unknown>) ?? {};
  const savedStops = Array.isArray(savedGradient.stops) ? savedGradient.stops.filter(isHexColour).slice(0, 3) : [];
  const savedLayout = (record.layout as Record<string, unknown>) ?? {};

  return {
    ...freshDefaults(),
    ...record,
    customGradient: {
      kind: ["linear", "radial", "mesh"].includes(savedGradient.kind as string)
        ? (savedGradient.kind as CustomGradient["kind"])
        : DEFAULT_GRADIENT.kind,
      angle: typeof savedGradient.angle === "number" ? clamp(savedGradient.angle, 0, 360) : DEFAULT_GRADIENT.angle,
      stops: savedStops.length >= 2 ? savedStops : [...DEFAULT_GRADIENT.stops],
    },
    pinnedShortcuts: Array.isArray(record.pinnedShortcuts)
      ? record.pinnedShortcuts.filter((id: unknown): id is Destination => typeof id === "string")
      : null,
    widgetVisibility: { ...DEFAULT_VISIBILITY, ...((record.widgetVisibility as object) || {}) },
    layout: {
      order: Array.isArray(savedLayout.order) ? savedLayout.order.filter((key: unknown) => typeof key === "string") : [],
      sizes: savedLayout.sizes && typeof savedLayout.sizes === "object" ? { ...savedLayout.sizes } : {},
      collapsed: savedLayout.collapsed && typeof savedLayout.collapsed === "object" ? { ...savedLayout.collapsed } : {},
    },
  } as DashboardPreferences;
}

function loadPreferences(storageKey: string): DashboardPreferences {
  try {
    const value = window.localStorage.getItem(storageKey);
    if (!value) return freshDefaults();

    const parsed = JSON.parse(value);
    return mergePreferencesFromRaw(parsed);
  } catch {
    return freshDefaults();
  }
}

/** True when a preferences object has never been touched from its
 *  defaults — used to decide whether a first-load local copy is worth
 *  migrating up to the server. */
function isDefaultPreferences(preferences: DashboardPreferences): boolean {
  return JSON.stringify(preferences) === JSON.stringify(freshDefaults());
}

/**
 * Keeps the saved order for widgets that still exist for this person, and
 * slots any newly available widget back in near its default position.
 */
function sanitizeOrder(saved: WidgetKey[], defaults: WidgetKey[]) {
  const allowed = new Set(defaults);
  const seen = new Set<WidgetKey>();
  const result: WidgetKey[] = [];

  for (const key of saved) {
    if (allowed.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }

  defaults.forEach((key, position) => {
    if (!seen.has(key)) {
      result.splice(Math.min(position, result.length), 0, key);
      seen.add(key);
    }
  });

  return result;
}

function snapSize(saved: SizeKey | undefined, spec: WidgetSpec): SizeKey {
  if (!saved || !(saved in SIZE_SPANS)) return spec.defaultSize;
  if (spec.sizes.includes(saved)) return saved;
  const target = SIZE_SPANS[saved];
  return spec.sizes.reduce(
    (best, option) => (Math.abs(SIZE_SPANS[option] - target) < Math.abs(SIZE_SPANS[best] - target) ? option : best),
    spec.sizes[0],
  );
}

function getScrollParent(node: HTMLElement | null): HTMLElement | Window {
  let element = node?.parentElement ?? null;
  while (element) {
    const { overflowY } = window.getComputedStyle(element);
    if ((overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight) {
      return element;
    }
    element = element.parentElement;
  }
  return window;
}

/* ---------- Calendar helpers ---------- */

function toneOf(event: CalendarItem) {
  const key =
    event.source === "LEAVE"
      ? "LEAVE"
      : event.source === "INTERVIEW"
        ? "INTERVIEW"
        : event.source === "DEPLOYMENT"
          ? "DEPLOYMENT"
          : event.type;
  return EVENT_TONES[key] ?? EVENT_TONES.OTHER;
}

function normalizeCalendarItems(response: CalendarApiResponse) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.events)) return response.events;
  if (Array.isArray(response.data)) return response.data;
  return [];
}

function byStart(a: CalendarItem, b: CalendarItem) {
  const diff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  if (diff !== 0) return diff;
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.title.localeCompare(b.title);
}

function eventEnd(event: CalendarItem) {
  if (event.endAt) return new Date(event.endAt);
  const start = new Date(event.startAt);
  return event.allDay ? start : new Date(start.getTime() + 30 * MINUTE);
}

function eventsOnDay(events: CalendarItem[], day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  return events.filter((event) => {
    if (event.status === "CANCELLED") return false;

    const start = new Date(event.startAt);
    const end = eventEnd(event);

    if (event.allDay) {
      return startOfDay(start) <= dayStart && startOfDay(end) >= dayStart;
    }

    return start < dayEnd && end > dayStart;
  });
}

function scheduleOnDay(events: CalendarItem[], day: Date) {
  return eventsOnDay(events, day)
    .filter((event) => event.source !== "LEAVE")
    .sort(byStart);
}

function eventTimeLabel(event: CalendarItem) {
  if (event.allDay) return "All day";
  const start = formatClock(new Date(event.startAt));
  return event.endAt ? `${start} to ${formatClock(new Date(event.endAt))}` : start;
}

function eventContext(event: CalendarItem) {
  return event.client?.name ?? event.project?.name ?? event.location ?? toneOf(event).label;
}

function findSpotlight(events: CalendarItem[], now: Date): Spotlight | null {
  const timed = events.filter((event) => !event.allDay);
  const time = now.getTime();

  for (const event of timed) {
    const start = new Date(event.startAt).getTime();
    const end = eventEnd(event).getTime();

    if (start <= time && time < end) {
      return {
        event,
        state: "now",
        minutes: (end - time) / MINUTE,
        progress: ((time - start) / Math.max(end - start, 1)) * 100,
      };
    }

    if (start > time) {
      return { event, state: "soon", minutes: (start - time) / MINUTE, progress: 0 };
    }
  }

  return null;
}

function layoutTimeline(events: CalendarItem[], day: Date) {
  const base = startOfDay(day).getTime();

  const items = events
    .filter((event) => !event.allDay)
    .map((event) => {
      const start = clamp((new Date(event.startAt).getTime() - base) / MINUTE, 0, 1440);
      const end = clamp((eventEnd(event).getTime() - base) / MINUTE, 0, 1440);
      return { event, start, end: Math.max(end, start + 15), lane: 0 };
    })
    .sort((a, b) => a.start - b.start);

  const laneEnds: number[] = [];

  items.forEach((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    item.lane = lane;
  });

  const windowStart = Math.min(DAY_START, ...items.map((item) => Math.floor(item.start / 60) * 60));
  const windowEnd = Math.max(DAY_END, ...items.map((item) => Math.ceil(item.end / 60) * 60));

  return { items, laneCount: Math.max(1, laneEnds.length), windowStart, windowEnd };
}

function buildSampleEvents(today: Date): CalendarItem[] {
  const at = (offset: number, time: string) => {
    const date = addDays(today, offset);
    const [hours, minutes] = time.split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
  };

  const make = (
    id: string,
    offset: number,
    start: string,
    end: string | null,
    title: string,
    type: string,
    extra: Partial<CalendarItem> = {},
  ): CalendarItem => ({
    id: `sample-${id}`,
    source: "CALENDAR",
    title,
    type,
    startAt: at(offset, start),
    endAt: end ? at(offset, end) : null,
    allDay: false,
    ...extra,
  });

  const leave = (
    id: string,
    name: string,
    department: string,
    from: number,
    to: number,
    leaveType: string,
  ): CalendarItem => ({
    id: `sample-leave-${id}`,
    source: "LEAVE",
    title: leaveType,
    type: "LEAVE",
    startAt: startOfDay(addDays(today, from)).toISOString(),
    endAt: startOfDay(addDays(today, to)).toISOString(),
    allDay: true,
    owner: { id, name, department: { id: department, name: department } },
    metadata: { leaveType },
  });

  return [
    make("1", 0, "09:30", "10:00", "Morning operations review", "MEETING", { client: { id: "sg", name: "Syntra Grid" } }),
    make("2", 0, "11:00", "12:00", "Zing product review", "MEETING", {
      client: { id: "zing", name: "Zing" },
      meetingUrl: "https://meet.google.com",
    }),
    make("3", 0, "13:00", "14:30", "Focus block", "FOCUS"),
    make("4", 0, "14:30", "15:15", "RentWise project review", "MEETING", { client: { id: "rw", name: "RentWise" } }),
    { ...make("5", 0, "17:00", "17:30", "Esteem deployment", "DEPLOYMENT"), source: "DEPLOYMENT" },
    make("6", 1, "10:00", "11:00", "Meldex content sync", "MEETING", { client: { id: "mx", name: "Meldex" } }),
    make("7", 2, "16:00", null, "RentWise launch checklist due", "DEADLINE"),
    make("8", 3, "12:00", "13:00", "Team lunch", "COMPANY"),
    make("9", 4, "15:00", "16:00", "Invoice run", "FINANCE"),
    leave("grace", "Grace Adeyemi", "Design", -1, 2, "Holiday"),
    leave("tunde", "Tunde Bello", "Engineering", 0, 0, "Sick leave"),
    leave("ifeoma", "Ifeoma Nwosu", "Operations", 0, 1, "Training"),
    leave("kemi", "Kemi Lawal", "Client Success", 2, 4, "Holiday"),
  ];
}

/* ---------- Charts ---------- */

function smoothPath(values: number[], width: number, height: number, padding = 4) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  const points = values.map((value, index) => [
    (index / Math.max(values.length - 1, 1)) * width,
    height - padding - ((value - min) / span) * (height - padding * 2),
  ]);

  const f = (n: number) => n.toFixed(2);
  let d = `M${f(points[0][0])},${f(points[0][1])}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;

    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`;
  }

  return { d, points };
}

/* ---------- Image upload ---------- */

async function processWallpaper(file: File): Promise<string> {
  const MAX_UPLOAD_SIZE = 12 * 1024 * 1024;

  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > MAX_UPLOAD_SIZE) throw new Error("Please choose an image smaller than 12 MB.");

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      try {
        const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Unable to process the selected image.");

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/jpeg", 0.74));
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to load the selected image."));
    };

    image.src = objectUrl;
  });
}

/* =============================================================================
   HOOKS
============================================================================= */

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function useNow(interval: number) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const id = window.setInterval(update, interval);
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [interval]);

  return now;
}

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function useCountUp(target: number, duration = 1000) {
  const reduced = useReducedMotionPreference();
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;

    const step = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (target - from) * eased;
      setValue(next);
      fromRef.current = next;
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);

  return value;
}

function useSafeId(prefix: string) {
  const raw = useId();
  return `${prefix}${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
}

function useCalendarFeed(todayKey: string | null) {
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [status, setStatus] = useState<FeedStatus>("loading");
  const statusRef = useRef<FeedStatus>("loading");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!todayKey) return;

      const today = dateFromKey(todayKey);
      const start = startOfWeekMonday(today);
      const weekEnd = addDays(start, 7);
      const lookAhead = addDays(today, 8);
      const end = lookAhead > weekEnd ? lookAhead : weekEnd;

      const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });

      try {
        const response = await fetch(`/api/admin/calendar?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          signal,
        });

        if (!response.ok) throw new Error(`Calendar request failed (${response.status})`);

        const body = (await response.json()) as CalendarApiResponse;
        setEvents(normalizeCalendarItems(body).sort(byStart));
        statusRef.current = "live";
        setStatus("live");
      } catch (error) {
        if (signal?.aborted) return;
        console.warn("Overview calendar feed unavailable:", error);

        // Keep live data on a failed refresh. Only show samples when nothing loaded.
        if (statusRef.current === "live") return;

        setEvents(buildSampleEvents(today));
        statusRef.current = "sample";
        setStatus("sample");
      }
    },
    [todayKey],
  );

  useEffect(() => {
    if (!todayKey) return;

    const controller = new AbortController();
    void load(controller.signal);

    const interval = window.setInterval(() => void load(), 2 * 60_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);

    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load, todayKey]);

  return { events, status };
}

/* =============================================================================
   EMPLOYEE-MODE DATA

   Restricted-employee widgets only. These hooks always call the same
   already-secured endpoints a restricted account hits directly (GET
   /api/admin/me, /api/admin/leave/overview, /api/admin/team) — every
   scope/permission check still happens server-side exactly as it does
   for any other caller of those routes. Nothing here grants data access;
   it only decides whether to ask for it, and the `enabled` flag lets the
   Owner's path skip the fetch entirely.
============================================================================= */

type EmployeeProfileData = {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  fullName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: { id: string; name: string } | null;
};

function useEmployeeProfile(enabled: boolean) {
  const [profile, setProfile] = useState<EmployeeProfileData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    fetch("/api/admin/me", { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { ok?: boolean; profile?: EmployeeProfileData }) => {
        if (cancelled) return;
        if (payload?.ok && payload.profile) {
          setProfile(payload.profile);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { profile, status };
}

type LeaveOverviewData = {
  my: {
    approvedDaysThisYear: number;
    balances: { policyName: string; available: number }[];
    recentRequests: { id: string; status: string; startDate: string; endDate: string; totalDays: number }[];
  };
};

function useMyLeaveOverview(enabled: boolean) {
  const [data, setData] = useState<LeaveOverviewData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    fetch("/api/admin/leave/overview", { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((payload: LeaveOverviewData) => {
        if (cancelled) return;
        if (payload?.my) {
          setData(payload);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { data, status };
}

type DepartmentColleague = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  jobTitle?: string;
  avatarUrl?: string | null;
  status?: string;
};

function useMyDepartmentColleagues(enabled: boolean, viewerEmployeeId: string | null) {
  const [colleagues, setColleagues] = useState<DepartmentColleague[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    fetch("/api/admin/team", { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { employees?: DepartmentColleague[] }) => {
        if (cancelled) return;
        const list = (payload?.employees ?? []).filter((employee) => employee.id !== viewerEmployeeId);
        setColleagues(list);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, viewerEmployeeId]);

  return { colleagues, status };
}

type OverviewDataPayload = {
  summary: OverviewSummaryPayload;
  analytics: AnalyticsPoint[];
  attention: AttentionFeedItem[];
  delivery: DeliveryProjectItem[];
  workspaces: WorkspaceSummaryItem[];
  team: TeammateSampleItem[];
};

/** Owner-only company-wide dashboard data — /api/admin/overview. Never
 *  called in employee mode (she has her own real per-module endpoints). */
function useOverviewData(enabled: boolean) {
  const [data, setData] = useState<OverviewDataPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setStatus("loading");

    fetch("/api/admin/overview", { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { ok?: boolean } & Partial<OverviewDataPayload>) => {
        if (cancelled) return;
        if (payload?.ok && payload.summary) {
          setData(payload as OverviewDataPayload);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { data, status };
}

/** Monthly new-client + new-project counts — real for both Owner and a
 *  restricted employee holding "analytics" VIEW (see the route for why
 *  this one metric isn't scope-narrowed further). */
function useAnalyticsSeries(enabled: boolean) {
  const [series, setSeries] = useState<AnalyticsPoint[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setStatus("loading");

    fetch("/api/admin/overview/analytics", { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { ok?: boolean; series?: AnalyticsPoint[] }) => {
        if (cancelled) return;
        if (payload?.ok) {
          setSeries(payload.series ?? []);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { series, status };
}

/** Recent activity — real for both Owner (company-wide) and a restricted
 *  employee (scoped server-side by her "activity" grant). */
function useActivityFeed(enabled: boolean) {
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setStatus("loading");

    fetch("/api/admin/overview/activity", { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { ok?: boolean; items?: ActivityFeedItem[] }) => {
        if (cancelled) return;
        if (payload?.ok) {
          setItems(payload.items ?? []);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { items, status };
}

/** Real, persisted notifications — available to every account. */
function useNotificationsFeed(enabled: boolean) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    if (!enabled) return;

    fetch("/api/admin/overview/notifications", { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { ok?: boolean; items?: NotificationItem[]; unreadCount?: number }) => {
        if (payload?.ok) {
          setItems(payload.items ?? []);
          setUnreadCount(payload.unreadCount ?? 0);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = useCallback(
    (id: string) => {
      setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
      setUnreadCount((current) => Math.max(0, current - 1));
      void fetch(`/api/admin/overview/notifications/${id}`, { method: "PATCH", credentials: "include" }).catch(() => {});
    },
    [],
  );

  const markAllRead = useCallback(() => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    void fetch("/api/admin/overview/notifications/read-all", { method: "POST", credentials: "include" }).catch(() => {});
  }, []);

  return { items, unreadCount, status, markRead, markAllRead };
}

/* =============================================================================
   MESSAGES ENTRY CARD

   Internal employee messaging lives in its own full-width workspace
   (?workspace=messages), opened via onOpenMessages — see AdminHome.tsx.
   This card is Command Overview's entry point into it: real unread
   count and a real last-message preview, both derived from the actual
   conversations the signed-in AdminUser belongs to. Deliberately not a
   WIDGET_META entry — it's a fixed, always-visible card rather than
   another draggable/collapsible widget.
============================================================================= */

type MessagesSummaryConversation = {
  id: string;
  type: "DIRECT" | "GROUP";
  name: string | null;
  lastMessageAt: string | null;
  members: { adminUser: { id: string; firstName: string | null; lastName: string | null; email: string } }[];
  messages: { body: string | null; senderId: string; deletedAt: string | null }[];
};

function useMessagesSummary() {
  const [unreadConversations, setUnreadConversations] = useState(0);
  const [latest, setLatest] = useState<MessagesSummaryConversation | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/admin/chat/unread-count", { credentials: "include", cache: "no-store" }).then((response) => response.json()),
      fetch("/api/admin/chat/conversations?limit=1", { credentials: "include", cache: "no-store" }).then((response) => response.json()),
    ])
      .then(([unread, conversations]: [{ ok?: boolean; unreadConversations?: number }, { ok?: boolean; conversations?: MessagesSummaryConversation[] }]) => {
        if (!unread?.ok) {
          setStatus("error");
          return;
        }
        setUnreadConversations(unread.unreadConversations ?? 0);
        setLatest(conversations?.ok ? conversations.conversations?.[0] ?? null : null);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(() => void load(), 30_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  return { unreadConversations, latest, status };
}

function conversationDisplayName(conversation: MessagesSummaryConversation, selfId: string | null | undefined): string {
  if (conversation.type === "GROUP") return conversation.name ?? "Group";
  const other = conversation.members.find((member) => member.adminUser.id !== selfId)?.adminUser;
  if (!other) return "Conversation";
  return [other.firstName, other.lastName].filter(Boolean).join(" ") || other.email;
}

function MessagesEntryCard({ admin, onOpen }: { admin?: OverviewTabProps["admin"]; onOpen?: () => void }) {
  const { unreadConversations, latest, status } = useMessagesSummary();

  const lastMessage = latest?.messages?.[0] ?? null;
  const preview = !latest
    ? null
    : lastMessage
      ? lastMessage.deletedAt
        ? "This message was deleted."
        : lastMessage.body?.trim() || "Sent an attachment"
      : "No messages yet";

  return (
    <section className="sgo-card" style={{ marginBottom: 14 }}>
      <header className="sgo-card-head">
        <h2 className="sgo-card-title" style={{ margin: 0 }}>
          <span className="sgo-card-icon">
            <MessageSquareText size={15} />
          </span>
          <span className="sgo-truncate">Messages</span>
        </h2>
        <button type="button" className="sgo-link" onClick={onOpen}>
          Open Messages
          <ChevronRight size={13} />
        </button>
      </header>

      <p className="sgo-soft" style={{ margin: 0, fontSize: 12 }}>
        Stay connected with your team.
      </p>

      {status === "loading" ? (
        <p className="sgo-muted" style={{ margin: "10px 0 0", fontSize: 12 }}>
          Loading…
        </p>
      ) : !latest ? (
        <p className="sgo-muted" style={{ margin: "10px 0 0", fontSize: 12 }}>
          No conversations yet — start one with a teammate.
        </p>
      ) : (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 650 }} className="sgo-truncate">
              {conversationDisplayName(latest, admin?.id)}
            </p>
            <p className="sgo-muted sgo-truncate" style={{ margin: "2px 0 0", fontSize: 11.5 }}>
              {preview}
            </p>
          </div>

          {unreadConversations > 0 ? (
            <span className="sgo-badge" style={{ background: "var(--accent-tint)", color: "var(--accent-strong)" }}>
              {unreadConversations} unread
            </span>
          ) : null}
        </div>
      )}
    </section>
  );
}

type SocialMediaSummary = {
  postsByStatus: Record<string, number>;
  connectedAccounts: number;
  hasMetrics: boolean;
};

/** Real Social Media counts for MyGrowthCard — only fetched when the
 *  caller actually holds social_media:VIEW (the analytics route enforces
 *  this server-side too; this just avoids a doomed-to-403 request). */
function useSocialMediaSummary(enabled: boolean) {
  const [summary, setSummary] = useState<SocialMediaSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setStatus("loading");

    fetch("/api/admin/social-media/analytics", { credentials: "include", cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { ok?: boolean } & Partial<SocialMediaSummary>) => {
        if (cancelled) return;
        if (payload?.ok) {
          setSummary({
            postsByStatus: payload.postsByStatus ?? {},
            connectedAccounts: payload.connectedAccounts ?? 0,
            hasMetrics: payload.hasMetrics ?? false,
          });
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { summary, status };
}

/** Does this restricted identity hold at least the given action on a module? */
function hasModulePermission(identity: OverviewIdentity | undefined, module: string, action: string): boolean {
  if (!identity) return false;
  return identity.permissions.some((grant) => grant.module === module && grant.action === action);
}

/* =============================================================================
   LAYOUT EDITOR

   iOS style editing. Press and hold any widget (or tap Arrange) and every
   widget starts to wiggle. While editing:
   - drag a widget to move it; the others slide out of the way
   - use the shape buttons, or drag the corner handle, to change its width
   - minimise it to just its header, or remove it with the minus badge
   Pointer events cover mouse, touch and pen. Arrow keys move a focused
   widget for keyboard users.
============================================================================= */

type DragState = {
  key: WidgetKey;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  grabX: number;
  grabY: number;
  tx: number;
  ty: number;
  active: boolean;
  scroller: HTMLElement | Window;
};

type SlotHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
};

function useLayoutEditor({
  editing,
  onEnterEdit,
  onMove,
  layoutKey,
  reducedMotion,
}: {
  editing: boolean;
  onEnterEdit: () => void;
  onMove: (from: WidgetKey, to: WidgetKey) => void;
  layoutKey: string;
  reducedMotion: boolean;
}) {
  const slots = useRef(new Map<WidgetKey, HTMLDivElement>());
  const press = useRef<{ key: WidgetKey; pointerId: number; x: number; y: number; timer: number } | null>(null);
  const drag = useRef<DragState | null>(null);
  const flip = useRef<Map<WidgetKey, DOMRect> | null>(null);
  const frame = useRef(0);
  const lastSwap = useRef(0);
  const suppressClick = useRef(false);
  const detachWindow = useRef<(() => void) | null>(null);
  const dragMoveRef = useRef<(event: PointerEvent) => void>(() => undefined);
  const endDragRef = useRef<() => void>(() => undefined);
  const editingRef = useRef(editing);
  const moveRef = useRef(onMove);
  const enterRef = useRef(onEnterEdit);
  const [draggingKey, setDraggingKey] = useState<WidgetKey | null>(null);

  editingRef.current = editing;
  moveRef.current = onMove;
  enterRef.current = onEnterEdit;

  const registerSlot = useCallback(
    (key: WidgetKey) => (element: HTMLDivElement | null) => {
      if (element) slots.current.set(key, element);
      else slots.current.delete(key);
    },
    [],
  );

  /** Records where every widget is now, so the next layout change can animate from it. */
  const captureFlip = useCallback(() => {
    const rects = new Map<WidgetKey, DOMRect>();
    slots.current.forEach((element, key) => rects.set(key, element.getBoundingClientRect()));
    flip.current = rects;
  }, []);

  const clearPress = useCallback(() => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  }, []);

  const applyDrag = useCallback(() => {
    const state = drag.current;
    if (!state?.active) return;
    const element = slots.current.get(state.key);
    if (!element) return;

    // Work out where the widget sits in the grid without the drag offset,
    // then offset it so it stays under the pointer.
    const rect = element.getBoundingClientRect();
    const naturalLeft = rect.left - state.tx;
    const naturalTop = rect.top - state.ty;
    state.tx = state.x - state.grabX - naturalLeft;
    state.ty = state.y - state.grabY - naturalTop;
    element.style.transform = `translate3d(${state.tx}px, ${state.ty}px, 0)`;
  }, []);

  const hitTest = useCallback(() => {
    const state = drag.current;
    if (!state?.active) return;
    // A short pause after each move stops two widgets of different sizes
    // swapping back and forth under a still pointer.
    if (performance.now() - lastSwap.current < 170) return;

    for (const [key, element] of slots.current) {
      if (key === state.key) continue;
      // Skip widgets still sliding into place: their on-screen position is
      // not where they will land, and passing under the pointer mid-slide
      // would swap them straight back.
      if (element.getAnimations().length > 0) continue;
      const rect = element.getBoundingClientRect();
      if (state.x >= rect.left && state.x <= rect.right && state.y >= rect.top && state.y <= rect.bottom) {
        lastSwap.current = performance.now();
        captureFlip();
        moveRef.current(state.key, key);
        return;
      }
    }
  }, [captureFlip]);

  const autoScroll = useCallback((state: DragState) => {
    const edge = 90;
    let delta = 0;
    if (state.y < edge) delta = -Math.ceil((edge - state.y) / 5);
    else if (state.y > window.innerHeight - edge) delta = Math.ceil((state.y - (window.innerHeight - edge)) / 5);
    if (!delta) return;
    if (state.scroller === window) window.scrollBy(0, delta);
    else (state.scroller as HTMLElement).scrollTop += delta;
  }, []);

  const loop = useCallback(() => {
    const state = drag.current;
    if (!state?.active) return;
    autoScroll(state);
    applyDrag();
    hitTest();
    frame.current = requestAnimationFrame(loop);
  }, [applyDrag, autoScroll, hitTest]);

  const beginDrag = useCallback((key: WidgetKey, pointerId: number, x: number, y: number) => {
    const element = slots.current.get(key);
    if (!element) return;
    const rect = element.getBoundingClientRect();

    // Follow the pointer at window level rather than with pointer capture.
    // Reordering moves the widget's element in the page, which would
    // silently drop a capture and end the drag after the first move.
    detachWindow.current?.();
    const move = (event: PointerEvent) => dragMoveRef.current(event);
    const up = (event: PointerEvent) => {
      if (drag.current?.pointerId === event.pointerId) endDragRef.current();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    detachWindow.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };

    drag.current = {
      key,
      pointerId,
      startX: x,
      startY: y,
      x,
      y,
      grabX: x - rect.left,
      grabY: y - rect.top,
      tx: 0,
      ty: 0,
      active: false,
      scroller: getScrollParent(element),
    };
  }, []);

  const endDrag = useCallback(() => {
    detachWindow.current?.();
    detachWindow.current = null;
    const state = drag.current;
    drag.current = null;
    cancelAnimationFrame(frame.current);
    if (!state) return;

    const element = slots.current.get(state.key);
    if (state.active && element) {
      const from = `translate3d(${state.tx}px, ${state.ty}px, 0)`;
      element.style.transform = "";
      if (!reducedMotion) {
        element.animate([{ transform: from }, { transform: "translate3d(0, 0, 0)" }], {
          duration: 280,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }
    }
    setDraggingKey(null);
  }, [reducedMotion]);

  const onDragMove = useCallback(
    (event: PointerEvent) => {
      const state = drag.current;
      if (!state || state.pointerId !== event.pointerId) return;
      state.x = event.clientX;
      state.y = event.clientY;

      if (!state.active) {
        if (Math.hypot(state.x - state.startX, state.y - state.startY) < 6) return;
        state.active = true;
        setDraggingKey(state.key);
        frame.current = requestAnimationFrame(loop);
      }
    },
    [loop],
  );

  dragMoveRef.current = onDragMove;
  endDragRef.current = endDrag;

  // Slide every widget from its old position to its new one after a change.
  useIsoLayoutEffect(() => {
    const rects = flip.current;
    if (!rects) return;
    flip.current = null;
    const draggedKey = drag.current?.key;

    slots.current.forEach((element, key) => {
      if (key === draggedKey) return;
      const before = rects.get(key);
      if (!before) return;
      element.getAnimations().forEach((animation) => animation.cancel());
      const after = element.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (reducedMotion || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) return;
      element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
        duration: 300,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      });
    });

    applyDrag();
  }, [layoutKey, reducedMotion, applyDrag]);

  // Leaving edit mode cancels anything in flight.
  useEffect(() => {
    if (!editing) {
      endDrag();
      clearPress();
    }
  }, [editing, endDrag, clearPress]);

  useEffect(
    () => () => {
      detachWindow.current?.();
      cancelAnimationFrame(frame.current);
      if (press.current) window.clearTimeout(press.current.timer);
    },
    [],
  );

  const handlersFor = (key: WidgetKey): SlotHandlers => ({
    onPointerDown: (event) => {
      suppressClick.current = false;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest("[data-slot-control]")) return;

      if (!editingRef.current) {
        if (target.closest("input, textarea, select, [contenteditable='true']")) return;
        clearPress();
        const { pointerId, clientX, clientY, pointerType } = event;
        press.current = {
          key,
          pointerId,
          x: clientX,
          y: clientY,
          timer: window.setTimeout(() => {
            const pending = press.current;
            press.current = null;
            suppressClick.current = true;
            enterRef.current();
            if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
            // Mouse and pen can carry straight on into a drag, like iOS.
            // Touch starts a fresh drag after lifting, because the browser
            // has already claimed this touch for scrolling.
            if (pointerType !== "touch" && pending) beginDrag(key, pointerId, pending.x, pending.y);
          }, LONG_PRESS_MS),
        };
        return;
      }

      event.preventDefault();
      beginDrag(key, event.pointerId, event.clientX, event.clientY);
    },

    onPointerMove: (event) => {
      // Drag movement is tracked at window level (see beginDrag); here we
      // only cancel a pending long press if the pointer wanders off.
      const pending = press.current;
      if (pending && pending.pointerId === event.pointerId) {
        if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > 8) clearPress();
      }
    },

    onPointerUp: () => clearPress(),

    onPointerCancel: () => clearPress(),

    onPointerLeave: () => {
      if (press.current && !drag.current) clearPress();
    },

    onClickCapture: (event) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },

    onContextMenu: (event) => {
      if (editingRef.current || press.current) event.preventDefault();
    },
  });

  return { draggingKey, registerSlot, handlersFor, captureFlip };
}

/* =============================================================================
   STYLES (scoped to the Overview, nothing leaks into the shell)
============================================================================= */

const OVERVIEW_CSS = `
.sgo {
  --r: 24px;
  --ga: 0.68;
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: calc(100dvh - 58px);
  overflow: hidden;
  background: #8DBBE4;
  font-family: var(--font-sans), Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.sgo, .sgo *, .sgo *::before, .sgo *::after { box-sizing: border-box; }
.sgo button { font: inherit; }

.sgo[data-theme="dark"] {
  --g: rgba(36, 44, 50, var(--ga));
  --g-strong: rgba(28, 35, 40, min(0.96, calc(var(--ga) + 0.18)));
  --inset: rgba(255, 255, 255, 0.05);
  --t: #F6F8F9;
  --t2: rgba(246, 248, 249, 0.74);
  --t3: rgba(246, 248, 249, 0.50);
  --ln: rgba(255, 255, 255, 0.10);
  --ln2: rgba(255, 255, 255, 0.20);
  --btn: rgba(255, 255, 255, 0.08);
  --btn2: rgba(255, 255, 255, 0.15);
  --track: rgba(255, 255, 255, 0.12);
  --acc: #CFEFD9;
  --chip: #FFFFFF;
  --chip-ink: #121A1F;
  --menu: rgba(26, 32, 37, 0.97);
  --shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 20px 50px rgba(10, 20, 30, 0.18);
}
.sgo[data-theme="light"] {
  --g: rgba(255, 255, 255, var(--ga));
  --g-strong: rgba(255, 255, 255, min(0.97, calc(var(--ga) + 0.22)));
  --inset: rgba(21, 35, 43, 0.04);
  --t: #15232B;
  --t2: rgba(21, 35, 43, 0.74);
  --t3: rgba(21, 35, 43, 0.50);
  --ln: rgba(21, 35, 43, 0.09);
  --ln2: rgba(21, 35, 43, 0.18);
  --btn: rgba(21, 35, 43, 0.05);
  --btn2: rgba(21, 35, 43, 0.10);
  --track: rgba(21, 35, 43, 0.10);
  --acc: #2F5B43;
  --chip: #15232B;
  --chip-ink: #FFFFFF;
  --menu: rgba(255, 255, 255, 0.98);
  --shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 20px 50px rgba(10, 20, 30, 0.08);
}
.sgo[data-hero="light"] {
  --h: #14222A;
  --h2: rgba(20, 34, 42, 0.72);
  --hg: rgba(255, 255, 255, 0.66);
  --hln: rgba(255, 255, 255, 0.65);
  --hshadow: none;
}
.sgo[data-hero="dark"] {
  --h: #FFFFFF;
  --h2: rgba(255, 255, 255, 0.80);
  --hg: rgba(18, 26, 32, 0.42);
  --hln: rgba(255, 255, 255, 0.16);
  --hshadow: 0 1px 18px rgba(0, 0, 0, 0.28);
}

/* Wallpaper */
.sgo-wall {
  position: absolute; inset: 0; z-index: -4;
  background-size: cover; background-position: center; background-repeat: no-repeat;
  transition: filter 300ms ease;
  pointer-events: none;
}
.sgo-glow {
  position: absolute; inset: -20%; z-index: -3;
  background: radial-gradient(circle at 70% 20%, rgba(255,255,255,0.28), transparent 35%);
  animation: sgo-drift 38s ease-in-out infinite alternate;
  pointer-events: none;
}
.sgo-shade { position: absolute; inset: 0; z-index: -2; background: rgba(0, 0, 0, var(--shade, 0)); pointer-events: none; }
.sgo-grain { position: absolute; inset: 0; z-index: -1; opacity: 0.22; mix-blend-mode: overlay; pointer-events: none; }

/* Layout */
.sgo-content {
  position: relative; z-index: 1;
  display: flex; flex: 1; flex-direction: column;
  width: 100%; max-width: 1520px; margin: 0 auto;
  padding: 22px 28px 28px;
}
.sgo[data-editing="true"] .sgo-content { padding-bottom: 110px; }
.sgo-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.sgo-brand { display: inline-flex; align-items: center; gap: 10px; color: var(--h); font-size: 12.5px; font-weight: 700; letter-spacing: -0.02em; text-shadow: var(--hshadow); }
.sgo-brand-mark {
  display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center;
  border-radius: 10px; background: #FFFFFF; color: #15232B;
  box-shadow: 0 6px 18px rgba(0,0,0,0.08);
  overflow: hidden; flex-shrink: 0;
}
.sgo-brand-mark img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
.sgo-top-actions { display: flex; align-items: center; gap: 8px; }
.sgo-top-btn {
  position: relative;
  display: inline-flex; height: 38px; align-items: center; justify-content: center; gap: 8px;
  padding: 0 14px; border: 1px solid var(--hln); border-radius: 12px;
  background: var(--hg); color: var(--h);
  font-size: 11px; font-weight: 650;
  backdrop-filter: blur(18px) saturate(140%); -webkit-backdrop-filter: blur(18px) saturate(140%);
  cursor: pointer; transition: transform 180ms ease, background 180ms ease;
}
.sgo-top-btn:hover:not(:disabled) { transform: translateY(-1px); }
.sgo-top-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sgo-top-btn.is-icon { width: 38px; padding: 0; }
.sgo-top-btn[aria-pressed="true"] { background: var(--chip); color: var(--chip-ink); border-color: transparent; }
.sgo-top-badge {
  position: absolute; top: -4px; right: -4px;
  min-width: 17px; height: 17px; padding: 0 4px; border-radius: 999px;
  background: #FF7A6B; color: #FFFFFF; font-size: 9px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.7);
}

/* Hero */
.sgo-hero { padding: 46px 12px 34px; text-align: center; color: var(--h); text-shadow: var(--hshadow); }
.sgo-hero-date { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--h2); }
.sgo-clock { font-variant-numeric: tabular-nums; font-weight: 650; color: var(--h); }
.sgo-colon { animation: sgo-blink 2s steps(1) infinite; }
.sgo-hero-title { margin: 10px 0 0; font-size: clamp(36px, 4.6vw, 64px); font-weight: 600; line-height: 1.08; letter-spacing: -0.06em; }
.sgo-hero-name { font-family: Georgia, "Times New Roman", serif; font-style: italic; font-weight: 400; letter-spacing: -0.04em; }
.sgo-hero-sub { max-width: 560px; margin: 12px auto 0; font-size: 13.5px; line-height: 1.7; color: var(--h2); }
.sgo-hero-meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin-top: 18px; }
.sgo-hero-chip {
  display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px;
  border: 1px solid var(--hln); border-radius: 999px; background: var(--hg); color: var(--h);
  font-size: 10.5px; font-weight: 650; text-shadow: none;
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
}
button.sgo-hero-chip { cursor: pointer; transition: transform 180ms ease; }
button.sgo-hero-chip:hover:not(:disabled) { transform: translateY(-1px); }

/* Discovery tip */
.sgo-tip {
  display: flex; align-items: center; gap: 10px; align-self: center; max-width: 100%;
  margin: 0 auto 14px; padding: 6px 6px 6px 14px; border: 1px solid var(--hln); border-radius: 999px;
  background: var(--hg); color: var(--h); font-size: 11px; font-weight: 600;
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  animation: sgo-rise 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.sgo-tip-try {
  height: 28px; padding: 0 12px; border: 0; border-radius: 999px;
  background: var(--chip); color: var(--chip-ink); font-size: 10.5px; font-weight: 700; cursor: pointer;
}
.sgo-tip-close {
  display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center;
  border: 0; border-radius: 50%; background: transparent; color: var(--h2); cursor: pointer;
}

/* Grid */
.sgo-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-auto-flow: row dense; gap: 14px; align-items: stretch; }
.sgo-span-4 { grid-column: span 4; } .sgo-span-6 { grid-column: span 6; }
.sgo-span-8 { grid-column: span 8; } .sgo-span-12 { grid-column: span 12; }

/* Slots: the grid item that edit mode moves, resizes and wiggles */
.sgo-slot { position: relative; min-width: 0; display: flex; -webkit-touch-callout: none; border-radius: var(--r); }
.sgo-slot[data-collapsed="true"] { align-self: start; }
.sgo-jiggle { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; border-radius: var(--r); transform-origin: 50% 50%; }
.sgo-slot-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.sgo-slot-body > * { flex: 1; }
.sgo-slot:focus-visible { outline: 2px solid #8FD6B0; outline-offset: 4px; }

.sgo[data-editing="true"] .sgo-slot { touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; }
.sgo[data-editing="true"] .sgo-slot-body { pointer-events: none; }
.sgo[data-editing="true"] .sgo-jiggle {
  animation: sgo-wiggle 0.3s ease-in-out infinite alternate;
  animation-delay: calc(var(--i, 0) * -0.11s);
}
.sgo[data-editing="true"] .sgo-slot[data-group="true"] .sgo-jiggle {
  outline: 1.5px dashed var(--hln); outline-offset: 5px;
}
.sgo-slot[data-dragging="true"] { z-index: 60; cursor: grabbing; }
.sgo[data-editing="true"] .sgo-slot[data-dragging="true"] .sgo-jiggle {
  animation: none;
  transform: scale(1.035);
  filter: drop-shadow(0 28px 36px rgba(6, 14, 20, 0.30));
  transition: transform 180ms ease;
}

/* Edit controls */
.sgo-ctl-remove {
  position: absolute; top: -9px; left: -9px; z-index: 6;
  display: flex; width: 26px; height: 26px; align-items: center; justify-content: center;
  border: 0; border-radius: 50%; background: rgba(58, 64, 70, 0.94); color: #FFFFFF; cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 0 0 1.5px rgba(255,255,255,0.4);
  animation: sgo-pop 200ms ease both; transition: background 160ms ease, transform 160ms ease;
}
.sgo-ctl-remove:hover { background: #E5484D; transform: scale(1.08); }
.sgo-ctl-bar {
  position: absolute; top: 10px; right: 10px; z-index: 6;
  display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 12px;
  background: rgba(18, 24, 28, 0.82); box-shadow: 0 8px 22px rgba(0,0,0,0.22);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  animation: sgo-pop 200ms ease both;
}
.sgo-ctl-bar button {
  display: inline-flex; height: 28px; min-width: 28px; padding: 0 7px; align-items: center; justify-content: center;
  border: 0; border-radius: 8px; background: transparent; color: rgba(255,255,255,0.72); cursor: pointer;
  transition: background 140ms ease, color 140ms ease;
}
.sgo-ctl-bar button:hover { background: rgba(255,255,255,0.12); color: #FFFFFF; }
.sgo-ctl-bar button[data-active="true"] { background: #FFFFFF; color: #121A1F; }
.sgo-shape { display: block; height: 10px; border: 1.5px solid currentColor; border-radius: 3px; }
.sgo-ctl-sep { width: 1px; height: 16px; margin: 0 3px; background: rgba(255,255,255,0.18); }
.sgo-ctl-resize {
  position: absolute; right: -8px; bottom: -8px; z-index: 6;
  width: 24px; height: 24px; border-radius: 50%; background: #FFFFFF; cursor: ew-resize; touch-action: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25); animation: sgo-pop 200ms ease both;
}
.sgo-ctl-resize::before {
  content: ""; position: absolute; inset: 7px 7px 8px 8px;
  border-right: 2px solid #6B7680; border-bottom: 2px solid #6B7680; border-radius: 0 0 3px 0;
}
.sgo-ctl-name {
  position: absolute; left: 50%; bottom: -24px; transform: translateX(-50%);
  padding: 2px 9px; border-radius: 999px; background: var(--hg); color: var(--h);
  font-size: 10px; font-weight: 650; white-space: nowrap; pointer-events: none;
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
}

/* Edit bar */
.sgo-editbar {
  position: fixed; left: 50%; bottom: 22px; z-index: 80; transform: translateX(-50%);
  display: flex; align-items: center; gap: 6px; max-width: calc(100vw - 24px); padding: 7px;
  border-radius: 18px; background: rgba(18, 24, 28, 0.84); color: #FFFFFF;
  backdrop-filter: blur(24px) saturate(160%); -webkit-backdrop-filter: blur(24px) saturate(160%);
  box-shadow: 0 24px 60px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08);
  animation: sgo-bar-in 340ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.sgo-editbar-hint { display: inline-flex; align-items: center; gap: 7px; padding: 0 10px 0 8px; color: rgba(255,255,255,0.66); font-size: 11px; font-weight: 600; white-space: nowrap; }
.sgo-editbar-btn, .sgo-editbar-done {
  display: inline-flex; height: 38px; align-items: center; gap: 7px; padding: 0 13px; border: 0; border-radius: 12px;
  background: rgba(255,255,255,0.09); color: #FFFFFF; font-size: 11px; font-weight: 650; white-space: nowrap; cursor: pointer;
  transition: background 150ms ease;
}
.sgo-editbar-btn:hover:not(:disabled) { background: rgba(255,255,255,0.16); }
.sgo-editbar-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.sgo-editbar-count { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: #FFFFFF; color: #121A1F; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
.sgo-editbar-done { background: #FFFFFF; color: #121A1F; }
.sgo-editbar-done:hover { background: #E9F5EE; }
.sgo-tray {
  position: absolute; left: 50%; bottom: calc(100% + 10px); transform: translateX(-50%);
  width: min(360px, calc(100vw - 24px)); max-height: 360px; overflow-y: auto; padding: 6px;
  border-radius: 18px; background: rgba(18, 24, 28, 0.92); box-shadow: 0 24px 60px rgba(0,0,0,0.35);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  animation: sgo-tray-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.sgo-tray-title { margin: 6px 10px 6px; color: rgba(255,255,255,0.5); font-size: 10.5px; font-weight: 650; }
.sgo-tray-item {
  display: flex; width: 100%; align-items: center; gap: 12px; padding: 9px 10px; border: 0; border-radius: 12px;
  background: transparent; color: #FFFFFF; text-align: left; cursor: pointer;
}
.sgo-tray-item:hover { background: rgba(255,255,255,0.08); }
.sgo-tray-icon { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 10px; background: rgba(255,255,255,0.1); flex-shrink: 0; }
.sgo-tray-plus { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; border-radius: 50%; background: #3EC27A; color: #FFFFFF; flex-shrink: 0; }

/* Card */
.sgo-card {
  position: relative; min-width: 0;
  display: flex; flex-direction: column;
  padding: 20px; border: 1px solid var(--ln); border-radius: var(--r);
  background: var(--g); color: var(--t); box-shadow: var(--shadow);
  backdrop-filter: blur(26px) saturate(150%); -webkit-backdrop-filter: blur(26px) saturate(150%);
  animation: sgo-rise 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--i, 0) * 45ms);
  transition: border-color 200ms ease, background 200ms ease, padding 200ms ease;
}
.sgo-card:hover { border-color: var(--ln2); }
.sgo-card[data-collapsed="true"] { padding-top: 14px; padding-bottom: 14px; }
.sgo-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; min-height: 30px; }
.sgo-card[data-collapsed="true"] .sgo-card-head { margin-bottom: 0; }
.sgo-card-title { display: inline-flex; align-items: center; gap: 9px; min-width: 0; font-size: 13px; font-weight: 650; letter-spacing: -0.02em; }
.sgo-card-icon { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border-radius: 10px; background: var(--btn); color: var(--t2); flex-shrink: 0; }
.sgo-card-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.sgo-collapse {
  display: inline-flex; width: 26px; height: 26px; align-items: center; justify-content: center; border: 0; border-radius: 8px;
  background: transparent; color: var(--t3); cursor: pointer; opacity: 0; transition: opacity 160ms ease, background 160ms ease, transform 200ms ease;
}
.sgo-collapse svg { transition: transform 220ms ease; }
.sgo-collapse[aria-expanded="false"] svg { transform: rotate(-90deg); }
.sgo-card:hover .sgo-collapse, .sgo-collapse:focus-visible, .sgo-card[data-collapsed="true"] .sgo-collapse { opacity: 1; }
.sgo-collapse:hover { background: var(--btn); color: var(--t); }
@media (hover: none) { .sgo-collapse { opacity: 0.75; } }

/* Primitives */
.sgo-muted { color: var(--t3); } .sgo-soft { color: var(--t2); }
.sgo-eyebrow { font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--t3); }
.sgo-link {
  display: inline-flex; align-items: center; gap: 3px; padding: 6px 8px; border: 0; border-radius: 9px;
  background: transparent; color: var(--t3); font-size: 11px; font-weight: 600; cursor: pointer;
}
.sgo-link:hover:not(:disabled) { background: var(--btn); color: var(--t); }
.sgo-link:disabled { opacity: 0.45; cursor: not-allowed; }
.sgo-badge {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 999px;
  background: var(--btn); color: var(--t2); font-size: 9.5px; font-weight: 650; white-space: nowrap;
}
.sgo-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: 36px; padding: 0 14px; border: 1px solid var(--ln); border-radius: 11px;
  background: var(--btn); color: var(--t); font-size: 11px; font-weight: 650;
  text-decoration: none; cursor: pointer; white-space: nowrap;
  transition: background 180ms ease, transform 180ms ease;
}
.sgo-btn:hover:not(:disabled) { background: var(--btn2); }
.sgo-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.sgo-btn-primary { border-color: transparent; background: var(--chip); color: var(--chip-ink); }
.sgo-btn-primary:hover:not(:disabled) { background: var(--chip); opacity: 0.88; }
.sgo-seg { display: inline-flex; padding: 3px; border-radius: 10px; background: var(--btn); gap: 2px; }
.sgo-seg button { height: 26px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: var(--t3); font-size: 10.5px; font-weight: 650; cursor: pointer; }
.sgo-seg button[data-active="true"] { background: var(--chip); color: var(--chip-ink); }
.sgo-live { position: relative; display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #7EE2A2; flex-shrink: 0; }
.sgo-live::after {
  content: ""; position: absolute; inset: -4px; border-radius: 50%;
  border: 2px solid rgba(126, 226, 162, 0.55); animation: sgo-ping 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
}
.sgo-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.sgo-avatar {
  display: inline-flex; width: 34px; height: 34px; flex-shrink: 0; align-items: center; justify-content: center;
  border-radius: 50%; color: #1B2A33; font-size: 10.5px; font-weight: 700; position: relative;
}
.sgo-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.sgo-bar { width: 100%; height: 5px; overflow: hidden; border-radius: 999px; background: var(--track); }
.sgo-bar-fill {
  height: 100%; border-radius: 999px; background: var(--acc);
  transform-origin: left center; animation: sgo-grow 1100ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: 200ms; transition: width 600ms ease;
}
.sgo-row-btn {
  display: flex; align-items: center; gap: 12px; padding: 9px 10px; margin: 0 -10px;
  width: calc(100% + 20px); border: 0; border-radius: 14px; background: transparent; color: inherit;
  text-align: left; cursor: pointer; transition: background 160ms ease;
}
.sgo-row-btn:hover:not(:disabled) { background: var(--btn); }
.sgo-row-btn:disabled { cursor: default; }
.sgo-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.sgo-title-sm { font-size: 12px; font-weight: 650; letter-spacing: -0.01em; }
.sgo-sub { font-size: 10.5px; color: var(--t3); margin-top: 2px; }
.sgo-big { font-size: 32px; font-weight: 650; letter-spacing: -0.06em; line-height: 1; font-variant-numeric: tabular-nums; }
.sgo-divider { height: 1px; background: var(--ln); margin: 14px 0; }

/* Empty layout */
.sgo-empty { grid-column: span 12; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 40px 20px; text-align: center; }

/* Command bar */
.sgo-command { z-index: 6; padding: 14px; }
.sgo-command-field {
  position: relative; display: flex; align-items: center; gap: 10px;
  height: 54px; padding: 0 8px 0 16px; border-radius: 16px;
  background: var(--g-strong); border: 1px solid var(--ln);
  transition: border-color 180ms ease;
}
.sgo-command-field:focus-within { border-color: var(--ln2); }
.sgo-command-field input { flex: 1; min-width: 0; height: 100%; border: 0; outline: none; background: transparent; color: var(--t); font-size: 13px; }
.sgo-command-field input::placeholder { color: var(--t3); }
.sgo-kbd {
  display: inline-flex; height: 22px; min-width: 22px; align-items: center; justify-content: center;
  padding: 0 6px; border: 1px solid var(--ln); border-radius: 7px; color: var(--t3); font-size: 10px; font-weight: 650;
}
.sgo-command-go {
  display: inline-flex; width: 36px; height: 36px; align-items: center; justify-content: center; border: 0;
  border-radius: 50%; background: var(--chip); color: var(--chip-ink); cursor: pointer;
}
.sgo-command-go:disabled { opacity: 0.4; cursor: not-allowed; }
.sgo-command-chips { position: relative; display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.sgo-chip-add { border-style: dashed; color: var(--t); }
.sgo-chip-wrap { position: relative; display: inline-flex; }
.sgo-chip-x {
  position: absolute; top: -5px; right: -5px; display: flex; width: 18px; height: 18px; align-items: center; justify-content: center;
  border: 0; border-radius: 50%; background: var(--chip); color: var(--chip-ink); cursor: pointer;
  opacity: 0; transform: scale(0.8); transition: opacity 140ms ease, transform 140ms ease;
}
.sgo-chip-wrap:hover .sgo-chip-x, .sgo-chip-x:focus-visible { opacity: 1; transform: none; }
@media (hover: none) { .sgo-chip-x { display: none; } }
.sgo-picker {
  position: absolute; left: 0; top: calc(100% + 8px); z-index: 20; width: min(380px, 100%); max-height: 440px; overflow-y: auto;
  padding: 8px; border: 1px solid var(--ln); border-radius: 18px; background: var(--menu);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25); animation: sgo-pop 160ms ease both;
}
.sgo-picker-head { padding: 6px 8px 8px; }
.sgo-picker-row {
  display: flex; width: 100%; align-items: center; gap: 12px; padding: 8px; border: 0; border-radius: 12px;
  background: transparent; color: var(--t); text-align: left; cursor: pointer; transition: background 140ms ease;
}
.sgo-picker-row:hover:not(:disabled) { background: var(--btn); }
.sgo-picker-row:disabled { cursor: default; opacity: 0.75; }
.sgo-picker-check {
  display: flex; width: 22px; height: 22px; flex-shrink: 0; align-items: center; justify-content: center;
  border: 1.5px solid var(--ln2); border-radius: 50%; color: var(--chip-ink);
}
.sgo-picker-check[data-on="true"] { border-color: transparent; background: var(--chip); }
.sgo-picker-sep { height: 1px; margin: 6px 8px; background: var(--ln); }
.sgo-command-chip {
  display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px;
  border: 1px solid var(--ln); border-radius: 999px; background: var(--btn); color: var(--t2);
  font-size: 10.5px; font-weight: 650; cursor: pointer; transition: background 160ms ease, color 160ms ease;
}
.sgo-command-chip:hover:not(:disabled) { background: var(--btn2); color: var(--t); }
.sgo-command-chip:disabled { opacity: 0.45; cursor: not-allowed; }
.sgo-command-menu {
  position: absolute; left: 0; right: 0; top: calc(100% + 8px); z-index: 20;
  padding: 6px; border: 1px solid var(--ln); border-radius: 16px;
  background: var(--menu);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25); animation: sgo-pop 160ms ease both;
  max-height: 320px; overflow-y: auto;
}
.sgo-command-option {
  display: flex; width: 100%; align-items: center; gap: 12px; padding: 9px 10px; border: 0; border-radius: 11px;
  background: transparent; color: var(--t); text-align: left; cursor: pointer;
}
.sgo-command-option[data-active="true"] { background: var(--btn2); }

/* Today */
.sgo-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.sgo-day {
  display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 0 7px;
  border: 1px solid transparent; border-radius: 14px; background: transparent; color: var(--t2); cursor: pointer;
  transition: background 160ms ease, color 160ms ease;
}
.sgo-day:hover { background: var(--btn); }
.sgo-day[data-today="true"] { border-color: var(--ln2); }
.sgo-day[data-selected="true"] { background: var(--chip); color: var(--chip-ink); border-color: transparent; }
.sgo-day-name { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.7; }
.sgo-day-num { font-size: 16px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
.sgo-day-dots { display: flex; gap: 3px; height: 5px; }
.sgo-day-dots span { width: 5px; height: 5px; border-radius: 50%; }

.sgo-spot {
  position: relative; display: flex; align-items: center; gap: 14px; margin-top: 16px; padding: 14px 14px 14px 18px;
  border-radius: 18px; background: var(--inset); border: 1px solid var(--ln); overflow: hidden;
}
.sgo-spot::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 4px; border-radius: 0 4px 4px 0; background: var(--c); }
.sgo-spot-title { margin-top: 4px; font-size: 15px; font-weight: 650; letter-spacing: -0.025em; }
.sgo-spot-meta { display: flex; align-items: center; gap: 6px; margin-top: 4px; font-size: 11px; color: var(--t3); }

.sgo-tl { margin-top: 16px; }
.sgo-tl-allday { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.sgo-tl-allday button {
  display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border: 0; border-radius: 8px;
  background: var(--c); color: #132028; font-size: 10px; font-weight: 650; cursor: pointer;
}
.sgo-tl-track { position: relative; border-radius: 14px; background: var(--inset); border: 1px solid var(--ln); overflow: hidden; }
.sgo-tl-hour { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--ln); }
.sgo-tl-past { position: absolute; top: 0; bottom: 0; left: 0; background: repeating-linear-gradient(135deg, transparent 0 6px, var(--inset) 6px 7px); }
.sgo-tl-block {
  position: absolute; height: 24px; display: flex; align-items: center; padding: 0 8px; border: 0; border-radius: 8px;
  background: var(--c); color: #132028; font-size: 10px; font-weight: 650; cursor: pointer;
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: left;
  transition: transform 160ms ease, filter 160ms ease, opacity 200ms ease;
  animation: sgo-pop 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.sgo-tl-block:hover { transform: translateY(-1px); filter: brightness(1.05); }
.sgo-tl-block[data-past="true"] { opacity: 0.42; }
.sgo-tl-block[data-current="true"] { box-shadow: 0 0 0 2px var(--chip); }
.sgo-tl-now { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #FF7A6B; z-index: 2; }
.sgo-tl-now::before { content: ""; position: absolute; top: -1px; left: -3px; width: 8px; height: 8px; border-radius: 50%; background: #FF7A6B; }
.sgo-tl-ticks { position: relative; height: 16px; margin-top: 6px; }
.sgo-tl-ticks span { position: absolute; transform: translateX(-50%); font-size: 9.5px; color: var(--t3); font-variant-numeric: tabular-nums; }

/* Away pager */
.sgo-pager { display: flex; align-items: center; gap: 4px; }
.sgo-pager button {
  display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; border: 0; border-radius: 50%;
  background: transparent; color: var(--t3); font-size: 10.5px; font-weight: 650; cursor: pointer;
}
.sgo-pager button[data-active="true"] { background: var(--btn2); color: var(--t); }
.sgo-leave-tag {
  display: inline-flex; align-items: center; height: 24px; padding: 0 10px; border-radius: 8px;
  background: var(--chip); color: var(--chip-ink); font-size: 10px; font-weight: 650; white-space: nowrap;
}

/* Charts */
.sgo-spark { display: block; width: 100%; overflow: visible; }
.sgo-chart { position: relative; margin-top: 14px; }
.sgo-chart svg { display: block; width: 100%; height: 130px; overflow: visible; }
.sgo-chart-line { stroke-dasharray: 1000; stroke-dashoffset: 1000; animation: sgo-draw 1600ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.sgo-chart-area { animation: sgo-fade 1200ms ease both; animation-delay: 300ms; }
.sgo-chart-tip {
  position: absolute; top: -6px; transform: translate(-50%, -100%); padding: 6px 9px; border-radius: 9px;
  background: var(--chip); color: var(--chip-ink); font-size: 10px; font-weight: 650; white-space: nowrap; pointer-events: none;
}
.sgo-chart-axis { display: flex; justify-content: space-between; margin-top: 8px; font-size: 9.5px; color: var(--t3); }

/* Stat tiles */
.sgo-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
.sgo[data-compact="true"] .sgo-stats { gap: 10px; }
.sgo-stat { padding: 18px; gap: 0; }
.sgo-stat-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sgo-stat-spark { height: 34px; margin-top: 14px; }

/* Segmented progress */
.sgo-segbar { display: flex; height: 8px; gap: 3px; margin-top: 16px; }
.sgo-segbar span { border-radius: 999px; transform-origin: left; animation: sgo-grow 900ms cubic-bezier(0.22, 1, 0.36, 1) both; }

/* =========================================================================
   CUSTOMISE PANEL
   ========================================================================= */
.sgp-backdrop {
  position: fixed; inset: 0; z-index: 90; border: 0; background: rgba(8, 14, 18, 0.26);
  backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: sgo-fade 200ms ease both; cursor: default;
}
.sgp {
  position: fixed; top: 12px; right: 12px; bottom: 12px; z-index: 100;
  display: flex; flex-direction: column; width: min(440px, calc(100vw - 24px)); overflow: hidden;
  border: 1px solid rgba(255,255,255,0.7); border-radius: 28px;
  background: rgba(248, 250, 249, 0.9); color: #18262D;
  backdrop-filter: blur(30px) saturate(170%); -webkit-backdrop-filter: blur(30px) saturate(170%);
  box-shadow: 0 40px 100px rgba(8, 16, 22, 0.28), inset 0 1px 0 rgba(255,255,255,0.9);
  animation: sgp-in 340ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.sgp-handle { display: none; }
.sgp-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 18px 14px 22px; }
.sgp-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 18px; font-weight: 650; letter-spacing: -0.035em; }
.sgp-subtitle { margin: 3px 0 0; font-size: 11px; color: #73817A; }
.sgp-icon-btn {
  display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; flex-shrink: 0;
  border: 1px solid rgba(24,38,45,0.08); border-radius: 11px; background: #FFFFFF; color: #3B4A44; cursor: pointer;
}
.sgp-preview { position: relative; margin: 0 18px; height: 140px; overflow: hidden; border-radius: 20px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06), 0 10px 30px rgba(8,16,22,0.12); }
.sgp-preview-wall { position: absolute; inset: -8px; background-size: cover; background-position: center; }
.sgp-preview-shade { position: absolute; inset: 0; }
.sgp-preview-grid { position: absolute; inset: 14px; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 5px; align-content: start; overflow: hidden; }
.sgp-preview-grid span { display: block; box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.3); transition: all 300ms ease; }
.sgp-preview-label { position: absolute; left: 12px; bottom: 10px; padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,0.85); color: #18262D; font-size: 9.5px; font-weight: 700; }
.sgp-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; margin: 14px 18px 0; padding: 4px; border-radius: 14px; background: rgba(24,38,45,0.06); }
.sgp-tabs button {
  display: inline-flex; height: 34px; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: 10px;
  background: transparent; color: #66746D; font-size: 11.5px; font-weight: 650; cursor: pointer; transition: background 160ms ease, color 160ms ease;
}
.sgp-tabs button[data-active="true"] { background: #FFFFFF; color: #18262D; box-shadow: 0 2px 10px rgba(0,0,0,0.07); }
.sgp-body { flex: 1; overflow-y: auto; padding: 18px 22px 22px; overscroll-behavior: contain; }
.sgp-section { margin-bottom: 26px; }
.sgp-label { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 0 10px; color: #22332B; font-size: 12px; font-weight: 700; }
.sgp-label small { color: #8A968F; font-size: 11px; font-weight: 600; }
.sgp-hint { margin: 8px 0 0; color: #84918A; font-size: 10.5px; line-height: 1.6; }
.sgp-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.sgp-chip {
  display: inline-flex; height: 32px; align-items: center; gap: 6px; padding: 0 13px; border: 1px solid rgba(24,38,45,0.1);
  border-radius: 999px; background: #FFFFFF; color: #4C5B54; font-size: 11px; font-weight: 650; cursor: pointer;
}
.sgp-chip[data-active="true"] { background: #18262D; border-color: #18262D; color: #FFFFFF; }
.sgp-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.sgp-tile {
  position: relative; height: 80px; width: 100%; padding: 0; overflow: hidden; border: 0; border-radius: 16px; cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06); transition: transform 180ms ease, box-shadow 180ms ease;
}
.sgp-tile:hover { transform: translateY(-2px); }
.sgp-tile[data-selected="true"] { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #2F5B43; }
.sgp-tile-label {
  position: absolute; left: 7px; bottom: 7px; display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 8px;
  background: rgba(255,255,255,0.86); color: #18262D; font-size: 9.5px; font-weight: 650;
}
.sgp-tile-check { position: absolute; top: 7px; right: 7px; display: flex; width: 20px; height: 20px; align-items: center; justify-content: center; border-radius: 50%; background: #FFFFFF; color: #2F5B43; }
.sgp-card { padding: 14px; border: 1px solid rgba(24,38,45,0.07); border-radius: 18px; background: #FFFFFF; }
.sgp-builder-preview { position: relative; height: 104px; border-radius: 14px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06); }
.sgp-builder-preview button { position: absolute; right: 8px; top: 8px; }
.sgp-seg { display: grid; grid-auto-columns: minmax(0, 1fr); grid-auto-flow: column; gap: 4px; padding: 4px; border-radius: 12px; background: rgba(24,38,45,0.06); }
.sgp-seg button {
  display: inline-flex; height: 32px; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: 9px;
  background: transparent; color: #66746D; font-size: 11px; font-weight: 650; cursor: pointer;
}
.sgp-seg button[data-active="true"] { background: #FFFFFF; color: #18262D; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.sgp-stops { display: flex; gap: 8px; margin-top: 12px; }
.sgp-stop {
  position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 6px 8px;
  border: 1px solid rgba(24,38,45,0.08); border-radius: 12px; background: #FAFBFA; cursor: pointer;
}
.sgp-stop input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.sgp-stop-swatch { width: 30px; height: 30px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.12); }
.sgp-stop-code { color: #5E6D66; font-size: 9.5px; font-weight: 650; font-variant-numeric: tabular-nums; }
.sgp-stop-remove {
  position: absolute; top: 4px; right: 4px; z-index: 2; display: flex; width: 18px; height: 18px; align-items: center; justify-content: center;
  border: 0; border-radius: 50%; background: rgba(24,38,45,0.08); color: #5E6D66; cursor: pointer;
}
.sgp-add-stop {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 72px;
  border: 1px dashed rgba(24,38,45,0.2); border-radius: 12px; background: transparent; color: #5E6D66; font-size: 10px; font-weight: 650; cursor: pointer;
}
.sgp-swatches { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; }
.sgp-swatch { aspect-ratio: 1; width: 100%; padding: 0; border: 0; border-radius: 50%; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.12); transition: transform 160ms ease; }
.sgp-swatch:hover { transform: scale(1.08); }
.sgp-swatch[data-selected="true"] { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #2F5B43; }
.sgp-colour-row { display: flex; align-items: center; gap: 12px; margin-top: 12px; padding: 10px 12px; border: 1px solid rgba(24,38,45,0.08); border-radius: 14px; background: #FFFFFF; }
.sgp-colour-row input { width: 44px; height: 36px; padding: 0; border: 0; background: transparent; cursor: pointer; }
.sgp-upload {
  display: flex; width: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 24px 16px;
  border: 1.5px dashed rgba(47,91,67,0.3); border-radius: 16px; background: rgba(47,91,67,0.04); color: #2F5B43;
  font-size: 12px; font-weight: 650; cursor: pointer;
}
.sgp-upload:disabled { opacity: 0.6; cursor: progress; }
.sgp-upload small { color: #84918A; font-size: 10.5px; font-weight: 500; }
.sgp-photo { position: relative; height: 140px; margin-top: 12px; overflow: hidden; border-radius: 16px; background-size: cover; background-position: center; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08); }
.sgp-photo-actions { position: absolute; left: 10px; right: 10px; bottom: 10px; display: flex; gap: 6px; }
.sgp-range { width: 100%; accent-color: #2F5B43; cursor: pointer; }
.sgp-toggle {
  display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0;
  border: 0; border-bottom: 1px solid rgba(24,38,45,0.06); background: transparent; text-align: left; cursor: pointer;
}
.sgp-switch { display: flex; width: 40px; height: 24px; flex-shrink: 0; align-items: center; padding: 3px; border-radius: 999px; background: #D8DFDB; transition: background 180ms ease; }
.sgp-switch[data-active="true"] { background: #2F5B43; }
.sgp-switch span { width: 18px; height: 18px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1); }
.sgp-switch[data-active="true"] span { transform: translateX(16px); }
.sgp-btn {
  display: inline-flex; height: 38px; align-items: center; justify-content: center; gap: 7px; padding: 0 14px;
  border: 1px solid rgba(24,38,45,0.1); border-radius: 12px; background: #FFFFFF; color: #2E3F37;
  font-size: 11.5px; font-weight: 650; cursor: pointer; white-space: nowrap;
}
.sgp-btn-sm { height: 30px; padding: 0 10px; font-size: 10.5px; border-radius: 9px; }
.sgp-btn-primary { border-color: #18262D; background: #18262D; color: #FFFFFF; }
.sgp-btn-danger { color: #B42318; }
.sgp-feature {
  display: flex; align-items: center; gap: 14px; padding: 16px; margin-bottom: 18px; border-radius: 20px;
  background: linear-gradient(135deg, #18262D, #2F5B43); color: #FFFFFF;
  box-shadow: 0 16px 34px rgba(24,38,45,0.22);
}
.sgp-feature-icon { display: flex; width: 42px; height: 42px; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 14px; background: rgba(255,255,255,0.14); }
.sgp-feature button { margin-left: auto; height: 34px; padding: 0 13px; border: 0; border-radius: 10px; background: #FFFFFF; color: #18262D; font-size: 11px; font-weight: 700; cursor: pointer; white-space: nowrap; }
.sgp-widget-row { display: flex; align-items: flex-start; gap: 10px; padding: 12px 0; border-bottom: 1px solid rgba(24,38,45,0.06); }
.sgp-widget-row[data-hidden="true"] .sgp-widget-main { opacity: 0.5; }
.sgp-widget-icon { display: flex; width: 34px; height: 34px; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 11px; background: rgba(24,38,45,0.06); color: #3B4A44; }
.sgp-widget-main { min-width: 0; flex: 1; }
.sgp-widget-name { margin: 0; color: #22332B; font-size: 12px; font-weight: 650; }
.sgp-widget-desc { margin: 2px 0 0; color: #8A968F; font-size: 10.5px; }
.sgp-sizes { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.sgp-size {
  display: inline-flex; height: 26px; align-items: center; gap: 6px; padding: 0 9px; border: 1px solid rgba(24,38,45,0.1); border-radius: 8px;
  background: #FFFFFF; color: #5E6D66; font-size: 10px; font-weight: 650; cursor: pointer;
}
.sgp-size[data-active="true"] { background: #18262D; border-color: #18262D; color: #FFFFFF; }
.sgp-move { display: flex; flex-direction: column; gap: 2px; }
.sgp-move button {
  display: flex; width: 26px; height: 20px; align-items: center; justify-content: center; border: 0; border-radius: 6px;
  background: rgba(24,38,45,0.05); color: #5E6D66; cursor: pointer;
}
.sgp-move button:disabled { opacity: 0.3; cursor: default; }
.sgp-note { display: flex; gap: 10px; padding: 14px; border-radius: 14px; background: rgba(47,91,67,0.07); color: #4E6A5A; font-size: 11px; line-height: 1.6; }
.sgp-foot { display: flex; gap: 10px; padding: 14px 18px 18px; border-top: 1px solid rgba(24,38,45,0.06); }

/* Compact */
.sgo[data-compact="true"] .sgo-card { padding: 16px; }
.sgo[data-compact="true"] .sgo-card[data-collapsed="true"] { padding-top: 12px; padding-bottom: 12px; }
.sgo[data-compact="true"] .sgo-grid { gap: 10px; }
.sgo[data-compact="true"] .sgo-hero { padding-top: 26px; padding-bottom: 22px; }

/* Focus */
.sgo button:focus-visible, .sgo a:focus-visible, .sgo input:focus-visible { outline: 2px solid #5A9D76; outline-offset: 2px; }

/* Motion */
@keyframes sgo-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes sgo-pop { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }
@keyframes sgo-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sgo-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes sgo-draw { to { stroke-dashoffset: 0; } }
@keyframes sgo-ping { 0% { transform: scale(0.6); opacity: 1; } 80%, 100% { transform: scale(1.6); opacity: 0; } }
@keyframes sgo-blink { 50% { opacity: 0.35; } }
@keyframes sgo-drift { from { transform: translate3d(-3%, -2%, 0); } to { transform: translate3d(4%, 3%, 0); } }
@keyframes sgo-spin { to { transform: rotate(360deg); } }
@keyframes sgo-wiggle {
  from { transform: rotate(calc(var(--wig, 0.5deg) * -1)) translateY(0.5px); }
  to { transform: rotate(var(--wig, 0.5deg)) translateY(-0.5px); }
}
@keyframes sgo-bar-in { from { opacity: 0; transform: translate(-50%, 24px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes sgo-tray-in { from { opacity: 0; transform: translate(-50%, 10px) scale(0.98); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes sgp-in { from { opacity: 0; transform: translateX(26px) scale(0.985); } to { opacity: 1; transform: none; } }
@keyframes sgp-up { from { opacity: 0; transform: translateY(48px); } to { opacity: 1; transform: none; } }
.sgo-spin { animation: sgo-spin 1s linear infinite; }

/* Responsive */
@media (min-width: 700px) and (max-width: 1199px) {
  .sgo-span-8, .sgo-span-12 { grid-column: span 12; }
  .sgo-span-4, .sgo-span-6 { grid-column: span 6; }
}
@media (max-width: 1199px) {
  .sgo-ctl-resize { display: none; }
}
@media (max-width: 699px) {
  .sgo-content { padding: 16px; }
  .sgo-brand-text, .sgo-top-btn .sgo-top-label { display: none; }
  .sgo-top-btn { width: 38px; padding: 0; }
  .sgo-hero { padding: 34px 4px 26px; }
  .sgo-hero-title { font-size: 36px; }
  .sgo-grid { gap: 10px; }
  .sgo-grid > * { grid-column: span 12; }
  .sgo-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .sgo-big { font-size: 28px; }
  .sgo-hide-sm { display: none !important; }
  .sgo-editbar { bottom: 14px; }
  .sgo-tip span { font-size: 10.5px; }
  .sgp { top: auto; left: 0; right: 0; bottom: 0; width: 100%; height: min(90dvh, 780px); border-radius: 26px 26px 0 0; animation-name: sgp-up; }
  .sgp-handle { display: block; width: 40px; height: 4px; margin: 8px auto 0; border-radius: 999px; background: rgba(24,38,45,0.18); }
}
@media (prefers-reduced-motion: reduce) {
  .sgo *, .sgo *::before, .sgo *::after { animation: none !important; transition-duration: 0ms !important; }
  .sgo-chart-line { stroke-dashoffset: 0; }
  .sgo[data-editing="true"] .sgo-jiggle { outline: 1.5px dashed var(--hln); outline-offset: 4px; }
}
`;

/* =============================================================================
   SLOT CONTEXT

   Lets every widget know whether it is minimised or being edited without
   threading new props through each card.
============================================================================= */

type SlotState = {
  title: string;
  collapsed: boolean;
  collapsible: boolean;
  editing: boolean;
  toggleCollapsed: () => void;
};

const SlotContext = createContext<SlotState>({
  title: "",
  collapsed: false,
  collapsible: false,
  editing: false,
  toggleCollapsed: () => undefined,
});

/* =============================================================================
   MAIN COMPONENT
============================================================================= */

export default function OverviewTab({ admin, identity, onNavigate, onOpenMessages }: OverviewTabProps) {
  const now = useNow(15_000);
  const reducedMotion = useReducedMotionPreference();

  /* ---------- Employee mode ----------
     True only for a restricted employee account (see
     lib/auth/current-admin.ts). Every pre-existing, full-access account —
     the Owner included — has isEmployeeMode === false here and the rest
     of this component behaves exactly as it always has: this flag is the
     only thing anything below branches on. */
  const isEmployeeMode = Boolean(identity) && !identity?.isFullAccess;

  const employeeProfile = useEmployeeProfile(isEmployeeMode);
  const myLeave = useMyLeaveOverview(isEmployeeMode && hasModulePermission(identity, "leave", "VIEW"));
  const myDepartment = useMyDepartmentColleagues(
    isEmployeeMode && hasModulePermission(identity, "team", "VIEW"),
    identity?.employeeId ?? null,
  );

  const canSeeOwnCalendar = isEmployeeMode && hasModulePermission(identity, "calendar", "VIEW");
  const canRequestLeave = isEmployeeMode && hasModulePermission(identity, "leave", "VIEW");
  const canSeeDepartment = isEmployeeMode && hasModulePermission(identity, "team", "VIEW");
  const canSeeNotifications = isEmployeeMode && hasModulePermission(identity, "notifications", "VIEW");
  const canSeeAnalytics = isEmployeeMode && hasModulePermission(identity, "analytics", "VIEW");
  // Named distinctly from canSeeGrowth below — this is Command's own
  // Activity timeline, not the unrelated Growth-module reuse of the
  // "activity" widget key for MyGrowthCard.
  const canSeeCommandActivity = isEmployeeMode && hasModulePermission(identity, "activity", "VIEW");
  // Admin mode shows Analytics/Activity/Notifications unconditionally,
  // exactly as before this feature existed. Employee mode only shows
  // them when the corresponding module grant is held.
  const showAnalytics = isEmployeeMode ? canSeeAnalytics : true;
  const showCommandActivity = isEmployeeMode ? canSeeCommandActivity : true;
  const showNotifications = isEmployeeMode ? canSeeNotifications : true;

  const overview = useOverviewData(!isEmployeeMode);
  const analyticsSeries = useAnalyticsSeries(showAnalytics);
  const activityFeed = useActivityFeed(showCommandActivity);
  const notificationsFeed = useNotificationsFeed(showNotifications);

  const canSeeGrowth =
    isEmployeeMode &&
    (hasModulePermission(identity, "social_media", "VIEW") ||
      hasModulePermission(identity, "campaigns", "VIEW") ||
      hasModulePermission(identity, "brand_assets", "VIEW") ||
      hasModulePermission(identity, "seo_analytics", "VIEW"));

  // The analytics route itself requires social_media:VIEW specifically —
  // narrower than canSeeGrowth above, which also covers campaigns/brand
  // assets/SEO access that doesn't carry real post data with it.
  const canSeeSocialMediaSummary = isEmployeeMode && hasModulePermission(identity, "social_media", "VIEW");
  const socialMediaSummary = useSocialMediaSummary(canSeeSocialMediaSummary);

  /* ---------- User ---------- */

  const firstName = useMemo(() => {
    if (isEmployeeMode) {
      const source =
        employeeProfile.profile?.preferredName?.trim() ||
        employeeProfile.profile?.firstName?.trim() ||
        admin?.fullName?.trim() ||
        "there";
      return source.split(/\s+/)[0];
    }

    const source = admin?.fullName?.trim() || admin?.name?.trim() || admin?.email?.split("@")[0] || "there";
    return source.split(/\s+/)[0];
  }, [admin, isEmployeeMode, employeeProfile.profile]);

  const role = useMemo(() => (isEmployeeMode ? "employee" : getRole(admin?.role)), [admin?.role, isEmployeeMode]);

  // Owner-only company-wide affordances (Portfolio, Finance) never apply
  // in employee mode, regardless of what admin.role happens to contain —
  // this is a hard "false" here, not a string comparison a stray role
  // value could accidentally satisfy.
  const canViewCompanyOperations = !isEmployeeMode && role === "admin";
  const canViewFinance = !isEmployeeMode && (role === "admin" || role === "finance");

  /* ---------- Preferences ---------- */

  const storageKey = useMemo(() => getStorageKey(admin), [admin]);
  const [preferences, setPreferences] = useState<DashboardPreferences>(freshDefaults);
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>("wallpaper");
  const [editing, setEditing] = useState(false);
  const [wallpaperError, setWallpaperError] = useState<string | null>(null);
  const [savingWallpaper, setSavingWallpaper] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const editorGridRef = useRef<HTMLDivElement>(null);

  // Gates the server-save effect until the server round trip below has
  // either produced a definitive record or confirmed there isn't one yet
  // — otherwise an early render's default preferences could race ahead
  // and overwrite a real saved record with blank defaults.
  const serverReconciledRef = useRef(false);

  // Set right before a server-sourced setPreferences call, so the save
  // effect below doesn't immediately PATCH the same data straight back
  // to the server it just came from.
  const suppressNextSaveRef = useRef(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    setPreferences(loadPreferences(storageKey));
    setLoadedStorageKey(storageKey);
  }, [storageKey]);

  // Reconcile with the database: it's the source of truth across devices
  // and sessions. The local copy loaded above still paints instantly so
  // there's no flash of defaults while this request is in flight.
  useEffect(() => {
    if (!storageKey) return;

    let cancelled = false;
    serverReconciledRef.current = false;

    (async () => {
      try {
        const response = await fetch("/api/admin/overview/preferences", {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) throw new Error(`status ${response.status}`);

        const payload = await response.json();
        if (cancelled) return;

        if (payload?.ok && payload.preferences && Object.keys(payload.preferences).length > 0) {
          suppressNextSaveRef.current = true;
          setPreferences(mergePreferencesFromRaw(payload.preferences));
        } else {
          // No server record yet. If this browser already has real
          // (non-default) local preferences, migrate them up once —
          // the next load for this user will find a server record and
          // skip this branch entirely.
          const local = loadPreferences(storageKey);
          if (!isDefaultPreferences(local)) {
            void fetch("/api/admin/overview/preferences", {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ preferences: local }),
            }).catch(() => {});
          }
        }
      } catch (error) {
        // Offline or API hiccup — keep using the local copy already
        // loaded above; the debounced save effect stays gated off below
        // so nothing gets overwritten on the server by a stale local copy.
        console.warn("Unable to load dashboard preferences from the server:", error);
      } finally {
        if (!cancelled) serverReconciledRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || loadedStorageKey !== storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch (error) {
      // Appearance still works for this session. Large wallpapers can exceed the quota.
      console.warn("Unable to persist dashboard preferences:", error);
    }

    if (suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false;
      return;
    }

    if (!serverReconciledRef.current) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      void fetch("/api/admin/overview/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      }).catch((error) => {
        console.warn("Unable to save dashboard preferences:", error);
      });
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [preferences, storageKey, loadedStorageKey]);

  const updatePreference = useCallback(
    <K extends keyof DashboardPreferences>(key: K, value: DashboardPreferences[K]) => {
      setPreferences((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const updateLayout = useCallback((updater: (layout: DashboardLayout) => DashboardLayout) => {
    setPreferences((current) => ({ ...current, layout: updater(current.layout) }));
  }, []);

  const handleWallpaperUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSavingWallpaper(true);
    setWallpaperError(null);

    try {
      const resized = await processWallpaper(file);
      const blob = await (await fetch(resized)).blob();

      const body = new FormData();
      body.append("file", blob, "wallpaper.jpg");

      const response = await fetch("/api/admin/overview/wallpaper", {
        method: "POST",
        credentials: "include",
        body,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || typeof payload.url !== "string") {
        throw new Error(payload?.error || "Unable to upload wallpaper.");
      }

      setPreferences((current) => ({ ...current, wallpaperType: "custom", customWallpaper: payload.url }));
    } catch (error) {
      setWallpaperError(error instanceof Error ? error.message : "Unable to upload wallpaper.");
    } finally {
      setSavingWallpaper(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(freshDefaults());
    setWallpaperError(null);
  }, []);

  const openPanel = useCallback((tab: PanelTab) => {
    setPanelTab(tab);
    setCustomiseOpen(true);
  }, []);

  /* ---------- Navigation ---------- */

  const navigate = useCallback((destination: Destination) => onNavigate?.(destination), [onNavigate]);
  const navDisabled = !onNavigate;

  /* ---------- Calendar feed ---------- */

  const todayKey = now ? toDateKey(now) : null;
  const feed = useCalendarFeed(todayKey);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Snap back to today when the date rolls over.
  const lastTodayRef = useRef<string | null>(null);
  useEffect(() => {
    if (todayKey && lastTodayRef.current && lastTodayRef.current !== todayKey) setSelectedKey(null);
    lastTodayRef.current = todayKey;
  }, [todayKey]);

  const activeKey = selectedKey ?? todayKey;

  const todaySchedule = useMemo(
    () => (now ? scheduleOnDay(feed.events, now) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feed.events, todayKey],
  );

  const heroSpotlight = useMemo(() => (now ? findSpotlight(todaySchedule, now) : null), [todaySchedule, now]);

  /* ---------- Wallpaper and glass ---------- */

  const hour = now?.getHours() ?? 12;
  const wallpaper = useMemo(() => resolveWallpaper(preferences, hour), [preferences, hour]);
  const heroTone: Tone = preferences.overlay > 35 ? "dark" : wallpaper.tone;
  const glassTheme: Tone =
    preferences.widgetTheme === "auto" ? wallpaper.tone : preferences.widgetTheme === "light" ? "light" : "dark";
  const accent = ACCENTS.find((item) => item.id === preferences.accentId) ?? ACCENTS[0];

  const wallpaperStyle = useMemo(
    () => wallpaperStyleFor(wallpaper.background, preferences.blur),
    [wallpaper.background, preferences.blur],
  );

  const rootStyle = {
    "--r": `${clamp(preferences.radius, 12, 34)}px`,
    "--ga": clamp(preferences.glassOpacity, 25, 96) / 100,
    "--acc": glassTheme === "dark" ? accent.dark : accent.light,
  } as CSSProperties;

  /* ---------- Notifications ---------- */

  const unreadCount = notificationsFeed.unreadCount;

  /* ---------- Copy ---------- */

  const greetingDescription = isEmployeeMode
    ? "Everything you're set up to work on, in one place."
    : role === "admin"
      ? "Here's what's happening across Syntra Grid today."
      : role === "finance"
        ? "Your financial workspace, all in one place."
        : "Everything you need to stay on top of your day.";

  const roleLabel = isEmployeeMode
    ? employeeProfile.profile?.jobTitle || "My workspace"
    : role === "admin"
      ? "Admin workspace"
      : role === "finance"
        ? "Finance workspace"
        : "My workspace";

  /* ---------- Commands ---------- */

  const commands = useMemo<CommandItem[]>(() => {
    // Quick actions and navigation only ever point to modules this
    // identity actually holds a VIEW grant for — never the Owner's full
    // command list filtered client-side by role string.
    if (isEmployeeMode) {
      const list: CommandItem[] = [];

      if (canSeeOwnCalendar) {
        list.push({ id: "calendar", label: "Calendar", hint: "Your meetings and events", keywords: "schedule events meeting leave", icon: CalendarDays });
      }
      if (canRequestLeave) {
        list.push({ id: "leave", label: "Leave", hint: "Request leave and check your balance", keywords: "leave holiday vacation", icon: Plane });
      }
      if (canSeeDepartment) {
        list.push({ id: "team", label: "Team", hint: "Your department", keywords: "people colleagues department", icon: Users });
      }
      if (canSeeNotifications) {
        list.push({ id: "notifications", label: "Notifications", hint: "Updates and alerts", keywords: "alerts inbox", icon: Bell });
      }
      if (canSeeAnalytics) {
        list.push({ id: "analytics", label: "Analytics", hint: "Company performance", keywords: "reports insights metrics", icon: BarChart3 });
      }
      if (canSeeCommandActivity) {
        list.push({ id: "activity", label: "Activity", hint: "Operational timeline", keywords: "log history feed", icon: Activity });
      }
      if (hasModulePermission(identity, "social_media", "VIEW")) {
        list.push({ id: "social_media", label: "Social Media", hint: "Posts and campaigns", keywords: "social media posts", icon: Megaphone });
      }
      if (hasModulePermission(identity, "campaigns", "VIEW")) {
        list.push({ id: "campaigns", label: "Campaigns", hint: "Marketing campaigns", keywords: "campaigns marketing", icon: Megaphone });
      }
      if (hasModulePermission(identity, "seo_analytics", "VIEW")) {
        list.push({ id: "seo_analytics", label: "SEO & Analytics", hint: "Search and site performance", keywords: "seo analytics", icon: BarChart3 });
      }
      if (hasModulePermission(identity, "brand_assets", "VIEW")) {
        list.push({ id: "brand_assets", label: "Brand Assets", hint: "Logos and brand materials", keywords: "brand assets logo", icon: Sparkles });
      }

      return list;
    }

    const list: CommandItem[] = [
      { id: "quick-action", label: "New action", hint: "Create a task, event or request", keywords: "create add new task", icon: Plus },
      { id: "calendar", label: "Calendar", hint: "Meetings, deadlines and leave", keywords: "schedule events meeting leave", icon: CalendarDays },
      { id: "projects", label: "Projects", hint: "Delivery and milestones", keywords: "delivery milestones tasks", icon: FolderKanban },
      { id: "support", label: "Support", hint: "Open client conversations", keywords: "tickets help clients", icon: Headphones },
      { id: "team", label: "Team", hint: "People and availability", keywords: "people staff employees", icon: Users },
      { id: "analytics", label: "Analytics", hint: "Company performance", keywords: "reports insights metrics", icon: BarChart3 },
      { id: "activity", label: "Activity", hint: "Operational timeline", keywords: "log history feed", icon: Activity },
      { id: "notifications", label: "Notifications", hint: "Updates and alerts", keywords: "alerts inbox", icon: Bell },
      { id: "attention", label: "Needs attention", hint: "Items waiting on you", keywords: "urgent priorities", icon: AlertCircle },
    ];

    if (canViewCompanyOperations) {
      list.push({ id: "portfolio", label: "Portfolio", hint: "Client workspaces", keywords: "workspaces clients", icon: LayoutGrid });
    }

    list.push(
      { id: "leave", label: "Leave", hint: "Requests, balances and policies", keywords: "leave holiday vacation absence", icon: Plane },
      { id: "social_media", label: "Social Media", hint: "Posts and publishing", keywords: "social media posts instagram linkedin", icon: Megaphone },
      { id: "campaigns", label: "Campaigns", hint: "Marketing campaigns", keywords: "campaigns marketing", icon: Megaphone },
      { id: "seo_analytics", label: "SEO & Analytics", hint: "Search and site performance", keywords: "seo analytics search", icon: BarChart3 },
      { id: "brand_assets", label: "Brand Assets", hint: "Logos and brand materials", keywords: "brand assets logo", icon: Sparkles },
    );
    if (canViewFinance) {
      list.splice(4, 0, { id: "finance", label: "Finance", hint: "Revenue and receivables", keywords: "money invoices revenue", icon: CircleDollarSign });
    }

    return list;
  }, [
    canViewCompanyOperations,
    canViewFinance,
    isEmployeeMode,
    canSeeOwnCalendar,
    canRequestLeave,
    canSeeDepartment,
    canSeeNotifications,
    canSeeAnalytics,
    canSeeCommandActivity,
    identity,
  ]);

  /* ---------- Shortcut chips ----------
     Built only from `commands`, so an employee can only ever pin tabs
     they already hold a VIEW grant for. */

  const lockedShortcut = commands.find((command) => command.id === LOCKED_SHORTCUT) ?? null;
  const pinnable = commands.filter((command) => command.id !== "quick-action" && command.id !== LOCKED_SHORTCUT);
  const defaultPins = pinnable.slice(0, isEmployeeMode ? 4 : 3).map((command) => command.id);
  const pinnedIds = (preferences.pinnedShortcuts ?? defaultPins).filter((id) =>
    pinnable.some((command) => command.id === id),
  );
  const shortcuts = pinnedIds.map((id) => pinnable.find((command) => command.id === id)!);
  const quickAction = commands.find((command) => command.id === "quick-action") ?? null;

  const togglePin = (id: Destination) => {
    setPreferences((current) => {
      const list = (current.pinnedShortcuts ?? defaultPins).filter((item) => pinnable.some((command) => command.id === item));
      return {
        ...current,
        pinnedShortcuts: list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
      };
    });
  };

  /* ---------- Stats ---------- */

  const statistics = useMemo<StatDefinition[]>(() => {
    if (isEmployeeMode) {
      // Every tile here is either real data from an already-secured,
      // permission-gated endpoint, or omitted entirely — never a
      // fabricated figure presented as if it were hers. A flat sparkline
      // (no trend implied) is used rather than inventing a trend.
      const tiles: StatDefinition[] = [];

      if (canSeeOwnCalendar) {
        tiles.push({
          label: "Today's events",
          value: todaySchedule.length,
          prefix: "",
          suffix: "",
          decimals: 0,
          note: feed.status === "live" ? "From your calendar" : "Loading your calendar…",
          icon: CalendarDays,
          spark: Array(8).fill(todaySchedule.length),
        });
      }

      if (canRequestLeave && myLeave.status === "ready" && myLeave.data) {
        const available = myLeave.data.my.balances.reduce((sum, balance) => sum + balance.available, 0);

        tiles.push({
          label: "Leave available",
          value: available,
          prefix: "",
          suffix: "d",
          decimals: 1,
          note: "Remaining this year",
          icon: Plane,
          spark: Array(8).fill(available),
        });
      }

      if (canSeeDepartment && myDepartment.status === "ready") {
        tiles.push({
          label: "Department",
          value: myDepartment.colleagues.length,
          prefix: "",
          suffix: "",
          decimals: 0,
          note: employeeProfile.profile?.department?.name ?? "Colleagues",
          icon: Building2,
          spark: Array(8).fill(myDepartment.colleagues.length),
        });
      }

      if (canSeeNotifications) {
        tiles.push({
          label: "Notifications",
          value: unreadCount,
          prefix: "",
          suffix: "",
          decimals: 0,
          note: "Unread",
          icon: Bell,
          spark: Array(8).fill(unreadCount),
        });
      }

      return tiles;
    }

    const summary = overview.data?.summary;
    const flatSpark = (value: number) => Array(8).fill(value);

    if (role === "finance") {
      if (!summary) return [];

      return [
        { label: "Revenue this month", value: summary.finance.revenueThisMonth, prefix: "₦", suffix: "", decimals: 0, note: "Paid invoices", icon: CircleDollarSign, spark: flatSpark(summary.finance.revenueThisMonth) },
        { label: "Receivables", value: summary.finance.receivables, prefix: "₦", suffix: "", decimals: 0, note: "Outstanding balance", icon: Wallet, spark: flatSpark(summary.finance.receivables) },
        { label: "Active projects", value: summary.projects.active, prefix: "", suffix: "", decimals: 0, note: "Company projects", icon: FolderKanban, spark: flatSpark(summary.projects.active) },
        { label: "Timesheets to review", value: summary.timesheets.awaitingApproval, prefix: "", suffix: "", decimals: 0, note: "Awaiting approval", icon: Clock3, spark: flatSpark(summary.timesheets.awaitingApproval) },
      ];
    }

    if (role === "employee") {
      return [
        { label: "Today's events", value: todaySchedule.length, prefix: "", suffix: "", decimals: 0, note: feed.status === "live" ? "From your calendar" : "Sample schedule", icon: CalendarDays, spark: [2, 4, 3, 5, 3, 4, 2, todaySchedule.length] },
        { label: "Notifications", value: unreadCount, prefix: "", suffix: "", decimals: 0, note: "Unread", icon: Bell, spark: [1, 2, 4, 3, 2, 3, 4, unreadCount] },
      ];
    }

    if (!summary) return [];

    return [
      { label: "Active clients", value: summary.clients.active, prefix: "", suffix: "", decimals: 0, note: "Status: Active", icon: LayoutGrid, spark: flatSpark(summary.clients.active) },
      { label: "Active projects", value: summary.projects.active, prefix: "", suffix: "", decimals: 0, note: "In delivery", icon: FolderKanban, spark: flatSpark(summary.projects.active) },
      { label: "Open support", value: summary.tickets.open, prefix: "", suffix: "", decimals: 0, note: `${summary.tickets.urgent} urgent`, icon: Headphones, spark: flatSpark(summary.tickets.open) },
      { label: "Employees", value: summary.employees.total, prefix: "", suffix: "", decimals: 0, note: "Active headcount", icon: Activity, spark: flatSpark(summary.employees.total) },
    ];
  }, [
    role,
    todaySchedule.length,
    feed.status,
    unreadCount,
    overview.data,
    isEmployeeMode,
    canSeeOwnCalendar,
    canRequestLeave,
    myLeave.status,
    myLeave.data,
    canSeeDepartment,
    myDepartment.status,
    myDepartment.colleagues.length,
    employeeProfile.profile,
    canSeeNotifications,
  ]);

  /* ---------- Widget registry ----------
     One entry per widget this person may see, in default order. Employee
     mode only ever lists widgets backed by a permission grant, exactly as
     before; the layout editor can only move, resize, minimise or hide
     these, never add anything outside them. */

  const spec = (
    key: WidgetKey,
    sizes: SizeKey[],
    defaultSize: SizeKey,
    render: () => ReactNode,
    options: { collapsible?: boolean; group?: boolean } = {},
  ): WidgetSpec => {
    const meta = WIDGET_META[key];
    return {
      key,
      label: isEmployeeMode ? meta.employeeLabel : meta.label,
      description: (isEmployeeMode && meta.employeeDescription) || meta.description,
      icon: meta.icon,
      sizes,
      defaultSize,
      collapsible: options.collapsible ?? true,
      group: options.group ?? false,
      render,
    };
  };

  const todayCard = () => (
    <TodayCard
      index={1}
      events={feed.events}
      status={feed.status}
      now={now}
      todayKey={todayKey}
      activeKey={activeKey}
      onSelectDay={(key) => setSelectedKey(key === todayKey ? null : key)}
      onOpenCalendar={() => navigate("calendar")}
      navDisabled={navDisabled}
    />
  );

  const awayCard = () => (
    <AwayCard
      index={2}
      events={feed.events}
      status={feed.status}
      todayKey={todayKey}
      onOpen={() => navigate("team")}
      navDisabled={navDisabled}
    />
  );

  const statsGroup = () => (
    <div className="sgo-stats">
      {statistics.map((stat, position) => (
        <StatTile key={stat.label} index={3 + position} {...stat} />
      ))}
    </div>
  );

  const commandBar = () => (
    <CommandBar
      commands={commands}
      lockedShortcut={lockedShortcut}
      shortcuts={shortcuts}
      pinnable={pinnable}
      quickAction={quickAction}
      addLabel={isEmployeeMode ? "Add shortcut" : "New action"}
      onTogglePin={togglePin}
      disabled={navDisabled}
      onRun={navigate}
      index={0}
    />
  );

  const specs: WidgetSpec[] = [];

  if (isEmployeeMode) {
    if (commands.length > 0) specs.push(spec("commandBar", ["l", "xl"], "xl", commandBar, { collapsible: false }));
    if (canSeeOwnCalendar) specs.push(spec("today", ["m", "l", "xl"], canSeeDepartment ? "l" : "xl", todayCard));
    if (canSeeDepartment) specs.push(spec("away", ["s", "m", "l"], canSeeOwnCalendar ? "s" : "l", awayCard));
    if (statistics.length > 0) {
      specs.push(spec("statistics", ["m", "l", "xl"], "xl", statsGroup, { collapsible: false, group: true }));
    }
    if (canSeeDepartment) {
      specs.push(
        spec("team", ["s", "m", "l"], "m", () => (
          <MyDepartmentCard
            index={10}
            colleagues={myDepartment.colleagues}
            status={myDepartment.status}
            departmentName={employeeProfile.profile?.department?.name ?? null}
            onOpen={() => navigate("team")}
            navDisabled={navDisabled}
          />
        )),
      );
    }
    if (canRequestLeave) {
      specs.push(
        spec("finance", ["s", "m", "l"], "m", () => (
          <MyLeaveCard index={11} data={myLeave.data} status={myLeave.status} onOpen={() => navigate("leave")} navDisabled={navDisabled} />
        )),
      );
    }
    if (canSeeNotifications) {
      specs.push(
        spec("notifications", ["s", "m", "l"], "m", () => (
          <MyNotificationsCard
            index={12}
            now={now}
            items={notificationsFeed.items}
            loading={notificationsFeed.status === "loading"}
            onToggle={(id) => notificationsFeed.markRead(id)}
            onOpen={() => navigate("notifications")}
            onOpenItem={navigate}
            navDisabled={navDisabled}
          />
        )),
      );
    }
    if (canSeeGrowth) {
      specs.push(
        spec("activity", ["s", "m", "l"], "m", () => (
          <MyGrowthCard
            index={13}
            summary={canSeeSocialMediaSummary ? socialMediaSummary.summary : null}
            loading={canSeeSocialMediaSummary && socialMediaSummary.status === "loading"}
            onOpen={() =>
              navigate(
                hasModulePermission(identity, "social_media", "VIEW")
                  ? "social_media"
                  : hasModulePermission(identity, "campaigns", "VIEW")
                    ? "campaigns"
                    : hasModulePermission(identity, "seo_analytics", "VIEW")
                      ? "seo_analytics"
                      : "brand_assets",
              )
            }
            navDisabled={navDisabled}
          />
        )),
      );
    }
    if (canSeeAnalytics) {
      specs.push(
        spec("analytics", ["s", "m", "l"], "m", () => (
          <AnalyticsCard
            index={14}
            series={analyticsSeries.series}
            loading={analyticsSeries.status === "loading"}
            onOpen={() => navigate("analytics")}
            navDisabled={navDisabled}
          />
        )),
      );
    }
    if (canSeeCommandActivity) {
      specs.push(
        spec("commandActivity", ["s", "m", "l"], "m", () => (
          <ActivityCard
            index={15}
            now={now}
            items={activityFeed.items}
            loading={activityFeed.status === "loading"}
            onOpen={() => navigate("activity")}
            onOpenItem={navigate}
            navDisabled={navDisabled}
          />
        )),
      );
    }
  } else {
    const pairSize: SizeKey = canViewFinance ? "s" : "m";

    specs.push(
      spec("commandBar", ["l", "xl"], "xl", commandBar, { collapsible: false }),
      spec("today", ["m", "l", "xl"], "l", todayCard),
      spec("away", ["s", "m", "l"], "s", awayCard),
      spec("statistics", ["m", "l", "xl"], "xl", statsGroup, { collapsible: false, group: true }),
      spec("analytics", ["s", "m", "l"], "s", () => (
        <AnalyticsCard
          index={7}
          series={analyticsSeries.series}
          loading={analyticsSeries.status === "loading"}
          onOpen={() => navigate("analytics")}
          navDisabled={navDisabled}
        />
      )),
      spec("activity", ["s", "m", "l"], "s", () => (
        <ActivityCard
          index={8}
          now={now}
          items={activityFeed.items}
          loading={activityFeed.status === "loading"}
          onOpen={() => navigate("activity")}
          onOpenItem={navigate}
          navDisabled={navDisabled}
        />
      )),
      spec("notifications", ["s", "m"], "s", () => (
        <NotificationsCard
          index={9}
          now={now}
          items={notificationsFeed.items}
          loading={notificationsFeed.status === "loading"}
          onToggle={(id) => notificationsFeed.markRead(id)}
          onReadAll={() => notificationsFeed.markAllRead()}
          onOpen={() => navigate("notifications")}
          onOpenItem={navigate}
          navDisabled={navDisabled}
        />
      )),
      spec("delivery", ["m", "l", "xl"], "l", () => (
        <DeliveryCard
          index={10}
          role={role}
          projects={overview.data?.delivery ?? []}
          workspaces={overview.data?.workspaces ?? []}
          loading={overview.status === "loading"}
          showWorkspaces={canViewCompanyOperations}
          onOpenProjects={() => navigate("projects")}
          onOpenPortfolio={() => navigate("portfolio")}
          navDisabled={navDisabled}
        />
      )),
      spec("attention", ["s", "m"], "s", () => (
        <AttentionCard
          index={11}
          role={role}
          items={overview.data?.attention ?? []}
          loading={overview.status === "loading"}
          onOpen={() => navigate("attention")}
          navDisabled={navDisabled}
        />
      )),
      spec("support", ["s", "m"], pairSize, () => (
        <SupportCard
          index={12}
          open={overview.data?.summary.tickets.open ?? 0}
          urgent={overview.data?.summary.tickets.urgent ?? 0}
          loading={overview.status === "loading"}
          onOpen={() => navigate("support")}
          navDisabled={navDisabled}
        />
      )),
      spec("team", ["s", "m"], pairSize, () => (
        <TeamCard
          index={13}
          adminName={firstName}
          awayNames={eventsOnDay(feed.events, now ?? new Date())
            .filter((event) => event.source === "LEAVE" && event.owner)
            .map((event) => event.owner?.name ?? "")}
          teammates={overview.data?.team ?? []}
          loading={overview.status === "loading"}
          onOpen={() => navigate("team")}
          navDisabled={navDisabled}
        />
      )),
    );

    if (canViewFinance) {
      specs.push(
        spec("finance", ["s", "m", "l"], "s", () => (
          <FinanceCard
            index={14}
            summary={overview.data?.summary.finance ?? null}
            loading={overview.status === "loading"}
            onOpen={() => navigate("finance")}
            navDisabled={navDisabled}
          />
        )),
      );
    }
  }

  /* ---------- Layout ---------- */

  const visible = preferences.widgetVisibility;
  const specMap = new Map(specs.map((item) => [item.key, item]));
  const defaultOrder = specs.map((item) => item.key);
  const defaultOrderRef = useRef(defaultOrder);
  defaultOrderRef.current = defaultOrder;

  const fullOrder = sanitizeOrder(preferences.layout.order, defaultOrder);
  const visibleOrder = fullOrder.filter((key) => visible[key]);
  const sizeOf = (item: WidgetSpec) => snapSize(preferences.layout.sizes[item.key], item);
  const collapsedOf = (item: WidgetSpec) => item.collapsible && Boolean(preferences.layout.collapsed[item.key]);

  const layoutKey = visibleOrder
    .map((key) => {
      const item = specMap.get(key)!;
      return `${key}:${sizeOf(item)}:${collapsedOf(item) ? 1 : 0}`;
    })
    .join("|");

  const moveWidget = useCallback(
    (from: WidgetKey, to: WidgetKey) => {
      updateLayout((layout) => {
        const order = sanitizeOrder(layout.order, defaultOrderRef.current);
        const fromIndex = order.indexOf(from);
        const toIndex = order.indexOf(to);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return layout;
        order.splice(fromIndex, 1);
        order.splice(toIndex, 0, from);
        return { ...layout, order };
      });
    },
    [updateLayout],
  );

  const editor = useLayoutEditor({
    editing,
    onEnterEdit: () => setEditing(true),
    onMove: moveWidget,
    layoutKey,
    reducedMotion,
  });

  const moveBy = (key: WidgetKey, delta: number, list: WidgetKey[]) => {
    const index = list.indexOf(key);
    const target = list[index + delta];
    if (index === -1 || !target) return;
    editor.captureFlip();
    moveWidget(key, target);
  };

  const changeSize = (key: WidgetKey, size: SizeKey) => {
    editor.captureFlip();
    updateLayout((layout) => ({ ...layout, sizes: { ...layout.sizes, [key]: size } }));
  };

  const toggleCollapsed = (key: WidgetKey) => {
    editor.captureFlip();
    updateLayout((layout) => ({ ...layout, collapsed: { ...layout.collapsed, [key]: !layout.collapsed[key] } }));
  };

  const setWidgetVisible = (key: WidgetKey, value: boolean) => {
    editor.captureFlip();
    setPreferences((current) => ({
      ...current,
      widgetVisibility: { ...current.widgetVisibility, [key]: value },
    }));
  };

  const resetLayout = () => {
    editor.captureFlip();
    setPreferences((current) => ({ ...current, layout: freshLayout(), widgetVisibility: { ...DEFAULT_VISIBILITY } }));
  };

  /** Drag the corner handle sideways to step through the widget's allowed widths. */
  const startResize = (event: ReactPointerEvent<HTMLSpanElement>, item: WidgetSpec, current: SizeKey) => {
    event.preventDefault();
    event.stopPropagation();
    const grid = editorGridRef.current;
    if (!grid) return;

    const gap = Number.parseFloat(window.getComputedStyle(grid).columnGap) || 14;
    const column = (grid.clientWidth - gap * 11) / 12 + gap;
    const startX = event.clientX;
    const startSpan = SIZE_SPANS[current];
    const handle = event.currentTarget;
    let applied = current;

    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Resizing still follows the pointer while it stays over the handle.
    }

    const onMoveResize = (moveEvent: PointerEvent) => {
      const wanted = startSpan + (moveEvent.clientX - startX) / column;
      const best = item.sizes.reduce((closest, option) =>
        Math.abs(SIZE_SPANS[option] - wanted) < Math.abs(SIZE_SPANS[closest] - wanted) ? option : closest,
      );
      if (best !== applied) {
        applied = best;
        changeSize(item.key, best);
      }
    };

    const stop = () => {
      handle.removeEventListener("pointermove", onMoveResize);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };

    handle.addEventListener("pointermove", onMoveResize);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  };


  // Once someone has found Arrange, by any route, the hint has done its job.
  useEffect(() => {
    if (editing && !preferences.layoutTipSeen) updatePreference("layoutTipSeen", true);
  }, [editing, preferences.layoutTipSeen, updatePreference]);

  // Escape leaves edit mode, unless the Customise panel is handling it.
  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !customiseOpen) setEditing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, customiseOpen]);

  const visibleSpecs = visibleOrder.map((key) => specMap.get(key)!).filter(Boolean);
  const hiddenSpecs = fullOrder.filter((key) => !visible[key]).map((key) => specMap.get(key)!).filter(Boolean);
  const showTip = !preferences.layoutTipSeen && !editing && (loadedStorageKey !== null || !storageKey);

  const panelRows = fullOrder.map((key) => {
    const item = specMap.get(key)!;
    return { spec: item, visible: visible[key], size: sizeOf(item), collapsed: collapsedOf(item) };
  });

  /* ---------- Render ---------- */

  return (
    <div
      className="sgo"
      data-theme={glassTheme}
      data-hero={heroTone}
      data-compact={preferences.compact}
      data-editing={editing}
      style={rootStyle}
      onPointerDown={(event) => {
        // Tapping empty space ends editing, the same as on iOS.
        if (!editing) return;
        const target = event.target as HTMLElement;
        if (!target.closest(".sgo-slot, .sgo-editbar, .sgp, .sgp-backdrop, .sgo-top")) setEditing(false);
      }}
    >
      <style>{OVERVIEW_CSS}</style>

      <div className="sgo-wall" style={wallpaperStyle} aria-hidden="true" />
      {preferences.motion ? <div className="sgo-glow" aria-hidden="true" /> : null}
      <div className="sgo-shade" style={{ ["--shade" as string]: preferences.overlay / 100 } as CSSProperties} aria-hidden="true" />
      {preferences.grain ? <div className="sgo-grain" style={{ backgroundImage: GRAIN_IMAGE }} aria-hidden="true" /> : null}

      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleWallpaperUpload}
        aria-label="Upload dashboard wallpaper"
      />

      <div className="sgo-content">
        {/* Top bar */}
        <div className="sgo-top">
          <div className="sgo-brand">
            <span className="sgo-brand-mark">
              <Image src="/images/syntra-logo.png" alt="Syntra Grid" width={32} height={32} priority />
            </span>
            <span className="sgo-brand-text">Syntra Grid</span>
          </div>

          <div className="sgo-top-actions">
            <button
              type="button"
              className="sgo-top-btn is-icon"
              onClick={() => navigate("calendar")}
              disabled={navDisabled}
              aria-label="Open Calendar"
              title="Calendar"
            >
              <CalendarDays size={16} />
            </button>

            <button
              type="button"
              className="sgo-top-btn is-icon"
              onClick={() => navigate("notifications")}
              disabled={navDisabled}
              aria-label={`Open Notifications, ${unreadCount} unread`}
              title="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 ? <span className="sgo-top-badge">{unreadCount}</span> : null}
            </button>

            <button
              type="button"
              className="sgo-top-btn"
              onClick={() => setEditing((value) => !value)}
              aria-pressed={editing}
              title="Move, resize and minimise widgets"
            >
              {editing ? <Check size={16} /> : <Move size={16} />}
              <span className="sgo-top-label">{editing ? "Done" : "Arrange"}</span>
            </button>

            <button type="button" className="sgo-top-btn" onClick={() => openPanel("wallpaper")}>
              <Palette size={16} />
              <span className="sgo-top-label">Customise</span>
            </button>
          </div>
        </div>

        {/* Hero */}
        {preferences.showGreeting ? (
          <section className="sgo-hero">
            <p className="sgo-hero-date">
              {now ? formatLongDate(now) : "Your workspace"}
              {now ? (
                <>
                  <span aria-hidden="true">·</span>
                  <time className="sgo-clock" dateTime={now.toISOString()}>
                    {pad(now.getHours())}
                    <span className="sgo-colon">:</span>
                    {pad(now.getMinutes())}
                  </time>
                </>
              ) : null}
            </p>

            <h1 className="sgo-hero-title">
              {now ? getGreeting(now) : "Welcome"}, <span className="sgo-hero-name">{firstName}.</span>
            </h1>

            <p className="sgo-hero-sub">{greetingDescription}</p>

            <div className="sgo-hero-meta">
              <span className="sgo-hero-chip">
                <Sparkles size={12} />
                {roleLabel}
              </span>

              {heroSpotlight ? (
                <button type="button" className="sgo-hero-chip" onClick={() => navigate("calendar")} disabled={navDisabled}>
                  <span className="sgo-live" />
                  {heroSpotlight.state === "now"
                    ? `${heroSpotlight.event.title} is on now`
                    : `Next: ${heroSpotlight.event.title} in ${formatIn(heroSpotlight.minutes)}`}
                  <ArrowRight size={12} />
                </button>
              ) : now && feed.status !== "loading" ? (
                <span className="sgo-hero-chip">
                  <CalendarDays size={12} />
                  {todaySchedule.length ? "Clear for the rest of today" : "Nothing on the calendar today"}
                </span>
              ) : null}
            </div>
          </section>
        ) : (
          <div style={{ height: 22 }} />
        )}

        {showTip ? (
          <div className="sgo-tip" role="note">
            <Move size={13} />
            <span>Press and hold any widget to move, resize or minimise it.</span>
            <button
              type="button"
              className="sgo-tip-try"
              onClick={() => {
                setEditing(true);
                updatePreference("layoutTipSeen", true);
              }}
            >
              Try it
            </button>
            <button
              type="button"
              className="sgo-tip-close"
              aria-label="Dismiss tip"
              onClick={() => updatePreference("layoutTipSeen", true)}
            >
              <X size={13} />
            </button>
          </div>
        ) : null}

        {onOpenMessages ? <MessagesEntryCard admin={admin} onOpen={onOpenMessages} /> : null}

        {/* Widgets */}
        <div ref={editorGridRef} className="sgo-grid">
          {visibleSpecs.length === 0 ? (
            <section className="sgo-card sgo-empty">
              <span className="sgo-card-icon">
                <LayoutGrid size={15} />
              </span>
              <p className="sgo-title-sm" style={{ margin: 0 }}>
                All widgets are hidden
              </p>
              <p className="sgo-sub" style={{ margin: 0 }}>
                Add some back to fill your dashboard.
              </p>
              <button type="button" className="sgo-btn sgo-btn-primary" onClick={() => openPanel("widgets")}>
                <Plus size={13} />
                Add widgets
              </button>
            </section>
          ) : (
            visibleSpecs.map((item, position) => {
              const size = sizeOf(item);
              return (
                <WidgetSlot
                  key={item.key}
                  spec={item}
                  size={size}
                  collapsed={collapsedOf(item)}
                  editing={editing}
                  dragging={editor.draggingKey === item.key}
                  index={position}
                  slotRef={editor.registerSlot(item.key)}
                  handlers={editor.handlersFor(item.key)}
                  onRemove={() => setWidgetVisible(item.key, false)}
                  onSize={(next) => changeSize(item.key, next)}
                  onToggleCollapsed={() => toggleCollapsed(item.key)}
                  onResizeStart={(event) => startResize(event, item, size)}
                  onKeyMove={(delta) => moveBy(item.key, delta, visibleOrder)}
                >
                  {item.render()}
                </WidgetSlot>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: "auto", paddingTop: 26 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              color: "var(--h2)",
              fontSize: 10.5,
              textShadow: "var(--hshadow)",
            }}
          >
            <p style={{ display: "flex", alignItems: "center", gap: 7, margin: 0 }}>
              <ShieldCheck size={13} />
              {isEmployeeMode ? "Syntra Grid" : "Syntra Grid Command Workspace"}
            </p>
            <p style={{ margin: 0 }}>
              {isEmployeeMode
                ? "Every widget here reflects your real calendar, leave and department data."
                : feed.status === "live"
                  ? "Calendar and leave are live. Other widgets show demonstration data."
                  : "Dashboard information is currently demonstration data."}
            </p>
          </div>
        </div>
      </div>

      {editing ? (
        <EditBar
          hidden={hiddenSpecs}
          onAdd={(key) => setWidgetVisible(key, true)}
          onReset={resetLayout}
          onStyle={() => openPanel("wallpaper")}
          onDone={() => setEditing(false)}
        />
      ) : null}

      {customiseOpen ? (
        <CustomisePanel
          preferences={preferences}
          hour={hour}
          tab={panelTab}
          onTabChange={setPanelTab}
          preview={{
            style: wallpaperStyle,
            overlay: preferences.overlay,
            glass: glassTheme,
            tiles: visibleSpecs.map((item) => ({
              key: item.key,
              span: SIZE_SPANS[sizeOf(item)],
              collapsed: collapsedOf(item),
            })),
          }}
          savingWallpaper={savingWallpaper}
          wallpaperError={wallpaperError}
          onPickUpload={() => uploadRef.current?.click()}
          onClose={() => setCustomiseOpen(false)}
          onUpdate={updatePreference}
          onReset={resetPreferences}
          rows={panelRows}
          onToggleWidget={setWidgetVisible}
          onSize={changeSize}
          onToggleCollapsed={toggleCollapsed}
          onMoveWidget={(key, delta) => moveBy(key, delta, fullOrder)}
          onResetLayout={resetLayout}
          onEditLayout={() => {
            setCustomiseOpen(false);
            setEditing(true);
            updatePreference("layoutTipSeen", true);
          }}
        />
      ) : null}
    </div>
  );
}

/* =============================================================================
   WIDGET SLOT

   The grid item for one widget. Owns the long press, drag and the edit
   controls (remove, shape, minimise and the resize handle).
============================================================================= */

function WidgetSlot({
  spec,
  size,
  collapsed,
  editing,
  dragging,
  index,
  slotRef,
  handlers,
  onRemove,
  onSize,
  onToggleCollapsed,
  onResizeStart,
  onKeyMove,
  children,
}: {
  spec: WidgetSpec;
  size: SizeKey;
  collapsed: boolean;
  editing: boolean;
  dragging: boolean;
  index: number;
  slotRef: (element: HTMLDivElement | null) => void;
  handlers: SlotHandlers;
  onRemove: () => void;
  onSize: (size: SizeKey) => void;
  onToggleCollapsed: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onKeyMove: (delta: number) => void;
  children: ReactNode;
}) {
  const span = SIZE_SPANS[size];

  const context = useMemo<SlotState>(
    () => ({ title: spec.label, collapsed, collapsible: spec.collapsible, editing, toggleCollapsed: onToggleCollapsed }),
    [spec.label, spec.collapsible, collapsed, editing, onToggleCollapsed],
  );

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!editing || event.target !== event.currentTarget) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onKeyMove(-1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onKeyMove(1);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove();
    }
  };

  return (
    <div
      ref={slotRef}
      className={`sgo-slot sgo-span-${span}`}
      data-dragging={dragging}
      data-collapsed={collapsed}
      data-group={spec.group}
      tabIndex={editing ? 0 : -1}
      role={editing ? "group" : undefined}
      aria-label={editing ? `${spec.label}. Arrow keys move it, Delete removes it.` : undefined}
      onKeyDown={onKeyDown}
      style={{ ["--i" as string]: index, ["--wig" as string]: `${(2.6 / span).toFixed(2)}deg` } as CSSProperties}
      {...handlers}
    >
      <div className="sgo-jiggle">
        <SlotContext.Provider value={context}>
          <div className="sgo-slot-body" aria-hidden={editing || undefined}>
            {children}
          </div>
        </SlotContext.Provider>

        {editing ? (
          <>
            <button
              type="button"
              data-slot-control
              className="sgo-ctl-remove"
              onClick={onRemove}
              aria-label={`Remove ${spec.label}`}
              title="Remove widget"
            >
              <Minus size={13} strokeWidth={3} />
            </button>

            {spec.sizes.length > 1 || spec.collapsible ? (
              <div data-slot-control className="sgo-ctl-bar">
                {spec.sizes.length > 1
                  ? spec.sizes.map((option) => (
                      <button
                        key={option}
                        type="button"
                        data-active={option === size}
                        onClick={() => onSize(option)}
                        aria-label={`${SIZE_LABELS[option]} size`}
                        aria-pressed={option === size}
                        title={SIZE_LABELS[option]}
                      >
                        <span className="sgo-shape" style={{ width: 6 + SIZE_SPANS[option] * 1.4 }} />
                      </button>
                    ))
                  : null}

                {spec.sizes.length > 1 && spec.collapsible ? <span className="sgo-ctl-sep" /> : null}

                {spec.collapsible ? (
                  <button
                    type="button"
                    onClick={onToggleCollapsed}
                    aria-label={collapsed ? `Expand ${spec.label}` : `Minimise ${spec.label}`}
                    title={collapsed ? "Expand" : "Minimise"}
                  >
                    {collapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                  </button>
                ) : null}
              </div>
            ) : null}

            {spec.sizes.length > 1 ? (
              <span
                data-slot-control
                className="sgo-ctl-resize"
                onPointerDown={onResizeStart}
                title="Drag to resize"
                aria-hidden="true"
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* =============================================================================
   EDIT BAR
============================================================================= */

function EditBar({
  hidden,
  onAdd,
  onReset,
  onStyle,
  onDone,
}: {
  hidden: WidgetSpec[];
  onAdd: (key: WidgetKey) => void;
  onReset: () => void;
  onStyle: () => void;
  onDone: () => void;
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  const open = trayOpen && hidden.length > 0;

  return (
    <div className="sgo-editbar" role="toolbar" aria-label="Arrange widgets">
      {open ? (
        <div className="sgo-tray" role="menu">
          <p className="sgo-tray-title">Add a widget</p>
          {hidden.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className="sgo-tray-item"
                onClick={() => {
                  onAdd(item.key);
                  if (hidden.length <= 1) setTrayOpen(false);
                }}
              >
                <span className="sgo-tray-icon">
                  <Icon size={15} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 650 }}>{item.label}</span>
                  <span style={{ display: "block", marginTop: 2, fontSize: 10.5, color: "rgba(255,255,255,0.55)" }}>
                    {item.description}
                  </span>
                </span>
                <span className="sgo-tray-plus">
                  <Plus size={14} strokeWidth={3} />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <span className="sgo-editbar-hint sgo-hide-sm">
        <Move size={13} />
        Drag to rearrange
      </span>

      <button
        type="button"
        className="sgo-editbar-btn"
        onClick={() => setTrayOpen((value) => !value)}
        disabled={!hidden.length}
        aria-expanded={open}
      >
        <Plus size={14} />
        <span className="sgo-hide-sm">Add widget</span>
        {hidden.length ? <span className="sgo-editbar-count">{hidden.length}</span> : null}
      </button>

      <button type="button" className="sgo-editbar-btn" onClick={onStyle}>
        <Paintbrush size={14} />
        <span className="sgo-hide-sm">Style</span>
      </button>

      <button type="button" className="sgo-editbar-btn" onClick={onReset} title="Restore the default layout">
        <RotateCcw size={14} />
        <span className="sgo-hide-sm">Reset</span>
      </button>

      <button type="button" className="sgo-editbar-done" onClick={onDone}>
        <Check size={14} />
        Done
      </button>
    </div>
  );
}

/* =============================================================================
   WIDGET SHELL
============================================================================= */

function Widget({
  title,
  icon,
  badge,
  action,
  onAction,
  actionDisabled,
  extra,
  index,
  className = "",
  children,
}: {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  action?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  extra?: ReactNode;
  index: number;
  className?: string;
  children: ReactNode;
}) {
  const slot = useContext(SlotContext);

  return (
    <section
      className={`sgo-card ${className}`}
      data-collapsed={slot.collapsed}
      style={{ ["--i" as string]: index } as CSSProperties}
    >
      <header className="sgo-card-head">
        <h2 className="sgo-card-title" style={{ margin: 0 }}>
          {icon ? <span className="sgo-card-icon">{icon}</span> : null}
          <span className="sgo-truncate">{title}</span>
          {badge}
        </h2>
        <div className="sgo-card-actions">
          {slot.collapsed ? null : extra}
          {action ? (
            <button type="button" className="sgo-link" onClick={onAction} disabled={actionDisabled}>
              {action}
              <ChevronRight size={13} />
            </button>
          ) : null}
          {slot.collapsible && !slot.editing ? (
            <button
              type="button"
              className="sgo-collapse"
              onClick={slot.toggleCollapsed}
              aria-expanded={!slot.collapsed}
              aria-label={slot.collapsed ? `Expand ${title}` : `Minimise ${title}`}
              title={slot.collapsed ? "Expand" : "Minimise"}
            >
              <ChevronDown size={15} />
            </button>
          ) : null}
        </div>
      </header>
      {slot.collapsed ? null : children}
    </section>
  );
}

function Avatar({ name, src, size = 34 }: { name: string; src?: string | null; size?: number }) {
  return (
    <span className="sgo-avatar" style={{ width: size, height: size, background: avatarColor(name) }} title={name}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

function FeedBadge({ status }: { status: FeedStatus }) {
  if (status === "loading") {
    return (
      <span className="sgo-badge">
        <Loader2 size={11} className="sgo-spin" />
        Syncing
      </span>
    );
  }

  if (status === "live") {
    return (
      <span className="sgo-badge">
        <span className="sgo-live" />
        Live
      </span>
    );
  }

  return <span className="sgo-badge">Sample</span>;
}

/* =============================================================================
   COMMAND BAR
============================================================================= */

function CommandBar({
  commands,
  lockedShortcut,
  shortcuts,
  pinnable,
  quickAction,
  addLabel,
  onTogglePin,
  disabled,
  onRun,
  index,
}: {
  commands: CommandItem[];
  lockedShortcut: CommandItem | null;
  shortcuts: CommandItem[];
  pinnable: CommandItem[];
  quickAction: CommandItem | null;
  addLabel: string;
  onTogglePin: (id: Destination) => void;
  disabled: boolean;
  onRun: (destination: Destination) => void;
  index: number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const pinnedIds = new Set(shortcuts.map((command) => command.id));

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.hint} ${command.keywords}`.toLowerCase().includes(term),
    );
  }, [commands, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (event.key === "Escape") setPickerOpen(false);

      if (!typing && event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    const onPointer = (event: PointerEvent) => {
      if (!fieldRef.current?.contains(event.target as Node)) setOpen(false);
      if (!chipsRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  const run = (command?: CommandItem) => {
    if (!command || disabled) return;
    onRun(command.id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (matches.length ? (current + 1) % matches.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (matches.length ? (current - 1 + matches.length) % matches.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(matches[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  };

  return (
    <section className="sgo-card sgo-command" style={{ ["--i" as string]: index } as CSSProperties}>
      <div ref={fieldRef} className="sgo-command-field">
        <Search size={16} className="sgo-muted" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search or jump to anything in Syntra Grid…"
          aria-label="Search and jump to a workspace area"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {!query ? <span className="sgo-kbd sgo-hide-sm">/</span> : null}
        <button
          type="button"
          className="sgo-command-go"
          aria-label="Go"
          disabled={disabled || !matches.length || !query}
          onClick={() => run(matches[active])}
        >
          <ArrowUp size={15} />
        </button>

        {open && matches.length ? (
          <div className="sgo-command-menu" role="listbox">
            {matches.map((command, position) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  type="button"
                  role="option"
                  aria-selected={position === active}
                  data-active={position === active}
                  className="sgo-command-option"
                  onPointerMove={() => setActive(position)}
                  onClick={() => run(command)}
                  disabled={disabled}
                >
                  <span className="sgo-card-icon">
                    <Icon size={15} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="sgo-title-sm" style={{ display: "block" }}>
                      {command.label}
                    </span>
                    <span className="sgo-sub sgo-truncate" style={{ display: "block" }}>
                      {command.hint}
                    </span>
                  </span>
                  {position === active ? <span className="sgo-kbd">Enter</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div ref={chipsRef} className="sgo-command-chips">
        <button
          type="button"
          className="sgo-command-chip sgo-chip-add"
          onClick={() => setPickerOpen((value) => !value)}
          aria-expanded={pickerOpen}
          aria-haspopup="dialog"
        >
          <Plus size={13} />
          {addLabel}
        </button>

        {lockedShortcut ? (
          <button type="button" className="sgo-command-chip" onClick={() => run(lockedShortcut)} disabled={disabled}>
            <lockedShortcut.icon size={13} />
            {lockedShortcut.label}
          </button>
        ) : null}

        {shortcuts.map((command) => {
          const Icon = command.icon;
          return (
            <span key={command.id} className="sgo-chip-wrap">
              <button type="button" className="sgo-command-chip" onClick={() => run(command)} disabled={disabled}>
                <Icon size={13} />
                {command.label}
              </button>
              <button
                type="button"
                className="sgo-chip-x"
                onClick={() => onTogglePin(command.id)}
                aria-label={`Remove ${command.label} shortcut`}
                title="Remove shortcut"
              >
                <X size={10} strokeWidth={3} />
              </button>
            </span>
          );
        })}

        {pickerOpen ? (
          <div className="sgo-picker" role="dialog" aria-label="Choose shortcuts">
            {quickAction ? (
              <>
                <button
                  type="button"
                  className="sgo-picker-row"
                  onClick={() => {
                    setPickerOpen(false);
                    run(quickAction);
                  }}
                  disabled={disabled}
                >
                  <span className="sgo-card-icon">
                    <Plus size={15} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="sgo-title-sm" style={{ display: "block" }}>
                      Create something new
                    </span>
                    <span className="sgo-sub" style={{ display: "block" }}>
                      {quickAction.hint}
                    </span>
                  </span>
                  <ArrowRight size={14} className="sgo-muted" />
                </button>
                <div className="sgo-picker-sep" />
              </>
            ) : null}

            <div className="sgo-picker-head">
              <p className="sgo-title-sm" style={{ margin: 0 }}>
                Shortcuts
              </p>
              <p className="sgo-sub" style={{ margin: "2px 0 0" }}>
                Pick the tabs you want one tap away.
              </p>
            </div>

            {lockedShortcut ? (
              <button type="button" className="sgo-picker-row" disabled aria-disabled="true">
                <span className="sgo-card-icon">
                  <lockedShortcut.icon size={15} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="sgo-title-sm" style={{ display: "block" }}>
                    {lockedShortcut.label}
                  </span>
                  <span className="sgo-sub" style={{ display: "block" }}>
                    Always shown
                  </span>
                </span>
                <span className="sgo-picker-check" data-on="true">
                  <Lock size={11} />
                </span>
              </button>
            ) : null}

            {pinnable.map((command) => {
              const Icon = command.icon;
              const pinned = pinnedIds.has(command.id);
              return (
                <button
                  key={command.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={pinned}
                  className="sgo-picker-row"
                  onClick={() => onTogglePin(command.id)}
                >
                  <span className="sgo-card-icon">
                    <Icon size={15} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="sgo-title-sm" style={{ display: "block" }}>
                      {command.label}
                    </span>
                    <span className="sgo-sub sgo-truncate" style={{ display: "block" }}>
                      {command.hint}
                    </span>
                  </span>
                  <span className="sgo-picker-check" data-on={pinned}>
                    {pinned ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                </button>
              );
            })}

            <button type="button" className="sgo-btn" onClick={() => setPickerOpen(false)} style={{ width: "100%", marginTop: 8 }}>
              Done
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* =============================================================================
   TODAY (CALENDAR)
============================================================================= */

function TodayCard({
  index,
  events,
  status,
  now,
  todayKey,
  activeKey,
  onSelectDay,
  onOpenCalendar,
  navDisabled,
}: {
  index: number;
  events: CalendarItem[];
  status: FeedStatus;
  now: Date | null;
  todayKey: string | null;
  activeKey: string | null;
  onSelectDay: (key: string) => void;
  onOpenCalendar: () => void;
  navDisabled: boolean;
}) {
  const today = useMemo(() => (todayKey ? dateFromKey(todayKey) : null), [todayKey]);
  const selected = useMemo(() => (activeKey ? dateFromKey(activeKey) : today), [activeKey, today]);
  const isToday = activeKey === todayKey;

  const week = useMemo(() => {
    if (!today) return [];
    const start = startOfWeekMonday(today);
    return Array.from({ length: 7 }, (_, offset) => {
      const date = addDays(start, offset);
      return { date, key: toDateKey(date), items: scheduleOnDay(events, date) };
    });
  }, [today, events]);

  const dayEvents = useMemo(() => (selected ? scheduleOnDay(events, selected) : []), [selected, events]);
  const allDay = dayEvents.filter((event) => event.allDay);
  const timeline = useMemo(() => (selected ? layoutTimeline(dayEvents, selected) : null), [dayEvents, selected]);

  const spotlight: Spotlight | null = useMemo(() => {
    if (!now) return null;
    if (isToday) return findSpotlight(dayEvents, now);
    const first = dayEvents.find((event) => !event.allDay) ?? dayEvents[0];
    return first ? { event: first, state: "later", minutes: 0, progress: 0 } : null;
  }, [dayEvents, isToday, now]);

  const rest = dayEvents
    .filter((event) => event.id !== spotlight?.event.id && !event.allDay)
    .filter((event) => !isToday || !now || eventEnd(event) > now);

  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const windowStart = timeline?.windowStart ?? DAY_START;
  const windowEnd = timeline?.windowEnd ?? DAY_END;
  const toPct = (minutes: number) => ((minutes - windowStart) / (windowEnd - windowStart)) * 100;
  const hours: number[] = [];
  for (let minute = Math.ceil(windowStart / 60) * 60; minute <= windowEnd; minute += 60) hours.push(minute);

  const heading = !selected
    ? "Today"
    : isToday
      ? "Today"
      : new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short" }).format(selected);

  return (
    <Widget
      index={index}
      title={heading}
      icon={<CalendarDays size={15} />}
      badge={<FeedBadge status={status} />}
      action="Open calendar"
      onAction={onOpenCalendar}
      actionDisabled={navDisabled}
      extra={
        !isToday && todayKey ? (
          <button type="button" className="sgo-link" onClick={() => onSelectDay(todayKey)}>
            <RotateCcw size={12} />
            Today
          </button>
        ) : null
      }
    >
      {/* Week strip */}
      <div className="sgo-week" role="tablist" aria-label="Choose a day this week">
        {week.map(({ date, key, items }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === activeKey}
            aria-label={`${formatLongDate(date)}, ${items.length} ${items.length === 1 ? "event" : "events"}`}
            className="sgo-day"
            data-selected={key === activeKey}
            data-today={key === todayKey}
            onClick={() => onSelectDay(key)}
          >
            <span className="sgo-day-name">{new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(date)}</span>
            <span className="sgo-day-num">{date.getDate()}</span>
            <span className="sgo-day-dots">
              {items.slice(0, 3).map((event) => (
                <span key={event.id} style={{ background: toneOf(event).color }} />
              ))}
            </span>
          </button>
        ))}
      </div>

      {/* Spotlight */}
      {spotlight ? (
        <div className="sgo-spot" style={{ ["--c" as string]: toneOf(spotlight.event).color } as CSSProperties}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="sgo-eyebrow" style={{ margin: 0, display: "flex", alignItems: "center", gap: 7 }}>
              {spotlight.state === "now" ? <span className="sgo-live" /> : null}
              {spotlight.state === "now"
                ? `Happening now · ends in ${formatIn(spotlight.minutes)}`
                : spotlight.state === "soon"
                  ? `Next up · in ${formatIn(spotlight.minutes)}`
                  : "First up"}
            </p>
            <p className="sgo-spot-title sgo-truncate" style={{ marginBottom: 0 }}>
              {spotlight.event.title || "Untitled event"}
            </p>
            <p className="sgo-spot-meta" style={{ marginBottom: 0 }}>
              <Clock3 size={11} />
              <span className="sgo-truncate">
                {eventTimeLabel(spotlight.event)} · {eventContext(spotlight.event)}
              </span>
            </p>
            {spotlight.state === "now" ? (
              <div className="sgo-bar" style={{ marginTop: 10 }}>
                <div className="sgo-bar-fill" style={{ width: `${clamp(spotlight.progress, 2, 100)}%` }} />
              </div>
            ) : null}
          </div>

          {spotlight.event.meetingUrl && spotlight.event.source !== "DEPLOYMENT" ? (
            <a className="sgo-btn sgo-btn-primary" href={spotlight.event.meetingUrl} target="_blank" rel="noopener noreferrer">
              <Video size={13} />
              Join
            </a>
          ) : (
            <button type="button" className="sgo-btn sgo-hide-sm" onClick={onOpenCalendar} disabled={navDisabled}>
              Details
            </button>
          )}
        </div>
      ) : (
        <div className="sgo-spot" style={{ ["--c" as string]: "var(--track)" } as CSSProperties}>
          <div style={{ flex: 1 }}>
            <p className="sgo-spot-title" style={{ margin: 0 }}>
              {status === "loading"
                ? "Loading your schedule"
                : dayEvents.length && isToday
                  ? "You're done for the day"
                  : "Nothing scheduled"}
            </p>
            <p className="sgo-spot-meta" style={{ marginBottom: 0 }}>
              {isToday ? "Enjoy the space, or plan something new." : "This day is free."}
            </p>
          </div>
          <button type="button" className="sgo-btn" onClick={onOpenCalendar} disabled={navDisabled}>
            <Plus size={13} />
            Plan
          </button>
        </div>
      )}

      {/* Timeline */}
      {timeline ? (
        <div className="sgo-tl">
          {allDay.length ? (
            <div className="sgo-tl-allday">
              {allDay.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  style={{ ["--c" as string]: toneOf(event).color } as CSSProperties}
                  onClick={onOpenCalendar}
                  disabled={navDisabled}
                >
                  {event.title}
                </button>
              ))}
            </div>
          ) : null}

          <div className="sgo-tl-track" style={{ height: timeline.laneCount * LANE_HEIGHT + 14 }}>
            {isToday && nowMinutes > windowStart ? (
              <span className="sgo-tl-past" style={{ width: `${clamp(toPct(nowMinutes), 0, 100)}%` }} />
            ) : null}

            {hours.map((minute) => (
              <span key={minute} className="sgo-tl-hour" style={{ left: `${toPct(minute)}%` }} />
            ))}

            {timeline.items.map((item, position) => {
              const left = toPct(item.start);
              const width = Math.max(toPct(item.end) - left, 1.6);
              const past = isToday && item.end <= nowMinutes;
              const current = isToday && item.start <= nowMinutes && nowMinutes < item.end;

              return (
                <button
                  key={item.event.id}
                  type="button"
                  className="sgo-tl-block"
                  data-past={past}
                  data-current={current}
                  title={`${eventTimeLabel(item.event)}, ${item.event.title}`}
                  aria-label={`${item.event.title}, ${eventTimeLabel(item.event)}`}
                  onClick={onOpenCalendar}
                  disabled={navDisabled}
                  style={
                    {
                      ["--c" as string]: toneOf(item.event).color,
                      left: `${left}%`,
                      width: `calc(${width}% - 2px)`,
                      top: 7 + item.lane * LANE_HEIGHT,
                      animationDelay: `${300 + position * 60}ms`,
                    } as CSSProperties
                  }
                >
                  {width > 7 ? item.event.title : ""}
                </button>
              );
            })}

            {isToday && nowMinutes >= windowStart && nowMinutes <= windowEnd ? (
              <span
                className="sgo-tl-now"
                style={{ left: `${toPct(nowMinutes)}%` }}
                aria-label={`Now, ${pad(Math.floor(nowMinutes / 60))}:${pad(nowMinutes % 60)}`}
              />
            ) : null}
          </div>

          <div className="sgo-tl-ticks" aria-hidden="true">
            {hours
              .filter((minute) => (minute / 60) % 2 === 0)
              .map((minute) => (
                <span key={minute} style={{ left: `${toPct(minute)}%` }}>
                  {pad(minute / 60)}:00
                </span>
              ))}
          </div>
        </div>
      ) : null}

      {/* Later list */}
      {rest.length ? (
        <div style={{ marginTop: 10 }}>
          <p className="sgo-eyebrow" style={{ margin: "0 0 4px" }}>
            {isToday ? "Later today" : "Also scheduled"}
          </p>
          {rest.slice(0, 3).map((event) => (
            <button key={event.id} type="button" className="sgo-row-btn" onClick={onOpenCalendar} disabled={navDisabled}>
              <span style={{ width: 44, fontSize: 11, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>
                {formatClock(new Date(event.startAt))}
              </span>
              <span className="sgo-dot" style={{ background: toneOf(event).color }} />
              <span className="sgo-title-sm sgo-truncate" style={{ flex: 1 }}>
                {event.title}
              </span>
              <span className="sgo-sub sgo-truncate sgo-hide-sm" style={{ marginTop: 0, maxWidth: 140 }}>
                {eventContext(event)}
              </span>
            </button>
          ))}
          {rest.length > 3 ? (
            <button type="button" className="sgo-link" onClick={onOpenCalendar} disabled={navDisabled} style={{ marginTop: 4 }}>
              {rest.length - 3} more
              <ChevronRight size={12} />
            </button>
          ) : null}
        </div>
      ) : null}
    </Widget>
  );
}

/* =============================================================================
   WHO'S AWAY
============================================================================= */

function AwayCard({
  index,
  events,
  status,
  todayKey,
  onOpen,
  navDisabled,
}: {
  index: number;
  events: CalendarItem[];
  status: FeedStatus;
  todayKey: string | null;
  onOpen: () => void;
  navDisabled: boolean;
}) {
  const PAGE_SIZE = 3;
  const [page, setPage] = useState(0);

  const { away, upcoming } = useMemo(() => {
    if (!todayKey) return { away: [] as CalendarItem[], upcoming: [] as CalendarItem[] };
    const today = dateFromKey(todayKey);
    const leave = events.filter((event) => event.source === "LEAVE" && event.status !== "CANCELLED");
    const awayToday = eventsOnDay(leave, today);
    const ids = new Set(awayToday.map((event) => event.id));
    const soon = leave
      .filter((event) => !ids.has(event.id))
      .filter((event) => {
        const start = startOfDay(new Date(event.startAt));
        return start > today && start <= addDays(today, 7);
      })
      .sort(byStart);
    return { away: awayToday, upcoming: soon };
  }, [events, todayKey]);

  const pages = Math.max(1, Math.ceil(away.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = away.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const leaveLabel = (event: CalendarItem) => {
    const value = event.metadata?.leaveType;
    return typeof value === "string" && value ? value : event.title || "Leave";
  };

  const backLabel = (event: CalendarItem) => {
    const end = eventEnd(event);
    const back = event.allDay ? addDays(startOfDay(end), 1) : end;
    return todayKey && toDateKey(back) === toDateKey(addDays(dateFromKey(todayKey), 1))
      ? "Back tomorrow"
      : `Back ${formatShortDate(back)}`;
  };

  return (
    <Widget
      index={index}
      title="Who's away"
      icon={<Plane size={15} />}
      badge={status === "sample" ? <span className="sgo-badge">Sample</span> : null}
      extra={
        pages > 1 ? (
          <div className="sgo-pager" aria-label="Pages">
            {Array.from({ length: pages }, (_, value) => (
              <button
                key={value}
                type="button"
                data-active={value === current}
                aria-label={`Page ${value + 1}`}
                aria-current={value === current}
                onClick={() => setPage(value)}
              >
                {value + 1}
              </button>
            ))}
          </div>
        ) : null
      }
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="sgo-big">{status === "loading" ? "·" : away.length}</span>
        <span className="sgo-soft" style={{ fontSize: 11 }}>
          {away.length === 1 ? "person out today" : "people out today"}
        </span>
      </div>

      <div style={{ marginTop: 12, flex: 1 }}>
        {shown.length ? (
          shown.map((event) => (
            <div key={event.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0" }}>
              <Avatar name={event.owner?.name ?? "Team member"} src={event.owner?.avatarUrl} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="sgo-title-sm sgo-truncate" style={{ margin: 0 }}>
                  {event.owner?.name ?? "Team member"}
                </p>
                <p className="sgo-sub sgo-truncate" style={{ marginBottom: 0 }}>
                  {[event.owner?.department?.name ?? event.department?.name, backLabel(event)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="sgo-leave-tag">{leaveLabel(event)}</span>
            </div>
          ))
        ) : status === "loading" ? (
          <p className="sgo-sub">Checking leave…</p>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
            <span className="sgo-card-icon" style={{ color: "#8FE0A8" }}>
              <Check size={15} />
            </span>
            <div>
              <p className="sgo-title-sm" style={{ margin: 0 }}>
                Everyone is in today
              </p>
              <p className="sgo-sub" style={{ marginBottom: 0 }}>
                No approved leave for today.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="sgo-divider" />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p className="sgo-sub" style={{ margin: 0 }}>
          {upcoming.length
            ? `${upcoming.length} more ${upcoming.length === 1 ? "absence" : "absences"} booked this week`
            : "No other leave booked this week"}
        </p>
        <button type="button" className="sgo-link" onClick={onOpen} disabled={navDisabled}>
          Team
          <ChevronRight size={13} />
        </button>
      </div>
    </Widget>
  );
}

/* =============================================================================
   STAT TILE
============================================================================= */

function StatTile({
  index,
  label,
  value,
  prefix,
  suffix,
  decimals,
  note,
  icon: Icon,
  spark,
}: StatDefinition & { index: number }) {
  const animated = useCountUp(value);

  return (
    <section className="sgo-card sgo-stat" style={{ ["--i" as string]: index } as CSSProperties}>
      <div className="sgo-stat-top">
        <span className="sgo-card-icon">
          <Icon size={15} />
        </span>
        <span className="sgo-eyebrow">{label}</span>
      </div>

      <p className="sgo-big" style={{ margin: "18px 0 0" }}>
        {prefix}
        {animated.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        {suffix}
      </p>
      <p className="sgo-sub" style={{ marginBottom: 0 }}>
        {note}
      </p>

      <div className="sgo-stat-spark">
        <Sparkline values={spark} />
      </div>
    </section>
  );
}

function Sparkline({ values, height = 34 }: { values: number[]; height?: number }) {
  const id = useSafeId("spark");
  const width = 100;
  const { d } = smoothPath(values, width, height, 3);

  return (
    <svg className="sgo-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--acc)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--acc)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${id})`} className="sgo-chart-area" />
      <path
        d={d}
        fill="none"
        stroke="var(--acc)"
        strokeWidth={1.6}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1000}
        className="sgo-chart-line"
      />
    </svg>
  );
}

/* =============================================================================
   ANALYTICS
============================================================================= */

function AnalyticsCard({
  index,
  series,
  loading,
  onOpen,
  navDisabled,
}: {
  index: number;
  series: AnalyticsPoint[];
  loading: boolean;
  onOpen: () => void;
  navDisabled: boolean;
}) {
  const [period, setPeriod] = useState<6 | 12>(12);
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useSafeId("area");

  const seriesSlice = series.slice(-period);
  const values = seriesSlice.length > 0 ? seriesSlice.map((point) => point.total) : [0];
  const latest = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? latest;
  const delta = latest - previous;
  const animated = useCountUp(latest);
  const hasData = seriesSlice.some((point) => point.total > 0);

  const months = seriesSlice.map((point) => {
    const [year, month] = point.month.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { month: "short" }).format(new Date(year, (month ?? 1) - 1, 1));
  });

  const width = 320;
  const height = 120;
  const { d, points: chartPoints } = smoothPath(values, width, height, 10);

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    setHover(Math.round(ratio * (values.length - 1)));
  };

  const hovered = hover !== null ? chartPoints[hover] : null;

  return (
    <Widget
      index={index}
      title="Analytics"
      icon={<BarChart3 size={15} />}
      extra={
        <div className="sgo-seg" role="radiogroup" aria-label="Period">
          {[6, 12].map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={period === option}
              data-active={period === option}
              onClick={() => setPeriod(option as 6 | 12)}
            >
              {option}M
            </button>
          ))}
        </div>
      }
    >
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p className="sgo-eyebrow" style={{ margin: 0 }}>
            New clients &amp; projects
          </p>
          <p className="sgo-big" style={{ margin: "8px 0 0" }}>
            {loading ? "—" : Math.round(animated)}
          </p>
        </div>
        {!loading && hasData ? (
          <span className="sgo-badge">
            <ArrowUpRight size={11} />
            {delta >= 0 ? `+${delta}` : delta} this month
          </span>
        ) : null}
      </div>

      {!loading && !hasData ? (
        <p className="sgo-sub" style={{ margin: "14px 0 0" }}>
          Not enough data yet — this fills in as clients and projects are created.
        </p>
      ) : (
      <div className="sgo-chart" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <svg key={period} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`New clients and projects over the last ${period} months`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--acc)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--acc)" stopOpacity={0} />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((line) => (
            <line key={line} x1={0} x2={width} y1={height * line} y2={height * line} stroke="var(--ln)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={`${d} L${width},${height} L0,${height} Z`} fill={`url(#${gradientId})`} className="sgo-chart-area" />
          <path
            d={d}
            fill="none"
            stroke="var(--acc)"
            strokeWidth={2.2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1000}
            className="sgo-chart-line"
          />
          {hovered ? <line x1={hovered[0]} x2={hovered[0]} y1={0} y2={height} stroke="var(--ln2)" vectorEffect="non-scaling-stroke" /> : null}
        </svg>

        {hovered && hover !== null ? (
          <>
            <span
              style={{
                position: "absolute",
                left: `${(hovered[0] / width) * 100}%`,
                top: `${(hovered[1] / height) * 130}px`,
                width: 10,
                height: 10,
                marginLeft: -5,
                marginTop: -5,
                borderRadius: "50%",
                background: "var(--acc)",
                boxShadow: "0 0 0 3px var(--g-strong)",
                pointerEvents: "none",
              }}
            />
            <span className="sgo-chart-tip" style={{ left: `${(hovered[0] / width) * 100}%`, top: `${(hovered[1] / height) * 130 - 8}px` }}>
              {months[hover]} · {values[hover]}
            </span>
          </>
        ) : null}

        <div className="sgo-chart-axis">
          <span>{months[0]}</span>
          <span>{months[Math.floor(months.length / 2)]}</span>
          <span>{months[months.length - 1]}</span>
        </div>
      </div>
      )}

      <div className="sgo-divider" />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span className="sgo-sub" style={{ margin: 0 }}>
          New clients and projects per month
        </span>
        <button type="button" className="sgo-link" onClick={onOpen} disabled={navDisabled}>
          Full analytics
          <ChevronRight size={13} />
        </button>
      </div>
    </Widget>
  );
}

/* =============================================================================
   ACTIVITY
============================================================================= */

const ACTIVITY_MODULE_ICONS: Record<ActivityFeedItem["module"], LucideIcon> = {
  contracts: FolderKanban,
  recruitment: Users,
  leave: Plane,
  timesheets: Clock3,
  audit: ShieldCheck,
};

const ACTIVITY_MODULE_DESTINATIONS: Record<ActivityFeedItem["module"], Destination> = {
  contracts: "contracts",
  recruitment: "recruitment",
  leave: "leave",
  timesheets: "timesheets",
  audit: "audit_logs",
};

function ActivityCard({
  index,
  now,
  items,
  loading,
  onOpen,
  onOpenItem,
  navDisabled,
}: {
  index: number;
  now: Date | null;
  items: ActivityFeedItem[];
  loading: boolean;
  onOpen: () => void;
  onOpenItem: (destination: Destination) => void;
  navDisabled: boolean;
}) {
  return (
    <Widget
      index={index}
      title="Activity"
      icon={<Activity size={15} />}
      badge={
        items.length > 0 ? (
          <span className="sgo-badge">
            <span className="sgo-live" />
            Live
          </span>
        ) : undefined
      }
      action="Timeline"
      onAction={onOpen}
      actionDisabled={navDisabled}
    >
      {loading ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          Loading recent activity…
        </p>
      ) : items.length === 0 ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          No activity recorded yet.
        </p>
      ) : (
      <div style={{ position: "relative" }}>
        <span aria-hidden="true" style={{ position: "absolute", left: 16, top: 18, bottom: 18, width: 1, background: "var(--ln)" }} />
        {items.slice(0, 6).map((item) => {
          const Icon = ACTIVITY_MODULE_ICONS[item.module] ?? Activity;
          const createdAt = new Date(item.createdAt).getTime();
          return (
            <button
              key={item.id}
              type="button"
              className="sgo-row-btn"
              onClick={() => onOpenItem(ACTIVITY_MODULE_DESTINATIONS[item.module] ?? "activity")}
              disabled={navDisabled}
              style={{ alignItems: "flex-start" }}
            >
              <span className="sgo-card-icon" style={{ position: "relative", background: "var(--g-strong)", border: "1px solid var(--ln)" }}>
                <Icon size={14} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="sgo-title-sm sgo-truncate" style={{ display: "block" }}>
                  {item.title}
                  {item.actorName ? ` — ${item.actorName}` : ""}
                </span>
                {item.description ? (
                  <span className="sgo-sub sgo-truncate" style={{ display: "block" }}>
                    {item.description}
                  </span>
                ) : null}
              </span>
              <span className="sgo-sub" style={{ marginTop: 2, whiteSpace: "nowrap" }}>
                {now ? formatAgo(now.getTime() - createdAt) : ""}
              </span>
            </button>
          );
        })}
      </div>
      )}
    </Widget>
  );
}

/* =============================================================================
   NOTIFICATIONS
============================================================================= */

const NOTIFICATION_TONES: Record<string, string> = {
  LEAVE_REQUEST_PENDING: "#A7D6AF",
  TICKET_URGENT: "#EFA1A1",
  INVOICE_OVERDUE: "#F0C68D",
  INTERVIEW_UPCOMING: "#A9C8E6",
  OFFER_EXPIRING: "#EAD9F5",
  CONTRACT_RENEWAL_DUE: "#A8C3E9",
  ACTIVITY: "#D6EEF0",
};

// lib/notifications/server.ts sets `module` to one of these AdminTab-style
// keys. Every one is already a valid Destination (either natively, or via
// the module-navigation additions above), so this is a type-narrowing
// helper rather than a real transformation.
const NOTIFICATION_MODULE_DESTINATIONS = new Set<string>(["leave", "support", "invoices", "recruitment", "contracts"]);

function notificationDestination(module: string): Destination {
  return NOTIFICATION_MODULE_DESTINATIONS.has(module) ? (module as Destination) : "notifications";
}

function NotificationsCard({
  index,
  now,
  items,
  loading,
  onToggle,
  onReadAll,
  onOpen,
  onOpenItem,
  navDisabled,
}: {
  index: number;
  now: Date | null;
  items: NotificationItem[];
  loading: boolean;
  onToggle: (id: string) => void;
  onReadAll: () => void;
  onOpen: () => void;
  onOpenItem: (destination: Destination) => void;
  navDisabled: boolean;
}) {
  const unread = items.filter((item) => !item.read).length;
  const animated = useCountUp(unread, 500);

  return (
    <Widget index={index} title="Notifications" icon={<Bell size={15} />}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="sgo-big">{loading ? "—" : Math.round(animated)}</span>
          <span className="sgo-soft" style={{ fontSize: 11 }}>
            unread
          </span>
        </div>
        <button type="button" className="sgo-link" onClick={onReadAll} disabled={!unread}>
          <CheckCheck size={13} />
          Read all
        </button>
      </div>

      <div style={{ marginTop: 10, flex: 1 }}>
        {loading ? (
          <p className="sgo-sub" style={{ margin: 0 }}>
            Loading notifications…
          </p>
        ) : items.length === 0 ? (
          <p className="sgo-sub" style={{ margin: 0 }}>
            No notifications yet.
          </p>
        ) : (
          items.slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              className="sgo-row-btn"
              onClick={() => {
                if (!item.read) onToggle(item.id);
                onOpenItem(notificationDestination(item.module));
              }}
              aria-pressed={item.read}
              title={item.read ? "Read" : "Mark as read"}
              disabled={navDisabled}
              style={{ alignItems: "flex-start", opacity: item.read ? 0.55 : 1 }}
            >
              <span className="sgo-dot" style={{ background: !item.read ? NOTIFICATION_TONES[item.type] ?? "var(--acc)" : "var(--track)", marginTop: 5 }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="sgo-title-sm sgo-truncate" style={{ display: "block" }}>
                  {item.title}
                </span>
                {item.body ? (
                  <span className="sgo-sub" style={{ display: "block" }}>
                    {item.body}
                  </span>
                ) : null}
              </span>
              <span className="sgo-sub" style={{ marginTop: 1, whiteSpace: "nowrap" }}>
                {now ? formatAgo(now.getTime() - new Date(item.createdAt).getTime()) : ""}
              </span>
            </button>
          ))
        )}
      </div>

      <button type="button" className="sgo-btn" onClick={onOpen} disabled={navDisabled} style={{ marginTop: 12, width: "100%" }}>
        Open inbox
        <ArrowRight size={13} />
      </button>
    </Widget>
  );
}

/* =============================================================================
   DELIVERY (projects and workspaces)
============================================================================= */

const PROJECT_STATUS_LABELS: Record<string, string> = {
  DEVELOPMENT: "In development",
  TESTING: "Testing",
  ACTIVE: "Active",
  MAINTENANCE: "Maintenance",
  PAUSED: "Paused",
  ARCHIVED: "Archived",
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  DEVELOPMENT: "#A8C3E9",
  TESTING: "#EFC48A",
  ACTIVE: "#A9D5B3",
  MAINTENANCE: "#A9D5B3",
  PAUSED: "#EFC48A",
  ARCHIVED: "#C7CDD3",
};

function DeliveryCard({
  index,
  role,
  projects,
  workspaces,
  loading,
  showWorkspaces,
  onOpenProjects,
  onOpenPortfolio,
  navDisabled,
}: {
  index: number;
  role: DashboardRole;
  projects: DeliveryProjectItem[];
  workspaces: WorkspaceSummaryItem[];
  loading: boolean;
  showWorkspaces: boolean;
  onOpenProjects: () => void;
  onOpenPortfolio: () => void;
  navDisabled: boolean;
}) {
  const [tab, setTab] = useState<"projects" | "workspaces">("projects");
  const activeTab = showWorkspaces ? tab : "projects";

  return (
    <Widget
      index={index}
      title={role === "employee" ? "My projects" : "Delivery"}
      icon={<FolderKanban size={15} />}
      extra={
        showWorkspaces ? (
          <div className="sgo-seg" role="tablist" aria-label="Delivery view">
            <button type="button" role="tab" aria-selected={activeTab === "projects"} data-active={activeTab === "projects"} onClick={() => setTab("projects")}>
              Projects
            </button>
            <button type="button" role="tab" aria-selected={activeTab === "workspaces"} data-active={activeTab === "workspaces"} onClick={() => setTab("workspaces")}>
              Workspaces
            </button>
          </div>
        ) : null
      }
      action={activeTab === "projects" ? "All projects" : "Portfolio"}
      onAction={activeTab === "projects" ? onOpenProjects : onOpenPortfolio}
      actionDisabled={navDisabled}
    >
      {loading ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          Loading…
        </p>
      ) : activeTab === "projects" ? (
        <div key="projects" style={{ display: "grid", gap: 4 }}>
          {projects.length === 0 ? (
            <p className="sgo-sub" style={{ margin: 0 }}>
              No active projects right now.
            </p>
          ) : (
            projects.map((project) => (
              <button key={project.id} type="button" className="sgo-row-btn" onClick={onOpenProjects} disabled={navDisabled} style={{ display: "block", padding: "12px 10px" }}>
                <span style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="sgo-title-sm sgo-truncate" style={{ display: "block" }}>
                      {project.name}
                    </span>
                    <span className="sgo-sub" style={{ display: "block" }}>
                      {project.clientName}
                    </span>
                  </span>
                  <span
                    className="sgo-badge"
                    style={{ background: PROJECT_STATUS_COLORS[project.status] ?? "var(--g-strong)" }}
                  >
                    {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : (
        <div key="workspaces" style={{ display: "grid", gap: 4 }}>
          {workspaces.length === 0 ? (
            <p className="sgo-sub" style={{ margin: 0 }}>
              No active client workspaces right now.
            </p>
          ) : (
            workspaces.map((workspace) => (
              <button key={workspace.clientId} type="button" className="sgo-row-btn" onClick={onOpenPortfolio} disabled={navDisabled}>
                <span className="sgo-card-icon" style={{ width: 36, height: 36, fontSize: 10, fontWeight: 700, color: "var(--t)" }}>
                  {initials(workspace.clientName)}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="sgo-title-sm sgo-truncate" style={{ display: "block" }}>
                    {workspace.clientName}
                  </span>
                  <span className="sgo-sub" style={{ display: "block" }}>
                    {workspace.activeProjects} active project{workspace.activeProjects === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </Widget>
  );
}

/* =============================================================================
   NEEDS ATTENTION
============================================================================= */

const ATTENTION_KIND_COLORS: Record<AttentionFeedItem["kind"], string> = {
  overdue_invoice: "#EFA1A1",
  urgent_ticket: "#EFA1A1",
  expiring_offer: "#EFC48A",
  contract_renewal: "#A7C5E2",
};

function AttentionCard({
  index,
  role,
  items,
  loading,
  onOpen,
  navDisabled,
}: {
  index: number;
  role: DashboardRole;
  items: AttentionFeedItem[];
  loading: boolean;
  onOpen: () => void;
  navDisabled: boolean;
}) {
  const urgent = items.filter((item) => item.kind === "overdue_invoice" || item.kind === "urgent_ticket").length;

  return (
    <Widget index={index} title={role === "employee" ? "My priorities" : "Needs your attention"} icon={<AlertCircle size={15} />}>
      {loading ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          Nothing needs attention right now.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex" }}>
              {items.map((item, position) => (
                <span
                  key={item.id}
                  className="sgo-avatar"
                  style={{ background: ATTENTION_KIND_COLORS[item.kind], marginLeft: position ? -10 : 0, boxShadow: "0 0 0 2px var(--g-strong)", width: 32, height: 32, fontSize: 9.5 }}
                >
                  {initials(item.title)}
                </span>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>
              {items.length} item{items.length === 1 ? "" : "s"} waiting
              <span className="sgo-muted" style={{ display: "block", fontSize: 10.5, fontWeight: 500 }}>
                {urgent} urgent
              </span>
            </p>
          </div>

          <div style={{ marginTop: 12, flex: 1 }}>
            {items.map((item) => (
              <button key={item.id} type="button" className="sgo-row-btn" onClick={onOpen} disabled={navDisabled} style={{ alignItems: "flex-start" }}>
                <span className="sgo-dot" style={{ background: ATTENTION_KIND_COLORS[item.kind], marginTop: 5 }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="sgo-title-sm sgo-truncate" style={{ display: "block" }}>
                    {item.title}
                  </span>
                  <span className="sgo-sub sgo-truncate" style={{ display: "block" }}>
                    {item.detail}
                  </span>
                </span>
                <ArrowUpRight size={14} className="sgo-muted" />
              </button>
            ))}
          </div>
        </>
      )}

      <button type="button" className="sgo-btn sgo-btn-primary" onClick={onOpen} disabled={navDisabled || items.length === 0} style={{ marginTop: 12, width: "100%" }}>
        Review all
        <ArrowRight size={13} />
      </button>
    </Widget>
  );
}

/* =============================================================================
   SUPPORT
============================================================================= */

function SupportCard({
  index,
  open,
  urgent,
  loading,
  onOpen,
  navDisabled,
}: {
  index: number;
  open: number;
  urgent: number;
  loading: boolean;
  onOpen: () => void;
  navDisabled: boolean;
}) {
  const inProgress = Math.max(0, open - urgent);
  const animated = useCountUp(open);

  const segments = [
    { label: "Urgent", value: urgent, color: "#EFA1A1" },
    { label: "In progress", value: inProgress, color: "#A5C6E7" },
  ];

  return (
    <Widget index={index} title="Support" icon={<Headphones size={15} />} action="Open support" onAction={onOpen} actionDisabled={navDisabled}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="sgo-big">{loading ? "—" : Math.round(animated)}</span>
        <span className="sgo-soft" style={{ fontSize: 11 }}>
          open conversations
        </span>
      </div>

      {!loading && open > 0 ? (
        <>
          <div className="sgo-segbar">
            {segments.map((segment, position) => (
              <span key={segment.label} style={{ flexGrow: segment.value, background: segment.color, animationDelay: `${200 + position * 120}ms` }} />
            ))}
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            {segments.map((segment) => (
              <div key={segment.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="sgo-dot" style={{ background: segment.color }} />
                  <span className="sgo-soft" style={{ fontSize: 11 }}>
                    {segment.label}
                  </span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 650 }}>{segment.value}</span>
              </div>
            ))}
          </div>
        </>
      ) : !loading ? (
        <p className="sgo-sub" style={{ margin: "14px 0 0" }}>
          No open support conversations.
        </p>
      ) : null}
    </Widget>
  );
}

/* =============================================================================
   TEAM
============================================================================= */

function TeamCard({
  index,
  adminName,
  awayNames,
  teammates,
  loading,
  onOpen,
  navDisabled,
}: {
  index: number;
  adminName: string;
  awayNames: string[];
  teammates: TeammateSampleItem[];
  loading: boolean;
  onOpen: () => void;
  navDisabled: boolean;
}) {
  return (
    <Widget index={index} title="Team" icon={<Users size={15} />} action="View team" onAction={onOpen} actionDisabled={navDisabled}>
      <p className="sgo-sub" style={{ margin: "0 0 8px" }}>
        {awayNames.length ? `${awayNames.length} on leave today` : "Everyone is in today"}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0" }}>
        <Avatar name={adminName} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span className="sgo-title-sm sgo-truncate" style={{ display: "block" }}>
            {adminName}
          </span>
          <span className="sgo-sub" style={{ display: "block" }}>
            You
          </span>
        </span>
      </div>
      {loading ? (
        <p className="sgo-sub" style={{ margin: "6px 0 0" }}>
          Loading…
        </p>
      ) : (
        teammates.map((teammate) => (
          <div key={teammate.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0" }}>
            <Avatar name={teammate.name} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="sgo-title-sm sgo-truncate" style={{ display: "block" }}>
                {teammate.name}
              </span>
              <span className="sgo-sub sgo-truncate" style={{ display: "block" }}>
                {teammate.jobTitle ?? teammate.departmentName ?? ""}
              </span>
            </span>
          </div>
        ))
      )}
    </Widget>
  );
}

/* =============================================================================
   FINANCE
============================================================================= */

function FinanceCard({
  index,
  summary,
  loading,
  onOpen,
  navDisabled,
}: {
  index: number;
  summary: OverviewSummaryPayload["finance"] | null;
  loading: boolean;
  onOpen: () => void;
  navDisabled: boolean;
}) {
  const formatCurrency = (value: number, currency: string) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

  const metrics = summary
    ? [
        { label: "Revenue this month", value: formatCurrency(summary.revenueThisMonth, summary.currency), helper: "Paid invoices" },
        { label: "Receivables", value: formatCurrency(summary.receivables, summary.currency), helper: "Outstanding balance" },
        {
          label: "Bank balance",
          value: summary.monzo.connected && summary.monzo.balanceMinor != null
            ? formatCurrency(summary.monzo.balanceMinor / 100, summary.monzo.currency ?? "GBP")
            : "Not connected",
          helper: summary.monzo.connected ? "Live from Monzo" : "Connect Monzo in Finance",
        },
      ]
    : [];

  return (
    <Widget index={index} title="Finance" icon={<CircleDollarSign size={15} />} action="Finance" onAction={onOpen} actionDisabled={navDisabled}>
      {loading || !summary ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          Loading…
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
          {metrics.map((metric) => (
            <div key={metric.label} style={{ padding: 14, borderRadius: 16, background: "var(--inset)", border: "1px solid var(--ln)" }}>
              <p className="sgo-eyebrow" style={{ margin: 0 }}>
                {metric.label}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 650, letterSpacing: "-0.045em" }}>{metric.value}</p>
              <p className="sgo-sub" style={{ marginBottom: 0 }}>
                {metric.helper}
              </p>
            </div>
          ))}
        </div>
      )}
    </Widget>
  );
}

/* =============================================================================
   EMPLOYEE WIDGETS

   Real data only — each card is only ever rendered when the identity
   holds the matching permission grant (see the employee branch of the
   widget registry above), and every figure here comes from an already-
   secured, permission-aware endpoint. No widget invents a number.
============================================================================= */

function MyDepartmentCard({
  index,
  colleagues,
  status,
  departmentName,
  onOpen,
  navDisabled,
}: {
  index: number;
  colleagues: DepartmentColleague[];
  status: "loading" | "ready" | "error";
  departmentName: string | null;
  onOpen: () => void;
  navDisabled: boolean;
}) {
  return (
    <Widget
      index={index}
      title={departmentName ? `${departmentName} team` : "My department"}
      icon={<Users size={15} />}
      action="View department"
      onAction={onOpen}
      actionDisabled={navDisabled}
    >
      {status === "loading" ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          Loading your colleagues…
        </p>
      ) : colleagues.length === 0 ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          No department colleagues to show yet.
        </p>
      ) : (
        colleagues.slice(0, 5).map((person) => (
          <div key={person.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0" }}>
            <Avatar name={`${person.firstName} ${person.lastName}`} src={person.avatarUrl} size={30} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="sgo-title-sm sgo-truncate" style={{ display: "block" }}>
                {person.preferredName || person.firstName} {person.lastName}
              </span>
              <span className="sgo-sub" style={{ display: "block" }}>
                {person.jobTitle || " "}
              </span>
            </span>
          </div>
        ))
      )}
    </Widget>
  );
}

function MyLeaveCard({
  index,
  data,
  status,
  onOpen,
  navDisabled,
}: {
  index: number;
  data: LeaveOverviewData | null;
  status: "loading" | "ready" | "error";
  onOpen: () => void;
  navDisabled: boolean;
}) {
  return (
    <Widget index={index} title="My leave" icon={<Plane size={15} />} action="Request leave" onAction={onOpen} actionDisabled={navDisabled}>
      {status === "loading" ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          Loading your leave balance…
        </p>
      ) : status === "error" || !data ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          Your leave balance could not be loaded.
        </p>
      ) : (
        <>
          {data.my.balances.length === 0 ? (
            <p className="sgo-sub" style={{ margin: 0 }}>
              No leave policy has been assigned to you yet.
            </p>
          ) : (
            data.my.balances.map((balance) => (
              <div key={balance.policyName} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0" }}>
                <span className="sgo-title-sm">{balance.policyName}</span>
                <span className="sgo-sub">{balance.available.toFixed(1)} days available</span>
              </div>
            ))
          )}

          {data.my.recentRequests.length > 0 ? (
            <p className="sgo-sub" style={{ margin: "8px 0 0" }}>
              Most recent request: {data.my.recentRequests[0].status.toLowerCase()}
            </p>
          ) : null}
        </>
      )}
    </Widget>
  );
}

function MyNotificationsCard({
  index,
  now,
  items,
  loading,
  onToggle,
  onOpen,
  onOpenItem,
  navDisabled,
}: {
  index: number;
  now: Date | null;
  items: NotificationItem[];
  loading: boolean;
  onToggle: (id: string) => void;
  onOpen: () => void;
  onOpenItem: (destination: Destination) => void;
  navDisabled: boolean;
}) {
  return (
    <Widget index={index} title="Notifications" icon={<Bell size={15} />} action="Open notifications" onAction={onOpen} actionDisabled={navDisabled}>
      {loading ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          Loading notifications…
        </p>
      ) : items.length === 0 ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          No notifications right now.
        </p>
      ) : (
        items.slice(0, 5).map((item) => (
          <button
            key={item.id}
            type="button"
            className="sgo-row-btn"
            onClick={() => {
              if (!item.read) onToggle(item.id);
              onOpenItem(notificationDestination(item.module));
            }}
            disabled={navDisabled}
            style={{ alignItems: "flex-start", opacity: item.read ? 0.55 : 1 }}
          >
            <span className="sgo-dot" style={{ background: !item.read ? NOTIFICATION_TONES[item.type] ?? "var(--acc)" : "var(--track)", marginTop: 5 }} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="sgo-title-sm sgo-truncate" style={{ display: "block" }}>
                {item.title}
              </span>
              {item.body ? (
                <span className="sgo-sub" style={{ display: "block" }}>
                  {item.body}
                </span>
              ) : null}
            </span>
            <span className="sgo-sub" style={{ marginTop: 1, whiteSpace: "nowrap" }}>
              {now ? formatAgo(now.getTime() - new Date(item.createdAt).getTime()) : ""}
            </span>
          </button>
        ))
      )}
    </Widget>
  );
}

const GROWTH_STATUS_CHIPS: { key: string; label: string }[] = [
  { key: "DRAFT", label: "Draft" },
  { key: "PENDING_REVIEW", label: "Pending" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "PUBLISHED", label: "Published" },
  { key: "FAILED", label: "Failed" },
];

function MyGrowthCard({
  index,
  summary,
  loading,
  onOpen,
  navDisabled,
}: {
  index: number;
  summary: { postsByStatus: Record<string, number>; connectedAccounts: number; hasMetrics: boolean } | null;
  loading: boolean;
  onOpen: () => void;
  navDisabled: boolean;
}) {
  const totalPosts = summary ? Object.values(summary.postsByStatus).reduce((sum, count) => sum + count, 0) : 0;

  return (
    <Widget index={index} title="Marketing activity" icon={<Megaphone size={15} />} action="Open" onAction={onOpen} actionDisabled={navDisabled}>
      {loading ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          Loading…
        </p>
      ) : !summary || totalPosts === 0 ? (
        <p className="sgo-sub" style={{ margin: 0 }}>
          No posts yet. You&apos;ll see draft, scheduled and published content here once there is some.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {GROWTH_STATUS_CHIPS.map((chip) => {
              const value = summary.postsByStatus[chip.key] ?? 0;
              if (value === 0) return null;
              return (
                <span key={chip.key} className="sgo-badge">
                  {value} {chip.label}
                </span>
              );
            })}
          </div>
          <p className="sgo-sub" style={{ margin: "10px 0 0" }}>
            {summary.connectedAccounts > 0
              ? `${summary.connectedAccounts} connected account${summary.connectedAccounts === 1 ? "" : "s"}`
              : "No accounts connected yet"}
            {summary.hasMetrics ? "" : " · No analytics available yet"}
          </p>
        </>
      )}
    </Widget>
  );
}

/* =============================================================================
   CUSTOMISATION PANEL

   A floating sheet (bottom sheet on phones) with a live preview of the
   dashboard at the top, then three tabs:
   - Wallpaper: scenes, gradient presets, a gradient builder, solid colours
     and your own photo, plus darkness, blur, grain and moving light
   - Style: glass colour and opacity, corner roundness, accent colour
   - Widgets: show, hide, reorder, resize and minimise every widget
============================================================================= */

type WallpaperSource = "scenes" | "gradients" | "colour" | "photo";

type PanelRow = { spec: WidgetSpec; visible: boolean; size: SizeKey; collapsed: boolean };

type PanelPreview = {
  style: CSSProperties;
  overlay: number;
  glass: Tone;
  tiles: { key: WidgetKey; span: number; collapsed: boolean }[];
};

function sourceFor(type: WallpaperType): WallpaperSource {
  if (type === "gradient" || type === "mix") return "gradients";
  if (type === "solid") return "colour";
  if (type === "custom") return "photo";
  return "scenes";
}

function CustomisePanel({
  preferences,
  hour,
  tab,
  onTabChange,
  preview,
  savingWallpaper,
  wallpaperError,
  onPickUpload,
  onClose,
  onUpdate,
  onReset,
  rows,
  onToggleWidget,
  onSize,
  onToggleCollapsed,
  onMoveWidget,
  onResetLayout,
  onEditLayout,
}: {
  preferences: DashboardPreferences;
  hour: number;
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  preview: PanelPreview;
  savingWallpaper: boolean;
  wallpaperError: string | null;
  onPickUpload: () => void;
  onClose: () => void;
  onUpdate: <K extends keyof DashboardPreferences>(key: K, value: DashboardPreferences[K]) => void;
  onReset: () => void;
  rows: PanelRow[];
  onToggleWidget: (key: WidgetKey, visible: boolean) => void;
  onSize: (key: WidgetKey, size: SizeKey) => void;
  onToggleCollapsed: (key: WidgetKey) => void;
  onMoveWidget: (key: WidgetKey, delta: number) => void;
  onResetLayout: () => void;
  onEditLayout: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [source, setSource] = useState<WallpaperSource>(() => sourceFor(preferences.wallpaperType));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const autoPreset = WALLPAPERS.find((item) => item.id === autoWallpaperId(hour)) ?? WALLPAPERS[0];
  const gradient = preferences.customGradient;
  const glassColour =
    preview.glass === "dark"
      ? `rgba(36, 44, 50, ${clamp(preferences.glassOpacity, 25, 96) / 100})`
      : `rgba(255, 255, 255, ${clamp(preferences.glassOpacity, 25, 96) / 100})`;

  const setGradient = (next: Partial<CustomGradient>) => {
    onUpdate("customGradient", { ...gradient, ...next });
    onUpdate("wallpaperType", "mix");
  };

  const visibleCount = rows.filter((row) => row.visible).length;

  return (
    <>
      <button type="button" className="sgp-backdrop" onClick={onClose} aria-label="Close customisation" />

      <aside ref={panelRef} className="sgp" role="dialog" aria-modal="true" aria-label="Customise your dashboard">
        <span className="sgp-handle" aria-hidden="true" />

        <div className="sgp-head">
          <div>
            <h2 className="sgp-title">
              <Palette size={18} />
              Personalise
            </h2>
            <p className="sgp-subtitle">Changes apply instantly and are saved for your account.</p>
          </div>
          <button type="button" className="sgp-icon-btn" onClick={onClose} aria-label="Close customisation">
            <X size={16} />
          </button>
        </div>

        {/* Live preview */}
        <div className="sgp-preview" aria-hidden="true">
          <div className="sgp-preview-wall" style={preview.style} />
          <div className="sgp-preview-shade" style={{ background: `rgba(0, 0, 0, ${preview.overlay / 100})` }} />
          <div className="sgp-preview-grid">
            {preview.tiles.map((tile) => (
              <span
                key={tile.key}
                style={{
                  gridColumn: `span ${tile.span}`,
                  height: tile.collapsed ? 8 : tile.key === "commandBar" ? 10 : tile.key === "statistics" ? 14 : tile.span >= 8 ? 30 : 24,
                  borderRadius: Math.max(3, preferences.radius / 5),
                  background: glassColour,
                }}
              />
            ))}
          </div>
          <span className="sgp-preview-label">Live preview</span>
        </div>

        <div className="sgp-tabs" role="tablist" aria-label="Customise sections">
          {(
            [
              { id: "wallpaper", label: "Wallpaper", icon: ImageIcon },
              { id: "style", label: "Style", icon: Paintbrush },
              { id: "widgets", label: "Widgets", icon: LayoutGrid },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                data-active={tab === item.id}
                onClick={() => onTabChange(item.id)}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="sgp-body">
          {tab === "wallpaper" ? (
            <>
              <div className="sgp-chips" role="radiogroup" aria-label="Wallpaper source">
                {(
                  [
                    { id: "scenes", label: "Scenes" },
                    { id: "gradients", label: "Gradients" },
                    { id: "colour", label: "Colour" },
                    { id: "photo", label: "Photo" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={source === item.id}
                    data-active={source === item.id}
                    className="sgp-chip"
                    onClick={() => setSource(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {source === "scenes" ? (
                <section className="sgp-section">
                  <div className="sgp-tiles">
                    <PanelTile
                      name="Time of day"
                      background={autoPreset.preview}
                      selected={preferences.wallpaperType === "auto"}
                      onSelect={() => onUpdate("wallpaperType", "auto")}
                      icon={<SunMoon size={12} />}
                    />
                    {WALLPAPERS.map((item) => (
                      <PanelTile
                        key={item.id}
                        name={item.name}
                        background={item.preview}
                        selected={preferences.wallpaperType === "preset" && preferences.wallpaperId === item.id}
                        onSelect={() => {
                          onUpdate("wallpaperType", "preset");
                          onUpdate("wallpaperId", item.id);
                        }}
                      />
                    ))}
                  </div>
                  <p className="sgp-hint">Time of day moves from dawn to daylight, sunset and night on its own.</p>
                </section>
              ) : null}

              {source === "gradients" ? (
                <>
                  <section className="sgp-section">
                    <p className="sgp-label">Presets</p>
                    <div className="sgp-tiles">
                      {GRADIENTS.map((item) => (
                        <PanelTile
                          key={item.id}
                          name={item.name}
                          background={item.background}
                          selected={preferences.wallpaperType === "gradient" && preferences.gradientId === item.id}
                          onSelect={() => {
                            onUpdate("wallpaperType", "gradient");
                            onUpdate("gradientId", item.id);
                          }}
                        />
                      ))}
                    </div>
                  </section>

                  <section className="sgp-section">
                    <p className="sgp-label">
                      Create your own
                      {preferences.wallpaperType === "mix" ? <small>In use</small> : null}
                    </p>
                    <div className="sgp-card">
                      <div className="sgp-builder-preview" style={{ backgroundImage: buildCustomGradient(gradient) }}>
                        <button
                          type="button"
                          className="sgp-btn sgp-btn-sm"
                          onClick={() => setGradient({ stops: randomPalette(gradient.stops.length) })}
                        >
                          <Shuffle size={13} />
                          Shuffle
                        </button>
                      </div>

                      <div className="sgp-seg" role="radiogroup" aria-label="Gradient style" style={{ marginTop: 12 }}>
                        {(["linear", "radial", "mesh"] as const).map((kind) => (
                          <button
                            key={kind}
                            type="button"
                            role="radio"
                            aria-checked={gradient.kind === kind}
                            data-active={gradient.kind === kind}
                            onClick={() => setGradient({ kind })}
                          >
                            {kind === "linear" ? "Linear" : kind === "radial" ? "Radial" : "Mesh"}
                          </button>
                        ))}
                      </div>

                      <div className="sgp-stops">
                        {gradient.stops.map((stop, position) => (
                          <label key={position} className="sgp-stop">
                            <span className="sgp-stop-swatch" style={{ background: stop }} />
                            <span className="sgp-stop-code">{stop.toUpperCase()}</span>
                            <input
                              type="color"
                              value={stop}
                              aria-label={`Colour ${position + 1}`}
                              onChange={(event) => {
                                const stops = [...gradient.stops];
                                stops[position] = event.target.value;
                                setGradient({ stops });
                              }}
                            />
                            {gradient.stops.length > 2 ? (
                              <button
                                type="button"
                                className="sgp-stop-remove"
                                aria-label={`Remove colour ${position + 1}`}
                                onClick={(event) => {
                                  event.preventDefault();
                                  setGradient({ stops: gradient.stops.filter((_, item) => item !== position) });
                                }}
                              >
                                <X size={10} />
                              </button>
                            ) : null}
                          </label>
                        ))}
                        {gradient.stops.length < 3 ? (
                          <button
                            type="button"
                            className="sgp-add-stop"
                            onClick={() => setGradient({ stops: [...gradient.stops, randomPalette(3)[2]] })}
                          >
                            <Plus size={14} />
                            Add colour
                          </button>
                        ) : null}
                      </div>

                      {gradient.kind !== "radial" ? (
                        <div style={{ marginTop: 14 }}>
                          <RangeRow
                            label="Direction"
                            value={gradient.angle}
                            unit="°"
                            min={0}
                            max={360}
                            onChange={(value) => setGradient({ angle: value })}
                          />
                        </div>
                      ) : null}
                    </div>
                  </section>
                </>
              ) : null}

              {source === "colour" ? (
                <section className="sgp-section">
                  <div className="sgp-swatches">
                    {SOLID_SWATCHES.map((colour) => (
                      <button
                        key={colour}
                        type="button"
                        className="sgp-swatch"
                        style={{ background: colour }}
                        data-selected={preferences.wallpaperType === "solid" && preferences.solidColor.toUpperCase() === colour}
                        aria-label={`Use ${colour}`}
                        onClick={() => {
                          onUpdate("solidColor", colour);
                          onUpdate("wallpaperType", "solid");
                        }}
                      />
                    ))}
                  </div>
                  <div className="sgp-colour-row">
                    <input
                      type="color"
                      value={preferences.solidColor}
                      aria-label="Choose any colour"
                      onChange={(event) => {
                        onUpdate("solidColor", event.target.value);
                        onUpdate("wallpaperType", "solid");
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 650 }}>Any colour</p>
                      <p style={{ margin: "2px 0 0", fontSize: 10.5, color: "#84918A" }}>{preferences.solidColor.toUpperCase()}</p>
                    </div>
                  </div>
                </section>
              ) : null}

              {source === "photo" ? (
                <section className="sgp-section">
                  <button type="button" className="sgp-upload" onClick={onPickUpload} disabled={savingWallpaper}>
                    {savingWallpaper ? <Loader2 size={18} className="sgo-spin" /> : <Upload size={18} />}
                    {savingWallpaper ? "Processing your photo…" : "Upload a photo"}
                    <small>JPG or PNG, up to 12 MB. Resized to fit.</small>
                  </button>

                  {preferences.customWallpaper ? (
                    <div className="sgp-photo" style={{ backgroundImage: `url("${preferences.customWallpaper}")` }}>
                      <div className="sgp-photo-actions">
                        <button
                          type="button"
                          className="sgp-btn sgp-btn-sm"
                          onClick={() => onUpdate("wallpaperType", "custom")}
                          disabled={preferences.wallpaperType === "custom"}
                        >
                          <Check size={13} />
                          {preferences.wallpaperType === "custom" ? "In use" : "Use photo"}
                        </button>
                        <button
                          type="button"
                          className="sgp-btn sgp-btn-sm sgp-btn-danger"
                          onClick={() => {
                            onUpdate("customWallpaper", null);
                            if (preferences.wallpaperType === "custom") onUpdate("wallpaperType", "preset");
                          }}
                        >
                          <Trash2 size={13} />
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {wallpaperError ? <p style={{ margin: "10px 0 0", fontSize: 11, color: "#DC2626" }}>{wallpaperError}</p> : null}
                </section>
              ) : null}

              <section className="sgp-section">
                <p className="sgp-label">Adjust</p>
                <RangeRow label="Darkness" value={preferences.overlay} unit="%" min={0} max={65} onChange={(value) => onUpdate("overlay", value)} />
                <div style={{ height: 14 }} />
                <RangeRow label="Blur" value={preferences.blur} unit="px" min={0} max={20} onChange={(value) => onUpdate("blur", value)} />
                <div style={{ height: 6 }} />
                <PanelToggle label="Film grain" description="A soft photographic texture." checked={preferences.grain} onChange={(value) => onUpdate("grain", value)} />
                <PanelToggle label="Moving light" description="A slow drifting glow over the wallpaper." checked={preferences.motion} onChange={(value) => onUpdate("motion", value)} />
              </section>
            </>
          ) : null}

          {tab === "style" ? (
            <>
              <section className="sgp-section">
                <p className="sgp-label">Widget glass</p>
                <div className="sgp-seg" role="radiogroup" aria-label="Widget glass">
                  {(
                    [
                      { id: "dark", label: "Dark", icon: Moon },
                      { id: "light", label: "Light", icon: Sun },
                      { id: "auto", label: "Match", icon: SunMoon },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={preferences.widgetTheme === item.id}
                        data-active={preferences.widgetTheme === item.id}
                        onClick={() => onUpdate("widgetTheme", item.id)}
                      >
                        <Icon size={14} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <p className="sgp-hint">Match picks light or dark glass to suit your wallpaper.</p>
              </section>

              <section className="sgp-section">
                <RangeRow label="Glass opacity" value={preferences.glassOpacity} unit="%" min={25} max={96} onChange={(value) => onUpdate("glassOpacity", value)} />
                <div style={{ height: 16 }} />
                <RangeRow label="Corner roundness" value={preferences.radius} unit="px" min={12} max={34} onChange={(value) => onUpdate("radius", value)} />
              </section>

              <section className="sgp-section">
                <p className="sgp-label">
                  Accent
                  <small>{ACCENTS.find((item) => item.id === preferences.accentId)?.name ?? "Mint"}</small>
                </p>
                <div className="sgp-swatches">
                  {ACCENTS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="sgp-swatch"
                      style={{ background: `linear-gradient(135deg, ${item.dark} 0 50%, ${item.light} 50% 100%)` }}
                      data-selected={preferences.accentId === item.id}
                      aria-label={`${item.name} accent`}
                      onClick={() => onUpdate("accentId", item.id)}
                    />
                  ))}
                </div>
                <p className="sgp-hint">Used for charts, progress bars and highlights.</p>
              </section>

              <section className="sgp-section">
                <p className="sgp-label">Layout</p>
                <PanelToggle label="Compact spacing" description="Tighter gaps between widgets." checked={preferences.compact} onChange={(value) => onUpdate("compact", value)} />
                <PanelToggle label="Show greeting" description="Your welcome, date and time." checked={preferences.showGreeting} onChange={(value) => onUpdate("showGreeting", value)} />
              </section>
            </>
          ) : null}

          {tab === "widgets" ? (
            <>
              <div className="sgp-feature">
                <span className="sgp-feature-icon">
                  <Move size={19} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 650 }}>Arrange on your dashboard</p>
                  <p style={{ margin: "3px 0 0", fontSize: 10.5, color: "rgba(255,255,255,0.72)" }}>
                    Or press and hold any widget.
                  </p>
                </div>
                <button type="button" onClick={onEditLayout}>
                  Edit layout
                </button>
              </div>

              <section className="sgp-section">
                <p className="sgp-label">
                  Your widgets
                  <small>
                    {visibleCount} of {rows.length} shown
                  </small>
                </p>

                {rows.map((row, position) => {
                  const Icon = row.spec.icon;
                  return (
                    <div key={row.spec.key} className="sgp-widget-row" data-hidden={!row.visible}>
                      <div className="sgp-move">
                        <button
                          type="button"
                          aria-label={`Move ${row.spec.label} up`}
                          disabled={position === 0}
                          onClick={() => onMoveWidget(row.spec.key, -1)}
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${row.spec.label} down`}
                          disabled={position === rows.length - 1}
                          onClick={() => onMoveWidget(row.spec.key, 1)}
                        >
                          <ChevronDown size={13} />
                        </button>
                      </div>

                      <span className="sgp-widget-icon">
                        <Icon size={15} />
                      </span>

                      <div className="sgp-widget-main">
                        <p className="sgp-widget-name">{row.spec.label}</p>
                        <p className="sgp-widget-desc">{row.spec.description}</p>

                        {row.visible && (row.spec.sizes.length > 1 || row.spec.collapsible) ? (
                          <div className="sgp-sizes">
                            {row.spec.sizes.length > 1
                              ? row.spec.sizes.map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    className="sgp-size"
                                    data-active={row.size === option}
                                    aria-pressed={row.size === option}
                                    onClick={() => onSize(row.spec.key, option)}
                                  >
                                    <span className="sgo-shape" style={{ width: 5 + SIZE_SPANS[option], height: 8 }} />
                                    {SIZE_LABELS[option]}
                                  </button>
                                ))
                              : null}
                            {row.spec.collapsible ? (
                              <button
                                type="button"
                                className="sgp-size"
                                data-active={row.collapsed}
                                aria-pressed={row.collapsed}
                                onClick={() => onToggleCollapsed(row.spec.key)}
                              >
                                <Minimize2 size={11} />
                                Minimised
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={row.visible}
                        aria-label={`${row.visible ? "Hide" : "Show"} ${row.spec.label}`}
                        onClick={() => onToggleWidget(row.spec.key, !row.visible)}
                        style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", marginTop: 6 }}
                      >
                        <span className="sgp-switch" data-active={row.visible}>
                          <span />
                        </span>
                      </button>
                    </div>
                  );
                })}

                <button type="button" className="sgp-btn" onClick={onResetLayout} style={{ marginTop: 14, width: "100%" }}>
                  <RotateCcw size={14} />
                  Restore default layout
                </button>
              </section>

              <div className="sgp-note">
                <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  Your layout is saved for this account in this browser. You only ever see widgets you have access to.
                </span>
              </div>
            </>
          ) : null}
        </div>

        <div className="sgp-foot">
          <button type="button" className="sgp-btn" onClick={onReset} title="Reset wallpaper, style and layout">
            <RotateCcw size={14} />
            Reset all
          </button>
          <button type="button" className="sgp-btn sgp-btn-primary" onClick={onClose} style={{ flex: 1 }}>
            <Check size={15} />
            Done
          </button>
        </div>
      </aside>
    </>
  );
}

function PanelTile({
  name,
  background,
  selected,
  onSelect,
  icon,
}: {
  name: string;
  background: string;
  selected: boolean;
  onSelect: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      className="sgp-tile"
      data-selected={selected}
      style={{ backgroundImage: background }}
      onClick={onSelect}
      aria-label={`Use ${name}`}
      aria-pressed={selected}
      title={name}
    >
      <span className="sgp-tile-label">
        {icon}
        {name}
      </span>
      {selected ? (
        <span className="sgp-tile-check">
          <Check size={12} />
        </span>
      ) : null}
    </button>
  );
}

function RangeRow({
  label,
  value,
  unit,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="sgp-label" style={{ marginBottom: 8 }}>
        <span style={{ color: "#22332B", fontSize: 12, fontWeight: 650 }}>{label}</span>
        <small>
          {value}
          {unit}
        </small>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
        className="sgp-range"
        aria-label={label}
      />
    </div>
  );
}

function PanelToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button type="button" className="sgp-toggle" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: 650, color: "#26372D" }}>{label}</span>
        {description ? <span style={{ display: "block", marginTop: 3, fontSize: 10.5, color: "#8A978D" }}>{description}</span> : null}
      </span>
      <span className="sgp-switch" data-active={checked}>
        <span />
      </span>
    </button>
  );
}