/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
  type RefObject,
} from "react";

import {
  Activity,
  Bookmark,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Edit3,
  FileText,
  Heart,
  ImagePlus,
  Inbox,
  Info,
  LayoutGrid,
  List,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Repeat2,
  Search,
  Send,
  ShieldCheck,
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

/** The UI's existing 3-stage pipeline bucket. realStatus (below) always
 *  carries the true backend status for an honest secondary badge — this
 *  bucket only decides which of the existing 3 pipeline columns a post
 *  shows up in, so the existing Pipeline/PostCard design needs no changes. */
type ContentStatus = "DRAFT" | "READY" | "SCHEDULED";

type WorkspaceView = "content" | "publishing" | "accounts" | "engagement" | "analytics";

type ContentFilter = "ALL" | ContentStatus;

type PlatformFilter = "ALL" | SocialPlatform;

type LibraryLayout = "list" | "grid";

type PostTarget = {
  accountId: string;
  platform: SocialPlatform;
  caption: string | null;
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
  assetIds: string[];
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

/* =============================================================================
   CONSTANTS
============================================================================= */

const BANNER_KEY = "syntragrid.social-media.preview-banner.v1";
const LAYOUT_KEY = "syntragrid.social-media.layout.v1";

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
    // TikTok's mark is conventionally monochrome and theme-adaptive
    // (black on light backgrounds, white on dark) rather than a fixed
    // hex — var(--text) keeps it legible in both themes, matching how
    // X's glyph already works below.
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

const CLOSED_COMPOSER: ComposerState = {
  open: false,
  editingId: null,
  presetDate: null,
};

/** Maps the real backend status onto the UI's existing 3-stage pipeline —
 *  no new pipeline column, every real status still lands somewhere
 *  sensible. REAL_STATUS_META (below) carries the honest, specific label
 *  shown as a secondary badge so e.g. a FAILED post never just looks like
 *  a generic "Scheduled" card. */
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

/* Shared class strings -------------------------------------------------------- */

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";

const FOCUS_INSET =
  "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]";

const CARD =
  "rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

const BTN_PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[11.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_-10px_var(--accent)] transition hover:brightness-110 active:translate-y-px disabled:pointer-events-none disabled:opacity-50";

const BTN_SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-[11.5px] font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)] disabled:pointer-events-none disabled:opacity-50";

const ACCENT_SOFT =
  "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]";

const INPUT =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[12px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_14%,transparent)]";

const OVERLAY_BTN =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-black/60 px-2.5 text-[10.5px] font-semibold text-white backdrop-blur-sm transition hover:bg-black/75 outline-none focus-visible:ring-2 focus-visible:ring-white";

const IMAGE_MAX_EDGE = 1440;
const IMAGE_MAX_BYTES = 15 * 1024 * 1024;

const SG_STYLES = `
@keyframes sg-rise { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes sg-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sg-pop { from { opacity: 0; transform: translateY(-4px) scale(.97); } to { opacity: 1; transform: none; } }
.sg-rise { animation: sg-rise .24s cubic-bezier(.2,.8,.2,1) both; }
.sg-fade { animation: sg-fade .18s ease-out both; }
.sg-pop { animation: sg-pop .14s ease-out both; transform-origin: top right; }
@media (prefers-reduced-motion: reduce) { .sg-rise, .sg-fade, .sg-pop { animation: none; } }
`;

