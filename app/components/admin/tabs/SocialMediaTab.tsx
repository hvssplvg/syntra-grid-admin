/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

import {
  Activity,
  AlertCircle,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Edit3,
  FileText,
  Globe,
  Heart,
  ImagePlus,
  Inbox,
  Info,
  LayoutGrid,
  List,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Repeat2,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Trash2,
  Undo2,
  X,
} from "lucide-react";

import { SocialPlatformIcon, type SocialPlatformId } from "../common/SocialPlatformIcon";

/* =============================================================================
   TYPES
============================================================================= */

type SocialPlatform = SocialPlatformId;

/** The real backend status (SocialPostStatus in prisma/schema.prisma). */
type RealPostStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "PARTIALLY_PUBLISHED"
  | "FAILED"
  | "CANCELLED";

/** The UI's 3-stage pipeline bucket. realStatus always carries the true
 *  backend status; this bucket only decides which pipeline column a post
 *  sits in. */
type ContentStatus = "DRAFT" | "READY" | "SCHEDULED";

type WorkspaceView = "content" | "publishing" | "accounts" | "engagement" | "analytics";

type ContentFilter = "ALL" | ContentStatus;

type PlatformFilter = "ALL" | SocialPlatform;

type LibraryLayout = "list" | "grid";

type InstagramPlacement = "FEED" | "STORY";

type LoadStatus = "loading" | "ready" | "error";

type TargetStatus = "PENDING" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED";

type PostTarget = {
  accountId: string;
  platform: SocialPlatform;
  caption: string | null;
  placement: InstagramPlacement;
  status: TargetStatus;
  remotePostUrl: string | null;
  lastError: string | null;
  publishedAt: string | null;
  account: ApiAccountRef;
};

type SocialPost = {
  id: string;
  title: string | null;
  caption: string;
  category: string | null;
  campaignId: string | null;
  platforms: SocialPlatform[];
  targets: PostTarget[];
  status: ContentStatus;
  realStatus: RealPostStatus;
  reviewNotes: string | null;
  scheduledAt: string | null;
  image: string | null;
  imageType: "IMAGE" | "VIDEO" | null;
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
};

type PostForm = {
  title: string;
  caption: string;
  category: string;
  campaignId: string | null;
  platforms: SocialPlatform[];
  platformCaptions: Partial<Record<SocialPlatform, string>>;
  status: ContentStatus;
  scheduledAt: string;
  image: string | null;
  imageType: "IMAGE" | "VIDEO" | null;
  assetIds: string[];
  /** Where this should land on Instagram; ignored by every other platform.
   *  A Reel is the automatic result of FEED + a single video. */
  instagramPlacement: InstagramPlacement;
};

type ComposerState = {
  open: boolean;
  editingId: string | null;
  presetDate: string | null;
};

type Counts = Record<ContentStatus, number> & { total: number };

type Notice = {
  id: number;
  message: string;
  tone: "success" | "error";
  action?: { label: string; run: () => void };
};

type IconType = typeof FileText;

type DropProps = {
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
};

type PreviewMedia = {
  image: string | null;
  type: "IMAGE" | "VIDEO" | null;
  busy: boolean;
  dragging: boolean;
  onAdd: () => void;
  onRemove: () => void;
  dropProps: DropProps;
};

type PlatformDefinition = {
  id: SocialPlatform;
  name: string;
  description: string;
  color: string;
  limit: number;
};

/** A request for the shared confirm / prompt dialog. onConfirm may throw
 *  (the message is shown inside the dialog) or return false to keep the
 *  dialog open without an inline message. */
type DialogRequest = {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  input?: {
    label: string;
    type?: "text" | "textarea" | "datetime-local";
    placeholder?: string;
    initial?: string;
    min?: string;
    required?: boolean;
    validate?: (value: string) => string | null;
  };
  secondary?: { label: string; run: () => void };
  onConfirm: (value: string) => void | boolean | Promise<void | boolean>;
};

type FieldKey = "channels" | "caption" | "media" | "schedule";

/* =============================================================================
   CONSTANTS
============================================================================= */

const BANNER_KEY = "syntragrid.social-media.preview-banner.v1";
const LAYOUT_KEY = "syntragrid.social-media.layout.v1";

/** Must match the longest exit animation in SG_STYLES. */
const EXIT_MS = 190;

const PLATFORMS: PlatformDefinition[] = [
  {
    id: "INSTAGRAM",
    name: "Instagram",
    description: "Feed posts, reels and stories",
    color: "#D6246E",
    limit: 2200,
  },
  {
    id: "FACEBOOK",
    name: "Facebook",
    description: "Page posts and updates",
    color: "#1877F2",
    limit: 63206,
  },
  {
    id: "LINKEDIN",
    name: "LinkedIn",
    description: "Company page updates",
    color: "#0A66C2",
    limit: 3000,
  },
  {
    id: "X",
    name: "X",
    description: "Short updates and replies",
    color: "var(--text)",
    limit: 280,
  },
  {
    id: "TIKTOK",
    name: "TikTok",
    description: "Short-form video",
    // Monochrome and theme-adaptive, like X.
    color: "var(--text)",
    limit: 2200,
  },
  {
    id: "YOUTUBE",
    name: "YouTube",
    description: "Video uploads and shorts",
    color: "#FF0000",
    limit: 5000,
  },
];

const NAVIGATION: Array<{ id: WorkspaceView; label: string; icon: IconType }> = [
  { id: "content", label: "Content", icon: Edit3 },
  { id: "publishing", label: "Publishing", icon: CalendarDays },
  { id: "accounts", label: "Accounts", icon: LayoutGrid },
  { id: "engagement", label: "Engagement", icon: MessageCircle },
  { id: "analytics", label: "Analytics", icon: Activity },
];

const STATUS_ORDER: ContentStatus[] = ["DRAFT", "READY", "SCHEDULED"];

const STATUS_META: Record<
  ContentStatus,
  { label: string; short: string; description: string; hue: string; icon: IconType }
> = {
  DRAFT: {
    label: "Draft",
    short: "Drafts",
    description: "Still being written",
    hue: "var(--text-muted)",
    icon: FileText,
  },
  READY: {
    label: "Ready for review",
    short: "In review",
    description: "Waiting for sign-off",
    hue: "#D97706",
    icon: ShieldCheck,
  },
  SCHEDULED: {
    label: "Scheduled",
    short: "Scheduled",
    description: "Has a planned time",
    hue: "var(--accent)",
    icon: CalendarDays,
  },
};

const STATUS_HINT: Record<ContentStatus, string> = {
  DRAFT: "Saved for later. Nobody is asked to review it yet.",
  READY: "Sent to an approver for sign-off.",
  SCHEDULED:
    "If you can approve posts, it's approved and scheduled in one step. Otherwise it waits for sign-off.",
};

const CLOSED_COMPOSER: ComposerState = {
  open: false,
  editingId: null,
  presetDate: null,
};

function statusBucket(status: RealPostStatus): ContentStatus {
  if (status === "DRAFT" || status === "CHANGES_REQUESTED") return "DRAFT";
  if (status === "PENDING_REVIEW" || status === "APPROVED") return "READY";
  return "SCHEDULED";
}

const REAL_STATUS_META: Record<RealPostStatus, { label: string; hue: string }> = {
  DRAFT: { label: "Draft", hue: "var(--text-muted)" },
  PENDING_REVIEW: { label: "Pending review", hue: "#D97706" },
  CHANGES_REQUESTED: { label: "Changes requested", hue: "#DC2626" },
  APPROVED: { label: "Approved", hue: "#059669" },
  SCHEDULED: { label: "Scheduled", hue: "var(--accent)" },
  PUBLISHING: { label: "Publishing…", hue: "var(--accent)" },
  PUBLISHED: { label: "Published", hue: "#059669" },
  PARTIALLY_PUBLISHED: { label: "Partially published", hue: "#D97706" },
  FAILED: { label: "Failed", hue: "#DC2626" },
  CANCELLED: { label: "Cancelled", hue: "var(--text-subtle)" },
};

/** Per-destination status, independent of the post's own overall
 *  status — a multi-platform post can have one PUBLISHED target and one
 *  FAILED target at the same time (see reconcilePostStatus server-side). */
const TARGET_STATUS_META: Record<TargetStatus, { label: string; hue: string }> = {
  PENDING: { label: "Not yet scheduled", hue: "var(--text-subtle)" },
  SCHEDULED: { label: "Scheduled", hue: "var(--accent)" },
  PUBLISHING: { label: "Publishing…", hue: "var(--accent)" },
  PUBLISHED: { label: "Published", hue: "#059669" },
  FAILED: { label: "Failed", hue: "#DC2626" },
  CANCELLED: { label: "Cancelled", hue: "var(--text-subtle)" },
};

/** Statuses where the post has already been handed to the scheduler. */
const POST_SCHEDULE_STATES: RealPostStatus[] = [
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "PARTIALLY_PUBLISHED",
];

/* Shared class strings -------------------------------------------------------- */

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";

const FOCUS_INSET =
  "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]";

const CARD =
  "rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

const BTN_PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[11.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_-10px_var(--accent)] transition-[filter,transform,opacity] duration-150 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const BTN_SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-[11.5px] font-semibold text-[var(--text)] transition-[background-color,transform,opacity] duration-150 hover:bg-[var(--surface-muted)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const BTN_DANGER =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-[11.5px] font-semibold text-white transition-[background-color,transform,opacity] duration-150 hover:bg-red-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

const ACCENT_SOFT =
  "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]";

const INPUT =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[12px] text-[var(--text)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_14%,transparent)]";

const LABEL = "mb-1.5 block text-[11px] font-semibold text-[var(--text)]";

const BTN_COMPACT = "h-8 rounded-lg px-2.5 text-[11px]";

const OVERLAY_BTN =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-black/60 px-2.5 text-[10.5px] font-semibold text-white transition hover:bg-black/75 outline-none focus-visible:ring-2 focus-visible:ring-white";

const IMAGE_MAX_EDGE = 1440;
const IMAGE_MAX_BYTES = 15 * 1024 * 1024;

/* Motion. Only transform and opacity animate, so everything stays on the
   compositor and nothing janks while scrolling. Enter animations use
   `backwards` fill so inline transforms (swipe-to-close) still apply once
   the animation has finished. */
const SG_STYLES = `
@keyframes sg-rise { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes sg-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sg-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes sg-pop { from { opacity: 0; transform: translateY(-4px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes sg-view { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes sg-sheet-in { from { transform: translateY(100%); } to { transform: none; } }
@keyframes sg-sheet-out { from { transform: none; } to { transform: translateY(100%); } }
@keyframes sg-dialog-in { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes sg-dialog-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(8px) scale(.98); } }
@keyframes sg-toast-out { to { opacity: 0; transform: translateY(10px) scale(.97); } }
@keyframes sg-flash {
  0%, 35% { box-shadow: inset 0 0 0 1.5px var(--accent); background-color: color-mix(in srgb, var(--accent) 7%, transparent); }
  100% { box-shadow: inset 0 0 0 1.5px transparent; background-color: transparent; }
}
@keyframes sg-shake { 0%, 100% { transform: none; } 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
@keyframes sg-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

.sg-rise { animation: sg-rise .22s cubic-bezier(.2,.8,.2,1) both; }
.sg-fade { animation: sg-fade .16s ease-out both; }
.sg-backdrop-out { animation: sg-fade-out .19s ease-in both; }
.sg-pop { animation: sg-pop .14s ease-out both; transform-origin: top right; }
.sg-view { animation: sg-view .22s cubic-bezier(.2,.8,.2,1) backwards; }
.sg-dialog { animation: sg-sheet-in .32s cubic-bezier(.32,.72,0,1) backwards; will-change: transform; }
.sg-dialog.is-leaving { animation: sg-sheet-out .19s cubic-bezier(.4,0,1,1) forwards; }
@media (min-width: 640px) {
  .sg-dialog { animation: sg-dialog-in .22s cubic-bezier(.2,.8,.2,1) backwards; }
  .sg-dialog.is-leaving { animation: sg-dialog-out .16s ease-in forwards; }
}
.sg-toast-out { animation: sg-toast-out .17s ease-in forwards; }
.sg-flash { animation: sg-flash 1.7s ease-out; }
.sg-shake { animation: sg-shake .34s ease-in-out; }
.sg-skeleton {
  background: linear-gradient(90deg, var(--surface-muted) 0%, color-mix(in srgb, var(--surface-muted) 45%, var(--surface)) 50%, var(--surface-muted) 100%);
  background-size: 200% 100%;
  animation: sg-shimmer 1.3s ease-in-out infinite;
}
.sg-scroll { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--text) 18%, transparent) transparent; -webkit-overflow-scrolling: touch; }
.sg-noscrollbar { scrollbar-width: none; }
.sg-noscrollbar::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: reduce) {
  .sg-rise, .sg-fade, .sg-pop, .sg-view, .sg-dialog, .sg-flash, .sg-shake, .sg-backdrop-out, .sg-toast-out { animation-duration: 1ms !important; }
  .sg-skeleton { animation: none; }
}
`;

/* =============================================================================
   HELPERS
============================================================================= */

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function mix(color: string, percent: number, base = "transparent") {
  return `color-mix(in srgb, ${color} ${percent}%, ${base})`;
}

function nowMs() {
  return Date.now();
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!isValidDate(date)) return "Unknown date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!isValidDate(date)) return "Unknown date";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (!isValidDate(date)) return "--:--";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

const RELATIVE = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

function relativeTime(value: string) {
  const diff = new Date(value).getTime() - nowMs();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return "just now";
  if (abs < hour) return RELATIVE.format(Math.round(diff / minute), "minute");
  if (abs < day) return RELATIVE.format(Math.round(diff / hour), "hour");
  if (abs < 7 * day) return RELATIVE.format(Math.round(diff / day), "day");
  return RELATIVE.format(Math.round(diff / (7 * day)), "week");
}

function editedLabel(value: string) {
  const diff = Math.abs(new Date(value).getTime() - nowMs());
  return diff < 7 * 24 * 60 * 60_000
    ? `Edited ${relativeTime(value)}`
    : `Edited ${formatDate(value)}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dayLabel(date: Date) {
  const diff = Math.round(
    (startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86_400_000,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date);
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function keyToDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function localDateTimeValue(date: Date) {
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function nextFullHour() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date;
}

function quickSlots() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const daysToMonday = (8 - now.getDay()) % 7 || 7;
  const monday = new Date(y, m, d + daysToMonday, 9, 0);
  const inOneHour = nextFullHour();

  return [
    { label: `${dayLabel(inOneHour)}, ${formatTime(inOneHour.toISOString())}`, value: localDateTimeValue(inOneHour) },
    { label: "Tomorrow, 09:00", value: localDateTimeValue(new Date(y, m, d + 1, 9, 0)) },
    { label: "Tomorrow, 18:00", value: localDateTimeValue(new Date(y, m, d + 1, 18, 0)) },
    {
      label: `${new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(monday)}, 09:00`,
      value: localDateTimeValue(monday),
    },
  ];
}

function futureTimeError(value: string) {
  if (!value) return "Choose a date and time.";
  const date = new Date(value);
  if (!isValidDate(date) || date.getTime() <= nowMs()) return "Choose a time in the future.";
  return null;
}

function truncate(text: string, length: number) {
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

function platformDefinition(platform: SocialPlatform) {
  return PLATFORMS.find((item) => item.id === platform)!;
}

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: preference just won't persist */
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/* Hooks ------------------------------------------------------------------------ */

/** Locks page scroll without the layout jump caused by the scrollbar vanishing. */
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };

    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
    };
  }, [active]);
}

/** Keeps Tab focus inside a dialog and returns focus to the trigger on close. */
function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previous = document.activeElement as HTMLElement | null;
    const selector =
      'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([tabindex="-1"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => element.offsetParent !== null && !element.closest("[data-collapsed='true']"),
      );
      if (items.length === 0) return;
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

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [ref, active]);
}

/* =============================================================================
   API CLIENT

   Talks to the permission-enforced, database-backed Social Media API
   (app/api/admin/social-media/**). Only the layout and banner preferences
   live in localStorage.
============================================================================= */

const API_BASE = "/api/admin/social-media";

class ApiRequestError extends Error {}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: isFormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new ApiRequestError(payload?.error || `Request failed (${response.status}).`);
  }

  return payload as T;
}

type ApiAccountRef = { id: string; platform: SocialPlatform; accountName: string; username: string | null; status: string };

type ApiAsset = {
  id: string;
  url: string;
  cloudinaryPublicId: string;
  type: "IMAGE" | "VIDEO";
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  createdAt: string;
};

type ApiPost = {
  id: string;
  title: string | null;
  caption: string;
  category: string | null;
  campaignId: string | null;
  status: RealPostStatus;
  reviewNotes: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  targets: Array<{
    accountId: string;
    platform: SocialPlatform;
    caption: string | null;
    placement: InstagramPlacement;
    status: TargetStatus;
    remotePostUrl: string | null;
    lastError: string | null;
    publishedAt: string | null;
    account: ApiAccountRef;
  }>;
  assets: Array<{ assetId: string; position: number; asset: ApiAsset }>;
};

function fromApiPost(api: ApiPost): SocialPost {
  const targets: PostTarget[] = api.targets.map((target) => ({
    accountId: target.accountId,
    platform: target.platform,
    caption: target.caption,
    placement: target.placement,
    status: target.status,
    remotePostUrl: target.remotePostUrl,
    lastError: target.lastError,
    publishedAt: target.publishedAt,
    account: target.account,
  }));

  const sortedAssets = [...api.assets].sort((a, b) => a.position - b.position);

  return {
    id: api.id,
    title: api.title,
    caption: api.caption,
    category: api.category,
    campaignId: api.campaignId,
    platforms: Array.from(new Set(targets.map((target) => target.platform))),
    targets,
    status: statusBucket(api.status),
    realStatus: api.status,
    reviewNotes: api.reviewNotes,
    scheduledAt: api.scheduledAt,
    image: sortedAssets[0]?.asset.url ?? null,
    imageType: sortedAssets[0]?.asset.type ?? null,
    assetIds: sortedAssets.map((item) => item.assetId),
    createdAt: api.createdAt,
    updatedAt: api.updatedAt,
  };
}

type CreatePostPayload = {
  title: string | null;
  caption: string;
  category: string | null;
  campaignId: string | null;
  targets: { accountId: string; caption: string | null; placement?: InstagramPlacement }[];
  assetIds: string[];
};

async function fetchPostsApi(): Promise<SocialPost[]> {
  const payload = await apiRequest<{ posts: ApiPost[] }>("/posts?pageSize=100");
  return payload.posts.map(fromApiPost);
}

async function createPostApi(input: CreatePostPayload): Promise<SocialPost> {
  const payload = await apiRequest<{ post: ApiPost }>("/posts", { method: "POST", body: JSON.stringify(input) });
  return fromApiPost(payload.post);
}

async function updatePostApi(id: string, input: Partial<CreatePostPayload>): Promise<SocialPost> {
  const payload = await apiRequest<{ post: ApiPost }>(`/posts/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  return fromApiPost(payload.post);
}