/* =============================================================================
   HELPERS
============================================================================= */

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

  return [
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

/* =============================================================================
   API CLIENT

   Everything below talks to the real, permission-enforced, database-backed
   Social Media API (app/api/admin/social-media/**) — there is no
   localStorage fallback for posts/accounts/media/campaigns/analytics any
   more; STORAGE_KEY above is now unused dead weight from the previous
   local-only version and is kept only as a reference for the (harmless)
   layout/banner preference keys that still legitimately live in
   localStorage below.
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
  targets: Array<{ accountId: string; platform: SocialPlatform; caption: string | null; account: ApiAccountRef }>;
  assets: Array<{ assetId: string; position: number; asset: ApiAsset }>;
};

function fromApiPost(api: ApiPost): SocialPost {
  const targets: PostTarget[] = api.targets.map((target) => ({
    accountId: target.accountId,
    platform: target.platform,
    caption: target.caption,
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
  targets: { accountId: string; caption: string | null }[];
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

async function fetchAccountsApi(): Promise<ApiPlatformRow[]> {
  const payload = await apiRequest<{ platforms: ApiPlatformRow[] }>("/accounts");
  return payload.platforms;
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

// Resizes to a sensible size and re-encodes as JPEG so images fit in browser storage.
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

/* =============================================================================
   MAIN COMPONENT
============================================================================= */

export default function SocialMediaTab() {
  const [view, setView] = useState<WorkspaceView>("content");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [postsStatus, setPostsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [accounts, setAccounts] = useState<ApiPlatformRow[]>([]);
  const [accountsStatus, setAccountsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [composer, setComposer] = useState<ComposerState>(CLOSED_COMPOSER);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentFilter>("ALL");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("ALL");
  const [layout, setLayout] = useState<LibraryLayout>("list");
  const [bannerOpen, setBannerOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  /* Real data -------------------------------------------------------------- */

  const refreshPosts = useCallback(() => {
    setPostsStatus("loading");
    fetchPostsApi()
      .then((result) => {
        setPosts(result);
        setPostsStatus("ready");
      })
      .catch((error) => {
        setPostsStatus("error");
        setNotice({ id: nowMs(), message: error instanceof Error ? error.message : "Unable to load posts." });
      });
  }, []);

  const refreshAccounts = useCallback(() => {
    setAccountsStatus("loading");
    fetchAccountsApi()
      .then((result) => {
        setAccounts(result);
        setAccountsStatus("ready");
      })
      .catch((error) => {
        setAccountsStatus("error");
        setNotice({ id: nowMs(), message: error instanceof Error ? error.message : "Unable to load accounts." });
      });
  }, []);

  useEffect(() => {
    refreshPosts();
    refreshAccounts();
    fetchCampaignsApi().then(setCampaigns).catch(() => undefined);

    setBannerOpen(readFlag(BANNER_KEY) !== "dismissed");
    setLayout(readFlag(LAYOUT_KEY) === "grid" ? "grid" : "list");
    setLoaded(true);
  }, [refreshPosts, refreshAccounts]);

  // Reconnecting an account redirects back here with ?social=connected
  // etc. — refresh so the Accounts view reflects reality immediately
  // rather than waiting for the next manual refresh.
  useEffect(() => {
    if (!loaded) return;
    const params = new URLSearchParams(window.location.search);
    const socialStatus = params.get("social");
    if (!socialStatus) return;

    refreshAccounts();

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

    setNotice({ id: nowMs(), message: messages[socialStatus] ?? "Connection finished." });

    const url = new URL(window.location.href);
    url.searchParams.delete("social");
    url.searchParams.delete("platform");
    url.searchParams.delete("missing");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [loaded, refreshAccounts]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(
      () => setNotice(null),
      notice.action ? 6000 : 3200,
    );
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const notify = useCallback((message: string, action?: Notice["action"]) => {
    setNotice({ id: nowMs(), message, action });
  }, []);

  const notifyError = useCallback((error: unknown, fallback: string) => {
    setNotice({ id: nowMs(), message: error instanceof Error ? error.message : fallback });
  }, []);

  /* Connected accounts available right now, by platform — the composer
     only ever lets a user target an account that's genuinely connected. */
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
        if (platformFilter !== "ALL" && !post.platforms.includes(platformFilter)) {
          return false;
        }
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
            post.status === "SCHEDULED" &&
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

  const openCreate = useCallback((presetDate: string | null = null) => {
    setComposer({ open: true, editingId: null, presetDate });
  }, []);

  const openEdit = useCallback((id: string) => {
    setComposer({ open: true, editingId: id, presetDate: null });
  }, []);

  const closeComposer = useCallback(() => setComposer(CLOSED_COMPOSER), []);

  const savePost = useCallback(
    async (form: PostForm, editingId: string | null) => {
      const targets = form.platforms.map((platform) => {
        const account = connectedAccountsByPlatform.get(platform)?.[0];
        return account
          ? { accountId: account.id, caption: form.platformCaptions[platform]?.trim() || null }
          : null;
      }).filter((target): target is { accountId: string; caption: string | null } => target !== null);

      const payload: CreatePostPayload = {
        title: form.title.trim() || null,
        caption: form.caption.trim(),
        category: form.category.trim() || null,
        campaignId: form.campaignId,
        targets,
        assetIds: form.assetIds,
      };

      try {
        const saved = editingId ? await updatePostApi(editingId, payload) : await createPostApi(payload);

        setPosts((current) =>
          editingId ? current.map((post) => (post.id === editingId ? saved : post)) : [saved, ...current],
        );

        // A READY selection in the composer means "submit for review" —
        // the real workflow action, not just a locally-set status.
        let finalPost = saved;
        if (form.status === "READY" && saved.realStatus === "DRAFT") {
          finalPost = await submitPostApi(saved.id);
          setPosts((current) => current.map((post) => (post.id === finalPost.id ? finalPost : post)));
        }

        notify(
          editingId
            ? "Changes saved"
            : form.status === "READY"
              ? "Submitted for review"
              : "Draft saved",
        );

        closeComposer();
      } catch (error) {
        notifyError(error, "Unable to save this post.");
      }
    },
    [closeComposer, notify, notifyError, connectedAccountsByPlatform],
  );

  const deletePost = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this post? This cannot be undone.")) return;

      try {
        await deletePostApi(id);
        setPosts((current) => current.filter((post) => post.id !== id));
        notify("Post deleted");
      } catch (error) {
        notifyError(error, "Unable to delete this post.");
      }
    },
    [notify, notifyError],
  );

  const duplicatePost = useCallback(
    async (id: string) => {
      try {
        const duplicate = await duplicatePostApi(id);
        setPosts((current) => [duplicate, ...current]);
        notify("Duplicated as a draft");
      } catch (error) {
        notifyError(error, "Unable to duplicate this post.");
      }
    },
    [notify, notifyError],
  );

  const runWorkflowAction = useCallback(
    async (id: string, action: (id: string) => Promise<SocialPost>, successMessage: string) => {
      try {
        const updated = await action(id);
        setPosts((current) => current.map((post) => (post.id === id ? updated : post)));
        notify(successMessage);
      } catch (error) {
        notifyError(error, "That action could not be completed.");
      }
    },
    [notify, notifyError],
  );

  const submitForReview = useCallback((id: string) => runWorkflowAction(id, submitPostApi, "Submitted for review"), [runWorkflowAction]);
  const approvePostAction = useCallback((id: string) => runWorkflowAction(id, approvePostApi, "Approved"), [runWorkflowAction]);
  const cancelPostAction = useCallback((id: string) => runWorkflowAction(id, cancelPostApi, "Cancelled"), [runWorkflowAction]);

  const requestChangesAction = useCallback(
    (id: string) => {
      const notes = window.prompt("What changes are needed?");
      if (!notes || !notes.trim()) return;
      void runWorkflowAction(id, (postId) => requestChangesApi(postId, notes.trim()), "Changes requested");
    },
    [runWorkflowAction],
  );

  const schedulePostAction = useCallback(
    (id: string, scheduledAtLocal: string) => {
      const iso = new Date(scheduledAtLocal).toISOString();
      void runWorkflowAction(id, (postId) => schedulePostApi(postId, iso), `Scheduled for ${formatDateTime(iso)}`);
    },
    [runWorkflowAction],
  );

  const createCampaign = useCallback(async (name: string) => {
    const campaign = await createCampaignApi(name);
    setCampaigns((prev) => [...prev, campaign]);
    return campaign;
  }, []);

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

  /* Keyboard shortcuts: N = new post, / = search ------------------------------ */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (composer.open || event.metaKey || event.ctrlKey || event.altKey) return;
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
  }, [composer.open, openCreate, view]);

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
            Plan, write and review Syntra Grid&apos;s posts for Instagram, LinkedIn and X.
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
          className="-mb-px flex min-w-0 gap-1 overflow-x-auto"
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
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setView(item.id)}
                className={cx(
                  "inline-flex h-11 shrink-0 items-center gap-2 rounded-t-lg border-b-2 px-3 text-[12px] font-medium transition-colors",
                  FOCUS_INSET,
                  active
                    ? "border-[var(--accent)] text-[var(--text)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                <Icon size={15} className={active ? "text-[var(--accent)]" : undefined} />
                {item.label}
                {badge > 0 && (
                  <span
                    className={cx(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      active
                        ? ACCENT_SOFT
                        : "bg-[var(--surface-muted)] text-[var(--text-muted)]",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            refreshPosts();
            refreshAccounts();
          }}
          className="mb-3.5 hidden shrink-0 items-center gap-1.5 text-[10.5px] text-[var(--text-subtle)] transition hover:text-[var(--text)] md:inline-flex"
        >
          <RefreshCw size={11} className={postsStatus === "loading" || accountsStatus === "loading" ? "animate-spin" : undefined} />
          Refresh
        </button>
      </nav>

      {/* Preview banner */}
      {bannerOpen && (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3">
          <Info size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <p className="min-w-0 flex-1 text-[11.5px] leading-5 text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text)]">
              {totalConnectedAccounts > 0
                ? `${totalConnectedAccounts} account${totalConnectedAccounts === 1 ? "" : "s"} connected.`
                : "No accounts connected yet."}
            </span>{" "}
            Posts, campaigns and media are saved to Syntra Grid&apos;s database. Scheduled posts
            publish automatically once an account is connected for their channel.
          </p>
          <IconButton label="Dismiss" onClick={dismissBanner} size="sm">
            <X size={13} />
          </IconButton>
        </div>
      )}

      {/* Views */}
      {view === "content" && (
        <ContentStudio
          posts={filteredPosts}
          counts={counts}
          nextScheduled={nextScheduled}
          query={query}
          statusFilter={statusFilter}
          platformFilter={platformFilter}
          layout={layout}
          searchRef={searchRef}
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
        <PublishingWorkspace posts={posts} onCreate={openCreate} onEdit={openEdit} />
      )}

      {view === "accounts" && (
        <AccountsWorkspace
          platforms={accounts}
          status={accountsStatus}
          onRefresh={refreshAccounts}
          onDisconnect={(id: string) => {
            disconnectAccountApi(id)
              .then(() => {
                refreshAccounts();
                notify("Account disconnected");
              })
              .catch((error) => notifyError(error, "Unable to disconnect this account."));
          }}
        />
      )}

      {view === "engagement" && (
        <EngagementWorkspace
          connectedAccounts={totalConnectedAccounts}
          onGoToAccounts={() => setView("accounts")}
        />
      )}

      {view === "analytics" && <AnalyticsWorkspace />}

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
        />
      )}

      {/* Toast */}
      {notice && (
        <div className="fixed bottom-5 left-1/2 z-[200] w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 sm:left-auto sm:right-6 sm:w-auto sm:min-w-[300px] sm:translate-x-0">
          <div
            key={notice.id}
            role="status"
            aria-live="polite"
            className="sg-rise flex items-center gap-3 rounded-2xl bg-[var(--text)] py-2.5 pl-4 pr-2.5 text-[11.5px] font-medium text-[var(--surface)] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.5)]"
          >
            <Check size={15} className="shrink-0 opacity-80" />
            <span className="min-w-0 flex-1">{notice.message}</span>

            {notice.action && (
              <button
                type="button"
                onClick={() => notice.action?.run()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[color-mix(in_srgb,var(--surface)_16%,transparent)] px-2.5 text-[11px] font-semibold transition hover:bg-[color-mix(in_srgb,var(--surface)_26%,transparent)]"
              >
                <Undo2 size={13} />
                {notice.action.label}
              </button>
            )}

            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setNotice(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg opacity-60 transition hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================================================================
   CONTENT STUDIO
============================================================================= */

function ContentStudio({
  posts,
  counts,
  nextScheduled,
  query,
  statusFilter,
  platformFilter,
  layout,
  searchRef,
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
  nextScheduled: SocialPost | null;
  query: string;
  statusFilter: ContentFilter;
  platformFilter: PlatformFilter;
  layout: LibraryLayout;
  searchRef: RefObject<HTMLInputElement | null>;
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

  return (
    <div className="space-y-5">
      <Pipeline
        counts={counts}
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
              {filtering ? `${posts.length} of ${counts.total}` : counts.total}
            </span>
            {filtering && (
              <button
                type="button"
                onClick={onClearFilters}
                className={cx(
                  "rounded-md text-[11px] font-medium text-[var(--accent)] hover:underline",
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

        {/* Body */}
        {posts.length === 0 ? (
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
        ) : layout === "list" ? (
          <div className="divide-y divide-[var(--line)] [&>*:last-child]:rounded-b-[22px]">
            {posts.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                onEdit={() => onEdit(post.id)}
                onDuplicate={() => onDuplicate(post.id)}
                onDelete={() => onDelete(post.id)}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onEdit={() => onEdit(post.id)}
                onDuplicate={() => onDuplicate(post.id)}
                onDelete={() => onDelete(post.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* =============================================================================
   PIPELINE (draft → review → scheduled)
============================================================================= */

function Pipeline({
  counts,
  active,
  onSelect,
  nextScheduled,
  onOpen,
  onCreate,
}: {
  counts: Counts;
  active: ContentFilter;
  onSelect: (value: ContentFilter) => void;
  nextScheduled: SocialPost | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <section
      className={cx(CARD, "grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px]")}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-[var(--text)]">Content pipeline</h2>
          {active !== "ALL" && (
            <button
              type="button"
              onClick={() => onSelect("ALL")}
              className={cx(
                "rounded-md text-[11px] font-medium text-[var(--accent)] hover:underline",
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
                    "min-w-0 flex-1 rounded-2xl border p-3 text-left transition sm:p-4",
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
                  <span className="mt-2 block text-[26px] font-semibold leading-none tabular-nums tracking-[-0.04em] text-[var(--text)] sm:text-[30px]">
                    {value}
                  </span>
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

        {nextScheduled?.scheduledAt ? (
          <button
            type="button"
            onClick={() => onOpen(nextScheduled.id)}
            className={cx("mt-2 flex flex-1 flex-col rounded-xl text-left", FOCUS)}
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
                <ChevronRight size={13} />
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
  onEdit,
  onDuplicate,
  onDelete,
}: {
  post: SocialPost;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex gap-3.5 px-4 py-4 transition-colors hover:bg-[color-mix(in_srgb,var(--surface-muted)_70%,transparent)] sm:gap-4 sm:px-5">
      <div className="pt-0.5">
        <PlatformStack platforms={post.platforms} size="md" />
      </div>

      <button
        type="button"
        onClick={onEdit}
        className={cx("min-w-0 flex-1 rounded-lg text-left", FOCUS)}
      >
        <p className="line-clamp-2 whitespace-pre-wrap text-[12.5px] leading-6 text-[var(--text)]">
          {post.caption}
        </p>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10.5px] text-[var(--text-muted)]">
          <StatusPill status={post.status} />
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
          className={cx("hidden shrink-0 overflow-hidden rounded-xl border border-[var(--line)] sm:block", FOCUS)}
        >
          <img src={post.image} alt="" className="h-14 w-14 object-cover" />
        </button>
      )}

      <div className="flex shrink-0 items-start gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
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
  onEdit,
  onDuplicate,
  onDelete,
}: {
  post: SocialPost;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="flex flex-col rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))] hover:shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-2">
        <PlatformStack platforms={post.platforms} size="md" />
        <RowMenu onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>

      {post.image && (
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit post"
          className={cx("mt-3 overflow-hidden rounded-xl border border-[var(--line)]", FOCUS)}
        >
          <img src={post.image} alt="" className="aspect-[4/3] w-full object-cover" />
        </button>
      )}

      <button
        type="button"
        onClick={onEdit}
        className={cx("mt-3 flex-1 rounded-lg text-left", FOCUS)}
      >
        <p className={cx(post.image ? "line-clamp-3" : "line-clamp-5", "whitespace-pre-wrap text-[12.5px] leading-6 text-[var(--text)]")}>
          {post.caption}
        </p>
      </button>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <StatusPill status={post.status} />
        <span className="truncate text-[10.5px] tabular-nums text-[var(--text-subtle)]">
          {post.scheduledAt ? formatDateTime(post.scheduledAt) : editedLabel(post.updatedAt)}
        </span>
      </div>
    </article>
  );
}

function RowMenu({
  onDuplicate,
  onDelete,
}: {
  onDuplicate: () => void;
  onDelete: () => void;
}) {
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
      <IconButton
        label="More actions"
        onClick={() => setOpen((value) => !value)}
        expanded={open}
      >
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
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11.5px] font-medium transition",
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
  onCreate,
  onEdit,
}: {
  posts: SocialPost[];
  onCreate: (presetDate: string | null) => void;
  onEdit: (id: string) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => dateKey(new Date()));

  const todayKey = dateKey(new Date());

  // Every post with a scheduledAt belongs on the calendar — including ones
  // that have since resolved (published/failed/cancelled) — so the day view
  // is an honest record, not just a forward-looking queue. The UI bucket
  // ("SCHEDULED") lumps those resolved states together; realStatus is what
  // decides how each entry is actually labelled and whether it still counts
  // as something that will post automatically.
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
      (_, index) =>
        new Date(first.getFullYear(), first.getMonth(), 1 - offset + index),
    );
  }, [month]);

  const selectedDate = keyToDate(selected);
  const selectedPosts = byDay.get(selected) ?? [];
  const canPlanSelected = selected >= todayKey;

  const planFor = (key: string) => {
    const preset =
      key === todayKey ? localDateTimeValue(nextFullHour()) : `${key}T09:00`;
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
            <h2 className="text-[17px] font-semibold tracking-[-0.025em] text-[var(--text)]">
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
              className="px-2 py-2.5 text-center text-[10.5px] font-medium text-[var(--text-subtle)] sm:text-left sm:px-3"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
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
                  "relative flex min-h-[62px] flex-col border-[var(--line)] p-1.5 text-left transition-colors sm:min-h-[106px] sm:p-2",
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
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] tabular-nums",
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

                {/* Chips on larger screens */}
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

                {/* Dots on small screens */}
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
                    "flex w-full gap-3 rounded-xl p-2.5 text-left transition hover:bg-[var(--surface-muted)]",
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
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold"
                        style={{ background: mix(REAL_STATUS_META[post.realStatus].hue, 14), color: REAL_STATUS_META[post.realStatus].hue }}
                      >
                        {REAL_STATUS_META[post.realStatus].label}
                      </span>
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
                "mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] text-[11.5px] font-semibold text-[var(--accent)] transition hover:bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]",
                FOCUS,
              )}
            >
              <Plus size={14} />
              Plan a post for this day
            </button>
          )}
        </section>

        <section className={cx(CARD, "p-4 sm:p-5")}>
          <h3 className="text-[13px] font-semibold text-[var(--text)]">Coming up</h3>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            These won&apos;t post automatically until accounts are connected.
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
                        "flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-[var(--surface-muted)]",
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
  status: "loading" | "ready" | "error";
  onRefresh: () => void;
  onDisconnect: (accountId: string) => void;
}) {
  const benefits: Array<{ icon: IconType; title: string; text: string }> = [
    {
      icon: Send,
      title: "Publish on schedule",
      text: "Scheduled posts go out at their planned time.",
    },
    {
      icon: Inbox,
      title: "Replies in one place",
      text: "Comments and mentions arrive in Engagement.",
    },
    {
      icon: Activity,
      title: "Post performance",
      text: "Reach and engagement for each published post.",
    },
  ];

  const rowsByPlatform = new Map(platforms.map((row) => [row.platform, row]));

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
                      {connectedAccounts.length > 0 ? (
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
                      className={cx(BTN_SECONDARY, "h-9 px-3 text-[11px]")}
                    >
                      <Plus size={13} />
                      Connect another
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
                          {account.username ? ` · @${account.username}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => onDisconnect(account.id)}
                          className="shrink-0 text-[10.5px] font-semibold text-[var(--text-muted)] transition hover:text-red-600"
                        >
                          Disconnect
                        </button>
                      </div>
                    ))}
                    {platform.id === "LINKEDIN" && (
                      <p className="px-1 text-[10px] text-[var(--text-subtle)]">
                        Personal profile only — posts publish as this member. Company-page
                        publishing isn&apos;t supported yet.
                      </p>
                    )}
                  </div>
                )}

                {row?.accounts.some((account) => account.status === "EXPIRED" || account.status === "ERROR") && (
                  <p className="ml-0 text-[10.5px] text-red-600 sm:ml-[52px]">
                    An account needs reconnecting — its connection expired or failed.
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
              <span
                className={cx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  ACCENT_SOFT,
                )}
              >
                <Icon size={14} />
              </span>
              <span>
                <span className="block text-[11.5px] font-semibold text-[var(--text)]">
                  {title}
                </span>
                <span className="mt-0.5 block text-[11px] leading-5 text-[var(--text-muted)]">
                  {text}
                </span>
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
                <span
                  className="block h-2.5 rounded-full bg-[var(--surface-muted)]"
                  style={{ width: `${width}%` }}
                />
              </span>
              <span className="h-2.5 w-10 rounded-full bg-[var(--surface-muted)]" />
            </div>
          ))}
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span
            className={cx(
              "flex h-12 w-12 items-center justify-center rounded-2xl",
              ACCENT_SOFT,
            )}
          >
            <MessageCircle size={20} />
          </span>
          <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.015em] text-[var(--text)]">
            No conversations yet
          </h3>
          <p className="mt-1.5 max-w-[340px] text-[11.5px] leading-5 text-[var(--text-muted)]">
            {connectedAccounts > 0
              ? "Engagement data requires a supported platform API integration, which isn't built yet — comments and mentions aren't pulled in at this time."
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

   Real aggregates only (/api/admin/social-media/analytics). There is no
   provider metrics sync built yet, so hasMetrics is always false right
   now — shown as an honest empty state, never invented numbers.
============================================================================= */

function AnalyticsWorkspace() {
  const [data, setData] = useState<ApiAnalytics | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
    fetchAnalyticsApi()
      .then((result) => {
        setData(result);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const statusTiles = STATUS_ORDER.map((bucket) => {
    const realStatuses = (Object.keys(REAL_STATUS_META) as RealPostStatus[]).filter(
      (status) => statusBucket(status) === bucket,
    );
    const count = data ? realStatuses.reduce((sum, key) => sum + (data.postsByStatus[key] ?? 0), 0) : 0;
    return { bucket, count };
  });

  return (
    <div className="space-y-5">
      <section className={cx(CARD, "p-4 sm:p-5")}>
        <h2 className="text-[14px] font-semibold text-[var(--text)]">Content pipeline</h2>
        <p className="mt-1 text-[11.5px] leading-5 text-[var(--text-muted)]">
          Real post counts from the database, by stage.
        </p>

        {status === "loading" ? (
          <p className="mt-5 text-[11.5px] text-[var(--text-muted)]">Loading…</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {statusTiles.map(({ bucket, count }) => {
              const meta = STATUS_META[bucket];
              return (
                <div key={bucket} className="rounded-2xl border border-[var(--line)] p-3.5">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
                    {meta.short}
                  </p>
                  <p className="mt-1.5 text-[22px] font-semibold tabular-nums text-[var(--text)]">{count}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className={cx(CARD, "p-4 sm:p-5")}>
        <h2 className="text-[14px] font-semibold text-[var(--text)]">Platform performance</h2>
        <p className="mt-1 text-[11.5px] leading-5 text-[var(--text-muted)]">
          Impressions, reach, likes, comments and shares from each platform&apos;s own API.
        </p>

        {status !== "loading" && !data?.hasMetrics ? (
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
        ) : data?.totals ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(data.totals).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-[var(--line)] p-3.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">{key}</p>
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
}: {
  post: SocialPost | null;
  presetDate: string | null;
  campaigns: ApiCampaign[];
  connectedAccountsByPlatform: Map<SocialPlatform, ApiAccount[]>;
  onClose: () => void;
  onSave: (form: PostForm, editingId: string | null) => void;
  onCreateCampaign: (name: string) => Promise<ApiCampaign>;
  onSubmitForReview: (id: string) => void;
  onApprove: (id: string) => void;
  onRequestChanges: (id: string) => void;
  onSchedulePost: (id: string, scheduledAtLocal: string) => void;
  onCancelPost: (id: string) => void;
}) {
  const initial = useMemo<PostForm>(
    () => ({
      title: post?.title ?? "",
      caption: post?.caption ?? "",
      category: post?.category ?? "",
      campaignId: post?.campaignId ?? null,
      platforms: post?.platforms ?? [],
      platformCaptions: Object.fromEntries(
        (post?.targets ?? []).filter((target) => target.caption).map((target) => [target.platform, target.caption as string]),
      ),
      status: post?.status ?? (presetDate ? "SCHEDULED" : "DRAFT"),
      scheduledAt: post?.scheduledAt
        ? localDateTimeValue(new Date(post.scheduledAt))
        : presetDate ?? "",
      image: post?.image ?? null,
      assetIds: post?.assetIds ?? [],
    }),
    [post, presetDate],
  );

  const [form, setForm] = useState<PostForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [previewChoice, setPreviewChoice] = useState<SocialPlatform | null>(
    initial.platforms[0] ?? null,
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

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

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const captionLength = form.caption.trim().length;
  const selectedPlatforms = form.platforms.map(platformDefinition);
  const overLimit = selectedPlatforms.filter((platform) => captionLength > platform.limit);

  const activePreview =
    previewChoice && form.platforms.includes(previewChoice)
      ? previewChoice
      : form.platforms[0] ?? null;

  const update = (patch: Partial<PostForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
    setConfirmDiscard(false);
  };

  const togglePlatform = (platform: SocialPlatform) => {
    const selected = form.platforms.includes(platform);
    update({
      platforms: selected
        ? form.platforms.filter((item) => item !== platform)
        : PLATFORMS.map((item) => item.id).filter(
            (id) => id === platform || form.platforms.includes(id),
          ),
    });
    if (!selected) setPreviewChoice(platform);
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setImageBusy(true);
    setError(null);
    try {
      // Resize client-side first (bandwidth), then upload for real — the
      // resulting URL is a hosted Cloudinary asset, never a data: URI.
      const dataUrl = await prepareImage(file);
      const blob = await (await fetch(dataUrl)).blob();
      const asset = await uploadMediaAsset(blob, file.name || "image.jpg");
      update({ image: asset.url, assetIds: [asset.id] });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "That image couldn't be added.");
    } finally {
      setImageBusy(false);
    }
  };

  const openPicker = () => fileInputRef.current?.click();

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<ApiAsset[] | null>(null);
  const [libraryLoading, setLibraryLoading] = useState(false);

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

  const pickFromLibrary = (asset: ApiAsset) => {
    update({ image: asset.url, assetIds: [asset.id] });
    setLibraryOpen(false);
  };

  const dropProps: DropProps = {
    onDragOver: (event) => {
      if (!Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDragging(true);
    },
    onDragLeave: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setDragging(false);
      }
    },
    onDrop: (event) => {
      event.preventDefault();
      setDragging(false);
      void handleFile(event.dataTransfer.files[0]);
    },
  };

  const requestClose = useCallback(() => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }, [dirty, onClose]);

  const validate = () => {
    if (!form.caption.trim()) return "Write a caption before saving.";
    if (form.platforms.length === 0) return "Choose at least one channel.";

    if (form.status !== "DRAFT") {
      const disconnected = form.platforms.find((platform) => !connectedAccountsByPlatform.get(platform)?.length);
      if (disconnected) {
        return `No ${platformDefinition(disconnected).name} account is connected. Connect one in Accounts, or save this as a draft.`;
      }
    }

    if (form.status !== "DRAFT" && form.platforms.includes("INSTAGRAM") && !form.image) {
      return "Instagram posts need an image. Add one, or save this as a draft.";
    }

    if (form.status !== "DRAFT" && overLimit.length > 0) {
      const platform = overLimit[0];
      return `The caption is ${captionLength - platform.limit} characters over ${platform.name}'s limit. Shorten it or save it as a draft.`;
    }

    if (form.status === "SCHEDULED") {
      if (!form.scheduledAt) return "Choose a date and time for this post.";
      const scheduled = new Date(form.scheduledAt);
      if (!isValidDate(scheduled) || scheduled.getTime() <= nowMs()) {
        return "Choose a time in the future.";
      }
    }

    return null;
  };

  const submit = () => {
    if (imageBusy) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    onSave(form, post?.id ?? null);
  };

  /* Escape to close */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  /* Lock scroll and focus the caption on open */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const primaryLabel = post
    ? "Save changes"
    : form.status === "SCHEDULED"
      ? "Schedule post"
      : form.status === "READY"
        ? "Mark ready for review"
        : "Save draft";

  const previewWhen =
    form.status === "SCHEDULED" && form.scheduledAt && isValidDate(new Date(form.scheduledAt))
      ? formatDateTime(new Date(form.scheduledAt).toISOString())
      : "Just now";

  const media: PreviewMedia = {
    image: form.image,
    busy: imageBusy,
    dragging,
    onAdd: openPicker,
    onRemove: () => update({ image: null, assetIds: [] }),
    dropProps,
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      className="sg-fade fixed inset-0 z-[150] flex items-end justify-center bg-black/50 backdrop-blur-[4px] sm:items-center sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-composer-title"
        className="sg-rise flex max-h-[96dvh] w-full max-w-[1080px] flex-col overflow-hidden rounded-t-[26px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_40px_90px_-24px_rgba(0,0,0,0.5)] sm:max-h-[92dvh] sm:rounded-[26px]"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
          onPaste={(event) => {
            const file = Array.from(event.clipboardData.files).find((item) =>
              item.type.startsWith("image/"),
            );
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
            accept="image/jpeg,image/png,image/webp,image/gif"
            tabIndex={-1}
            aria-hidden
            className="sr-only"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4 sm:px-6">
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
            <IconButton label="Close" onClick={requestClose} bordered>
              <X size={16} />
            </IconButton>
          </div>

          {/* Body */}
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">
            {/* Editor */}
            <div className="space-y-6 px-5 py-5 sm:px-6 lg:overflow-y-auto">
              <fieldset>
                <legend className="mb-2.5 text-[11.5px] font-semibold text-[var(--text)]">
                  Channels
                </legend>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((platform) => {
                    const selected = form.platforms.includes(platform.id);
                    const connected = Boolean(connectedAccountsByPlatform.get(platform.id)?.length);
                    return (
                      <button
                        key={platform.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => togglePlatform(platform.id)}
                        title={connected ? undefined : "No account connected yet — you can still draft for this channel."}
                        className={cx(
                          "inline-flex h-11 items-center gap-2.5 rounded-xl border pl-1.5 pr-3 text-[11.5px] font-semibold transition",
                          FOCUS,
                          selected
                            ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))] text-[var(--text)]"
                            : "border-[var(--line)] text-[var(--text-muted)] hover:border-[color-mix(in_srgb,var(--text)_22%,var(--line))] hover:text-[var(--text)]",
                        )}
                      >
                        <PlatformMark platform={platform.id} size="md" />
                        {platform.name}
                        {!connected && (
                          <span className="rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[var(--text-subtle)]">
                            Not connected
                          </span>
                        )}
                        <span
                          className={cx(
                            "ml-1 flex h-4 w-4 items-center justify-center rounded-full border transition",
                            selected
                              ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                              : "border-[var(--line)]",
                          )}
                        >
                          {selected && <Check size={10} strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div>
                <button
                  type="button"
                  onClick={toggleLibrary}
                  className={cx(BTN_SECONDARY, FOCUS, "h-9 px-3 text-[11px]")}
                >
                  <ImagePlus size={13} />
                  {libraryOpen ? "Hide media library" : "Browse media library"}
                </button>

                {libraryOpen && (
                  <div className="mt-2.5 rounded-xl border border-[var(--line)] p-3">
                    {libraryLoading ? (
                      <p className="flex items-center gap-2 text-[11.5px] text-[var(--text-muted)]">
                        <Loader2 size={14} className="animate-spin" />
                        Loading previously uploaded media…
                      </p>
                    ) : libraryAssets && libraryAssets.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {libraryAssets.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onClick={() => pickFromLibrary(asset)}
                            className={cx(
                              "aspect-square overflow-hidden rounded-lg border transition hover:border-[var(--accent)]",
                              form.assetIds.includes(asset.id) ? "border-[var(--accent)]" : "border-[var(--line)]",
                            )}
                          >
                            {asset.type === "VIDEO" ? (
                              <video src={asset.url} className="h-full w-full object-cover" muted />
                            ) : (
                              <img src={asset.url} alt="" className="h-full w-full object-cover" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11.5px] text-[var(--text-muted)]">
                        Nothing uploaded yet. Add an image below and it&apos;ll show up here next time.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11.5px] font-semibold text-[var(--text)]">Title (internal)</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) => update({ title: event.target.value })}
                    placeholder="e.g. Autumn product launch teaser"
                    className={cx(INPUT, "h-10 px-3")}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11.5px] font-semibold text-[var(--text)]">Campaign</label>
                  <select
                    value={form.campaignId ?? ""}
                    onChange={(event) => {
                      if (event.target.value === "__new__") {
                        const name = window.prompt("Name this campaign");
                        if (!name || !name.trim()) return;
                        void onCreateCampaign(name.trim())
                          .then((campaign) => update({ campaignId: campaign.id }))
                          .catch(() => undefined);
                        return;
                      }
                      update({ campaignId: event.target.value || null });
                    }}
                    className={cx(INPUT, "h-10 px-3")}
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

              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <label
                    htmlFor="social-caption"
                    className="text-[11.5px] font-semibold text-[var(--text)]"
                  >
                    Caption
                  </label>
                  <span className="text-[10.5px] tabular-nums text-[var(--text-subtle)]">
                    {captionLength.toLocaleString("en-GB")} characters
                  </span>
                </div>

                <textarea
                  ref={textareaRef}
                  id="social-caption"
                  value={form.caption}
                  onChange={(event) => update({ caption: event.target.value })}
                  placeholder="What would you like to share?"
                  rows={8}
                  className={cx(
                    INPUT,
                    "min-h-[190px] resize-y bg-[var(--surface-muted)] p-4 text-[13px] leading-6",
                  )}
                />

                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-2">
                  {selectedPlatforms.length > 0 ? (
                    selectedPlatforms.map((platform) => (
                      <CharMeter
                        key={platform.id}
                        platform={platform}
                        count={form.platformCaptions[platform.id]?.length ?? captionLength}
                      />
                    ))
                  ) : (
                    <p className="text-[10.5px] text-[var(--text-subtle)]">
                      Choose a channel to see its character limit.
                    </p>
                  )}
                </div>

                {selectedPlatforms.length > 1 && (
                  <div className="mt-4 space-y-3 rounded-2xl border border-dashed border-[var(--line)] p-3.5">
                    <p className="text-[10.5px] font-semibold text-[var(--text)]">
                      Customise the caption per channel (optional)
                    </p>
                    {selectedPlatforms.map((platform) => (
                      <div key={platform.id}>
                        <div className="mb-1 flex items-center gap-2 text-[10.5px] text-[var(--text-muted)]">
                          <PlatformMark platform={platform.id} size="sm" />
                          {platform.name}
                        </div>
                        <textarea
                          value={form.platformCaptions[platform.id] ?? ""}
                          onChange={(event) =>
                            update({
                              platformCaptions: { ...form.platformCaptions, [platform.id]: event.target.value },
                            })
                          }
                          placeholder={`Leave blank to use the shared caption above for ${platform.name}`}
                          rows={2}
                          className={cx(INPUT, "resize-y bg-[var(--surface)] p-2.5 text-[12px]")}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-[var(--text)]">Image</span>
                  {form.platforms.includes("INSTAGRAM") && !form.image && (
                    <span className="text-[10.5px] text-[var(--text-subtle)]">
                      Needed for Instagram
                    </span>
                  )}
                </div>

                {form.image ? (
                  <div
                    {...dropProps}
                    className={cx(
                      "flex items-center gap-3 rounded-2xl border p-2.5 transition",
                      dragging
                        ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))]"
                        : "border-[var(--line)]",
                    )}
                  >
                    <img
                      src={form.image}
                      alt="Attached image"
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] font-semibold text-[var(--text)]">
                        {dragging ? "Drop to replace" : "Image attached"}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-[var(--text-muted)]">
                        Used in every channel&apos;s post.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openPicker}
                      disabled={imageBusy}
                      className={cx(BTN_SECONDARY, FOCUS, "h-9 px-3 text-[11px]")}
                    >
                      {imageBusy ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RefreshCw size={13} />
                      )}
                      Replace
                    </button>
                    <IconButton label="Remove image" onClick={() => update({ image: null, assetIds: [] })}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openPicker}
                    disabled={imageBusy}
                    {...dropProps}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-2xl border border-dashed p-4 text-left transition",
                      FOCUS,
                      dragging
                        ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))]"
                        : "border-[var(--line)] hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))]",
                    )}
                  >
                    <span
                      className={cx(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        ACCENT_SOFT,
                      )}
                    >
                      {imageBusy ? (
                        <Loader2 size={17} className="animate-spin" />
                      ) : (
                        <ImagePlus size={17} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11.5px] font-semibold text-[var(--text)]">
                        {imageBusy
                          ? "Preparing image…"
                          : dragging
                            ? "Drop to add"
                            : "Add an image"}
                      </span>
                      <span className="mt-0.5 block text-[10.5px] text-[var(--text-muted)]">
                        Click to browse, drop a file here, or paste one. JPG, PNG, WebP or GIF.
                      </span>
                    </span>
                  </button>
                )}
              </div>

              <fieldset>
                <legend className="mb-2.5 text-[11.5px] font-semibold text-[var(--text)]">
                  Status
                </legend>
                <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
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
                              status === "SCHEDULED" && !form.scheduledAt
                                ? slots[0].value
                                : form.scheduledAt,
                          })
                        }
                        className={cx(
                          "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                          FOCUS,
                          selected
                            ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))]"
                            : "border-[var(--line)] hover:border-[color-mix(in_srgb,var(--text)_22%,var(--line))]",
                        )}
                      >
                        <span
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: mix(meta.hue, 13), color: meta.hue }}
                        >
                          <Icon size={13} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[11.5px] font-semibold text-[var(--text)]">
                            {meta.label}
                          </span>
                          <span className="mt-0.5 block text-[10.5px] text-[var(--text-muted)]">
                            {meta.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {form.status === "SCHEDULED" && (
                <div className="sg-fade rounded-2xl border border-[var(--line)] p-4">
                  <label
                    htmlFor="social-schedule"
                    className="text-[11.5px] font-semibold text-[var(--text)]"
                  >
                    Publishing time
                  </label>

                  <input
                    id="social-schedule"
                    type="datetime-local"
                    value={form.scheduledAt}
                    min={localDateTimeValue(new Date())}
                    onChange={(event) => update({ scheduledAt: event.target.value })}
                    className={cx(INPUT, "mt-2.5 h-11 px-3")}
                  />

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {slots.map((slot) => {
                      const active = form.scheduledAt === slot.value;
                      return (
                        <button
                          key={slot.value}
                          type="button"
                          onClick={() => update({ scheduledAt: slot.value })}
                          className={cx(
                            "h-7 rounded-lg px-2.5 text-[10.5px] font-medium transition",
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

                  <p className="mt-3 text-[10.5px] leading-5 text-[var(--text-subtle)]">
                    This adds the post to the calendar. It won&apos;t publish automatically until
                    accounts are connected.
                  </p>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="sg-fade flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3 py-2.5 text-[11px] leading-5 text-red-600"
                >
                  <Info size={14} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="border-t border-[var(--line)] bg-[var(--surface-muted)] px-5 py-5 sm:px-6 lg:overflow-y-auto lg:border-l lg:border-t-0">
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

              <div className="mt-4">
                {activePreview ? (
                  <PostPreview
                    key={activePreview}
                    platform={activePreview}
                    caption={form.caption}
                    when={previewWhen}
                    media={media}
                  />
                ) : (
                  <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] px-6 text-center">
                    <Edit3 size={18} className="text-[var(--text-subtle)]" />
                    <p className="mt-3 text-[11.5px] leading-5 text-[var(--text-muted)]">
                      Choose a channel to see how the post will look.
                    </p>
                  </div>
                )}
              </div>

              <p className="mt-3 text-[10px] leading-4 text-[var(--text-subtle)]">
                Previews are approximate. Each platform crops text and media in its own way.
              </p>
            </div>
          </div>

          {/* Workflow actions — real backend-enforced transitions on the
              post's actual status, distinct from the DRAFT/READY/SCHEDULED
              radio above (which only covers creating/editing). The server
              rejects any transition the caller doesn't hold permission
              for or that isn't valid from the current status. */}
          {post && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-5 py-3 sm:px-6">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
                style={{ background: mix(REAL_STATUS_META[post.realStatus].hue, 14), color: REAL_STATUS_META[post.realStatus].hue }}
              >
                <Dot color={REAL_STATUS_META[post.realStatus].hue} />
                {REAL_STATUS_META[post.realStatus].label}
              </span>
              {post.reviewNotes && post.realStatus === "CHANGES_REQUESTED" && (
                <span className="text-[11px] text-[var(--text-muted)]">&ldquo;{post.reviewNotes}&rdquo;</span>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {(post.realStatus === "DRAFT" || post.realStatus === "CHANGES_REQUESTED") && (
                  <button type="button" onClick={() => onSubmitForReview(post.id)} className={cx(BTN_SECONDARY, FOCUS, "h-9 px-3 text-[11px]")}>
                    <Send size={12} />
                    Submit for review
                  </button>
                )}
                {post.realStatus === "PENDING_REVIEW" && (
                  <>
                    <button type="button" onClick={() => onRequestChanges(post.id)} className={cx(BTN_SECONDARY, FOCUS, "h-9 px-3 text-[11px]")}>
                      Request changes
                    </button>
                    <button type="button" onClick={() => onApprove(post.id)} className={cx(BTN_PRIMARY, FOCUS, "h-9 px-3 text-[11px]")}>
                      <Check size={12} />
                      Approve
                    </button>
                  </>
                )}
                {post.realStatus === "APPROVED" && (
                  <button
                    type="button"
                    onClick={() => {
                      const when = form.scheduledAt || localDateTimeValue(nextFullHour());
                      onSchedulePost(post.id, when);
                    }}
                    className={cx(BTN_PRIMARY, FOCUS, "h-9 px-3 text-[11px]")}
                  >
                    <CalendarDays size={12} />
                    Schedule
                  </button>
                )}
                {(post.realStatus === "SCHEDULED" ||
                  post.realStatus === "PENDING_REVIEW" ||
                  post.realStatus === "APPROVED") && (
                  <button
                    type="button"
                    onClick={() => onCancelPost(post.id)}
                    className="h-9 rounded-xl px-3 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          {post && activity.length > 0 && (
            <div className="max-h-28 overflow-y-auto border-t border-[var(--line)] px-5 py-3 sm:px-6">
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
                Activity
              </p>
              <ul className="space-y-1">
                {activity.map((item) => (
                  <li key={item.id} className="text-[11px] text-[var(--text-muted)]">
                    <span className="font-medium text-[var(--text)]">
                      {item.actor ? [item.actor.firstName, item.actor.lastName].filter(Boolean).join(" ") || "Someone" : "System"}
                    </span>{" "}
                    {(item.description ?? item.type.toLowerCase().replace(/_/g, " "))}
                    <span className="text-[var(--text-subtle)]"> · {formatDateTime(item.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer */}
          <div className="flex min-h-[64px] items-center gap-3 border-t border-[var(--line)] px-5 py-3 sm:px-6">
            {confirmDiscard ? (
              <div
                role="alert"
                className="sg-fade flex flex-1 flex-wrap items-center justify-between gap-2"
              >
                <p className="text-[12px] font-medium text-[var(--text)]">
                  Discard your unsaved changes?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDiscard(false)}
                    className={cx(BTN_SECONDARY, FOCUS)}
                  >
                    Keep editing
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className={cx(
                      "inline-flex h-10 items-center rounded-xl bg-red-600 px-4 text-[11.5px] font-semibold text-white transition hover:bg-red-700",
                      FOCUS,
                    )}
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="hidden items-center gap-1.5 text-[10.5px] text-[var(--text-subtle)] sm:flex">
                  <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
                  <Kbd>Enter</Kbd>
                  to save
                </p>
                <div className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={requestClose} className={cx(BTN_SECONDARY, FOCUS)}>
                    Cancel
                  </button>
                  <button type="submit" className={cx(BTN_PRIMARY, FOCUS)}>
                    <Check size={14} />
                    {primaryLabel}
                  </button>
                </div>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/* =============================================================================
   CHARACTER METER
============================================================================= */

function CharMeter({ platform, count }: { platform: PlatformDefinition; count: number }) {
  const ratio = count / platform.limit;
  const color =
    ratio > 1 ? "#DC2626" : ratio > 0.9 ? "#D97706" : "var(--accent)";

  return (
    <span className="inline-flex items-center gap-2 text-[10.5px] tabular-nums text-[var(--text-muted)]">
      <PlatformMark platform={platform.id} size="xs" label={platform.name} />
      <span className="h-1 w-14 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <span
          className="block h-full rounded-full transition-[width] duration-300"
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
}: {
  platform: SocialPlatform;
  caption: string;
  when: string;
  media: PreviewMedia;
}) {
  const empty = caption.trim() === "";
  const text = empty ? "Your caption will appear here." : caption.trim();
  const textTone = empty ? "text-[var(--text-subtle)]" : "text-[var(--text)]";
  const shell =
    "sg-fade overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_10px_30px_-20px_rgba(0,0,0,0.35)]";
  const iconTone = "text-[var(--text-muted)]";

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
          <span className="font-semibold text-[var(--text)]">syntragrid</span>{" "}
          {truncate(text, cut)}
          {text.length > cut && <span className="text-[var(--text-subtle)]"> more</span>}
        </p>
        <p className="px-3 pb-3 pt-1.5 text-[9.5px] text-[var(--text-subtle)]">{when}</p>
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
            <span className="block text-[11.5px] font-semibold text-[var(--text)]">
              Syntra Grid
            </span>
            <span className="block text-[10px] text-[var(--text-muted)]">Software agency</span>
            <span className="block text-[10px] text-[var(--text-subtle)]">{when}</span>
          </span>
          <MoreHorizontal size={15} className={cx("ml-auto", iconTone)} />
        </div>
        <p className={cx("whitespace-pre-wrap px-3.5 py-3 text-[11.5px] leading-[1.6]", textTone)}>
          {truncate(text, cut)}
          {text.length > cut && (
            <span className="font-medium text-[var(--text-muted)]"> see more</span>
          )}
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
          {overflow && (
            <span className="rounded-sm bg-red-500/15 text-red-600">{overflow}</span>
          )}
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

function PreviewMediaSlot({
  media,
  variant,
  imageClassName,
  emptyClassName,
}: {
  media: PreviewMedia;
  variant: "square" | "inline";
  imageClassName?: string;
  emptyClassName?: string;
}) {
  const { image, busy, dragging, onAdd, onRemove, dropProps } = media;

  if (image) {
    return (
      <div {...dropProps} className={cx("group relative overflow-hidden", imageClassName)}>
        <img
          src={image}
          alt="Attached image"
          className={cx(
            "block w-full object-cover",
            variant === "square" ? "aspect-square" : "max-h-[360px]",
          )}
        />

        {(dragging || busy) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-[11.5px] font-semibold text-white">
            {busy ? <Loader2 size={20} className="animate-spin" /> : "Drop to replace"}
          </div>
        )}

        <div className="absolute right-2 top-2 flex gap-1.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <button type="button" onClick={onAdd} disabled={busy} className={OVERLAY_BTN}>
            <RefreshCw size={12} />
            Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove image"
            title="Remove image"
            className={cx(OVERLAY_BTN, "w-8 justify-center px-0")}
          >
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  if (variant === "square") {
    return (
      <button
        type="button"
        onClick={onAdd}
        disabled={busy}
        {...dropProps}
        className={cx(
          "flex aspect-square w-full flex-col items-center justify-center gap-1.5 transition",
          FOCUS_INSET,
          dragging
            ? "bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] text-[var(--accent)]"
            : "bg-[color-mix(in_srgb,var(--text)_5%,var(--surface))] text-[var(--text-subtle)] hover:text-[var(--accent)]",
        )}
      >
        {busy ? <Loader2 size={24} className="animate-spin" /> : <ImagePlus size={26} />}
        <span className="mt-1 text-[12px] font-semibold">
          {busy ? "Preparing image…" : dragging ? "Drop to add" : "Add an image"}
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
          "flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-[11px] font-medium transition",
          FOCUS,
          dragging
            ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--accent)]"
            : "border-[var(--line)] text-[var(--text-muted)] hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] hover:text-[var(--accent)]",
        )}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
        {busy ? "Preparing image…" : dragging ? "Drop to add" : "Add an image"}
      </button>
    </div>
  );
}

function PreviewAvatar({ square, ring }: { square?: boolean; ring?: boolean }) {
  return (
    <span
      className={cx(
        "flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--accent)] text-[10.5px] font-bold tracking-tight text-white",
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
  /** Pass the platform's name when this mark is the only thing on screen
   *  identifying the platform (no adjacent visible or sr-only text) —
   *  otherwise leave unset so it stays decorative/aria-hidden. */
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
      style={{
        background: mix(definition.color, 13, "var(--surface)"),
      }}
      aria-hidden={label ? undefined : true}
    >
      <SocialPlatformIcon platform={platform} size={MARK_ICON_PIXELS[size]} color={definition.color} label={label} />
    </span>
  );
}

function PlatformStack({
  platforms,
  size = "sm",
}: {
  platforms: SocialPlatform[];
  size?: "sm" | "md";
}) {
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

function StatusPill({ status }: { status: ContentStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: mix(meta.hue, 12), color: meta.hue }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
  );
}

function Kbd({
  children,
  inverse,
  className,
}: {
  children: ReactNode;
  inverse?: boolean;
  className?: string;
}) {
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
        "flex shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
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

function Segmented({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex h-9 items-center gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-0.5"
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
        "inline-flex h-full min-w-8 items-center justify-center gap-1.5 rounded-[9px] px-2.5 text-[11px] font-medium transition",
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
      <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.015em] text-[var(--text)]">
        {title}
      </h3>
      <p className="mt-1.5 max-w-[340px] text-[11.5px] leading-5 text-[var(--text-muted)]">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}