async function deletePostApi(id: string): Promise<void> {
  await apiRequest(`/posts/${id}`, { method: "DELETE" });
}

async function duplicatePostApi(id: string): Promise<SocialPost> {
  const payload = await apiRequest<{ post: ApiPost }>(`/posts/${id}/duplicate`, { method: "POST" });
  return fromApiPost(payload.post);
}

async function submitPostApi(id: string): Promise<SocialPost> {
  const payload = await apiRequest<{ post: ApiPost }>(`/posts/${id}/submit`, { method: "POST" });
  return fromApiPost(payload.post);
}

async function approvePostApi(id: string): Promise<SocialPost> {
  const payload = await apiRequest<{ post: ApiPost }>(`/posts/${id}/approve`, { method: "POST" });
  return fromApiPost(payload.post);
}

async function requestChangesApi(id: string, notes: string): Promise<SocialPost> {
  const payload = await apiRequest<{ post: ApiPost }>(`/posts/${id}/request-changes`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
  return fromApiPost(payload.post);
}

async function schedulePostApi(id: string, scheduledAtIso: string): Promise<SocialPost> {
  const payload = await apiRequest<{ post: ApiPost }>(`/posts/${id}/schedule`, {
    method: "POST",
    body: JSON.stringify({ scheduledAt: scheduledAtIso }),
  });
  return fromApiPost(payload.post);
}

async function cancelPostApi(id: string): Promise<SocialPost> {
  const payload = await apiRequest<{ post: ApiPost }>(`/posts/${id}/cancel`, { method: "POST" });
  return fromApiPost(payload.post);
}

type PublishNowResult = { id: string; ok: boolean; skipped?: boolean; error?: string };

async function publishNowApi(id: string): Promise<{ post: SocialPost; results: PublishNowResult[] }> {
  const payload = await apiRequest<{ post: ApiPost; results: PublishNowResult[] }>(`/posts/${id}/publish-now`, {
    method: "POST",
  });
  return { post: fromApiPost(payload.post), results: payload.results };
}

type ApiAccount = {
  id: string;
  platform: SocialPlatform;
  accountName: string;
  username: string | null;
  profileImageUrl: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "EXPIRED" | "ERROR";
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  disconnectedAt: string | null;
};

type ApiPlatformRow = {
  platform: SocialPlatform;
  label: string;
  configured: boolean;
  requiredEnvVars: string[];
  accounts: ApiAccount[];
};

type SocialMediaPermissions = { canCreate: boolean; canEdit: boolean; canApprove: boolean; canManage: boolean };

const NO_PERMISSIONS: SocialMediaPermissions = { canCreate: false, canEdit: false, canApprove: false, canManage: false };

async function fetchAccountsApi(): Promise<{ platforms: ApiPlatformRow[]; permissions: SocialMediaPermissions }> {
  return apiRequest<{ platforms: ApiPlatformRow[]; permissions: SocialMediaPermissions }>("/accounts");
}

async function disconnectAccountApi(id: string): Promise<void> {
  await apiRequest(`/accounts/${id}/disconnect`, { method: "POST" });
}

async function uploadMediaAsset(blob: Blob, filename: string): Promise<ApiAsset> {
  const body = new FormData();
  body.append("file", blob, filename);
  const payload = await apiRequest<{ asset: ApiAsset }>("/media/upload", { method: "POST", body });
  return payload.asset;
}

async function fetchMediaAssets(): Promise<ApiAsset[]> {
  const payload = await apiRequest<{ assets: ApiAsset[] }>("/media?pageSize=60");
  return payload.assets;
}

type ApiBrandAssetOption = {
  id: string;
  name: string;
  type: "IMAGE" | "VIDEO" | "SVG" | "DOCUMENT" | "PRESENTATION" | "DESIGN_FILE" | "FONT" | "OTHER";
  url: string;
  usageRights: "INTERNAL_ONLY" | "CLIENT_APPROVED" | "PUBLIC" | "UNRESTRICTED";
  brandKit: { id: string; name: string } | null;
};

/** A separate base — Brand Assets is its own module/API, not Social
 *  Media's. This only ever reads (VIEW), so a plain fetch is enough;
 *  the heavier apiRequest helper above is scoped to API_BASE. */
async function fetchApprovedBrandAssetsApi(): Promise<ApiBrandAssetOption[]> {
  const response = await fetch("/api/admin/brand-assets/assets?status=ACTIVE&pageSize=60", {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) return [];
  const assets: ApiBrandAssetOption[] = payload.assets ?? [];
  // Only image/video brand assets are postable — Instagram/LinkedIn's
  // real publish APIs don't accept SVGs, documents or fonts as media.
  // Internal-only assets are excluded too — the server enforces this at
  // reuse time regardless, but hiding them here avoids a confusing pick-
  // then-reject round trip. See reuseBrandAssetAsSocialMediaAsset.
  return assets.filter(
    (asset) => (asset.type === "IMAGE" || asset.type === "VIDEO") && asset.usageRights !== "INTERNAL_ONLY",
  );
}

/** Reuses an approved Brand Asset's existing Cloudinary file as a real
 *  SocialMediaAsset — never re-uploads it. See
 *  lib/social-media/media.ts#reuseBrandAssetAsSocialMediaAsset. */
async function reuseBrandAssetApi(brandAssetId: string): Promise<ApiAsset> {
  const payload = await apiRequest<{ asset: ApiAsset }>("/media/from-brand-asset", {
    method: "POST",
    body: JSON.stringify({ brandAssetId }),
  });
  return payload.asset;
}

type ApiCampaign = { id: string; name: string; status: string; _count?: { posts: number } };

async function fetchCampaignsApi(): Promise<ApiCampaign[]> {
  const payload = await apiRequest<{ campaigns: ApiCampaign[] }>("/campaigns?pageSize=100");
  return payload.campaigns;
}

async function createCampaignApi(name: string): Promise<ApiCampaign> {
  const payload = await apiRequest<{ campaign: ApiCampaign }>("/campaigns", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return payload.campaign;
}

type ApiAnalytics = {
  postsByStatus: Record<string, number>;
  connectedAccounts: number;
  hasMetrics: boolean;
  totals: Record<string, number> | null;
};

async function fetchAnalyticsApi(): Promise<ApiAnalytics> {
  return apiRequest<ApiAnalytics>("/analytics");
}

type ApiActivityItem = {
  id: string;
  postId: string;
  type: string;
  description: string | null;
  createdAt: string;
  actor: { id: string; firstName: string | null; lastName: string | null } | null;
  post: { id: string; title: string | null; caption: string };
};

async function fetchActivityApi(postId?: string): Promise<ApiActivityItem[]> {
  const payload = await apiRequest<{ activity: ApiActivityItem[] }>(postId ? `/activity?postId=${postId}` : "/activity");
  return payload.activity;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load"));
    img.src = src;
  });
}

/** Resizes and re-encodes as JPEG before upload, to keep uploads fast. */
async function prepareImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file: JPG, PNG, WebP or GIF.");
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error("That image is over 15 MB. Choose a smaller one.");
  }

  const url = URL.createObjectURL(file);
  try {
    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
    } catch {
      throw new Error("That image couldn't be read. Try a JPG or PNG instead.");
    }
    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error("That image couldn't be read. Try a JPG or PNG instead.");
    }

    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser couldn't process that image.");

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.isContentEditable ||
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT"
  );
}

/* Form helpers ----------------------------------------------------------------- */

function formFromPost(post: SocialPost | null, presetDate: string | null): PostForm {
  return {
    title: post?.title ?? "",
    caption: post?.caption ?? "",
    category: post?.category ?? "",
    campaignId: post?.campaignId ?? null,
    platforms: post?.platforms ?? [],
    platformCaptions: Object.fromEntries(
      (post?.targets ?? [])
        .filter((target) => target.caption)
        .map((target) => [target.platform, target.caption as string]),
    ),
    status: post?.status ?? (presetDate ? "SCHEDULED" : "DRAFT"),
    scheduledAt: post?.scheduledAt
      ? localDateTimeValue(new Date(post.scheduledAt))
      : presetDate ?? "",
    image: post?.image ?? null,
    imageType: post?.imageType ?? null,
    assetIds: post?.assetIds ?? [],
    instagramPlacement:
      post?.targets.find((target) => target.platform === "INSTAGRAM")?.placement ?? "FEED",
  };
}

/** Whitespace-insensitive fingerprint so stray spaces never count as edits. */
function formSignature(form: PostForm) {
  const captions = Object.entries(form.platformCaptions)
    .map(([platform, text]) => [platform, (text ?? "").trim()] as const)
    .filter(([, text]) => text !== "")
    .sort(([a], [b]) => a.localeCompare(b));

  return JSON.stringify({
    title: form.title.trim(),
    caption: form.caption.trim(),
    category: form.category.trim(),
    campaignId: form.campaignId,
    platforms: form.platforms,
    captions,
    status: form.status,
    scheduledAt: form.status === "SCHEDULED" ? form.scheduledAt : "",
    assetIds: form.assetIds,
    instagramPlacement: form.platforms.includes("INSTAGRAM") ? form.instagramPlacement : "",
  });
}

/** For a brand-new post, only real content counts as something to lose. */
function hasContent(form: PostForm) {
  return (
    form.caption.trim() !== "" ||
    form.title.trim() !== "" ||
    form.assetIds.length > 0 ||
    Object.values(form.platformCaptions).some((text) => (text ?? "").trim() !== "")
  );
}

/* =============================================================================
   MAIN COMPONENT
============================================================================= */

export default function SocialMediaTab() {
  const [view, setView] = useState<WorkspaceView>("content");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [postsStatus, setPostsStatus] = useState<LoadStatus>("loading");
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [accounts, setAccounts] = useState<ApiPlatformRow[]>([]);
  const [permissions, setPermissions] = useState<SocialMediaPermissions>(NO_PERMISSIONS);
  const [accountsStatus, setAccountsStatus] = useState<LoadStatus>("loading");
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [composer, setComposer] = useState<ComposerState>(CLOSED_COMPOSER);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentFilter>("ALL");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("ALL");
  const [layout, setLayout] = useState<LibraryLayout>("list");
  const [bannerOpen, setBannerOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  /* Notifications ------------------------------------------------------------ */

  const notify = useCallback((message: string, action?: Notice["action"]) => {
    setNotice({ id: nowMs(), message, tone: "success", action });
  }, []);

  const notifyError = useCallback((error: unknown, fallback: string) => {
    setNotice({ id: nowMs(), message: errorMessage(error, fallback), tone: "error" });
  }, []);

  useEffect(() => {
    if (!highlightId) return;
    const timeout = window.setTimeout(() => setHighlightId(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [highlightId]);

  /* Real data ---------------------------------------------------------------- */

  const refreshPosts = useCallback(() => {
    setPostsStatus("loading");
    fetchPostsApi()
      .then((result) => {
        setPosts(result);
        setPostsStatus("ready");
        setPostsLoaded(true);
      })
      .catch((error) => {
        setPostsStatus("error");
        notifyError(error, "Unable to load posts.");
      });
  }, [notifyError]);

  const refreshAccounts = useCallback(() => {
    setAccountsStatus("loading");
    fetchAccountsApi()
      .then((result) => {
        setAccounts(result.platforms);
        setPermissions(result.permissions);
        setAccountsStatus("ready");
      })
      .catch((error) => {
        setAccountsStatus("error");
        notifyError(error, "Unable to load accounts.");
      });
  }, [notifyError]);

  useEffect(() => {
    refreshPosts();
    refreshAccounts();
    fetchCampaignsApi().then(setCampaigns).catch(() => undefined);

    setBannerOpen(readFlag(BANNER_KEY) !== "dismissed");
    setLayout(readFlag(LAYOUT_KEY) === "grid" ? "grid" : "list");
    setLoaded(true);
  }, [refreshPosts, refreshAccounts]);

  // Connecting an account redirects back here with ?social=connected etc.
  useEffect(() => {
    if (!loaded) return;
    const params = new URLSearchParams(window.location.search);
    const socialStatus = params.get("social");
    if (!socialStatus) return;

    refreshAccounts();
    setView("accounts");

    const messages: Record<string, string> = {
      connected: "Account connected.",
      access_denied: "Connection cancelled.",
      invalid_state: "Connection could not be verified. Please try again.",
      invalid_session: "Your session changed during connection. Please try again.",
      connection_failed: "Could not connect that account.",
      not_configured: "That platform is not configured yet on this server.",
      not_authorised: "You are not authorised to manage social accounts.",
      invalid_platform: "Unknown platform.",
    };

    setNotice({
      id: nowMs(),
      message: messages[socialStatus] ?? "Connection finished.",
      tone: socialStatus === "connected" ? "success" : "error",
    });

    const url = new URL(window.location.href);
    url.searchParams.delete("social");
    url.searchParams.delete("platform");
    url.searchParams.delete("missing");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [loaded, refreshAccounts]);

  const connectedAccountsByPlatform = useMemo(() => {
    const map = new Map<SocialPlatform, ApiAccount[]>();
    for (const row of accounts) {
      map.set(row.platform, row.accounts.filter((account) => account.status === "CONNECTED"));
    }
    return map;
  }, [accounts]);

  const totalConnectedAccounts = useMemo(
    () => accounts.reduce((sum, row) => sum + row.accounts.filter((account) => account.status === "CONNECTED").length, 0),
    [accounts],
  );

  /* Derived ------------------------------------------------------------------ */

  const counts = useMemo<Counts>(
    () => ({
      total: posts.length,
      DRAFT: posts.filter((post) => post.status === "DRAFT").length,
      READY: posts.filter((post) => post.status === "READY").length,
      SCHEDULED: posts.filter((post) => post.status === "SCHEDULED").length,
    }),
    [posts],
  );

  const filteredPosts = useMemo(() => {
    const term = query.trim().toLowerCase();

    return posts
      .filter((post) => {
        if (statusFilter !== "ALL" && post.status !== statusFilter) return false;
        if (platformFilter !== "ALL" && !post.platforms.includes(platformFilter)) return false;
        if (!term) return true;
        return (
          post.caption.toLowerCase().includes(term) ||
          (post.title?.toLowerCase().includes(term) ?? false) ||
          post.platforms.some((platform) =>
            platformDefinition(platform).name.toLowerCase().includes(term),
          )
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [posts, query, statusFilter, platformFilter]);

  const nextScheduled = useMemo(() => {
    const now = nowMs();
    return (
      posts
        .filter(
          (post) =>
            post.realStatus === "SCHEDULED" &&
            post.scheduledAt &&
            new Date(post.scheduledAt).getTime() > now,
        )
        .sort(
          (a, b) =>
            new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
        )[0] ?? null
    );
  }, [posts]);

  /* Actions ------------------------------------------------------------------ */

  const upsertPost = useCallback((post: SocialPost) => {
    setPosts((current) =>
      current.some((item) => item.id === post.id)
        ? current.map((item) => (item.id === post.id ? post : item))
        : [post, ...current],
    );
  }, []);

  const openCreate = useCallback((presetDate: string | null = null) => {
    setComposer({ open: true, editingId: null, presetDate });
  }, []);

  const openEdit = useCallback((id: string) => {
    setComposer({ open: true, editingId: id, presetDate: null });
  }, []);

  const closeComposer = useCallback(() => setComposer(CLOSED_COMPOSER), []);

  /** Saves the post, then runs whatever workflow step the chosen status needs.
   *  Returns an error message to show in the composer, or null on success.
   *  The composer handles its own close animation after a successful save. */
  const savePost = useCallback(
    async (form: PostForm, editingId: string | null): Promise<string | null> => {
      const targets: CreatePostPayload["targets"] = [];
      for (const platform of form.platforms) {
        const account = connectedAccountsByPlatform.get(platform)?.[0];
        if (!account) continue;
        targets.push({
          accountId: account.id,
          caption: form.platformCaptions[platform]?.trim() || null,
          ...(platform === "INSTAGRAM" ? { placement: form.instagramPlacement } : {}),
        });
      }

      const payload: CreatePostPayload = {
        title: form.title.trim() || null,
        caption: form.caption.trim(),
        category: form.category.trim() || null,
        campaignId: form.campaignId,
        targets,
        assetIds: form.assetIds,
      };

      let current: SocialPost;
      try {
        current = editingId ? await updatePostApi(editingId, payload) : await createPostApi(payload);
      } catch (error) {
        return errorMessage(error, "Unable to save this post.");
      }
      upsertPost(current);

      const savedLabel = editingId ? "Changes saved" : "Draft saved";
      let message = savedLabel;

      try {
        const needsSubmit = current.realStatus === "DRAFT" || current.realStatus === "CHANGES_REQUESTED";

        if (form.status === "READY" && needsSubmit) {
          current = await submitPostApi(current.id);
          upsertPost(current);
          message = "Submitted for review";
        }

        if (form.status === "SCHEDULED" && form.scheduledAt) {
          const iso = new Date(form.scheduledAt).toISOString();
          const sameTime =
            current.scheduledAt !== null &&
            localDateTimeValue(new Date(current.scheduledAt)) === form.scheduledAt;
          const alreadyHandled = POST_SCHEDULE_STATES.includes(current.realStatus) && sameTime;

          if (!alreadyHandled) {
            if (current.realStatus === "DRAFT" || current.realStatus === "CHANGES_REQUESTED") {
              current = await submitPostApi(current.id);
              upsertPost(current);
            }

            // Approval is permission-checked on the server. If this person
            // can't approve, the post stays in review rather than failing.
            if (current.realStatus === "PENDING_REVIEW") {
              try {
                current = await approvePostApi(current.id);
                upsertPost(current);
              } catch {
                notify("Submitted for review. It can be scheduled once it's approved.");
                setHighlightId(current.id);
                return null;
              }
            }

            if (current.realStatus === "APPROVED" || current.realStatus === "SCHEDULED") {
              current = await schedulePostApi(current.id, iso);
              upsertPost(current);
              message = `Scheduled for ${formatDateTime(iso)}`;
            }
          }
        }
      } catch (error) {
        // The post itself is saved; only the follow-up step failed.
        setNotice({
          id: nowMs(),
          tone: "error",
          message: `${savedLabel}, but ${errorMessage(error, "the next step couldn't be completed").replace(/^\w/, (c) => c.toLowerCase())}`,
        });
        setHighlightId(current.id);
        return null;
      }

      notify(message);
      setHighlightId(current.id);
      return null;
    },
    [connectedAccountsByPlatform, notify, notifyError, upsertPost],
  );

  const deletePost = useCallback(
    (id: string) => {
      setDialog({
        title: "Delete this post?",
        description: "It's removed from the pipeline and the calendar. This can't be undone.",
        confirmLabel: "Delete post",
        tone: "danger",
        onConfirm: async () => {
          await deletePostApi(id);
          setPosts((current) => current.filter((post) => post.id !== id));
          notify("Post deleted");
        },
      });
    },
    [notify],
  );

  const duplicatePost = useCallback(
    async (id: string) => {
      try {
        const duplicate = await duplicatePostApi(id);
        upsertPost(duplicate);
        setHighlightId(duplicate.id);
        notify("Duplicated as a draft", { label: "Open", run: () => openEdit(duplicate.id) });
      } catch (error) {
        notifyError(error, "Unable to duplicate this post.");
      }
    },
    [notify, notifyError, openEdit, upsertPost],
  );

  const runWorkflowAction = useCallback(
    async (id: string, action: (id: string) => Promise<SocialPost>, successMessage: string) => {
      try {
        const updated = await action(id);
        upsertPost(updated);
        notify(successMessage);
        return true;
      } catch (error) {
        notifyError(error, "That action could not be completed.");
        return false;
      }
    },
    [notify, notifyError, upsertPost],
  );

  const submitForReview = useCallback((id: string) => runWorkflowAction(id, submitPostApi, "Submitted for review"), [runWorkflowAction]);
  const approvePostAction = useCallback((id: string) => runWorkflowAction(id, approvePostApi, "Approved"), [runWorkflowAction]);
  const cancelPostAction = useCallback((id: string) => runWorkflowAction(id, cancelPostApi, "Post cancelled"), [runWorkflowAction]);

  const requestChangesAction = useCallback(
    (id: string, notes: string) =>
      runWorkflowAction(id, (postId) => requestChangesApi(postId, notes), "Changes requested"),
    [runWorkflowAction],
  );

  const schedulePostAction = useCallback(
    (id: string, scheduledAtLocal: string) => {
      const iso = new Date(scheduledAtLocal).toISOString();
      return runWorkflowAction(id, (postId) => schedulePostApi(postId, iso), `Scheduled for ${formatDateTime(iso)}`);
    },
    [runWorkflowAction],
  );

  // Not routed through runWorkflowAction — the message depends on each
  // target's own result (a multi-platform post can partially fail), not
  // a single static success string.
  const publishNowAction = useCallback(
    async (id: string) => {
      try {
        const { post: updated, results } = await publishNowApi(id);
        upsertPost(updated);

        const attempted = results.filter((result) => !result.skipped);
        const succeeded = attempted.filter((result) => result.ok).length;
        const failed = attempted.filter((result) => !result.ok).length;

        if (attempted.length === 0) {
          notify("Nothing left to publish — every destination already succeeded.");
        } else if (failed === 0) {
          notify(succeeded === 1 ? "Published." : `Published to all ${succeeded} destinations.`);
        } else if (succeeded > 0) {
          notify(`Published to ${succeeded} of ${attempted.length} destinations — ${failed} failed. See below for details.`);
        } else {
          notifyError(new Error("Every destination failed to publish — see below for details."), "Publishing failed.");
        }

        return true;
      } catch (error) {
        notifyError(error, "Unable to publish this post.");
        return false;
      }
    },
    [notify, notifyError, upsertPost],
  );

  const createCampaign = useCallback(async (name: string) => {
    const campaign = await createCampaignApi(name);
    setCampaigns((prev) => [...prev, campaign]);
    return campaign;
  }, []);

  const disconnectAccount = useCallback(
    (account: ApiAccount) => {
      setDialog({
        title: `Disconnect ${account.accountName}?`,
        description: "Scheduled posts for this account won't publish until it's connected again.",
        confirmLabel: "Disconnect",
        tone: "danger",
        onConfirm: async () => {
          await disconnectAccountApi(account.id);
          refreshAccounts();
          notify("Account disconnected");
        },
      });
    },
    [notify, refreshAccounts],
  );

  const clearFilters = useCallback(() => {
    setQuery("");
    setStatusFilter("ALL");
    setPlatformFilter("ALL");
  }, []);

  const changeLayout = useCallback((next: LibraryLayout) => {
    setLayout(next);
    writeFlag(LAYOUT_KEY, next);
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerOpen(false);
    writeFlag(BANNER_KEY, "dismissed");
  }, []);

  /* Keyboard shortcuts: N = new post, / = search ---------------------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (composer.open || dialog || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        openCreate();
      }

      if (event.key === "/" && view === "content") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [composer.open, dialog, openCreate, view]);

  /* Sliding tab indicator ----------------------------------------------------- */

  const tabRefs = useRef<Partial<Record<WorkspaceView, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const [indicatorReady, setIndicatorReady] = useState(false);

  useIsoLayoutEffect(() => {
    const measure = () => {
      const element = tabRefs.current[view];
      if (element) setIndicator({ left: element.offsetLeft, width: element.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view, counts.total, counts.SCHEDULED]);

  useEffect(() => {
    if (!indicator || indicatorReady) return;
    const frame = window.requestAnimationFrame(() => setIndicatorReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, [indicator, indicatorReady]);

  const editingPost = composer.editingId
    ? posts.find((post) => post.id === composer.editingId) ?? null
    : null;

  /* Render ------------------------------------------------------------------- */

  return (
    <div className="w-full min-w-0 space-y-6 pb-10">
      <style>{SG_STYLES}</style>

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-[-0.035em] text-[var(--text)] sm:text-[30px]">
            Social media
          </h1>
          <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-6 text-[var(--text-muted)]">
            Plan, write, review and schedule Syntra Grid&apos;s posts across every channel.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden -space-x-1.5 sm:flex" aria-hidden>
            {PLATFORMS.map((platform) => (
              <PlatformMark key={platform.id} platform={platform.id} size="md" ring />
            ))}
          </div>

          <button type="button" onClick={() => openCreate()} className={cx(BTN_PRIMARY, FOCUS)}>
            <Plus size={15} />
            Create post
            <Kbd inverse className="hidden sm:inline-flex">
              N
            </Kbd>
          </button>
        </div>
      </header>

      {/* Section tabs */}
      <nav className="flex items-end justify-between gap-4 border-b border-[var(--line)]">
        <div
          role="tablist"
          aria-label="Social media sections"
          className="sg-noscrollbar relative -mb-px flex min-w-0 gap-1 overflow-x-auto"
        >
          {NAVIGATION.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            const badge =
              item.id === "content"
                ? counts.total
                : item.id === "publishing"
                  ? counts.SCHEDULED
                  : 0;

            return (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[item.id] = node;
                }}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(item.id)}
                className={cx(
                  "inline-flex h-11 shrink-0 items-center gap-2 rounded-t-lg px-3 text-[12px] font-medium transition-colors duration-150",
                  FOCUS_INSET,
                  active ? "text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                <Icon
                  size={15}
                  className={cx("transition-colors duration-150", active && "text-[var(--accent)]")}
                />
                {item.label}
                {badge > 0 && (
                  <span
                    className={cx(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition-colors duration-150",
                      active ? ACCENT_SOFT : "bg-[var(--surface-muted)] text-[var(--text-muted)]",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}

          {indicator && (
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-0 h-[2px] rounded-full bg-[var(--accent)]"
              style={{
                width: indicator.width,
                transform: `translateX(${indicator.left}px)`,
                transition: indicatorReady
                  ? "transform .3s cubic-bezier(.2,.8,.2,1), width .3s cubic-bezier(.2,.8,.2,1)"
                  : "none",
              }}
            />
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            refreshPosts();
            refreshAccounts();
          }}
          className={cx(
            "mb-3.5 hidden shrink-0 items-center gap-1.5 rounded-md text-[10.5px] text-[var(--text-subtle)] transition hover:text-[var(--text)] md:inline-flex",
            FOCUS,
          )}
        >
          <RefreshCw
            size={11}
            className={postsStatus === "loading" || accountsStatus === "loading" ? "animate-spin" : undefined}
          />
          Refresh
        </button>
      </nav>

      {/* Info banner */}
      {bannerOpen && (
        <div className="sg-fade flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
          <Info size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <p className="min-w-0 flex-1 text-[11.5px] leading-5 text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text)]">
              {totalConnectedAccounts > 0
                ? `${totalConnectedAccounts} account${totalConnectedAccounts === 1 ? "" : "s"} connected.`
                : "No accounts connected yet."}
            </span>{" "}
            Posts, campaigns and media are saved to Syntra Grid&apos;s database. Scheduled posts
            publish automatically on channels with a connected account.
          </p>
          <IconButton label="Dismiss" onClick={dismissBanner} size="sm">
            <X size={13} />
          </IconButton>
        </div>
      )}

      {/* Views */}
      <div key={view} className="sg-view">
        {view === "content" && (
          <ContentStudio
            posts={filteredPosts}
            counts={counts}
            loading={!postsLoaded && postsStatus === "loading"}
            failed={!postsLoaded && postsStatus === "error"}
            highlightId={highlightId}
            nextScheduled={nextScheduled}
            query={query}
            statusFilter={statusFilter}
            platformFilter={platformFilter}
            layout={layout}
            searchRef={searchRef}
            onRetry={refreshPosts}
            onQueryChange={setQuery}
            onStatusFilterChange={setStatusFilter}
            onPlatformFilterChange={setPlatformFilter}
            onLayoutChange={changeLayout}
            onClearFilters={clearFilters}
            onCreate={() => openCreate()}
            onEdit={openEdit}
            onDuplicate={duplicatePost}
            onDelete={deletePost}
          />
        )}

        {view === "publishing" && (
          <PublishingWorkspace
            posts={posts}
            connectedAccounts={totalConnectedAccounts}
            onCreate={openCreate}
            onEdit={openEdit}
          />
        )}

        {view === "accounts" && (
          <AccountsWorkspace
            platforms={accounts}
            status={accountsStatus}
            onRefresh={refreshAccounts}
            onDisconnect={disconnectAccount}
          />
        )}

        {view === "engagement" && (
          <EngagementWorkspace
            connectedAccounts={totalConnectedAccounts}
            onGoToAccounts={() => setView("accounts")}
          />
        )}

        {view === "analytics" && <AnalyticsWorkspace />}
      </div>

      {/* Composer */}
      {composer.open && (
        <PostComposer
          key={composer.editingId ?? `new-${composer.presetDate ?? "blank"}`}
          post={editingPost}
          presetDate={composer.presetDate}
          campaigns={campaigns}
          connectedAccountsByPlatform={connectedAccountsByPlatform}
          onClose={closeComposer}
          onSave={savePost}
          onCreateCampaign={createCampaign}
          onSubmitForReview={submitForReview}
          onApprove={approvePostAction}
          onRequestChanges={requestChangesAction}
          onSchedulePost={schedulePostAction}
          onCancelPost={cancelPostAction}
          onPublishNow={publishNowAction}
          canPublishNow={permissions.canApprove || permissions.canManage}
        />
      )}

      {dialog && <ActionDialog request={dialog} onClose={() => setDialog(null)} />}

      {notice && <Toast key={notice.id} notice={notice} onDismiss={() => setNotice(null)} />}
    </div>
  );
}

/* =============================================================================
   TOAST
============================================================================= */

function Toast({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || leaving) return;
    const duration = notice.action ? 6000 : notice.tone === "error" ? 5200 : 3200;
    const timeout = window.setTimeout(() => setLeaving(true), duration);
    return () => window.clearTimeout(timeout);
  }, [notice, paused, leaving]);

  useEffect(() => {
    if (!leaving) return;
    const timeout = window.setTimeout(onDismiss, EXIT_MS);
    return () => window.clearTimeout(timeout);
  }, [leaving, onDismiss]);

  const isError = notice.tone === "error";

  return (
    <div className="fixed bottom-5 left-1/2 z-[200] w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 pb-[env(safe-area-inset-bottom)] sm:left-auto sm:right-6 sm:w-auto sm:min-w-[300px] sm:translate-x-0">
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className={cx(
          "flex items-center gap-3 rounded-2xl bg-[var(--text)] py-2.5 pl-4 pr-2.5 text-[11.5px] font-medium text-[var(--surface)] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.5)]",
          leaving ? "sg-toast-out" : "sg-rise",
        )}
      >
        {isError ? (
          <AlertCircle size={15} className="shrink-0 text-red-400" />
        ) : (
          <Check size={15} className="shrink-0 opacity-80" />
        )}
        <span className="min-w-0 flex-1 leading-5">{notice.message}</span>

        {notice.action && (
          <button
            type="button"
            onClick={() => {
              notice.action?.run();
              setLeaving(true);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[color-mix(in_srgb,var(--surface)_16%,transparent)] px-2.5 text-[11px] font-semibold transition hover:bg-[color-mix(in_srgb,var(--surface)_26%,transparent)]"
          >
            {notice.action.label === "Undo" && <Undo2 size={13} />}
            {notice.action.label}
          </button>
        )}

        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => setLeaving(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg opacity-60 transition hover:opacity-100"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* =============================================================================
   ACTION DIALOG (confirm / prompt)
============================================================================= */

function ActionDialog({ request, onClose }: { request: DialogRequest; onClose: () => void }) {
  const [value, setValue] = useState(request.input?.initial ?? "");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useFocusTrap(panelRef, true);
  useScrollLock(true);

  const danger = request.tone === "danger";
  const inputType = request.input?.type ?? "text";

  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(onClose, EXIT_MS);
  }, [onClose]);

  const dismiss = useCallback(() => {
    if (!busy && !leaving) close();
  }, [busy, leaving, close]);

  useEffect(() => {
    const target =
      textareaRef.current ?? inputRef.current ?? (danger ? cancelRef.current : confirmRef.current);
    target?.focus({ preventScroll: true });
  }, [danger]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      dismiss();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [dismiss]);

  const confirm = async () => {
    if (busy || leaving) return;
    const trimmed = value.trim();

    if (request.input?.required && !trimmed) {
      setError(`Add ${request.input.label.toLowerCase()} to continue.`);
      return;
    }
    const invalid = request.input?.validate?.(trimmed) ?? null;
    if (invalid) {
      setError(invalid);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await request.onConfirm(trimmed);
      if (result === false) {
        setBusy(false);
        return;
      }
      close();
    } catch (problem) {
      setBusy(false);
      setError(errorMessage(problem, "Something went wrong. Try again."));
    }
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
      className={cx(
        "fixed inset-0 z-[180] flex items-end justify-center bg-black/40 sm:items-center sm:p-6",
        leaving ? "sg-backdrop-out" : "sg-fade",
      )}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sg-action-dialog-title"
        className={cx(
          "sg-dialog w-full max-w-[420px] rounded-t-[24px] border border-[var(--line)] bg-[var(--surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.5)] sm:rounded-[22px] sm:pb-5",
          leaving && "is-leaving",
        )}
      >
        <div className="mx-auto -mt-1 mb-3 h-1 w-10 rounded-full bg-[var(--line)] sm:hidden" aria-hidden />

        <div className="flex items-start gap-3">
          {danger && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
              <AlertCircle size={17} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2
              id="sg-action-dialog-title"
              className="text-[15px] font-semibold tracking-[-0.015em] text-[var(--text)]"
            >
              {request.title}
            </h2>
            {request.description && (
              <p className="mt-1 text-[11.5px] leading-5 text-[var(--text-muted)]">
                {request.description}
              </p>
            )}
          </div>
        </div>

        {request.input && (
          <div className="mt-4">
            <label className="mb-1.5 block text-[11px] font-semibold text-[var(--text)]">
              {request.input.label}
            </label>
            {inputType === "textarea" ? (
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void confirm();
                  }
                }}
                placeholder={request.input.placeholder}
                rows={4}
                className={cx(INPUT, "resize-none p-3 leading-5")}
              />
            ) : (
              <input
                ref={inputRef}
                type={inputType}
                value={value}
                min={request.input.min}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void confirm();
                  }
                }}
                placeholder={request.input.placeholder}
                className={cx(INPUT, "h-11 px-3")}
              />
            )}
          </div>
        )}

        {error && (
          <p key={error} role="alert" className="sg-shake mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-red-600">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={dismiss}
            disabled={busy}
            className={cx(BTN_SECONDARY, FOCUS)}
          >
            {request.secondary ? "Keep editing" : "Cancel"}
          </button>
          {request.secondary && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                request.secondary?.run();
                close();
              }}
              className={cx(BTN_SECONDARY, FOCUS)}
            >
              {request.secondary.label}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            className={cx(danger ? BTN_DANGER : BTN_PRIMARY, FOCUS)}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   CONTENT STUDIO
============================================================================= */

function ContentStudio({
  posts,
  counts,
  loading,
  failed,
  highlightId,
  nextScheduled,
  query,
  statusFilter,
  platformFilter,
  layout,
  searchRef,
  onRetry,
  onQueryChange,
  onStatusFilterChange,
  onPlatformFilterChange,
  onLayoutChange,
  onClearFilters,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  posts: SocialPost[];
  counts: Counts;
  loading: boolean;
  failed: boolean;
  highlightId: string | null;
  nextScheduled: SocialPost | null;
  query: string;
  statusFilter: ContentFilter;
  platformFilter: PlatformFilter;
  layout: LibraryLayout;
  searchRef: RefObject<HTMLInputElement | null>;
  onRetry: () => void;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: ContentFilter) => void;
  onPlatformFilterChange: (value: PlatformFilter) => void;
  onLayoutChange: (value: LibraryLayout) => void;
  onClearFilters: () => void;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const filtering =
    query.trim() !== "" || statusFilter !== "ALL" || platformFilter !== "ALL";

  let body: ReactNode;
  if (loading) {
    body = <PostSkeleton layout={layout} />;
  } else if (failed) {
    body = (
      <EmptyState
        icon={AlertCircle}
        title="Posts couldn't be loaded"
        description="Check your connection, then try again."
        action={
          <button type="button" onClick={onRetry} className={cx(BTN_SECONDARY, FOCUS)}>
            <RefreshCw size={14} />
            Try again
          </button>
        }
      />
    );
  } else if (posts.length === 0) {
    body = (
      <EmptyState
        icon={filtering ? Search : Edit3}
        title={filtering ? "No posts match" : "Write your first post"}
        description={
          filtering
            ? "Try another search term, or clear the filters to see everything."
            : "Drafts, posts waiting for review and scheduled posts all collect here."
        }
        action={
          filtering ? (
            <button type="button" onClick={onClearFilters} className={cx(BTN_SECONDARY, FOCUS)}>
              Clear filters
            </button>
          ) : (
            <button type="button" onClick={onCreate} className={cx(BTN_PRIMARY, FOCUS)}>
              <Plus size={15} />
              Create post
            </button>
          )
        }
      />
    );
  } else if (layout === "list") {
    body = (
      <div className="divide-y divide-[var(--line)] [&>*:last-child]:rounded-b-[22px]">
        {posts.map((post) => (
          <PostRow
            key={post.id}
            post={post}
            highlighted={post.id === highlightId}
            onEdit={() => onEdit(post.id)}
            onDuplicate={() => onDuplicate(post.id)}
            onDelete={() => onDelete(post.id)}
          />
        ))}
      </div>
    );
  } else {
    body = (
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            highlighted={post.id === highlightId}
            onEdit={() => onEdit(post.id)}
            onDuplicate={() => onDuplicate(post.id)}
            onDelete={() => onDelete(post.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Pipeline
        counts={counts}
        loading={loading}
        active={statusFilter}
        onSelect={onStatusFilterChange}
        nextScheduled={nextScheduled}
        onOpen={onEdit}
        onCreate={onCreate}
      />

      <section className={CARD}>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--text)]">
              Posts
            </h2>
            <span className="text-[11px] tabular-nums text-[var(--text-subtle)]">
              {loading ? "" : filtering ? `${posts.length} of ${counts.total}` : counts.total}
            </span>
            {filtering && (
              <button
                type="button"
                onClick={onClearFilters}
                className={cx(
                  "sg-fade rounded-md text-[11px] font-medium text-[var(--accent)] hover:underline",
                  FOCUS,
                )}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[240px]">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]"
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    onQueryChange("");
                    event.currentTarget.blur();
                  }
                }}
                placeholder="Search posts"
                aria-label="Search posts"
                className={cx(INPUT, "h-9 bg-[var(--surface-muted)] pl-9 pr-9 text-[11.5px]")}
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => onQueryChange("")}
                  className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-[var(--text-subtle)] hover:text-[var(--text)]"
                >
                  <X size={12} />
                </button>
              ) : (
                <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">/</Kbd>
              )}
            </div>

            <Segmented label="Filter by channel">
              <SegmentButton
                active={platformFilter === "ALL"}
                onClick={() => onPlatformFilterChange("ALL")}
              >
                All
              </SegmentButton>
              {PLATFORMS.map((platform) => (
                <SegmentButton
                  key={platform.id}
                  active={platformFilter === platform.id}
                  onClick={() => onPlatformFilterChange(platform.id)}
                  title={platform.name}
                >
                  <PlatformMark platform={platform.id} size="xs" />
                  <span className="sr-only">{platform.name}</span>
                </SegmentButton>
              ))}
            </Segmented>

            <Segmented label="Layout">
              <SegmentButton
                active={layout === "list"}
                onClick={() => onLayoutChange("list")}
                title="List view"
              >
                <List size={14} />
                <span className="sr-only">List view</span>
              </SegmentButton>
              <SegmentButton
                active={layout === "grid"}
                onClick={() => onLayoutChange("grid")}
                title="Grid view"
              >
                <LayoutGrid size={14} />
                <span className="sr-only">Grid view</span>
              </SegmentButton>
            </Segmented>
          </div>
        </div>

        <div key={`${layout}-${loading ? "loading" : "ready"}`} className="sg-fade">
          {body}
        </div>
      </section>
    </div>
  );
}

function PostSkeleton({ layout }: { layout: LibraryLayout }) {
  if (layout === "grid") {
    return (
      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3" aria-busy="true" aria-label="Loading posts">
        {[0, 1, 2].map((index) => (
          <div key={index} className="rounded-[18px] border border-[var(--line)] p-4">
            <Skeleton className="h-7 w-16 rounded-[9px]" />
            <Skeleton className="mt-4 h-2.5 w-full" />
            <Skeleton className="mt-2 h-2.5 w-4/5" />
            <Skeleton className="mt-2 h-2.5 w-3/5" />
            <Skeleton className="mt-6 h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--line)]" aria-busy="true" aria-label="Loading posts">
      {[78, 62, 70, 54].map((width, index) => (
        <div key={index} className="flex gap-4 px-4 py-4 sm:px-5">
          <Skeleton className="h-7 w-7 rounded-[9px]" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-2.5" style={{ width: `${width}%` }} />
            <Skeleton className="mt-2 h-2.5 w-2/5" />
            <Skeleton className="mt-3.5 h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* =============================================================================
   PIPELINE (draft → review → scheduled)
============================================================================= */

function Pipeline({
  counts,
  loading,
  active,
  onSelect,
  nextScheduled,
  onOpen,
  onCreate,
}: {
  counts: Counts;
  loading: boolean;
  active: ContentFilter;
  onSelect: (value: ContentFilter) => void;
  nextScheduled: SocialPost | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <section className={cx(CARD, "grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px]")}>
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-[var(--text)]">Content pipeline</h2>
          {active !== "ALL" && (
            <button
              type="button"
              onClick={() => onSelect("ALL")}
              className={cx(
                "sg-fade rounded-md text-[11px] font-medium text-[var(--accent)] hover:underline",
                FOCUS,
              )}
            >
              Show all posts
            </button>
          )}
        </div>

        <div className="mt-4 flex items-stretch gap-1.5">
          {STATUS_ORDER.map((status, index) => {
            const meta = STATUS_META[status];
            const selected = active === status;
            const value = counts[status];

            return (
              <div key={status} className="flex min-w-0 flex-1 items-stretch gap-1.5">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(selected ? "ALL" : status)}
                  className={cx(
                    "min-w-0 flex-1 rounded-2xl border p-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 active:scale-[0.985] sm:p-4",
                    FOCUS,
                    selected
                      ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_12%,transparent)]"
                      : "border-[var(--line)] hover:border-[color-mix(in_srgb,var(--text)_22%,var(--line))]",
                  )}
                >
                  <span className="flex items-center gap-2 truncate text-[11px] font-medium text-[var(--text-muted)]">
                    <Dot color={meta.hue} />
                    {meta.short}
                  </span>
                  {loading ? (
                    <Skeleton className="mt-2 h-[26px] w-10 rounded-lg sm:h-[30px]" />
                  ) : (
                    <span className="mt-2 block text-[26px] font-semibold leading-none tabular-nums tracking-[-0.04em] text-[var(--text)] sm:text-[30px]">
                      {value}
                    </span>
                  )}
                  <span className="mt-2 hidden truncate text-[10.5px] text-[var(--text-subtle)] sm:block">
                    {meta.description}
                  </span>
                </button>

                {index < STATUS_ORDER.length - 1 && (
                  <ChevronRight
                    size={14}
                    aria-hidden
                    className="hidden shrink-0 self-center text-[var(--text-subtle)] sm:block"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div
          className="mt-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
          aria-hidden
        >
          {counts.total > 0 &&
            STATUS_ORDER.map((status) =>
              counts[status] > 0 ? (
                <span
                  key={status}
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${(counts[status] / counts.total) * 100}%`,
                    background: STATUS_META[status].hue,
                    opacity: status === "DRAFT" ? 0.45 : 1,
                  }}
                />
              ) : null,
            )}
        </div>
      </div>

      {/* Next up */}
      <div className="flex flex-col border-t border-[var(--line)] bg-[var(--surface-muted)] p-4 sm:p-5 lg:border-l lg:border-t-0">
        <p className="text-[11px] font-medium text-[var(--text-muted)]">Next scheduled</p>

        {loading ? (
          <div className="mt-2 flex-1">
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="mt-2 h-2.5 w-36" />
            <Skeleton className="mt-4 h-2.5 w-full" />
            <Skeleton className="mt-2 h-2.5 w-3/4" />
          </div>
        ) : nextScheduled?.scheduledAt ? (
          <button
            type="button"
            onClick={() => onOpen(nextScheduled.id)}
            className={cx("group mt-2 flex flex-1 flex-col rounded-xl text-left", FOCUS)}
          >
            <span className="text-[18px] font-semibold tracking-[-0.025em] text-[var(--text)]">
              {relativeTime(nextScheduled.scheduledAt)}
            </span>
            <span className="mt-0.5 text-[11px] tabular-nums text-[var(--text-muted)]">
              {formatDateTime(nextScheduled.scheduledAt)}
            </span>
            <span className="mt-3 line-clamp-2 text-[11.5px] leading-5 text-[var(--text)]">
              {nextScheduled.caption}
            </span>
            <span className="mt-auto flex items-center justify-between gap-2 pt-3">
              <PlatformStack platforms={nextScheduled.platforms} />
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)]">
                Open
                <ChevronRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </span>
          </button>
        ) : (
          <div className="mt-2 flex flex-1 flex-col">
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              Nothing scheduled
            </span>
            <span className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">
              Give a post a date and time and it will show up here.
            </span>
            <button
              type="button"
              onClick={onCreate}
              className={cx(BTN_SECONDARY, FOCUS, "mt-auto h-9 self-start px-3 text-[11px]")}
            >
              <CalendarDays size={13} />
              Plan a post
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* =============================================================================
   POST ROW / CARD
============================================================================= */

function PostRow({
  post,
  highlighted,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  post: SocialPost;
  highlighted: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cx(
        "group flex gap-3.5 px-4 py-4 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--surface-muted)_70%,transparent)] sm:gap-4 sm:px-5",
        highlighted && "sg-flash",
      )}
    >
      <div className="pt-0.5">
        <PlatformStack platforms={post.platforms} size="md" />
      </div>

      <button
        type="button"
        onClick={onEdit}
        className={cx("min-w-0 flex-1 rounded-lg text-left", FOCUS)}
      >
        {post.title && (
          <p className="mb-0.5 truncate text-[11px] font-semibold text-[var(--text-muted)]">{post.title}</p>
        )}
        <p className="line-clamp-2 whitespace-pre-wrap text-[12.5px] leading-6 text-[var(--text)]">
          {post.caption}
        </p>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10.5px] text-[var(--text-muted)]">
          <StatusPill status={post.realStatus} />
          {post.scheduledAt && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock3 size={11} />
              {formatDateTime(post.scheduledAt)}
            </span>
          )}
          <span className="text-[var(--text-subtle)]">{editedLabel(post.updatedAt)}</span>
        </span>
      </button>

      {post.image && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit post"
          className={cx("relative hidden shrink-0 overflow-hidden rounded-xl border border-[var(--line)] sm:block", FOCUS)}
        >
          <MediaThumb src={post.image} type={post.imageType} className="h-14 w-14" />
          {post.assetIds.length > 1 && (
            <span className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1 text-[9px] font-semibold text-white">
              +{post.assetIds.length - 1}
            </span>
          )}
        </button>
      )}

      <div className="flex shrink-0 items-start gap-1 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <IconButton label="Edit post" onClick={onEdit}>
          <Edit3 size={14} />
        </IconButton>
        <RowMenu onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
    </div>
  );
}

function PostCard({
  post,
  highlighted,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  post: SocialPost;
  highlighted: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className={cx(
        "flex flex-col rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))] hover:shadow-[0_14px_30px_-18px_rgba(0,0,0,0.35)]",
        highlighted && "sg-flash",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <PlatformStack platforms={post.platforms} size="md" />
        <RowMenu onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>

      {post.image && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit post"
          className={cx("relative mt-3 overflow-hidden rounded-xl border border-[var(--line)]", FOCUS)}
        >
          <MediaThumb src={post.image} type={post.imageType} className="aspect-[4/3] w-full" />
          {post.assetIds.length > 1 && (
            <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              1 / {post.assetIds.length}
            </span>
          )}
        </button>
      )}

      <button type="button" onClick={onEdit} className={cx("mt-3 flex-1 rounded-lg text-left", FOCUS)}>
        {post.title && (
          <p className="mb-1 truncate text-[11px] font-semibold text-[var(--text-muted)]">{post.title}</p>
        )}
        <p className={cx(post.image ? "line-clamp-3" : "line-clamp-5", "whitespace-pre-wrap text-[12.5px] leading-6 text-[var(--text)]")}>
          {post.caption}
        </p>
      </button>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <StatusPill status={post.realStatus} />
        <span className="truncate text-[10.5px] tabular-nums text-[var(--text-subtle)]">
          {post.scheduledAt ? formatDateTime(post.scheduledAt) : editedLabel(post.updatedAt)}
        </span>
      </div>
    </article>
  );
}

function RowMenu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconButton label="More actions" onClick={() => setOpen((value) => !value)} expanded={open}>
        <MoreHorizontal size={15} />
      </IconButton>

      {open && (
        <div
          role="menu"
          className="sg-pop absolute right-0 top-full z-30 mt-1.5 w-48 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.35)]"
        >
          <MenuItem
            icon={Copy}
            onClick={() => {
              setOpen(false);
              onDuplicate();
            }}
          >
            Duplicate as draft
          </MenuItem>
          <MenuItem
            icon={Trash2}
            danger
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete post
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  danger,
  onClick,
  children,
}: {
  icon: IconType;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11.5px] font-medium transition-colors duration-150",
        FOCUS_INSET,
        danger
          ? "text-red-600 hover:bg-red-500/10"
          : "text-[var(--text)] hover:bg-[var(--surface-muted)]",
      )}
    >
      <Icon size={14} />
      {children}
    </button>
  );
}

/* =============================================================================
   PUBLISHING WORKSPACE
============================================================================= */

function PublishingWorkspace({
  posts,
  connectedAccounts,
  onCreate,
  onEdit,
}: {
  posts: SocialPost[];
  connectedAccounts: number;
  onCreate: (presetDate: string | null) => void;
  onEdit: (id: string) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => dateKey(new Date()));

  const todayKey = dateKey(new Date());

  // Every post with a scheduledAt belongs on the calendar, including ones
  // that have since resolved, so the day view is an honest record.
  const scheduled = useMemo(
    () =>
      posts
        .filter((post) => post.scheduledAt)
        .sort(
          (a, b) =>
            new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime(),
        ),
    [posts],
  );

  const upcoming = useMemo(() => {
    const now = nowMs();
    return scheduled
      .filter(
        (post) =>
          (post.realStatus === "SCHEDULED" || post.realStatus === "PUBLISHING") &&
          new Date(post.scheduledAt!).getTime() >= now,
      )
      .slice(0, 6);
  }, [scheduled]);

  const byDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const post of scheduled) {
      const key = dateKey(new Date(post.scheduledAt!));
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [scheduled]);

  const days = useMemo(() => {
    const first = startOfMonth(month);
    const offset = (first.getDay() + 6) % 7;
    return Array.from(
      { length: 42 },
      (_, index) => new Date(first.getFullYear(), first.getMonth(), 1 - offset + index),
    );
  }, [month]);

  const selectedDate = keyToDate(selected);
  const selectedPosts = byDay.get(selected) ?? [];
  const canPlanSelected = selected >= todayKey;

  const planFor = (key: string) => {
    const preset = key === todayKey ? localDateTimeValue(nextFullHour()) : `${key}T09:00`;
    onCreate(preset);
  };

  const goToToday = () => {
    setMonth(startOfMonth(new Date()));
    setSelected(todayKey);
  };

  const changeMonth = (offset: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      {/* Calendar */}
      <section className={cx(CARD, "overflow-hidden")}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-5">
          <div>
            <h2 key={monthLabel(month)} className="sg-fade text-[17px] font-semibold tracking-[-0.025em] text-[var(--text)]">
              {monthLabel(month)}
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              Select a day to see its posts. Double-click a future day to plan one.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={goToToday}
              className={cx(BTN_SECONDARY, FOCUS, "h-9 px-3 text-[11px]")}
            >
              Today
            </button>
            <IconButton label="Previous month" onClick={() => changeMonth(-1)} bordered>
              <ChevronLeft size={15} />
            </IconButton>
            <IconButton label="Next month" onClick={() => changeMonth(1)} bordered>
              <ChevronRight size={15} />
            </IconButton>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-[var(--line)]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div
              key={day}
              className="px-2 py-2.5 text-center text-[10.5px] font-medium text-[var(--text-subtle)] sm:px-3 sm:text-left"
            >
              {day}
            </div>
          ))}
        </div>

        <div key={month.getTime()} className="sg-fade grid grid-cols-7">
          {days.map((day, index) => {
            const key = dateKey(day);
            const items = byDay.get(key) ?? [];
            const inMonth = day.getMonth() === month.getMonth();
            const isToday = key === todayKey;
            const isSelected = key === selected;
            const isPast = key < todayKey;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                onDoubleClick={() => !isPast && planFor(key)}
                aria-pressed={isSelected}
                aria-label={`${formatLongDate(day)}, ${items.length} scheduled ${
                  items.length === 1 ? "post" : "posts"
                }`}
                className={cx(
                  "relative flex min-h-[62px] flex-col border-[var(--line)] p-1.5 text-left transition-colors duration-150 sm:min-h-[106px] sm:p-2",
                  FOCUS_INSET,
                  index % 7 !== 6 && "border-r",
                  index < 35 && "border-b",
                  !inMonth && "bg-[color-mix(in_srgb,var(--surface-muted)_60%,transparent)]",
                  isSelected
                    ? "bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))]"
                    : "hover:bg-[color-mix(in_srgb,var(--surface-muted)_80%,transparent)]",
                )}
              >
                <span
                  className={cx(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] tabular-nums transition-colors duration-150",
                    isToday
                      ? "bg-[var(--accent)] font-semibold text-white"
                      : isSelected
                        ? "font-semibold text-[var(--accent)] ring-1 ring-[var(--accent)]"
                        : inMonth
                          ? isPast
                            ? "text-[var(--text-muted)]"
                            : "font-medium text-[var(--text)]"
                          : "text-[var(--text-subtle)]",
                  )}
                >
                  {day.getDate()}
                </span>

                <span className="mt-1.5 hidden w-full min-w-0 space-y-1 sm:block">
                  {items.slice(0, 2).map((post) => {
                    const hue = REAL_STATUS_META[post.realStatus].hue;
                    return (
                      <span
                        key={post.id}
                        className="flex min-w-0 items-center gap-1.5 rounded-md border-l-2 px-1.5 py-1 text-[9.5px]"
                        style={{ borderColor: hue, background: mix(hue, 9) }}
                      >
                        <span className="shrink-0 font-semibold tabular-nums" style={{ color: hue }}>
                          {formatTime(post.scheduledAt!)}
                        </span>
                        <span className="truncate text-[var(--text)]">{post.caption}</span>
                      </span>
                    );
                  })}
                  {items.length > 2 && (
                    <span className="block px-1 text-[9.5px] font-medium text-[var(--text-muted)]">
                      +{items.length - 2} more
                    </span>
                  )}
                </span>

                {items.length > 0 && (
                  <span className="mt-auto flex gap-0.5 pt-1 sm:hidden" aria-hidden>
                    {items.slice(0, 3).map((post) => (
                      <span
                        key={post.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: REAL_STATUS_META[post.realStatus].hue }}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Day agenda + queue */}
      <aside className="space-y-5">
        <section className={cx(CARD, "p-4 sm:p-5")}>
          <div key={selected} className="sg-fade">
            <p className="text-[11px] font-medium text-[var(--accent)]">{dayLabel(selectedDate)}</p>
            <h3 className="mt-0.5 text-[16px] font-semibold tracking-[-0.02em] text-[var(--text)]">
              {formatLongDate(selectedDate)}
            </h3>

            {selectedPosts.length > 0 ? (
              <div className="mt-4 space-y-1">
                {selectedPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => onEdit(post.id)}
                    className={cx(
                      "flex w-full gap-3 rounded-xl p-2.5 text-left transition-colors duration-150 hover:bg-[var(--surface-muted)]",
                      FOCUS,
                    )}
                  >
                    <span className="w-11 shrink-0 pt-0.5 text-[11.5px] font-semibold tabular-nums text-[var(--text)]">
                      {formatTime(post.scheduledAt!)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[11.5px] leading-5 text-[var(--text)]">
                        {post.caption}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <PlatformStack platforms={post.platforms} />
                        <StatusPill status={post.realStatus} />
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[11.5px] leading-5 text-[var(--text-muted)]">
                {canPlanSelected
                  ? "Nothing is planned for this day yet."
                  : "Nothing was scheduled for this day."}
              </p>
            )}

            {canPlanSelected && (
              <button
                type="button"
                onClick={() => planFor(selected)}
                className={cx(
                  "mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] text-[11.5px] font-semibold text-[var(--accent)] transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]",
                  FOCUS,
                )}
              >
                <Plus size={14} />
                Plan a post for this day
              </button>
            )}
          </div>
        </section>

        <section className={cx(CARD, "p-4 sm:p-5")}>
          <h3 className="text-[13px] font-semibold text-[var(--text)]">Coming up</h3>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            {connectedAccounts > 0
              ? "These publish automatically at their scheduled time."
              : "These won't publish automatically until an account is connected."}
          </p>

          {upcoming.length > 0 ? (
            <ol className="mt-4 space-y-1">
              {upcoming.map((post) => {
                const date = new Date(post.scheduledAt!);
                return (
                  <li key={post.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(dateKey(date));
                        setMonth(startOfMonth(date));
                      }}
                      className={cx(
                        "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors duration-150 hover:bg-[var(--surface-muted)]",
                        FOCUS,
                      )}
                    >
                      <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                        <span className="text-[14px] font-semibold leading-none tabular-nums text-[var(--text)]">
                          {date.getDate()}
                        </span>
                        <span className="mt-0.5 text-[9px] font-medium text-[var(--text-muted)]">
                          {new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date)}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] font-medium text-[var(--text)]">
                          {post.caption}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] tabular-nums text-[var(--text-muted)]">
                          {formatTime(post.scheduledAt!)}, {relativeTime(post.scheduledAt!)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-3 text-[11.5px] leading-5 text-[var(--text-muted)]">
              No upcoming posts. Schedule one from the calendar or the composer.
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}

/* =============================================================================
   ACCOUNTS WORKSPACE
============================================================================= */

function AccountsWorkspace({
  platforms,
  status,
  onRefresh,
  onDisconnect,
}: {
  platforms: ApiPlatformRow[];
  status: LoadStatus;
  onRefresh: () => void;
  onDisconnect: (account: ApiAccount) => void;
}) {
  const benefits: Array<{ icon: IconType; title: string; text: string }> = [
    { icon: Send, title: "Publish on schedule", text: "Scheduled posts go out at their planned time." },
    { icon: Inbox, title: "Replies in one place", text: "Comments and mentions arrive in Engagement." },
    { icon: Activity, title: "Post performance", text: "Reach and engagement for each published post." },
  ];

  const rowsByPlatform = new Map(platforms.map((row) => [row.platform, row]));
  const firstLoad = status === "loading" && platforms.length === 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className={cx(CARD, "p-4 sm:p-5")}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text)]">Connected accounts</h2>
            <p className="mt-1 text-[11.5px] leading-5 text-[var(--text-muted)]">
              Link Syntra Grid&apos;s profiles to publish posts and bring replies into this workspace.
            </p>
          </div>
          <IconButton label="Refresh" onClick={onRefresh} bordered>
            <RefreshCw size={14} className={status === "loading" ? "animate-spin" : undefined} />
          </IconButton>
        </div>

        <div className="mt-5 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)]">
          {PLATFORMS.map((platform) => {
            const row = rowsByPlatform.get(platform.id);
            const connectedAccounts = row?.accounts.filter((account) => account.status === "CONNECTED") ?? [];
            const configured = row?.configured ?? false;

            return (
              <div key={platform.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <PlatformMark platform={platform.id} size="lg" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[13px] font-semibold text-[var(--text)]">{platform.name}</h3>
                      {firstLoad ? (
                        <Skeleton className="h-4 w-20" />
                      ) : connectedAccounts.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,#059669_12%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[#059669]">
                          <Dot color="#059669" />
                          {connectedAccounts.length} connected
                        </span>
                      ) : !configured ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                          <Dot color="var(--text-subtle)" />
                          Configuration required
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                          <Dot color="var(--text-subtle)" />
                          Not connected
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      {platform.description}, up to {platform.limit.toLocaleString("en-GB")} characters
                    </p>
                    {!configured && row && row.requiredEnvVars.length > 0 && (
                      <p className="mt-1 text-[10px] text-[var(--text-subtle)]">
                        Needs {row.requiredEnvVars.join(", ")} set on the server.
                      </p>
                    )}
                  </div>

                  {configured ? (
                    <a
                      href={`/api/admin/social-media/accounts/connect?platform=${platform.id}`}
                      className={cx(BTN_SECONDARY, FOCUS, "h-9 px-3 text-[11px]")}
                    >
                      <Plus size={13} />
                      {connectedAccounts.length > 0 ? "Connect another" : "Connect"}
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Set the required environment variables on the server first"
                      className={cx(BTN_SECONDARY, "h-9 px-3 text-[11px]")}
                    >
                      <Plus size={13} />
                      Connect
                    </button>
                  )}
                </div>

                {connectedAccounts.length > 0 && (
                  <div className="ml-0 space-y-1.5 sm:ml-[52px]">
                    {connectedAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-muted)] px-3 py-2"
                      >
                        <span className="min-w-0 truncate text-[11px] text-[var(--text)]">
                          {account.accountName}
                          {account.username ? ` (@${account.username})` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => onDisconnect(account)}
                          className={cx(
                            "shrink-0 rounded-md text-[10.5px] font-semibold text-[var(--text-muted)] transition-colors hover:text-red-600",
                            FOCUS,
                          )}
                        >
                          Disconnect
                        </button>
                      </div>
                    ))}
                    {platform.id === "LINKEDIN" && (
                      <p className="px-1 text-[10px] text-[var(--text-subtle)]">
                        Personal profile only: posts publish as this member. Company-page publishing
                        isn&apos;t supported yet.
                      </p>
                    )}
                  </div>
                )}

                {row?.accounts.some((account) => account.status === "EXPIRED" || account.status === "ERROR") && (
                  <p className="ml-0 text-[10.5px] text-red-600 sm:ml-[52px]">
                    An account needs reconnecting. Its connection expired or failed.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <aside className={cx(CARD, "p-4 sm:p-5")}>
        <h3 className="text-[13px] font-semibold text-[var(--text)]">What connecting adds</h3>

        <ul className="mt-4 space-y-4">
          {benefits.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", ACCENT_SOFT)}>
                <Icon size={14} />
              </span>
              <span>
                <span className="block text-[11.5px] font-semibold text-[var(--text)]">{title}</span>
                <span className="mt-0.5 block text-[11px] leading-5 text-[var(--text-muted)]">{text}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex gap-3 border-t border-[var(--line)] pt-4">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <p className="text-[11px] leading-5 text-[var(--text-muted)]">
            You sign in on each platform&apos;s own page. Syntra Grid never sees or stores your
            social media passwords.
          </p>
        </div>
      </aside>
    </div>
  );
}

/* =============================================================================
   ENGAGEMENT WORKSPACE
============================================================================= */

function EngagementWorkspace({
  connectedAccounts,
  onGoToAccounts,
}: {
  connectedAccounts: number;
  onGoToAccounts: () => void;
}) {
  return (
    <section className={cx(CARD, "overflow-hidden")}>
      <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--text)]">Engagement</h2>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            Comments, mentions and messages from connected accounts.
          </p>
        </div>

        <Segmented label="Filter conversations">
          {["All", "Comments", "Mentions", "Messages"].map((label, index) => (
            <SegmentButton key={label} active={index === 0} disabled onClick={() => undefined}>
              {label}
            </SegmentButton>
          ))}
        </Segmented>
      </div>

      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none select-none divide-y divide-[var(--line)] opacity-60 [mask-image:linear-gradient(to_bottom,black_20%,transparent)]"
        >
          {[72, 54, 64, 46].map((width, index) => (
            <div key={index} className="flex items-center gap-3 px-5 py-4">
              <span className="h-9 w-9 shrink-0 rounded-full bg-[var(--surface-muted)]" />
              <span className="flex-1 space-y-2">
                <span className="block h-2.5 w-28 rounded-full bg-[var(--surface-muted)]" />
                <span className="block h-2.5 rounded-full bg-[var(--surface-muted)]" style={{ width: `${width}%` }} />
              </span>
              <span className="h-2.5 w-10 rounded-full bg-[var(--surface-muted)]" />
            </div>
          ))}
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className={cx("flex h-12 w-12 items-center justify-center rounded-2xl", ACCENT_SOFT)}>
            <MessageCircle size={20} />
          </span>
          <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.015em] text-[var(--text)]">
            No conversations yet
          </h3>
          <p className="mt-1.5 max-w-[340px] text-[11.5px] leading-5 text-[var(--text-muted)]">
            {connectedAccounts > 0
              ? "Comments and mentions aren't pulled in yet. They'll appear here once the platform integrations are built."
              : "Connect an account and new comments, mentions and messages will collect here."}
          </p>
          <button
            type="button"
            onClick={onGoToAccounts}
            className={cx(BTN_SECONDARY, FOCUS, "mt-4 h-9 px-3 text-[11px]")}
          >
            View accounts
          </button>
        </div>
      </div>
    </section>
  );
}

/* =============================================================================
   ANALYTICS WORKSPACE

   Real aggregates only. With no provider metrics sync yet, hasMetrics is
   false and an honest empty state is shown instead of invented numbers.
============================================================================= */

function AnalyticsWorkspace() {
  const [data, setData] = useState<ApiAnalytics | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");

  const load = useCallback(() => {
    setStatus("loading");
    fetchAnalyticsApi()
      .then((result) => {
        setData(result);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusTiles = STATUS_ORDER.map((bucket) => {
    const realStatuses = (Object.keys(REAL_STATUS_META) as RealPostStatus[]).filter(
      (status) => statusBucket(status) === bucket,
    );
    const count = data ? realStatuses.reduce((sum, key) => sum + (data.postsByStatus[key] ?? 0), 0) : 0;
    return { bucket, count };
  });

  if (status === "error") {
    return (
      <section className={CARD}>
        <EmptyState
          icon={AlertCircle}
          title="Analytics couldn't be loaded"
          description="Check your connection, then try again."
          action={
            <button type="button" onClick={load} className={cx(BTN_SECONDARY, FOCUS)}>
              <RefreshCw size={14} />
              Try again
            </button>
          }
        />
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className={cx(CARD, "p-4 sm:p-5")}>
        <h2 className="text-[14px] font-semibold text-[var(--text)]">Content pipeline</h2>
        <p className="mt-1 text-[11.5px] leading-5 text-[var(--text-muted)]">
          Post counts from the database, by stage.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {statusTiles.map(({ bucket, count }) => (
            <div key={bucket} className="rounded-2xl border border-[var(--line)] p-3.5">
              <p className="flex items-center gap-2 text-[10.5px] font-semibold text-[var(--text-muted)]">
                <Dot color={STATUS_META[bucket].hue} />
                {STATUS_META[bucket].short}
              </p>
              {status === "loading" ? (
                <Skeleton className="mt-2 h-[22px] w-10 rounded-md" />
              ) : (
                <p className="mt-1.5 text-[22px] font-semibold tabular-nums text-[var(--text)]">{count}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={cx(CARD, "p-4 sm:p-5")}>
        <h2 className="text-[14px] font-semibold text-[var(--text)]">Platform performance</h2>
        <p className="mt-1 text-[11.5px] leading-5 text-[var(--text-muted)]">
          Impressions, reach, likes, comments and shares from each platform&apos;s own API.
        </p>

        {status === "loading" ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="rounded-2xl border border-[var(--line)] p-3.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-3 h-[18px] w-12 rounded-md" />
              </div>
            ))}
          </div>
        ) : !data?.hasMetrics ? (
          <div className="mt-6 flex flex-col items-center py-6 text-center">
            <span className={cx("flex h-12 w-12 items-center justify-center rounded-2xl", ACCENT_SOFT)}>
              <Activity size={20} />
            </span>
            <h3 className="mt-4 text-[14px] font-semibold text-[var(--text)]">No analytics available yet</h3>
            <p className="mt-1.5 max-w-[360px] text-[11.5px] leading-5 text-[var(--text-muted)]">
              Metrics appear once a connected account&apos;s posts have been synchronised with its
              platform. Nothing is shown until that real data exists.
            </p>
          </div>
        ) : data.totals ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(data.totals).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-[var(--line)] p-3.5">
                <p className="text-[10.5px] font-semibold capitalize text-[var(--text-muted)]">{key}</p>
                <p className="mt-1.5 text-[18px] font-semibold tabular-nums text-[var(--text)]">
                  {(value ?? 0).toLocaleString("en-GB")}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

/* =============================================================================
   POST COMPOSER
============================================================================= */

function PostComposer({
  post,
  presetDate,
  campaigns,
  connectedAccountsByPlatform,
  onClose,
  onSave,
  onCreateCampaign,
  onSubmitForReview,
  onApprove,
  onRequestChanges,
  onSchedulePost,
  onCancelPost,
  onPublishNow,
  canPublishNow,
}: {
  post: SocialPost | null;
  presetDate: string | null;
  campaigns: ApiCampaign[];
  connectedAccountsByPlatform: Map<SocialPlatform, ApiAccount[]>;
  onClose: () => void;
  onSave: (form: PostForm, editingId: string | null) => Promise<string | null>;
  onCreateCampaign: (name: string) => Promise<ApiCampaign>;
  onSubmitForReview: (id: string) => Promise<boolean>;
  onApprove: (id: string) => Promise<boolean>;
  onRequestChanges: (id: string, notes: string) => Promise<boolean>;
  onSchedulePost: (id: string, scheduledAtLocal: string) => Promise<boolean>;
  onCancelPost: (id: string) => Promise<boolean>;
  onPublishNow: (id: string) => Promise<boolean>;
  /** Whether this caller holds the permission bar "Publish Now" reuses
   *  (the same one schedulePost/approvePost already require) — purely
   *  for deciding whether to show the button; the server re-checks this
   *  regardless of what's rendered here. */
  canPublishNow: boolean;
}) {
  const initial = useMemo(() => formFromPost(post, presetDate), [post, presetDate]);

  const [form, setForm] = useState<PostForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [previewChoice, setPreviewChoice] = useState<SocialPlatform | null>(initial.platforms[0] ?? null);
  const [customiseOpen, setCustomiseOpen] = useState(
    () => Object.values(initial.platformCaptions).some((text) => (text ?? "").trim() !== ""),
  );
  const [imageBusy, setImageBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLElement | null>>>({});
  const dragStart = useRef<number | null>(null);

  useScrollLock(true);
  useFocusTrap(panelRef, true);

  // Keep the status picker in step with workflow actions taken from here.
  const postStatus = post?.realStatus ?? null;
  const postScheduledAt = post?.scheduledAt ?? null;
  useEffect(() => {
    if (!postStatus) return;
    setForm((current) => ({
      ...current,
      status: statusBucket(postStatus),
      scheduledAt: postScheduledAt ? localDateTimeValue(new Date(postScheduledAt)) : current.scheduledAt,
    }));
  }, [postStatus, postScheduledAt]);

  /* Activity --------------------------------------------------------------- */

  const [activity, setActivity] = useState<ApiActivityItem[]>([]);
  useEffect(() => {
    if (!post) {
      setActivity([]);
      return;
    }
    let cancelled = false;
    fetchActivityApi(post.id)
      .then((items) => {
        if (!cancelled) setActivity(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [post]);

  const slots = useMemo(() => quickSlots(), []);
  const isMac = useMemo(
    () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent),
    [],
  );

  const dirty = post ? formSignature(form) !== formSignature(initial) : hasContent(form);
  const captionLength = form.caption.trim().length;
  const selectedPlatforms = form.platforms.map(platformDefinition);
  const customisedCount = form.platforms.filter((platform) => (form.platformCaptions[platform] ?? "").trim() !== "").length;
  const unconnectedSelected = form.platforms.filter((platform) => !connectedAccountsByPlatform.get(platform)?.length);

  const activePreview =
    previewChoice && form.platforms.includes(previewChoice) ? previewChoice : form.platforms[0] ?? null;

  const update = (patch: Partial<PostForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const togglePlatform = (platform: SocialPlatform) => {
    const selected = form.platforms.includes(platform);
    update({
      platforms: selected
        ? form.platforms.filter((item) => item !== platform)
        : PLATFORMS.map((item) => item.id).filter((id) => id === platform || form.platforms.includes(id)),
    });
    if (!selected) setPreviewChoice(platform);
  };

  /* Caption auto-grow ---------------------------------------------------------- */

  useIsoLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 104), 216)}px`;
  }, [form.caption]);

  /* Media ------------------------------------------------------------------------- */

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<ApiAsset[] | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const [brandAssetsOpen, setBrandAssetsOpen] = useState(false);
  const [brandAssetOptions, setBrandAssetOptions] = useState<ApiBrandAssetOption[] | null>(null);
  const [brandAssetsLoading, setBrandAssetsLoading] = useState(false);
  const [pickingBrandAssetId, setPickingBrandAssetId] = useState<string | null>(null);

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setImageBusy(true);
    setError(null);
    try {
      let asset: ApiAsset;
      if (file.type.startsWith("video/")) {
        asset = await uploadMediaAsset(file, file.name || "video.mp4");
      } else {
        const dataUrl = await prepareImage(file);
        const blob = await (await fetch(dataUrl)).blob();
        asset = await uploadMediaAsset(blob, file.name || "image.jpg");
      }
      update({ image: asset.url, imageType: asset.type, assetIds: [asset.id] });
      setLibraryAssets((current) => (current ? [asset, ...current.filter((item) => item.id !== asset.id)] : current));
    } catch (problem) {
      showError({ field: "media", message: errorMessage(problem, "That file couldn't be added.") });
    } finally {
      setImageBusy(false);
    }
  };

  const openPicker = () => fileInputRef.current?.click();
  const removeMedia = () => update({ image: null, imageType: null, assetIds: [] });

  const toggleLibrary = () => {
    setLibraryOpen((open) => !open);
    if (!libraryAssets && !libraryLoading) {
      setLibraryLoading(true);
      fetchMediaAssets()
        .then(setLibraryAssets)
        .catch(() => setLibraryAssets([]))
        .finally(() => setLibraryLoading(false));
    }
  };

  // Toggling builds up a carousel. Previews show the first asset.
  const pickFromLibrary = (asset: ApiAsset) => {
    setForm((current) => {
      const selected = current.assetIds.includes(asset.id);
      const assetIds = selected ? current.assetIds.filter((id) => id !== asset.id) : [...current.assetIds, asset.id];
      const firstId = assetIds[0];
      const firstAsset = firstId === asset.id ? asset : libraryAssets?.find((item) => item.id === firstId);
      return {
        ...current,
        assetIds,
        image: firstAsset?.url ?? (firstId ? current.image : null),
        imageType: firstAsset?.type ?? (firstId ? current.imageType : null),
      };
    });
    setError(null);
  };

  const toggleBrandAssets = () => {
    setBrandAssetsOpen((open) => !open);
    if (!brandAssetOptions && !brandAssetsLoading) {
      setBrandAssetsLoading(true);
      fetchApprovedBrandAssetsApi()
        .then(setBrandAssetOptions)
        .catch(() => setBrandAssetOptions([]))
        .finally(() => setBrandAssetsLoading(false));
    }
  };

  // Reuses the brand asset's existing hosted file (never re-uploads it),
  // then treats the result exactly like any other library pick.
  const pickBrandAsset = async (option: ApiBrandAssetOption) => {
    if (pickingBrandAssetId) return;
    setPickingBrandAssetId(option.id);
    try {
      const asset = await reuseBrandAssetApi(option.id);
      setLibraryAssets((current) => (current ? [asset, ...current.filter((item) => item.id !== asset.id)] : [asset]));
      pickFromLibrary(asset);
    } catch (problem) {
      showError({ field: "media", message: errorMessage(problem, "That brand asset couldn't be attached.") });
    } finally {
      setPickingBrandAssetId(null);
    }
  };

  const dropProps: DropProps = {
    onDragOver: (event) => {
      if (!Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDragging(true);
    },
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (event) => {
      event.preventDefault();
      setDragging(false);
      void handleFile(event.dataTransfer.files[0]);
    },
  };

  /* Validation -------------------------------------------------------------------- */

  const validate = (next: PostForm): { field: FieldKey; message: string } | null => {
    if (next.platforms.length === 0) return { field: "channels", message: "Choose at least one channel." };
    if (!next.caption.trim()) return { field: "caption", message: "Write a caption before saving." };

    if (next.status !== "DRAFT") {
      const disconnected = next.platforms.find((platform) => !connectedAccountsByPlatform.get(platform)?.length);
      if (disconnected) {
        return {
          field: "channels",
          message: `No ${platformDefinition(disconnected).name} account is connected. Connect one in Accounts, or save this as a draft.`,
        };
      }

      if (next.platforms.includes("INSTAGRAM")) {
        if (next.assetIds.length === 0) {
          return { field: "media", message: "Instagram posts need an image or video. Add one, or save this as a draft." };
        }
        if (next.instagramPlacement === "STORY" && next.assetIds.length > 1) {
          return {
            field: "media",
            message: "An Instagram Story takes a single image or video. Remove the extra ones, or switch placement to Feed.",
          };
        }
      }

      for (const platform of next.platforms) {
        const definition = platformDefinition(platform);
        const length = ((next.platformCaptions[platform] ?? "").trim() || next.caption.trim()).length;
        if (length > definition.limit) {
          return {
            field: "caption",
            message: `The ${definition.name} caption is ${(length - definition.limit).toLocaleString("en-GB")} characters over its limit. Shorten it or save this as a draft.`,
          };
        }
      }
    }

    if (next.status === "SCHEDULED") {
      if (!next.scheduledAt) return { field: "schedule", message: "Choose a date and time for this post." };
      const savedAt = post?.scheduledAt ?? null;
      const unchanged = savedAt !== null && localDateTimeValue(new Date(savedAt)) === next.scheduledAt;
      if (!unchanged) {
        const problem = futureTimeError(next.scheduledAt);
        if (problem) return { field: "schedule", message: problem };
      }
    }

    return null;
  };

  function showError(problem: { field: FieldKey; message: string }) {
    setError(problem.message);
    setErrorKey((key) => key + 1);
    const target = fieldRefs.current[problem.field];
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (problem.field === "caption") textareaRef.current?.focus({ preventScroll: true });
  }

  /* Close / save ------------------------------------------------------------------ */

  const closeNow = useCallback(() => {
    setLeaving(true);
    window.setTimeout(onClose, EXIT_MS);
  }, [onClose]);

  const submit = async (override?: Partial<PostForm>) => {
    if (imageBusy || saving || leaving) return;
    const next = override ? { ...form, ...override } : form;
    const problem = validate(next);
    if (problem) {
      if (override) setForm(next);
      showError(problem);
      return;
    }

    setSaving(true);
    setError(null);
    const failure = await onSave(next, post?.id ?? null);
    if (failure) {
      setSaving(false);
      setError(failure);
      setErrorKey((key) => key + 1);
      return;
    }
    closeNow();
  };

  const canQuickDraft = form.caption.trim() !== "" && form.platforms.length > 0;

  const requestClose = () => {
    if (leaving || saving) return;
    if (!dirty) {
      closeNow();
      return;
    }
    setDialog({
      title: post ? "Discard your changes?" : "Discard this post?",
      description: post
        ? "Edits made since the last save will be lost."
        : "Nothing has been saved yet, so this post will be lost.",
      confirmLabel: "Discard",
      tone: "danger",
      secondary:
        !post && canQuickDraft
          ? { label: "Save as draft", run: () => void submit({ status: "DRAFT" }) }
          : undefined,
      onConfirm: () => {
        closeNow();
      },
    });
  };

  // Keep a stable handle for the global key listener.
  const requestCloseRef = useRef(requestClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || dialog) return;
      event.preventDefault();
      requestCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog]);

  /* Focus the caption on desktop; on phones the keyboard would cover the sheet. */
  useEffect(() => {
    if (!window.matchMedia("(min-width: 640px)").matches) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    const timeout = window.setTimeout(() => {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, 60);
    return () => window.clearTimeout(timeout);
  }, []);

  /* Swipe down on the sheet header to close (touch only). */
  const headerPointer = {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "touch") return;
      if ((event.target as HTMLElement).closest("button")) return;
      dragStart.current = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragStart.current === null) return;
      setDragY(Math.max(0, event.clientY - dragStart.current));
    },
    onPointerUp: () => {
      if (dragStart.current === null) return;
      dragStart.current = null;
      const shouldClose = dragY > 110;
      setDragY(0);
      if (shouldClose) requestClose();
    },
    onPointerCancel: () => {
      dragStart.current = null;
      setDragY(0);
    },
  };

  /* Workflow actions ------------------------------------------------------------ */

  const runAction = async (key: string, action: () => Promise<boolean>) => {
    if (busyAction) return;
    setBusyAction(key);
    try {
      await action();
    } finally {
      setBusyAction(null);
    }
  };

  const openRequestChanges = () => {
    if (!post) return;
    setDialog({
      title: "Request changes",
      description: "The author sees this note on the post.",
      confirmLabel: "Send request",
      input: {
        label: "What needs changing",
        type: "textarea",
        placeholder: "e.g. Shorten the caption for X and swap the image for the new product shot.",
        required: true,
      },
      onConfirm: async (notes) => {
        const ok = await onRequestChanges(post.id, notes);
        return ok;
      },
    });
  };

  const openSchedule = () => {
    if (!post) return;
    setDialog({
      title: "Schedule this post",
      description: "It publishes automatically on every connected channel at this time.",
      confirmLabel: "Schedule",
      input: {
        label: "Publishing time",
        type: "datetime-local",
        initial: form.scheduledAt && !futureTimeError(form.scheduledAt) ? form.scheduledAt : localDateTimeValue(nextFullHour()),
        min: localDateTimeValue(new Date()),
        required: true,
        validate: futureTimeError,
      },
      onConfirm: async (value) => {
        const ok = await onSchedulePost(post.id, value);
        return ok;
      },
    });
  };

  const openPublishNow = () => {
    if (!post) return;
    const pending = post.targets.filter((target) => target.status !== "PUBLISHED" && target.status !== "CANCELLED");
    const retrying = post.realStatus === "PARTIALLY_PUBLISHED" || post.realStatus === "FAILED";
    setDialog({
      title: retrying ? "Retry publishing?" : "Publish now?",
      description: retrying
        ? `Only the destinations that haven't succeeded yet will be retried (${pending.length} of ${post.targets.length}). Anything already published is left as-is.`
        : `This publishes immediately to ${pending.length} connected ${pending.length === 1 ? "destination" : "destinations"} — it skips review and scheduling.`,
      confirmLabel: retrying ? "Retry" : "Publish now",
      onConfirm: async () => {
        const ok = await onPublishNow(post.id);
        return ok;
      },
    });
  };

  const openCancel = () => {
    if (!post) return;
    setDialog({
      title: "Cancel this post?",
      description: "It leaves the queue and won't publish. You can duplicate it later to start again.",
      confirmLabel: "Cancel post",
      tone: "danger",
      onConfirm: async () => {
        const ok = await onCancelPost(post.id);
        return ok;
      },
    });
  };

  const openNewCampaign = () => {
    setDialog({
      title: "New campaign",
      description: "Group related posts so they're easy to find and report on together.",
      confirmLabel: "Create campaign",
      input: { label: "Campaign name", placeholder: "e.g. Autumn launch", required: true },
      onConfirm: async (name) => {
        const campaign = await onCreateCampaign(name);
        update({ campaignId: campaign.id });
      },
    });
  };

  /* Labels -------------------------------------------------------------------------- */

  const statusChanged = post ? statusBucket(post.realStatus) !== form.status : false;

  const primaryLabel = post
    ? statusChanged && form.status === "READY"
      ? "Save and submit"
      : statusChanged && form.status === "SCHEDULED"
        ? "Save and schedule"
        : "Save changes"
    : form.status === "SCHEDULED"
      ? "Schedule post"
      : form.status === "READY"
        ? "Submit for review"
        : "Save draft";

  const savingLabel =
    form.status === "SCHEDULED" && (!post || statusChanged)
      ? "Scheduling…"
      : form.status === "READY" && (!post || statusChanged)
        ? "Submitting…"
        : "Saving…";

  const PrimaryIcon = form.status === "SCHEDULED" ? CalendarDays : form.status === "READY" ? Send : Check;

  const previewWhen =
    form.status === "SCHEDULED" && form.scheduledAt && isValidDate(new Date(form.scheduledAt))
      ? formatDateTime(new Date(form.scheduledAt).toISOString())
      : "Just now";

  const media: PreviewMedia = {
    image: form.image,
    type: form.imageType,
    busy: imageBusy,
    dragging,
    onAdd: openPicker,
    onRemove: removeMedia,
    dropProps,
  };

  const previewCaption = activePreview
    ? (form.platformCaptions[activePreview] ?? "").trim() || form.caption
    : form.caption;

  const libraryUrl = (id: string) => libraryAssets?.find((asset) => asset.id === id);
  const workflowLocked = dirty && Boolean(post);

  return (
    <>
      <div
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
        className={cx(
          "fixed inset-0 z-[150] flex items-end justify-center bg-black/50 sm:items-center sm:p-6",
          leaving ? "sg-backdrop-out" : "sg-fade",
        )}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="social-composer-title"
          style={
            dragY > 0
              ? { transform: `translateY(${dragY}px)`, transition: "none" }
              : { transition: "transform .28s cubic-bezier(.32,.72,0,1)" }
          }
          className={cx(
            "sg-dialog flex h-[94dvh] w-full max-w-[1120px] flex-col overflow-hidden rounded-t-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_40px_90px_-24px_rgba(0,0,0,0.5)] sm:h-[min(820px,92dvh)] sm:rounded-[26px]",
            leaving && "is-leaving",
          )}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
            onPaste={(event) => {
              const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith("image/"));
              if (file) {
                event.preventDefault();
                void handleFile(file);
              }
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              tabIndex={-1}
              aria-hidden
              className="sr-only"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            {/* Header (drag handle on phones) */}
            <div
              {...headerPointer}
              className="shrink-0 touch-none border-b border-[var(--line)] px-5 pb-3 pt-2.5 sm:touch-auto sm:px-6 sm:py-3"
            >
              <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[var(--line)] sm:hidden" aria-hidden />
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2
                    id="social-composer-title"
                    className="text-[17px] font-semibold tracking-[-0.025em] text-[var(--text)]"
                  >
                    {post ? "Edit post" : "New post"}
                  </h2>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                    {post ? editedLabel(post.updatedAt) : "Write once, then tailor it for each channel."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {dirty && (
                    <span className="sg-fade hidden items-center gap-1.5 text-[10.5px] text-[var(--text-subtle)] sm:inline-flex">
                      <Dot color="#D97706" />
                      Unsaved
                    </span>
                  )}
                  <IconButton label="Close" onClick={requestClose} bordered>
                    <X size={16} />
                  </IconButton>
                </div>
              </div>
            </div>

            {/* Workflow bar: real, server-enforced transitions */}
            {post && (
              <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_55%,transparent)] px-5 py-2.5 sm:px-6">
                <span key={post.realStatus} className="sg-pop">
                  <StatusPill status={post.realStatus} large />
                </span>
                {post.reviewNotes && post.realStatus === "CHANGES_REQUESTED" && (
                  <span className="min-w-0 max-w-full truncate text-[11px] text-[var(--text-muted)]" title={post.reviewNotes}>
                    &ldquo;{post.reviewNotes}&rdquo;
                  </span>
                )}

                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  {workflowLocked && post.realStatus !== "DRAFT" && post.realStatus !== "CHANGES_REQUESTED" && (
                    <span className="sg-fade mr-1 text-[10.5px] text-[var(--text-subtle)]">
                      Save or discard your edits first
                    </span>
                  )}

                  {(post.realStatus === "DRAFT" || post.realStatus === "CHANGES_REQUESTED") && (
                    <WorkflowButton
                      icon={Send}
                      busy={busyAction === "submit"}
                      disabled={Boolean(busyAction) || saving}
                      onClick={() =>
                        dirty
                          ? void submit({ status: "READY" })
                          : void runAction("submit", () => onSubmitForReview(post.id))
                      }
                    >
                      {dirty ? "Save and submit" : "Submit for review"}
                    </WorkflowButton>
                  )}

                  {post.realStatus === "PENDING_REVIEW" && (
                    <>
                      <WorkflowButton disabled={workflowLocked || Boolean(busyAction)} onClick={openRequestChanges}>
                        Request changes
                      </WorkflowButton>
                      <WorkflowButton
                        primary
                        icon={Check}
                        busy={busyAction === "approve"}
                        disabled={workflowLocked || Boolean(busyAction)}
                        onClick={() => void runAction("approve", () => onApprove(post.id))}
                      >
                        Approve
                      </WorkflowButton>
                    </>
                  )}

                  {post.realStatus === "APPROVED" && (
                    <WorkflowButton
                      primary
                      icon={CalendarDays}
                      disabled={workflowLocked || Boolean(busyAction)}
                      onClick={openSchedule}
                    >
                      Schedule
                    </WorkflowButton>
                  )}

                  {canPublishNow &&
                    (post.realStatus === "DRAFT" ||
                      post.realStatus === "CHANGES_REQUESTED" ||
                      post.realStatus === "PENDING_REVIEW" ||
                      post.realStatus === "APPROVED" ||
                      post.realStatus === "SCHEDULED" ||
                      post.realStatus === "PARTIALLY_PUBLISHED" ||
                      post.realStatus === "FAILED") && (
                      <WorkflowButton
                        primary
                        icon={Share2}
                        disabled={workflowLocked || Boolean(busyAction)}
                        onClick={openPublishNow}
                      >
                        {post.realStatus === "PARTIALLY_PUBLISHED" || post.realStatus === "FAILED" ? "Retry" : "Publish now"}
                      </WorkflowButton>
                    )}

                  {(post.realStatus === "SCHEDULED" ||
                    post.realStatus === "PENDING_REVIEW" ||
                    post.realStatus === "APPROVED") && (
                    <button
                      type="button"
                      onClick={openCancel}
                      disabled={workflowLocked || Boolean(busyAction)}
                      className={cx(
                        "h-8 rounded-lg px-2.5 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-500/10 disabled:pointer-events-none disabled:opacity-50",
                        FOCUS,
                      )}
                    >
                      Cancel post
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Per-destination publishing status — tracked independently;
                one platform failing never hides another's success. */}
            {post && post.targets.length > 0 && post.realStatus !== "DRAFT" && post.realStatus !== "CHANGES_REQUESTED" && (
              <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[var(--line)] px-5 py-2 text-[10.5px] sm:px-6">
                {post.targets.map((target) => {
                  const meta = TARGET_STATUS_META[target.status];
                  return (
                    <span key={target.accountId} className="inline-flex items-center gap-1.5">
                      <PlatformMark platform={target.platform} size="xs" label={platformDefinition(target.platform).name} />
                      <span className="font-medium text-[var(--text)]">{target.account.accountName}</span>
                      <span style={{ color: meta.hue }}>{meta.label}</span>
                      {target.status === "PUBLISHED" && target.publishedAt && (
                        <span className="text-[var(--text-subtle)]">{formatDateTime(target.publishedAt)}</span>
                      )}
                      {target.status === "FAILED" && target.lastError && (
                        <span className="max-w-[260px] truncate text-[var(--text-subtle)]" title={target.lastError}>
                          — {target.lastError}
                        </span>
                      )}
                      {target.remotePostUrl && (
                        <a
                          href={target.remotePostUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--accent)] hover:underline"
                        >
                          View
                        </a>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Body: each column scrolls on its own on desktop; one scroll on mobile */}
            <div className="sg-scroll grid min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
              {/* Editor: sized to fit without scrolling on a normal laptop screen */}
              <div className="sg-scroll space-y-4 px-5 py-4 sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
                {/* Channels */}
                <fieldset ref={(node) => { fieldRefs.current.channels = node; }} className="scroll-mt-4">
                  <legend className={LABEL}>Channels</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {PLATFORMS.map((platform) => {
                      const selected = form.platforms.includes(platform.id);
                      const connected = Boolean(connectedAccountsByPlatform.get(platform.id)?.length);
                      return (
                        <button
                          key={platform.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => togglePlatform(platform.id)}
                          title={connected ? platform.name : `${platform.name}: no account connected yet`}
                          className={cx(
                            "inline-flex h-9 items-center gap-2 rounded-xl border pl-1 pr-2.5 text-[11px] font-semibold transition-[border-color,background-color,color,transform] duration-150 active:scale-[0.97]",
                            FOCUS,
                            selected
                              ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))] text-[var(--text)]"
                              : "border-[var(--line)] text-[var(--text-muted)] hover:border-[color-mix(in_srgb,var(--text)_22%,var(--line))] hover:text-[var(--text)]",
                          )}
                        >
                          <span className="relative">
                            <PlatformMark platform={platform.id} size="md" />
                            {selected && (
                              <span className="sg-pop absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--accent)] text-white ring-2 ring-[var(--surface)]">
                                <Check size={8} strokeWidth={3.5} />
                              </span>
                            )}
                          </span>
                          {platform.name}
                          {!connected && (
                            <>
                              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--text-subtle)] opacity-60" />
                              <span className="sr-only">(not connected)</span>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {unconnectedSelected.length > 0 && (
                    <p className="sg-fade mt-1.5 text-[10.5px] leading-5 text-[var(--text-subtle)]">
                      {unconnectedSelected.map((platform) => platformDefinition(platform).name).join(", ")}{" "}
                      {unconnectedSelected.length === 1 ? "isn't" : "aren't"} connected, so{" "}
                      {unconnectedSelected.length === 1 ? "it" : "they"} won&apos;t be saved with this post yet.
                    </p>
                  )}
                </fieldset>

                {/* Caption */}
                <div ref={(node) => { fieldRefs.current.caption = node; }} className="scroll-mt-4">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label htmlFor="social-caption" className="text-[11px] font-semibold text-[var(--text)]">
                      Caption
                    </label>
                    <div className="flex items-center gap-3">
                      {selectedPlatforms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setCustomiseOpen((open) => !open)}
                          aria-expanded={customiseOpen}
                          className={cx("sg-fade inline-flex items-center gap-1 rounded-md text-[10.5px] font-semibold text-[var(--accent)] hover:underline", FOCUS)}
                        >
                          {customisedCount > 0 ? `Per-channel captions (${customisedCount})` : "Customise per channel"}
                          <ChevronDown size={11} className={cx("transition-transform duration-200", customiseOpen && "rotate-180")} />
                        </button>
                      )}
                      <span className="text-[10.5px] tabular-nums text-[var(--text-subtle)]">
                        {captionLength.toLocaleString("en-GB")}
                      </span>
                    </div>
                  </div>

                  <textarea
                    ref={textareaRef}
                    id="social-caption"
                    value={form.caption}
                    onChange={(event) => update({ caption: event.target.value })}
                    placeholder="What would you like to share?"
                    rows={4}
                    className={cx(INPUT, "sg-scroll resize-none bg-[var(--surface-muted)] px-3.5 py-3 text-[12.5px] leading-6")}
                  />

                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                    {selectedPlatforms.length > 0 ? (
                      selectedPlatforms.map((platform) => (
                        <CharMeter
                          key={platform.id}
                          platform={platform}
                          count={((form.platformCaptions[platform.id] ?? "").trim() || form.caption.trim()).length}
                        />
                      ))
                    ) : (
                      <p className="text-[10.5px] text-[var(--text-subtle)]">Choose a channel to see its character limit.</p>
                    )}
                  </div>

                  {selectedPlatforms.length > 1 && (
                    <Collapse open={customiseOpen}>
                      <div className="grid gap-2.5 pt-3 sm:grid-cols-2">
                        {selectedPlatforms.map((platform) => (
                          <div key={platform.id}>
                            <div className="mb-1 flex items-center gap-1.5 text-[10.5px] text-[var(--text-muted)]">
                              <PlatformMark platform={platform.id} size="xs" />
                              {platform.name}
                            </div>
                            <textarea
                              value={form.platformCaptions[platform.id] ?? ""}
                              onChange={(event) =>
                                update({ platformCaptions: { ...form.platformCaptions, [platform.id]: event.target.value } })
                              }
                              placeholder="Blank uses the shared caption"
                              rows={2}
                              className={cx(INPUT, "resize-none p-2.5 text-[11.5px] leading-5")}
                            />
                          </div>
                        ))}
                      </div>
                    </Collapse>
                  )}
                </div>

                {/* Media (with Instagram placement inline) */}
                <div ref={(node) => { fieldRefs.current.media = node; }} className="scroll-mt-4">
                  <div className="mb-1.5 flex min-h-7 items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold text-[var(--text)]">
                      Media
                      {form.platforms.includes("INSTAGRAM") && form.assetIds.length === 0 && (
                        <span className="ml-2 font-normal text-[var(--text-subtle)]">Needed for Instagram</span>
                      )}
                    </span>
                    {form.platforms.includes("INSTAGRAM") && (
                      <div className="sg-fade flex items-center gap-2">
                        <span className="hidden text-[10.5px] text-[var(--text-subtle)] sm:inline">Instagram</span>
                        <Segmented label="Instagram placement" compact>
                          <SegmentButton
                            active={form.instagramPlacement === "FEED"}
                            onClick={() => update({ instagramPlacement: "FEED" })}
                          >
                            Feed
                          </SegmentButton>
                          <SegmentButton
                            active={form.instagramPlacement === "STORY"}
                            onClick={() => update({ instagramPlacement: "STORY" })}
                          >
                            Story
                          </SegmentButton>
                        </Segmented>
                      </div>
                    )}
                  </div>

                  <div
                    {...dropProps}
                    className={cx(
                      "flex items-center gap-2.5 rounded-xl border p-2 transition-colors duration-150",
                      dragging
                        ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))]"
                        : form.image
                          ? "border-[var(--line)]"
                          : "border-dashed border-[var(--line)]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={openPicker}
                      disabled={imageBusy}
                      aria-label={form.image ? "Replace media" : "Add media"}
                      className={cx("flex shrink-0 -space-x-2.5 rounded-lg", FOCUS)}
                    >
                      {form.image ? (
                        form.assetIds.slice(0, 3).map((id, index) => {
                          const asset = index === 0 ? null : libraryUrl(id);
                          const src = index === 0 ? form.image : asset?.url;
                          if (!src) return null;
                          return (
                            <MediaThumb
                              key={id}
                              src={src}
                              type={index === 0 ? form.imageType : asset?.type ?? "IMAGE"}
                              className="h-11 w-11 rounded-lg ring-2 ring-[var(--surface)]"
                            />
                          );
                        })
                      ) : (
                        <span className={cx("flex h-11 w-11 items-center justify-center rounded-lg", ACCENT_SOFT)}>
                          {imageBusy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                        </span>
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-semibold text-[var(--text)]">
                        {dragging
                          ? form.image
                            ? "Drop to replace"
                            : "Drop to add"
                          : imageBusy
                            ? "Uploading…"
                            : form.assetIds.length > 1
                              ? `${form.assetIds.length} items attached`
                              : form.image
                                ? form.imageType === "VIDEO"
                                  ? "Video attached"
                                  : "Image attached"
                                : "Add an image or video"}
                      </p>
                      <p className="truncate text-[10.5px] text-[var(--text-muted)]">
                        {!form.image
                          ? "Drop, paste or upload. JPG, PNG, WebP, GIF or MP4."
                          : form.platforms.includes("INSTAGRAM")
                            ? form.instagramPlacement === "STORY"
                              ? "Instagram: a 24-hour Story from the first item."
                              : form.assetIds.length > 1
                                ? "Instagram: posts as a Feed carousel."
                                : form.imageType === "VIDEO"
                                  ? "Instagram: posts as a Reel."
                                  : "Instagram: posts to the Feed."
                            : form.assetIds.length > 1
                              ? "Posts as a carousel where supported."
                              : "Used in every channel's post."}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={openPicker}
                      disabled={imageBusy}
                      className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT)}
                    >
                      {imageBusy ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : form.image ? (
                        <RefreshCw size={12} />
                      ) : (
                        <ImagePlus size={12} />
                      )}
                      <span className="hidden sm:inline">{form.image ? "Replace" : "Upload"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={toggleLibrary}
                      aria-expanded={libraryOpen}
                      className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT, libraryOpen && "bg-[var(--surface-muted)]")}
                    >
                      <LayoutGrid size={12} />
                      Library
                    </button>
                    <button
                      type="button"
                      onClick={toggleBrandAssets}
                      aria-expanded={brandAssetsOpen}
                      className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT, brandAssetsOpen && "bg-[var(--surface-muted)]")}
                    >
                      <Sparkles size={12} />
                      Brand Assets
                    </button>
                    {form.image && (
                      <IconButton label="Remove media" onClick={removeMedia} size="sm">
                        <Trash2 size={13} />
                      </IconButton>
                    )}
                  </div>

                  <Collapse open={libraryOpen}>
                    <div className="mt-2 rounded-xl border border-[var(--line)] p-2.5">
                      {libraryLoading ? (
                        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                          {Array.from({ length: 8 }).map((_, index) => (
                            <Skeleton key={index} className="aspect-square w-full rounded-lg" />
                          ))}
                        </div>
                      ) : libraryAssets && libraryAssets.length > 0 ? (
                        <>
                          <p className="mb-2 flex items-center justify-between gap-2 text-[10.5px] text-[var(--text-subtle)]">
                            <span>
                              Pick one, or several for a carousel.
                              {form.assetIds.length > 1 && ` ${form.assetIds.length} selected.`}
                            </span>
                            {form.assetIds.length > 0 && (
                              <button
                                type="button"
                                onClick={removeMedia}
                                className="shrink-0 font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
                              >
                                Clear
                              </button>
                            )}
                          </p>
                          <div className="sg-scroll grid max-h-[148px] grid-cols-6 gap-1.5 overflow-y-auto overscroll-contain sm:grid-cols-8">
                            {libraryAssets.map((asset) => {
                              const order = form.assetIds.indexOf(asset.id);
                              const picked = order !== -1;
                              return (
                                <button
                                  key={asset.id}
                                  type="button"
                                  onClick={() => pickFromLibrary(asset)}
                                  aria-pressed={picked}
                                  className={cx(
                                    "relative aspect-square overflow-hidden rounded-lg border-2 transition-[border-color,transform] duration-150 active:scale-[0.96]",
                                    FOCUS_INSET,
                                    picked ? "border-[var(--accent)]" : "border-transparent hover:border-[var(--line)]",
                                  )}
                                >
                                  <MediaThumb src={asset.url} type={asset.type} className="h-full w-full" />
                                  {picked && (
                                    <span className="sg-pop absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white">
                                      {order + 1}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Nothing uploaded yet. Upload a file and it&apos;ll show up here next time.
                        </p>
                      )}
                    </div>
                  </Collapse>

                  <Collapse open={brandAssetsOpen}>
                    <div className="mt-2 rounded-xl border border-[var(--line)] p-2.5">
                      {brandAssetsLoading ? (
                        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                          {Array.from({ length: 8 }).map((_, index) => (
                            <Skeleton key={index} className="aspect-square w-full rounded-lg" />
                          ))}
                        </div>
                      ) : brandAssetOptions && brandAssetOptions.length > 0 ? (
                        <>
                          <p className="mb-2 text-[10.5px] text-[var(--text-subtle)]">
                            Approved, active brand assets — picking one reuses its existing file, never re-uploads it.
                          </p>
                          <div className="sg-scroll grid max-h-[148px] grid-cols-6 gap-1.5 overflow-y-auto overscroll-contain sm:grid-cols-8">
                            {brandAssetOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => void pickBrandAsset(option)}
                                disabled={pickingBrandAssetId === option.id}
                                title={option.brandKit ? `${option.name} · ${option.brandKit.name}` : option.name}
                                className={cx(
                                  "relative aspect-square overflow-hidden rounded-lg border-2 border-transparent transition-[border-color,transform] duration-150 hover:border-[var(--line)] active:scale-[0.96]",
                                  FOCUS_INSET,
                                )}
                              >
                                <MediaThumb src={option.url} type={option.type === "VIDEO" ? "VIDEO" : "IMAGE"} className="h-full w-full" />
                                {pickingBrandAssetId === option.id && (
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <Loader2 size={14} className="animate-spin text-white" />
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          No approved brand assets yet — add some from the Brand Assets module.
                        </p>
                      )}
                    </div>
                  </Collapse>
                </div>

                {/* Status + publishing time */}
                <div ref={(node) => { fieldRefs.current.schedule = node; }} className="scroll-mt-4">
                  <span className={LABEL}>Status</span>
                  <div
                    role="radiogroup"
                    aria-label="Status"
                    className="grid grid-cols-3 gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-0.5"
                  >
                    {STATUS_ORDER.map((status) => {
                      const meta = STATUS_META[status];
                      const Icon = meta.icon;
                      const selected = form.status === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() =>
                            update({
                              status,
                              scheduledAt:
                                status === "SCHEDULED" && (!form.scheduledAt || futureTimeError(form.scheduledAt))
                                  ? slots[1].value
                                  : form.scheduledAt,
                            })
                          }
                          className={cx(
                            "inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-[9px] px-2 text-[11px] font-semibold transition-[background-color,color,box-shadow] duration-150",
                            FOCUS_INSET,
                            selected
                              ? "bg-[var(--surface)] text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                              : "text-[var(--text-muted)] hover:text-[var(--text)]",
                          )}
                        >
                          <Icon size={13} className="shrink-0" style={{ color: meta.hue }} />
                          <span className="truncate">{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p key={form.status} className="sg-fade mt-1.5 text-[10.5px] leading-5 text-[var(--text-subtle)]">
                    {STATUS_HINT[form.status]}
                  </p>

                  <Collapse open={form.status === "SCHEDULED"}>
                    <div className="flex flex-wrap items-center gap-1.5 p-0.5 pt-2">
                      <input
                        id="social-schedule"
                        aria-label="Publishing time"
                        type="datetime-local"
                        value={form.scheduledAt}
                        min={localDateTimeValue(new Date())}
                        onChange={(event) => update({ scheduledAt: event.target.value })}
                        className={cx(INPUT, "h-8 w-full px-2.5 text-[11.5px] sm:w-[210px]")}
                      />
                      {slots.map((slot) => {
                        const active = form.scheduledAt === slot.value;
                        return (
                          <button
                            key={slot.value}
                            type="button"
                            onClick={() => update({ scheduledAt: slot.value })}
                            className={cx(
                              "h-8 rounded-lg px-2.5 text-[10.5px] font-medium transition-colors duration-150",
                              FOCUS,
                              active
                                ? ACCENT_SOFT
                                : "bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--text)]",
                            )}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  </Collapse>
                </div>

                {/* Details */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="social-title" className={LABEL}>
                      Title <span className="font-normal text-[var(--text-subtle)]">Internal only</span>
                    </label>
                    <input
                      id="social-title"
                      type="text"
                      value={form.title}
                      onChange={(event) => update({ title: event.target.value })}
                      placeholder="e.g. Autumn launch teaser"
                      className={cx(INPUT, "h-9 px-3")}
                    />
                  </div>
                  <div>
                    <label htmlFor="social-campaign" className={LABEL}>
                      Campaign
                    </label>
                    <select
                      id="social-campaign"
                      value={form.campaignId ?? ""}
                      onChange={(event) => {
                        if (event.target.value === "__new__") {
                          openNewCampaign();
                          return;
                        }
                        update({ campaignId: event.target.value || null });
                      }}
                      className={cx(INPUT, "h-9 px-3")}
                    >
                      <option value="">No campaign</option>
                      {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </option>
                      ))}
                      <option value="__new__">+ New campaign…</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Preview toggle on smaller screens, where it would stack under the form */}
              <button
                type="button"
                onClick={() => setPreviewOpen((open) => !open)}
                aria-expanded={previewOpen}
                className={cx(
                  "flex items-center justify-between border-t border-[var(--line)] px-5 py-3 text-[11.5px] font-semibold text-[var(--text)] sm:px-6 lg:hidden",
                  FOCUS_INSET,
                )}
              >
                <span className="flex items-center gap-2">
                  {previewOpen ? "Hide preview" : "Show preview"}
                  {activePreview && <PlatformMark platform={activePreview} size="xs" />}
                </span>
                <ChevronDown size={14} className={cx("text-[var(--text-muted)] transition-transform duration-200", previewOpen && "rotate-180")} />
              </button>

              {/* Preview + activity */}
              <div
                className={cx(
                  "sg-scroll border-t border-[var(--line)] bg-[var(--surface-muted)] px-5 py-4 sm:px-6 lg:block lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-t-0",
                  previewOpen ? "sg-fade block" : "hidden",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11.5px] font-semibold text-[var(--text)]">Preview</p>

                  {form.platforms.length > 1 && (
                    <Segmented label="Preview channel">
                      {form.platforms.map((platform) => (
                        <SegmentButton
                          key={platform}
                          active={activePreview === platform}
                          onClick={() => setPreviewChoice(platform)}
                          title={platformDefinition(platform).name}
                        >
                          <PlatformMark platform={platform} size="xs" />
                          <span className="sr-only">{platformDefinition(platform).name}</span>
                        </SegmentButton>
                      ))}
                    </Segmented>
                  )}
                </div>

                <div className="mx-auto mt-3 w-full max-w-[320px]">
                  {activePreview ? (
                    <PostPreview
                      key={`${activePreview}-${form.instagramPlacement}`}
                      platform={activePreview}
                      caption={previewCaption}
                      when={previewWhen}
                      media={media}
                      placement={form.instagramPlacement}
                    />
                  ) : (
                    <div className="sg-fade flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] px-6 text-center">
                      <Edit3 size={18} className="text-[var(--text-subtle)]" />
                      <p className="mt-3 text-[11.5px] leading-5 text-[var(--text-muted)]">
                        Choose a channel to see how the post will look.
                      </p>
                    </div>
                  )}
                </div>

                <p className="mx-auto mt-2.5 max-w-[320px] text-[10px] leading-4 text-[var(--text-subtle)]">
                  Previews are approximate. Each platform crops text and media in its own way.
                </p>

                {post && activity.length > 0 && (
                  <div className="sg-fade mt-6 border-t border-[var(--line)] pt-5">
                    <p className="text-[11.5px] font-semibold text-[var(--text)]">Activity</p>
                    <ol className="relative mt-3 space-y-3 border-l border-[var(--line)] pl-4">
                      {activity.map((item) => (
                        <li key={item.id} className="relative text-[11px] leading-5 text-[var(--text-muted)]">
                          <span className="absolute -left-[20.5px] top-[7px] h-2 w-2 rounded-full border-2 border-[var(--surface-muted)] bg-[var(--text-subtle)]" />
                          <span className="font-medium text-[var(--text)]">
                            {item.actor
                              ? [item.actor.firstName, item.actor.lastName].filter(Boolean).join(" ") || "Someone"
                              : "System"}
                          </span>{" "}
                          {item.description ?? item.type.toLowerCase().replace(/_/g, " ")}
                          <span className="block text-[10px] text-[var(--text-subtle)]">{formatDateTime(item.createdAt)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>

            {/* Footer: always visible */}
            <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface)] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-3">
              {error && (
                <div
                  key={errorKey}
                  role="alert"
                  className="sg-shake mb-2.5 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3 py-2 text-[11px] leading-5 text-red-600"
                >
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1">{error}</span>
                  <button
                    type="button"
                    aria-label="Dismiss error"
                    onClick={() => setError(null)}
                    className="shrink-0 rounded-md opacity-70 transition hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <p className="hidden items-center gap-1.5 text-[10.5px] text-[var(--text-subtle)] md:flex">
                  <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
                  <Kbd>Enter</Kbd>
                  to save
                  <span className="mx-1.5 h-3 w-px bg-[var(--line)]" />
                  <Kbd>Esc</Kbd>
                  to close
                </p>
                <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={requestClose}
                    disabled={saving}
                    className={cx(BTN_SECONDARY, FOCUS, "flex-1 sm:flex-none")}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || imageBusy}
                    className={cx(BTN_PRIMARY, FOCUS, "min-w-[150px] flex-[2] sm:flex-none")}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <PrimaryIcon size={14} />}
                    <span key={saving ? "saving" : primaryLabel} className="sg-fade">
                      {saving ? savingLabel : primaryLabel}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {dialog && <ActionDialog request={dialog} onClose={() => setDialog(null)} />}
    </>
  );
}

function WorkflowButton({
  children,
  icon: Icon,
  primary,
  busy,
  disabled,
  onClick,
}: {
  children: ReactNode;
  icon?: IconType;
  primary?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(primary ? BTN_PRIMARY : BTN_SECONDARY, FOCUS, "h-8 rounded-lg px-2.5 text-[11px]")}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : Icon ? <Icon size={12} /> : null}
      {children}
    </button>
  );
}

/* =============================================================================
   CHARACTER METER
============================================================================= */

function CharMeter({ platform, count }: { platform: PlatformDefinition; count: number }) {
  const ratio = count / platform.limit;
  const color = ratio > 1 ? "#DC2626" : ratio > 0.9 ? "#D97706" : "var(--accent)";

  return (
    <span className="inline-flex items-center gap-2 text-[10.5px] tabular-nums text-[var(--text-muted)]">
      <PlatformMark platform={platform.id} size="xs" label={platform.name} />
      <span className="h-1 w-14 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <span
          className="block h-full rounded-full transition-[width,background-color] duration-300"
          style={{ width: `${Math.min(ratio, 1) * 100}%`, background: color }}
        />
      </span>
      <span style={{ color: ratio > 1 ? color : undefined }}>
        {ratio > 1
          ? `${(count - platform.limit).toLocaleString("en-GB")} over`
          : `${(platform.limit - count).toLocaleString("en-GB")} left`}
      </span>
    </span>
  );
}

/* =============================================================================
   PLATFORM PREVIEWS
============================================================================= */

function PostPreview({
  platform,
  caption,
  when,
  media,
  placement,
}: {
  platform: SocialPlatform;
  caption: string;
  when: string;
  media: PreviewMedia;
  placement: InstagramPlacement;
}) {
  const empty = caption.trim() === "";
  const text = empty ? "Your caption will appear here." : caption.trim();
  const textTone = empty ? "text-[var(--text-subtle)]" : "text-[var(--text)]";
  const shell =
    "sg-rise overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)]";
  const iconTone = "text-[var(--text-muted)]";

  if (platform === "INSTAGRAM" && placement === "STORY") {
    return (
      <div className="sg-rise">
        <TallFrame media={media}>
          <div className="absolute inset-x-3 top-3 h-0.5 overflow-hidden rounded-full bg-white/35">
            <div className="h-full w-1/3 rounded-full bg-white" />
          </div>
          <div className="absolute left-3 top-6 flex items-center gap-2">
            <PreviewAvatar small ring />
            <span className="text-[11px] font-semibold text-white">syntragrid</span>
            <span className="text-[10px] text-white/70">{when === "Just now" ? "now" : when}</span>
          </div>
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2.5">
            <span className="flex-1 rounded-full border border-white/50 px-3 py-1.5 text-[10.5px] text-white/80">
              Send message
            </span>
            <Heart size={18} className="text-white" />
            <Send size={18} className="text-white" />
          </div>
        </TallFrame>
        <p className="mt-2 text-center text-[10px] text-[var(--text-subtle)]">
          Stories don&apos;t show a caption. Add any text to the image itself.
        </p>
      </div>
    );
  }

  if (platform === "INSTAGRAM") {
    const cut = 125;
    return (
      <div className={shell}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <PreviewAvatar ring />
          <span className="text-[11.5px] font-semibold text-[var(--text)]">syntragrid</span>
          <MoreHorizontal size={15} className={cx("ml-auto", iconTone)} />
        </div>
        <PreviewMediaSlot media={media} variant="square" />
        <div className={cx("flex items-center gap-3.5 px-3 pt-3", iconTone)}>
          <Heart size={17} />
          <MessageCircle size={17} />
          <Send size={17} />
          <Bookmark size={17} className="ml-auto" />
        </div>
        <p className={cx("whitespace-pre-wrap px-3 pt-2 text-[11.5px] leading-[1.55]", textTone)}>
          <span className="font-semibold text-[var(--text)]">syntragrid</span> {truncate(text, cut)}
          {text.length > cut && <span className="text-[var(--text-subtle)]"> more</span>}
        </p>
        <p className="px-3 pb-3 pt-1.5 text-[9.5px] text-[var(--text-subtle)]">{when}</p>
      </div>
    );
  }

  if (platform === "FACEBOOK") {
    const cut = 240;
    return (
      <div className={shell}>
        <div className="flex items-start gap-2.5 px-3.5 pt-3.5">
          <PreviewAvatar />
          <span className="min-w-0">
            <span className="block text-[11.5px] font-semibold text-[var(--text)]">Syntra Grid</span>
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-subtle)]">
              {when}
              <Globe size={10} />
            </span>
          </span>
          <MoreHorizontal size={15} className={cx("ml-auto", iconTone)} />
        </div>
        <p className={cx("whitespace-pre-wrap px-3.5 py-3 text-[11.5px] leading-[1.6]", textTone)}>
          {truncate(text, cut)}
          {text.length > cut && <span className="font-medium text-[var(--text-muted)]"> See more</span>}
        </p>
        <PreviewMediaSlot media={media} variant="inline" emptyClassName="px-3.5 pb-3" />
        <div className="mx-3.5 border-t border-[var(--line)]" />
        <div className={cx("grid grid-cols-3 px-1.5 py-1.5 text-[10.5px] font-medium", iconTone)}>
          {[
            { icon: ThumbsUp, label: "Like" },
            { icon: MessageCircle, label: "Comment" },
            { icon: Share2, label: "Share" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center justify-center gap-1.5 py-1.5">
              <Icon size={13} />
              {label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (platform === "LINKEDIN") {
    const cut = 210;
    return (
      <div className={shell}>
        <div className="flex items-start gap-2.5 px-3.5 pt-3.5">
          <PreviewAvatar square />
          <span className="min-w-0">
            <span className="block text-[11.5px] font-semibold text-[var(--text)]">Syntra Grid</span>
            <span className="block text-[10px] text-[var(--text-muted)]">Software agency</span>
            <span className="block text-[10px] text-[var(--text-subtle)]">{when}</span>
          </span>
          <MoreHorizontal size={15} className={cx("ml-auto", iconTone)} />
        </div>
        <p className={cx("whitespace-pre-wrap px-3.5 py-3 text-[11.5px] leading-[1.6]", textTone)}>
          {truncate(text, cut)}
          {text.length > cut && <span className="font-medium text-[var(--text-muted)]"> see more</span>}
        </p>
        <PreviewMediaSlot media={media} variant="inline" emptyClassName="px-3.5 pb-3" />
        <div className="mx-3.5 border-t border-[var(--line)]" />
        <div className={cx("grid grid-cols-4 px-1.5 py-1.5 text-[10px] font-medium", iconTone)}>
          {[
            { icon: ThumbsUp, label: "Like" },
            { icon: MessageCircle, label: "Comment" },
            { icon: Repeat2, label: "Repost" },
            { icon: Send, label: "Send" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center justify-center gap-1.5 py-1.5">
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (platform === "TIKTOK") {
    return (
      <div className="sg-rise">
        <TallFrame media={media}>
          <div className="absolute bottom-24 right-2.5 flex flex-col items-center gap-4 text-white">
            <PreviewAvatar small />
            <Heart size={22} />
            <MessageCircle size={22} />
            <Bookmark size={22} />
            <Share2 size={22} />
          </div>
          <div className="absolute bottom-3 left-3 right-14 text-white">
            <p className="text-[11.5px] font-semibold">@syntragrid</p>
            <p className={cx("mt-1 whitespace-pre-wrap text-[11px] leading-[1.45]", empty ? "text-white/60" : "text-white/90")}>
              {truncate(text, 150)}
            </p>
          </div>
        </TallFrame>
        {media.type !== "VIDEO" && (
          <p className="mt-2 text-center text-[10px] text-[var(--text-subtle)]">TikTok posts work best with a vertical video.</p>
        )}
      </div>
    );
  }

  if (platform === "YOUTUBE") {
    const firstLine = text.split("\n")[0] ?? text;
    return (
      <div className={shell}>
        <PreviewMediaSlot media={media} variant="wide" />
        <div className="flex gap-2.5 p-3">
          <PreviewAvatar />
          <div className="min-w-0 flex-1">
            <p className={cx("line-clamp-2 text-[12px] font-semibold leading-5", textTone)}>{truncate(firstLine, 100)}</p>
            <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">Syntra Grid, {when}</p>
          </div>
          <MoreHorizontal size={15} className={cx("shrink-0", iconTone)} />
        </div>
        {media.type !== "VIDEO" && (
          <p className="px-3 pb-3 text-[10px] text-[var(--text-subtle)]">YouTube needs a video to publish.</p>
        )}
      </div>
    );
  }

  /* X */
  const limit = platformDefinition("X").limit;
  const within = text.slice(0, limit);
  const overflow = text.slice(limit);

  return (
    <div className={cx(shell, "flex gap-2.5 p-3.5")}>
      <PreviewAvatar />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-[11.5px]">
          <span className="font-semibold text-[var(--text)]">Syntra Grid</span>
          <span className="text-[var(--text-subtle)]">@syntragrid</span>
          <span className="text-[10px] text-[var(--text-subtle)]">{when}</span>
        </p>
        <p className={cx("mt-1 whitespace-pre-wrap break-words text-[12px] leading-[1.5]", textTone)}>
          {within}
          {overflow && <span className="rounded-sm bg-red-500/15 text-red-600">{overflow}</span>}
        </p>
        <PreviewMediaSlot
          media={media}
          variant="inline"
          imageClassName="mt-2.5 rounded-2xl border border-[var(--line)]"
          emptyClassName="mt-2.5"
        />
        <div className={cx("mt-3 flex max-w-[260px] items-center justify-between", iconTone)}>
          <MessageCircle size={15} />
          <Repeat2 size={15} />
          <Heart size={15} />
          <Bookmark size={15} />
        </div>
      </div>
    </div>
  );
}

/** A 9:16 phone-style frame for Stories and TikTok. Overlays never block clicks. */
function TallFrame({ media, children }: { media: PreviewMedia; children: ReactNode }) {
  const { image, type, busy, dragging, onAdd, onRemove, dropProps } = media;

  return (
    <div
      {...dropProps}
      className="group relative mx-auto aspect-[9/16] w-full max-w-[230px] overflow-hidden rounded-[24px] bg-neutral-900 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.6)]"
    >
      {image ? (
        type === "VIDEO" ? (
          <video src={image} muted playsInline loop autoPlay className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <img src={image} alt="Attached media" className="absolute inset-0 h-full w-full object-cover" />
        )
      ) : (
        <button
          type="button"
          onClick={onAdd}
          disabled={busy}
          className={cx(
            "absolute inset-0 flex flex-col items-center justify-center gap-1.5 transition-colors",
            FOCUS_INSET,
            dragging ? "text-white" : "text-white/60 hover:text-white",
          )}
        >
          {busy ? <Loader2 size={24} className="animate-spin" /> : <ImagePlus size={26} />}
          <span className="mt-1 text-[12px] font-semibold">
            {busy ? "Uploading…" : dragging ? "Drop to add" : "Add a vertical image or video"}
          </span>
        </button>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/35" />
      <div className="pointer-events-none absolute inset-0">{children}</div>

      {(dragging || busy) && image && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-[11.5px] font-semibold text-white">
          {busy ? <Loader2 size={20} className="animate-spin" /> : "Drop to replace"}
        </div>
      )}

      {image && (
        <div className="absolute right-2 top-10 flex gap-1.5 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <button type="button" onClick={onAdd} disabled={busy} className={OVERLAY_BTN}>
            <RefreshCw size={12} />
            Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove media"
            title="Remove media"
            className={cx(OVERLAY_BTN, "w-8 justify-center px-0")}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function PreviewMediaSlot({
  media,
  variant,
  imageClassName,
  emptyClassName,
}: {
  media: PreviewMedia;
  variant: "square" | "wide" | "inline";
  imageClassName?: string;
  emptyClassName?: string;
}) {
  const { image, type, busy, dragging, onAdd, onRemove, dropProps } = media;
  const frame = variant === "square" ? "aspect-square" : variant === "wide" ? "aspect-video" : "max-h-[240px]";

  if (image) {
    return (
      <div {...dropProps} className={cx("group relative overflow-hidden", imageClassName)}>
        {type === "VIDEO" ? (
          <>
            <video src={image} muted playsInline className={cx("block w-full bg-black object-cover", frame)} />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white">
                <Play size={18} className="ml-0.5" fill="currentColor" />
              </span>
            </span>
          </>
        ) : (
          <img src={image} alt="Attached media" className={cx("block w-full object-cover", frame)} />
        )}

        {(dragging || busy) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-[11.5px] font-semibold text-white">
            {busy ? <Loader2 size={20} className="animate-spin" /> : "Drop to replace"}
          </div>
        )}

        <div className="absolute right-2 top-2 flex gap-1.5 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <button type="button" onClick={onAdd} disabled={busy} className={OVERLAY_BTN}>
            <RefreshCw size={12} />
            Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove media"
            title="Remove media"
            className={cx(OVERLAY_BTN, "w-8 justify-center px-0")}
          >
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  if (variant === "square" || variant === "wide") {
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        {...dropProps}
        className={cx(
          "flex w-full flex-col items-center justify-center gap-1.5 transition-colors duration-150",
          frame,
          FOCUS_INSET,
          dragging
            ? "bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] text-[var(--accent)]"
            : "bg-[color-mix(in_srgb,var(--text)_5%,var(--surface))] text-[var(--text-subtle)] hover:text-[var(--accent)]",
        )}
      >
        {busy ? <Loader2 size={24} className="animate-spin" /> : <ImagePlus size={26} />}
        <span className="mt-1 text-[12px] font-semibold">
          {busy ? "Uploading…" : dragging ? "Drop to add" : variant === "wide" ? "Add a video" : "Add an image"}
        </span>
        {!busy && !dragging && <span className="text-[10.5px]">Click, drop or paste</span>}
      </button>
    );
  }

  return (
    <div className={emptyClassName}>
      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        {...dropProps}
        className={cx(
          "flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-[11px] font-medium transition-colors duration-150",
          FOCUS,
          dragging
            ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]"
            : "border-[var(--line)] text-[var(--text-muted)] hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] hover:text-[var(--accent)]",
        )}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
        {busy ? "Uploading…" : dragging ? "Drop to add" : "Add an image"}
      </button>
    </div>
  );
}

function PreviewAvatar({ square, ring, small }: { square?: boolean; ring?: boolean; small?: boolean }) {
  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center bg-[var(--accent)] font-bold tracking-tight text-white",
        small ? "h-7 w-7 text-[9px]" : "h-9 w-9 text-[10.5px]",
        square ? "rounded-lg" : "rounded-full",
        ring && "ring-2 ring-[#D6246E] ring-offset-2 ring-offset-[var(--surface)]",
      )}
    >
      SG
    </span>
  );
}

/* =============================================================================
   SMALL PRIMITIVES
============================================================================= */

const MARK_SIZES = {
  xs: "h-4 w-4 rounded-[5px]",
  sm: "h-5 w-5 rounded-md",
  md: "h-7 w-7 rounded-[9px]",
  lg: "h-11 w-11 rounded-[14px]",
} as const;

const MARK_ICON_PIXELS = {
  xs: 9,
  sm: 11,
  md: 15,
  lg: 22,
} as const;

function PlatformMark({
  platform,
  size = "sm",
  ring,
  label,
}: {
  platform: SocialPlatform;
  size?: keyof typeof MARK_SIZES;
  ring?: boolean;
  /** Pass the name only when this mark is the sole identifier on screen. */
  label?: string;
}) {
  const definition = platformDefinition(platform);
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center leading-none",
        MARK_SIZES[size],
        ring && "ring-2 ring-[var(--surface)]",
      )}
      style={{ background: mix(definition.color, 13, "var(--surface)") }}
      aria-hidden={label ? undefined : true}
    >
      <SocialPlatformIcon platform={platform} size={MARK_ICON_PIXELS[size]} color={definition.color} label={label} />
    </span>
  );
}

function PlatformStack({ platforms, size = "sm" }: { platforms: SocialPlatform[]; size?: "sm" | "md" }) {
  const names = platforms.map((platform) => platformDefinition(platform).name).join(", ");
  return (
    <span className="flex -space-x-1" title={names}>
      {platforms.map((platform) => (
        <PlatformMark key={platform} platform={platform} size={size} ring />
      ))}
      <span className="sr-only">{names}</span>
    </span>
  );
}

/** Always shows the real backend status, so a failed post never looks scheduled. */
function StatusPill({ status, large }: { status: RealPostStatus; large?: boolean }) {
  const meta = REAL_STATUS_META[status];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full font-semibold",
        large ? "px-2.5 py-1 text-[10.5px]" : "px-2 py-0.5 text-[10px]",
      )}
      style={{ background: mix(meta.hue, 13), color: meta.hue }}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full bg-current", status === "PUBLISHING" && "animate-pulse")} />
      {meta.label}
    </span>
  );
}

function MediaThumb({
  src,
  type,
  className,
}: {
  src: string;
  type: "IMAGE" | "VIDEO" | null;
  className?: string;
}) {
  if (type === "VIDEO") {
    return (
      <span className={cx("relative block overflow-hidden bg-black", className)}>
        <video src={src} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Play size={14} className="text-white drop-shadow" fill="currentColor" />
        </span>
      </span>
    );
  }
  return <img src={src} alt="" loading="lazy" className={cx("object-cover", className)} />;
}

/** Smooth height animation without measuring, via the grid-rows 0fr → 1fr trick.
 *  Collapsed content is made invisible so it can't take keyboard focus. */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      data-collapsed={open ? "false" : "true"}
      aria-hidden={!open}
      className={cx(
        "grid transition-[grid-template-rows,opacity,visibility] duration-[250ms] ease-[cubic-bezier(.2,.8,.2,1)]",
        open ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={cx("sg-skeleton block rounded-full", className)} style={style} />;
}

function Dot({ color }: { color: string }) {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />;
}

function Kbd({ children, inverse, className }: { children: ReactNode; inverse?: boolean; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 font-sans text-[10px] font-semibold",
        inverse
          ? "bg-white/20 text-white"
          : "border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

function IconButton({
  label,
  onClick,
  children,
  bordered,
  expanded,
  size = "md",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  bordered?: boolean;
  expanded?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      onClick={onClick}
      className={cx(
        "flex shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--surface-muted)] hover:text-[var(--text)] active:scale-[0.94]",
        FOCUS,
        size === "sm" ? "h-7 w-7" : "h-9 w-9",
        bordered && "rounded-xl border border-[var(--line)] bg-[var(--surface)]",
        expanded && "bg-[var(--surface-muted)] text-[var(--text)]",
      )}
    >
      {children}
    </button>
  );
}

function Segmented({ label, children, compact }: { label: string; children: ReactNode; compact?: boolean }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(compact ? "h-7" : "h-9", "inline-flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-0.5")}
    >
      {children}
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
  title,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cx(
        "inline-flex h-full min-w-8 items-center justify-center gap-1.5 rounded-[9px] px-2.5 text-[11px] font-medium transition-[background-color,color,box-shadow] duration-150",
        FOCUS_INSET,
        active
          ? "bg-[var(--surface)] text-[var(--text)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
          : "text-[var(--text-muted)] hover:text-[var(--text)]",
        disabled && "cursor-not-allowed opacity-60 hover:text-[var(--text-muted)]",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: IconType;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
      <span className={cx("flex h-12 w-12 items-center justify-center rounded-2xl", ACCENT_SOFT)}>
        <Icon size={20} />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.015em] text-[var(--text)]">{title}</h3>
      <p className="mt-1.5 max-w-[340px] text-[11.5px] leading-5 text-[var(--text-muted)]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}