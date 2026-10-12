"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  Activity,
  AlertCircle,
  ArchiveRestore,
  Archive,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  Edit3,
  FileText,
  Folder,
  History,
  Image as ImageIcon,
  Inbox,
  Layers,
  Loader2,
  MessageCircle,
  Palette,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";

/* =============================================================================
   TYPES
============================================================================= */

type WorkspaceView = "overview" | "library" | "guidelines" | "kits" | "templates" | "requests";

type LoadStatus = "idle" | "loading" | "ready" | "error";

type IconType = typeof FileText;

type AssetType = "IMAGE" | "SVG" | "VIDEO" | "DOCUMENT" | "PRESENTATION" | "DESIGN_FILE" | "FONT" | "OTHER";
type AssetStatus = "ACTIVE" | "ARCHIVED";
type UsageRights = "INTERNAL_ONLY" | "CLIENT_APPROVED" | "PUBLIC" | "UNRESTRICTED";
type KitStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type GuidelineStatus = "DRAFT" | "PUBLISHED";
type TemplateCategory =
  | "INSTAGRAM_POST"
  | "INSTAGRAM_STORY"
  | "LINKEDIN_GRAPHIC"
  | "SOCIAL_COVER"
  | "MARKETING_BANNER"
  | "PRESENTATION"
  | "BUSINESS_CARD"
  | "LETTERHEAD"
  | "PROPOSAL"
  | "EMAIL_SIGNATURE"
  | "OTHER";
type TemplateStatus = "ACTIVE" | "ARCHIVED";
type RequestType = "LOGO" | "SOCIAL_GRAPHIC" | "MARKETING_MATERIAL" | "PRESENTATION" | "GUIDELINE_CHANGE" | "OTHER";
type RequestPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type RequestStatus =
  | "SUBMITTED"
  | "IN_PROGRESS"
  | "READY_FOR_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

type PersonRef = { id: string; firstName: string | null; lastName: string | null } | null;

function personName(person: PersonRef): string {
  if (!person) return "—";
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || "Unnamed";
}

type ApiBrandKit = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: KitStatus;
  clientId: string | null;
  client: { id: string; name: string; slug: string } | null;
  logoAssetId: string | null;
  logoAsset: ApiBrandAsset | null;
  primaryColors: string[] | null;
  secondaryColors: string[] | null;
  typography: Record<string, string> | null;
  createdBy: PersonRef;
  createdAt: string;
  updatedAt: string;
  _count?: { assets: number; templates: number; requests: number };
};

type ApiBrandAsset = {
  id: string;
  name: string;
  description: string | null;
  type: AssetType;
  category: string | null;
  tags: string[];
  url: string;
  mimeType: string;
  fileSizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  usageRights: UsageRights;
  status: AssetStatus;
  brandKitId: string | null;
  brandKit: { id: string; name: string } | null;
  uploadedBy: PersonRef;
  createdAt: string;
  updatedAt: string;
};

type ApiBrandAssetVersion = {
  id: string;
  versionNumber: number;
  url: string;
  fileSizeBytes: number;
  note: string | null;
  createdBy: PersonRef;
  createdAt: string;
};

type ApiBrandGuideline = {
  id: string;
  brandKitId: string;
  tagline: string | null;
  mission: string | null;
  vision: string | null;
  values: string[];
  personality: string | null;
  toneOfVoice: string | null;
  logoSpacingNotes: string | null;
  minLogoSizeNotes: string | null;
  approvedUsageNotes: string | null;
  incorrectUsageNotes: string | null;
  fontUsageNotes: string | null;
  socialMediaGuidelines: string | null;
  photographyGuidelines: string | null;
  videoGuidelines: string | null;
  marketingStandards: string | null;
  emailSignatureGuidelines: string | null;
  status: GuidelineStatus;
  updatedBy: PersonRef;
  updatedAt: string;
} | null;

type ApiBrandTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  tags: string[];
  url: string;
  mimeType: string;
  fileSizeBytes: number;
  status: TemplateStatus;
  brandKitId: string | null;
  brandKit: { id: string; name: string } | null;
  createdBy: PersonRef;
  createdAt: string;
  updatedAt: string;
};

type ApiBrandRequest = {
  id: string;
  title: string;
  description: string;
  type: RequestType;
  priority: RequestPriority;
  status: RequestStatus;
  brandKitId: string | null;
  brandKit: { id: string; name: string } | null;
  dueDate: string | null;
  requestedBy: PersonRef;
  assignedTo: PersonRef;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments?: Array<{ id: string; name: string; url: string; fileSizeBytes: number; uploadedBy: PersonRef; createdAt: string }>;
  comments?: Array<{ id: string; body: string; author: PersonRef; createdAt: string }>;
  activities?: Array<{ id: string; type: string; description: string | null; actor: PersonRef; createdAt: string }>;
  _count?: { comments: number; attachments: number };
};

type OverviewData = {
  totalAssets: number;
  storageBytes: number;
  activeBrandKits: number;
  totalTemplates: number;
  pendingApprovalRequests: number;
  recentAssets: ApiBrandAsset[];
  recentKits: Array<{ id: string; name: string; status: KitStatus; updatedAt: string }>;
};

type Pagination = { page: number; pageSize: number; total: number; pages: number; hasPrevious: boolean; hasNext: boolean };

type Notice = { id: number; message: string; tone: "success" | "error" };

type DialogRequest = {
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  input?: { label: string; type?: "text" | "textarea"; placeholder?: string; required?: boolean };
  onConfirm: (value: string) => Promise<void | boolean> | void | boolean;
};

/* =============================================================================
   STYLE TOKENS — matches the rest of the Syntra Grid admin (same values as
   SocialMediaTab.tsx / the wider dashboard design language).
============================================================================= */

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function mix(color: string, percent: number, base = "transparent") {
  return `color-mix(in srgb, ${color} ${percent}%, ${base})`;
}

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";
const FOCUS_INSET = "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]";
const CARD = "rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
const BTN_PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[11.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_-10px_var(--accent)] transition-[filter,transform,opacity] duration-150 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-[11.5px] font-semibold text-[var(--text)] transition-[background-color,transform,opacity] duration-150 hover:bg-[var(--surface-muted)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const BTN_DANGER =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-[11.5px] font-semibold text-white transition-[background-color,transform,opacity] duration-150 hover:bg-red-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
const ACCENT_SOFT = "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]";
const INPUT =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[12px] text-[var(--text)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_14%,transparent)]";
const LABEL = "mb-1.5 block text-[11px] font-semibold text-[var(--text)]";
const BTN_COMPACT = "h-8 rounded-lg px-2.5 text-[11px]";

/* =============================================================================
   FORMATTING HELPERS
============================================================================= */

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function relativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

/* =============================================================================
   API CLIENT
============================================================================= */

const API_BASE = "/api/admin/brand-assets";

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

const fetchOverviewApi = () => apiRequest<{ overview: OverviewData }>("/overview").then((response) => response.overview);

const fetchKitsApi = (params: { status?: string; search?: string } = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  return apiRequest<{ kits: ApiBrandKit[] }>(`/kits?${query}`).then((response) => response.kits);
};

const createKitApi = (input: { name: string; description?: string | null; clientId?: string | null; primaryColors?: string[]; secondaryColors?: string[] }) =>
  apiRequest<{ kit: ApiBrandKit }>("/kits", { method: "POST", body: JSON.stringify(input) }).then((response) => response.kit);

const updateKitApi = (id: string, input: Partial<ApiBrandKit>) =>
  apiRequest<{ kit: ApiBrandKit }>(`/kits/${id}`, { method: "PATCH", body: JSON.stringify(input) }).then((response) => response.kit);

const archiveKitApi = (id: string) => apiRequest<{ kit: ApiBrandKit }>(`/kits/${id}/archive`, { method: "POST" }).then((response) => response.kit);

const duplicateKitApi = (id: string) =>
  apiRequest<{ kit: ApiBrandKit }>(`/kits/${id}/duplicate`, { method: "POST" }).then((response) => response.kit);

type AssetFilters = { type?: string; status?: string; category?: string; brandKitId?: string; search?: string; page?: number };

const fetchAssetsApi = (filters: AssetFilters = {}) => {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, String(value));
  });
  return apiRequest<{ assets: ApiBrandAsset[]; pagination: Pagination }>(`/assets?${query}`);
};

const uploadAssetApi = (formData: FormData) =>
  apiRequest<{ asset: ApiBrandAsset }>("/assets", { method: "POST", body: formData }).then((response) => response.asset);

const updateAssetApi = (id: string, input: Record<string, unknown>) =>
  apiRequest<{ asset: ApiBrandAsset }>(`/assets/${id}`, { method: "PATCH", body: JSON.stringify(input) }).then((response) => response.asset);

const replaceAssetApi = (id: string, formData: FormData) =>
  apiRequest<{ asset: ApiBrandAsset }>(`/assets/${id}/replace`, { method: "POST", body: formData }).then((response) => response.asset);

const archiveAssetApi = (id: string) => apiRequest<{ asset: ApiBrandAsset }>(`/assets/${id}/archive`, { method: "POST" }).then((response) => response.asset);

const restoreAssetApi = (id: string) => apiRequest<{ asset: ApiBrandAsset }>(`/assets/${id}/restore`, { method: "POST" }).then((response) => response.asset);

const deleteAssetApi = (id: string) => apiRequest<{ ok: true }>(`/assets/${id}`, { method: "DELETE" });

const fetchAssetVersionsApi = (id: string) =>
  apiRequest<{ versions: ApiBrandAssetVersion[] }>(`/assets/${id}/versions`).then((response) => response.versions);

const restoreAssetVersionApi = (id: string, versionId: string) =>
  apiRequest<{ asset: ApiBrandAsset }>(`/assets/${id}/versions/${versionId}/restore`, { method: "POST" }).then((response) => response.asset);

const fetchGuidelineApi = (kitId: string) =>
  apiRequest<{ guideline: ApiBrandGuideline }>(`/kits/${kitId}/guideline`).then((response) => response.guideline);

const saveGuidelineApi = (kitId: string, input: Record<string, unknown>) =>
  apiRequest<{ guideline: ApiBrandGuideline }>(`/kits/${kitId}/guideline`, { method: "PUT", body: JSON.stringify(input) }).then(
    (response) => response.guideline,
  );

const publishGuidelineApi = (kitId: string) =>
  apiRequest<{ guideline: ApiBrandGuideline }>(`/kits/${kitId}/guideline/publish`, { method: "POST" }).then((response) => response.guideline);

const unpublishGuidelineApi = (kitId: string) =>
  apiRequest<{ guideline: ApiBrandGuideline }>(`/kits/${kitId}/guideline/unpublish`, { method: "POST" }).then((response) => response.guideline);

const fetchGuidelineVersionsApi = (kitId: string) =>
  apiRequest<{ versions: Array<{ id: string; versionNumber: number; note: string | null; createdBy: PersonRef; createdAt: string }> }>(
    `/kits/${kitId}/guideline/versions`,
  ).then((response) => response.versions);

type TemplateFilters = { category?: string; status?: string; brandKitId?: string; search?: string; page?: number };

const fetchTemplatesApi = (filters: TemplateFilters = {}) => {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, String(value));
  });
  return apiRequest<{ templates: ApiBrandTemplate[]; pagination: Pagination }>(`/templates?${query}`);
};

const uploadTemplateApi = (formData: FormData) =>
  apiRequest<{ template: ApiBrandTemplate }>("/templates", { method: "POST", body: formData }).then((response) => response.template);

const updateTemplateApi = (id: string, input: Record<string, unknown>) =>
  apiRequest<{ template: ApiBrandTemplate }>(`/templates/${id}`, { method: "PATCH", body: JSON.stringify(input) }).then((response) => response.template);

const archiveTemplateApi = (id: string) =>
  apiRequest<{ template: ApiBrandTemplate }>(`/templates/${id}/archive`, { method: "POST" }).then((response) => response.template);

const restoreTemplateApi = (id: string) =>
  apiRequest<{ template: ApiBrandTemplate }>(`/templates/${id}/restore`, { method: "POST" }).then((response) => response.template);

const duplicateTemplateApi = (id: string) =>
  apiRequest<{ template: ApiBrandTemplate }>(`/templates/${id}/duplicate`, { method: "POST" }).then((response) => response.template);

type RequestFilters = { status?: string; type?: string; priority?: string; brandKitId?: string; search?: string; page?: number };

const fetchRequestsApi = (filters: RequestFilters = {}) => {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, String(value));
  });
  return apiRequest<{ requests: ApiBrandRequest[]; pagination: Pagination }>(`/requests?${query}`);
};

const fetchRequestApi = (id: string) => apiRequest<{ request: ApiBrandRequest }>(`/requests/${id}`).then((response) => response.request);

const createRequestApi = (input: Record<string, unknown>) =>
  apiRequest<{ request: ApiBrandRequest }>("/requests", { method: "POST", body: JSON.stringify(input) }).then((response) => response.request);

const requestAction = (id: string, action: string, body?: Record<string, unknown>) =>
  apiRequest<{ request: ApiBrandRequest }>(`/requests/${id}/${action}`, { method: "POST", body: body ? JSON.stringify(body) : undefined }).then(
    (response) => response.request,
  );

const addCommentApi = (id: string, body: string) => requestAction(id, "comments", { body });

const addAttachmentApi = (id: string, formData: FormData) =>
  apiRequest<{ request: ApiBrandRequest }>(`/requests/${id}/attachments`, { method: "POST", body: formData }).then((response) => response.request);

/* =============================================================================
   NAVIGATION
============================================================================= */

const NAVIGATION: Array<{ id: WorkspaceView; label: string; icon: IconType }> = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "library", label: "Asset Library", icon: Folder },
  { id: "guidelines", label: "Brand Guidelines", icon: BookOpen },
  { id: "kits", label: "Brand Kits", icon: Palette },
  { id: "templates", label: "Templates", icon: Layers },
  { id: "requests", label: "Requests & Approvals", icon: Inbox },
];

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  IMAGE: "Image",
  SVG: "SVG logo",
  VIDEO: "Video",
  DOCUMENT: "Document",
  PRESENTATION: "Presentation",
  DESIGN_FILE: "Design file",
  FONT: "Font",
  OTHER: "Other",
};

const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  INSTAGRAM_POST: "Instagram Post",
  INSTAGRAM_STORY: "Instagram Story",
  LINKEDIN_GRAPHIC: "LinkedIn Graphic",
  SOCIAL_COVER: "Social Cover",
  MARKETING_BANNER: "Marketing Banner",
  PRESENTATION: "Presentation",
  BUSINESS_CARD: "Business Card",
  LETTERHEAD: "Letterhead",
  PROPOSAL: "Proposal",
  EMAIL_SIGNATURE: "Email Signature",
  OTHER: "Other",
};

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  LOGO: "New logo",
  SOCIAL_GRAPHIC: "Social media graphic",
  MARKETING_MATERIAL: "Marketing material",
  PRESENTATION: "Presentation",
  GUIDELINE_CHANGE: "Guideline change",
  OTHER: "Other creative asset",
};

const REQUEST_STATUS_META: Record<RequestStatus, { label: string; hue: string }> = {
  SUBMITTED: { label: "Submitted", hue: "var(--text-muted)" },
  IN_PROGRESS: { label: "In progress", hue: "var(--accent)" },
  READY_FOR_REVIEW: { label: "Ready for review", hue: "#D97706" },
  CHANGES_REQUESTED: { label: "Changes requested", hue: "#DC2626" },
  APPROVED: { label: "Approved", hue: "#059669" },
  COMPLETED: { label: "Completed", hue: "#059669" },
  REJECTED: { label: "Rejected", hue: "#DC2626" },
  CANCELLED: { label: "Cancelled", hue: "var(--text-subtle)" },
};

const PRIORITY_META: Record<RequestPriority, { label: string; hue: string }> = {
  LOW: { label: "Low", hue: "var(--text-subtle)" },
  MEDIUM: { label: "Medium", hue: "var(--accent)" },
  HIGH: { label: "High", hue: "#D97706" },
  URGENT: { label: "Urgent", hue: "#DC2626" },
};

/* =============================================================================
   SMALL SHARED PRIMITIVES
============================================================================= */

function Dot({ color }: { color: string }) {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />;
}

function Pill({ label, hue }: { label: string; hue: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: mix(hue, 12), color: hue }}
    >
      <Dot color={hue} />
      {label}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  bordered,
  children,
}: {
  label: string;
  onClick: () => void;
  bordered?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:text-[var(--text)]",
        bordered ? "border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]" : "hover:bg-[var(--surface-muted)]",
        FOCUS,
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon: Icon, title, description, action }: { icon: IconType; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-subtle)]">
        <Icon size={20} />
      </span>
      <div>
        <p className="text-[13px] font-semibold text-[var(--text)]">{title}</p>
        <p className="mt-1 max-w-[320px] text-[11.5px] leading-5 text-[var(--text-muted)]">{description}</p>
      </div>
      {action}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }: { icon: IconType; label: string; value: string; hint?: string }) {
  return (
    <div className={cx(CARD, "flex items-start gap-3 p-4")}>
      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", ACCENT_SOFT)}>
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
        <p className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-[var(--text)]">{value}</p>
        {hint && <p className="mt-0.5 text-[10.5px] text-[var(--text-subtle)]">{hint}</p>}
      </div>
    </div>
  );
}

function Toast({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className={cx(
        "fixed bottom-5 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[12px] font-medium shadow-lg",
        notice.tone === "success"
          ? "border-emerald-500/25 bg-[var(--surface)] text-[var(--text)]"
          : "border-red-500/25 bg-[var(--surface)] text-[var(--text)]",
      )}
    >
      {notice.tone === "success" ? <CheckCircle2 size={15} className="text-emerald-600" /> : <AlertCircle size={15} className="text-red-600" />}
      {notice.message}
      <button type="button" onClick={onDismiss} className="ml-1 text-[var(--text-subtle)] hover:text-[var(--text)]">
        <X size={13} />
      </button>
    </div>
  );
}

/** A single generic confirm/prompt dialog, reused across every
 *  destructive action and simple text/textarea prompt in this module —
 *  same pattern SocialMediaTab.tsx's ActionDialog established. */
function ConfirmDialog({ request, onClose }: { request: DialogRequest; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (textareaRef.current ?? inputRef.current)?.focus();
  }, []);

  const confirm = async () => {
    if (busy) return;
    if (request.input?.required && !value.trim()) {
      setError(`${request.input.label} is required.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await request.onConfirm(value.trim());
      if (result === false) {
        setBusy(false);
        return;
      }
      onClose();
    } catch (problem) {
      setBusy(false);
      setError(problem instanceof Error ? problem.message : "Something went wrong.");
    }
  };

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      className="sg-fade fixed inset-0 z-[190] flex items-center justify-center bg-black/45 p-4"
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl">
        <h3 className="text-[15px] font-semibold text-[var(--text)]">{request.title}</h3>
        {request.description && <div className="mt-1.5 text-[12px] leading-5 text-[var(--text-muted)]">{request.description}</div>}

        {request.input && (
          <div className="mt-4">
            <label className={LABEL}>{request.input.label}</label>
            {request.input.type === "textarea" ? (
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={request.input.placeholder}
                rows={4}
                className={cx(INPUT, "resize-y px-3 py-2")}
              />
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={request.input.placeholder}
                className={cx(INPUT, "h-10 px-3")}
              />
            )}
          </div>
        )}

        {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={cx(BTN_SECONDARY, FOCUS)}>
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={cx(request.tone === "danger" ? BTN_DANGER : BTN_PRIMARY, FOCUS)}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetTypeIcon({ type }: { type: AssetType }) {
  if (type === "IMAGE" || type === "SVG") return <ImageIcon size={14} />;
  if (type === "VIDEO") return <Activity size={14} />;
  if (type === "FONT") return <Tag size={14} />;
  return <FileText size={14} />;
}

/* =============================================================================
   MAIN COMPONENT
============================================================================= */

export default function BrandAssetsTab() {
  const [view, setView] = useState<WorkspaceView>("overview");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);

  const notify = useCallback((message: string) => setNotice({ id: Date.now(), message, tone: "success" }), []);
  const notifyError = useCallback((error: unknown, fallback: string) => {
    setNotice({ id: Date.now(), message: error instanceof Error ? error.message : fallback, tone: "error" });
  }, []);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewStatus, setOverviewStatus] = useState<LoadStatus>("idle");

  const [kits, setKits] = useState<ApiBrandKit[]>([]);
  const [kitsStatus, setKitsStatus] = useState<LoadStatus>("idle");

  const refreshOverview = useCallback(() => {
    Promise.resolve().then(() => setOverviewStatus("loading"));
    fetchOverviewApi()
      .then((data) => {
        setOverview(data);
        setOverviewStatus("ready");
      })
      .catch((error) => {
        setOverviewStatus("error");
        notifyError(error, "Unable to load the overview.");
      });
  }, [notifyError]);

  const refreshKits = useCallback(() => {
    Promise.resolve().then(() => setKitsStatus("loading"));
    fetchKitsApi()
      .then((data) => {
        setKits(data);
        setKitsStatus("ready");
      })
      .catch((error) => {
        setKitsStatus("error");
        notifyError(error, "Unable to load brand kits.");
      });
  }, [notifyError]);

  useEffect(() => {
    refreshOverview();
    refreshKits();
  }, [refreshOverview, refreshKits]);

  const activeKits = useMemo(() => kits.filter((kit) => kit.status !== "ARCHIVED"), [kits]);

  const goTo = useCallback((target: WorkspaceView) => setView(target), []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.03em] text-[var(--text)]">Brand Assets</h1>
          <p className="mt-1 max-w-[560px] text-[12.5px] leading-6 text-[var(--text-muted)]">
            Logos, identity assets, guidelines, templates and approvals — one source of truth for every brand Syntra Grid manages.
          </p>
        </div>
      </header>

      {/* Section tabs */}
      <nav className="flex items-end justify-between gap-4 border-b border-[var(--line)]">
        <div role="tablist" aria-label="Brand assets sections" className="sg-noscrollbar relative -mb-px flex min-w-0 gap-1 overflow-x-auto">
          {NAVIGATION.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
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
                <Icon size={15} className={cx("transition-colors duration-150", active && "text-[var(--accent)]")} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Workspace */}
      {view === "overview" && (
        <OverviewWorkspace overview={overview} status={overviewStatus} onRefresh={refreshOverview} onNavigate={goTo} />
      )}

      {view === "library" && <AssetLibraryWorkspace kits={activeKits} notify={notify} notifyError={notifyError} setDialog={setDialog} />}

      {view === "guidelines" && <BrandGuidelinesWorkspace kits={activeKits} notify={notify} notifyError={notifyError} setDialog={setDialog} />}

      {view === "kits" && (
        <BrandKitsWorkspace
          kits={kits}
          status={kitsStatus}
          onRefresh={refreshKits}
          notify={notify}
          notifyError={notifyError}
          setDialog={setDialog}
        />
      )}

      {view === "templates" && <TemplatesWorkspace kits={activeKits} notify={notify} notifyError={notifyError} setDialog={setDialog} />}

      {view === "requests" && <RequestsWorkspace kits={activeKits} notify={notify} notifyError={notifyError} setDialog={setDialog} />}

      {dialog && <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />}
      {notice && <Toast notice={notice} onDismiss={() => setNotice(null)} />}
    </div>
  );
}

/* =============================================================================
   OVERVIEW
============================================================================= */

function OverviewWorkspace({
  overview,
  status,
  onRefresh,
  onNavigate,
}: {
  overview: OverviewData | null;
  status: LoadStatus;
  onRefresh: () => void;
  onNavigate: (view: WorkspaceView) => void;
}) {
  const quickActions: Array<{ label: string; icon: IconType; view: WorkspaceView }> = [
    { label: "Upload Asset", icon: Upload, view: "library" },
    { label: "Create Brand Kit", icon: Palette, view: "kits" },
    { label: "Add Guideline", icon: BookOpen, view: "guidelines" },
    { label: "Create Template", icon: Layers, view: "templates" },
    { label: "New Asset Request", icon: Send, view: "requests" },
  ];

  if (status === "loading" && !overview) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className={cx(CARD, "h-[88px] animate-pulse")} />
        ))}
      </div>
    );
  }

  if (!overview) {
    return (
      <div className={CARD}>
        <EmptyState
          icon={Sparkles}
          title="Nothing to show yet"
          description="Upload your first asset or create a brand kit to get started."
          action={
            <button type="button" onClick={onRefresh} className={cx(BTN_SECONDARY, FOCUS)}>
              <RefreshCw size={13} />
              Retry
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Folder} label="Total assets" value={overview.totalAssets.toLocaleString("en-GB")} />
        <StatCard icon={Download} label="Storage used" value={formatBytes(overview.storageBytes)} />
        <StatCard icon={Palette} label="Active brand kits" value={overview.activeBrandKits.toLocaleString("en-GB")} />
        <StatCard icon={Layers} label="Total templates" value={overview.totalTemplates.toLocaleString("en-GB")} />
        <StatCard icon={Inbox} label="Pending approvals" value={overview.pendingApprovalRequests.toLocaleString("en-GB")} />
      </div>

      <div>
        <h2 className="mb-2.5 text-[12.5px] font-semibold text-[var(--text)]">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map(({ label, icon: Icon, view }) => (
            <button key={label} type="button" onClick={() => onNavigate(view)} className={cx(BTN_SECONDARY, FOCUS)}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={CARD}>
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
            <h3 className="text-[13px] font-semibold text-[var(--text)]">Recently uploaded assets</h3>
            <button type="button" onClick={() => onNavigate("library")} className="text-[11px] font-semibold text-[var(--accent)] hover:underline">
              View library
            </button>
          </div>
          {overview.recentAssets.length === 0 ? (
            <EmptyState icon={Folder} title="No assets yet" description="Uploaded assets will appear here." />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {overview.recentAssets.map((asset) => (
                <li key={asset.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--surface-muted)] text-[var(--text-subtle)]">
                    {asset.type === "IMAGE" || asset.type === "SVG" ? (
                      <img src={asset.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <AssetTypeIcon type={asset.type} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-medium text-[var(--text)]">{asset.name}</span>
                    <span className="block text-[10.5px] text-[var(--text-subtle)]">
                      {ASSET_TYPE_LABELS[asset.type]} · {formatBytes(asset.fileSizeBytes)} · {relativeTime(asset.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={CARD}>
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3.5 sm:px-5">
            <h3 className="text-[13px] font-semibold text-[var(--text)]">Recently updated brand kits</h3>
            <button type="button" onClick={() => onNavigate("kits")} className="text-[11px] font-semibold text-[var(--accent)] hover:underline">
              View kits
            </button>
          </div>
          {overview.recentKits.length === 0 ? (
            <EmptyState icon={Palette} title="No brand kits yet" description="Create a brand kit to group colours, logos and guidelines." />
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {overview.recentKits.map((kit) => (
                <li key={kit.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <span className="truncate text-[11.5px] font-medium text-[var(--text)]">{kit.name}</span>
                  <span className="shrink-0 text-[10.5px] text-[var(--text-subtle)]">{relativeTime(kit.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* =============================================================================
   ASSET LIBRARY
============================================================================= */

function guessAssetType(file: File): AssetType {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (file.type === "image/svg+xml" || ext === "svg") return "SVG";
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("video/")) return "VIDEO";
  if (["ttf", "otf", "woff", "woff2"].includes(ext)) return "FONT";
  if (["ppt", "pptx"].includes(ext)) return "PRESENTATION";
  if (["ai", "eps", "psd", "sketch", "fig", "xd"].includes(ext)) return "DESIGN_FILE";
  if (["pdf", "doc", "docx", "txt", "csv"].includes(ext) || file.type === "application/pdf") return "DOCUMENT";
  return "OTHER";
}

type SharedWorkspaceProps = {
  kits: ApiBrandKit[];
  notify: (message: string) => void;
  notifyError: (error: unknown, fallback: string) => void;
  setDialog: (request: DialogRequest | null) => void;
};

function AssetLibraryWorkspace({ kits, notify, notifyError, setDialog }: SharedWorkspaceProps) {
  const [assets, setAssets] = useState<ApiBrandAsset[]>([]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<AssetStatus>("ACTIVE");
  const [sort, setSort] = useState<"newest" | "oldest" | "name" | "size">("newest");
  const [selected, setSelected] = useState<ApiBrandAsset | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    Promise.resolve().then(() => setStatus("loading"));
    fetchAssetsApi({ type: typeFilter === "ALL" ? undefined : typeFilter, status: statusFilter, search: search || undefined })
      .then(({ assets: result }) => {
        setAssets(result);
        setStatus("ready");
      })
      .catch((error) => {
        setStatus("error");
        notifyError(error, "Unable to load assets.");
      });
  }, [typeFilter, statusFilter, search, notifyError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const sortedAssets = useMemo(() => {
    const copy = [...assets];
    if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "size") copy.sort((a, b) => b.fileSizeBytes - a.fileSizeBytes);
    else if (sort === "oldest") copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    else copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return copy;
  }, [assets, sort]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setUploadProgress({ done: 0, total: files.length });

      let succeeded = 0;
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("name", file.name.replace(/\.[^./]+$/, ""));
          formData.append("type", guessAssetType(file));
          await uploadAssetApi(formData);
          succeeded += 1;
        } catch (error) {
          notifyError(error, `Could not upload ${file.name}.`);
        }
        setUploadProgress({ done: index + 1, total: files.length });
      }

      setUploadProgress(null);
      if (succeeded > 0) notify(succeeded === 1 ? "Asset uploaded." : `${succeeded} of ${files.length} assets uploaded.`);
      refresh();
    },
    [notify, notifyError, refresh],
  );

  const dropProps = {
    onDragOver: (event: React.DragEvent) => {
      if (!Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      void uploadFiles(Array.from(event.dataTransfer.files));
    },
  };

  const archiveOrRestore = async (asset: ApiBrandAsset) => {
    try {
      const updated = asset.status === "ACTIVE" ? await archiveAssetApi(asset.id) : await restoreAssetApi(asset.id);
      setAssets((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelected((current) => (current?.id === updated.id ? updated : current));
      notify(asset.status === "ACTIVE" ? "Asset archived." : "Asset restored.");
      refresh();
    } catch (error) {
      notifyError(error, "Unable to update this asset.");
    }
  };

  const confirmDelete = (asset: ApiBrandAsset) => {
    setDialog({
      title: "Delete this asset?",
      description: "This permanently removes the file and cannot be undone. Archive it instead if you might need it later.",
      confirmLabel: "Delete",
      tone: "danger",
      onConfirm: async () => {
        await deleteAssetApi(asset.id);
        setAssets((current) => current.filter((item) => item.id !== asset.id));
        setSelected((current) => (current?.id === asset.id ? null : current));
        notify("Asset deleted.");
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search assets…"
            className={cx(INPUT, "h-10 pl-8 pr-3")}
          />
        </div>

        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as AssetType | "ALL")} className={cx(INPUT, "h-10 w-auto px-2.5")}>
          <option value="ALL">All types</option>
          {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AssetStatus)} className={cx(INPUT, "h-10 w-auto px-2.5")}>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className={cx(INPUT, "h-10 w-auto px-2.5")}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name</option>
          <option value="size">Largest first</option>
        </select>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            void uploadFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className={cx(BTN_PRIMARY, FOCUS)}>
          <Upload size={14} />
          Upload
        </button>
      </div>

      {uploadProgress && (
        <p className="flex items-center gap-2 text-[11.5px] text-[var(--text-muted)]">
          <Loader2 size={13} className="animate-spin" />
          Uploading file {uploadProgress.done + 1 > uploadProgress.total ? uploadProgress.total : uploadProgress.done + 1} of {uploadProgress.total}…
        </p>
      )}

      <div
        {...dropProps}
        className={cx(
          "rounded-[22px] border-2 border-dashed p-1 transition-colors",
          dragging ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]" : "border-transparent",
        )}
      >
        {status === "loading" && assets.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className={cx(CARD, "h-[160px] animate-pulse")} />
            ))}
          </div>
        ) : sortedAssets.length === 0 ? (
          <div className={CARD}>
            <EmptyState
              icon={Folder}
              title={search || typeFilter !== "ALL" ? "No matching assets" : "No assets yet"}
              description={
                search || typeFilter !== "ALL"
                  ? "Try a different search or filter."
                  : "Drag files here, or click Upload to add your first brand asset."
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sortedAssets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelected(asset)}
                className={cx(CARD, "group flex flex-col overflow-hidden text-left transition hover:border-[var(--accent)]", FOCUS)}
              >
                <span className="relative flex aspect-[4/3] items-center justify-center bg-[var(--surface-muted)] text-[var(--text-subtle)]">
                  {asset.type === "IMAGE" || asset.type === "SVG" ? (
                    <img src={asset.url} alt="" className="h-full w-full object-cover" />
                  ) : asset.type === "VIDEO" ? (
                    <video src={asset.url} className="h-full w-full object-cover" muted />
                  ) : (
                    <AssetTypeIcon type={asset.type} />
                  )}
                  {asset.status === "ARCHIVED" && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white">Archived</span>
                  )}
                </span>
                <span className="flex flex-col gap-0.5 p-3">
                  <span className="truncate text-[11.5px] font-medium text-[var(--text)]">{asset.name}</span>
                  <span className="truncate text-[10px] text-[var(--text-subtle)]">
                    {ASSET_TYPE_LABELS[asset.type]} · {formatBytes(asset.fileSizeBytes)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <AssetDetailPanel
          key={selected.id}
          asset={selected}
          kits={kits}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setAssets((current) => current.map((item) => (item.id === updated.id ? updated : item)));
            setSelected(updated);
          }}
          onArchiveToggle={() => void archiveOrRestore(selected)}
          onDelete={() => confirmDelete(selected)}
          notify={notify}
          notifyError={notifyError}
        />
      )}
    </div>
  );
}

function AssetDetailPanel({
  asset,
  kits,
  onClose,
  onUpdated,
  onArchiveToggle,
  onDelete,
  notify,
  notifyError,
}: {
  asset: ApiBrandAsset;
  kits: ApiBrandKit[];
  onClose: () => void;
  onUpdated: (asset: ApiBrandAsset) => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
  notify: (message: string) => void;
  notifyError: (error: unknown, fallback: string) => void;
}) {
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description ?? "");
  const [category, setCategory] = useState(asset.category ?? "");
  const [tags, setTags] = useState(asset.tags.join(", "));
  const [usageRights, setUsageRights] = useState<UsageRights>(asset.usageRights);
  const [brandKitId, setBrandKitId] = useState(asset.brandKitId ?? "");
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<ApiBrandAssetVersion[] | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateAssetApi(asset.id, {
        name,
        description: description || null,
        category: category || null,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        usageRights,
        brandKitId: brandKitId || null,
      });
      onUpdated(updated);
      notify("Asset updated.");
    } catch (error) {
      notifyError(error, "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const replaceFile = async (file: File) => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const updated = await replaceAssetApi(asset.id, formData);
      onUpdated(updated);
      notify("File replaced — the previous version was saved to history.");
    } catch (error) {
      notifyError(error, "Unable to replace this file.");
    } finally {
      setSaving(false);
    }
  };

  const loadVersions = async () => {
    setVersionsOpen((open) => !open);
    if (versions === null) {
      try {
        setVersions(await fetchAssetVersionsApi(asset.id));
      } catch (error) {
        notifyError(error, "Unable to load version history.");
      }
    }
  };

  const restoreVersion = async (versionId: string) => {
    try {
      const updated = await restoreAssetVersionApi(asset.id, versionId);
      onUpdated(updated);
      setVersions(await fetchAssetVersionsApi(asset.id));
      notify("Version restored.");
    } catch (error) {
      notifyError(error, "Unable to restore this version.");
    }
  };

  return (
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="sg-fade fixed inset-0 z-[150] flex items-end justify-center bg-black/45 sm:items-center sm:p-6">
      <div role="dialog" aria-modal="true" className="flex h-[92dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-[24px] border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:h-auto sm:max-h-[88dvh] sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h2 className="truncate text-[15px] font-semibold text-[var(--text)]">{asset.name}</h2>
          <IconButton label="Close" onClick={onClose} bordered>
            <X size={15} />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl bg-[var(--surface-muted)]">
            {asset.type === "IMAGE" || asset.type === "SVG" ? (
              <img src={asset.url} alt="" className="h-full w-full object-contain" />
            ) : asset.type === "VIDEO" ? (
              <video src={asset.url} controls className="h-full w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-[var(--text-subtle)]">
                <AssetTypeIcon type={asset.type} />
                <span className="text-[11px]">{ASSET_TYPE_LABELS[asset.type]}</span>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Name</label>
              <input value={name} onChange={(event) => setName(event.target.value)} className={cx(INPUT, "h-10 px-3")} />
            </div>
            <div>
              <label className={LABEL}>Category</label>
              <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="e.g. Logo, Social" className={cx(INPUT, "h-10 px-3")} />
            </div>
          </div>

          <div className="mt-3">
            <label className={LABEL}>Description</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className={cx(INPUT, "resize-y px-3 py-2")} />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Tags (comma separated)</label>
              <input value={tags} onChange={(event) => setTags(event.target.value)} className={cx(INPUT, "h-10 px-3")} />
            </div>
            <div>
              <label className={LABEL}>Brand kit</label>
              <select value={brandKitId} onChange={(event) => setBrandKitId(event.target.value)} className={cx(INPUT, "h-10 px-3")}>
                <option value="">No brand kit</option>
                {kits.map((kit) => (
                  <option key={kit.id} value={kit.id}>
                    {kit.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className={LABEL}>Usage rights</label>
            <select value={usageRights} onChange={(event) => setUsageRights(event.target.value as UsageRights)} className={cx(INPUT, "h-10 px-3")}>
              <option value="INTERNAL_ONLY">Internal only</option>
              <option value="CLIENT_APPROVED">Client approved</option>
              <option value="PUBLIC">Public</option>
              <option value="UNRESTRICTED">Unrestricted</option>
            </select>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl bg-[var(--surface-muted)] p-3 text-[10.5px] sm:grid-cols-3">
            <div>
              <dt className="text-[var(--text-subtle)]">Size</dt>
              <dd className="font-medium text-[var(--text)]">{formatBytes(asset.fileSizeBytes)}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-subtle)]">Uploaded by</dt>
              <dd className="font-medium text-[var(--text)]">{personName(asset.uploadedBy)}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-subtle)]">Uploaded</dt>
              <dd className="font-medium text-[var(--text)]">{formatDate(asset.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-subtle)]">Updated</dt>
              <dd className="font-medium text-[var(--text)]">{formatDate(asset.updatedAt)}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-subtle)]">MIME type</dt>
              <dd className="truncate font-medium text-[var(--text)]">{asset.mimeType}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-subtle)]">Status</dt>
              <dd className="font-medium text-[var(--text)]">{asset.status === "ACTIVE" ? "Active" : "Archived"}</dd>
            </div>
          </dl>

          <div className="mt-4">
            <button type="button" onClick={loadVersions} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--accent)]">
              <History size={13} />
              Version history
              <ChevronDown size={12} className={cx("transition-transform", versionsOpen && "rotate-180")} />
            </button>
            {versionsOpen && (
              <ul className="mt-2 space-y-1.5">
                {versions === null ? (
                  <li className="text-[11px] text-[var(--text-muted)]">Loading…</li>
                ) : versions.length === 0 ? (
                  <li className="text-[11px] text-[var(--text-muted)]">No previous versions — this is the only file this asset has had.</li>
                ) : (
                  versions.map((version) => (
                    <li key={version.id} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-[11px]">
                      <span className="min-w-0 truncate">
                        v{version.versionNumber} · {formatBytes(version.fileSizeBytes)} · {formatDate(version.createdAt)}
                        {version.note ? ` · ${version.note}` : ""}
                      </span>
                      <button type="button" onClick={() => void restoreVersion(version.id)} className="shrink-0 font-semibold text-[var(--accent)] hover:underline">
                        Restore
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-5 py-3.5">
          <a href={asset.url} download target="_blank" rel="noreferrer" className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT)}>
            <Download size={13} />
            Download
          </a>
          <input
            ref={replaceInputRef}
            type="file"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void replaceFile(file);
              event.target.value = "";
            }}
          />
          <button type="button" onClick={() => replaceInputRef.current?.click()} className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT)}>
            <RefreshCw size={13} />
            Replace
          </button>
          <button type="button" onClick={onArchiveToggle} className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT)}>
            {asset.status === "ACTIVE" ? <Archive size={13} /> : <ArchiveRestore size={13} />}
            {asset.status === "ACTIVE" ? "Archive" : "Restore"}
          </button>
          <button type="button" onClick={onDelete} className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-500/10">
            <Trash2 size={13} />
            Delete
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={cx(BTN_PRIMARY, FOCUS, BTN_COMPACT)}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   BRAND KITS
============================================================================= */

type ClientOption = { id: string; name: string };

function BrandKitsWorkspace({
  kits,
  status,
  onRefresh,
  notify,
  notifyError,
  setDialog,
}: {
  kits: ApiBrandKit[];
  status: LoadStatus;
  onRefresh: () => void;
  notify: (message: string) => void;
  notifyError: (error: unknown, fallback: string) => void;
  setDialog: (request: DialogRequest | null) => void;
}) {
  const [editing, setEditing] = useState<ApiBrandKit | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const visibleKits = useMemo(
    () =>
      kits
        .filter((kit) => (showArchived ? kit.status === "ARCHIVED" : kit.status !== "ARCHIVED"))
        .filter((kit) => !search || kit.name.toLowerCase().includes(search.toLowerCase())),
    [kits, showArchived, search],
  );

  const archiveKit = (kit: ApiBrandKit) => {
    setDialog({
      title: "Archive this brand kit?",
      description: "Its assets, templates and guideline stay intact — the kit just moves out of the active list.",
      confirmLabel: "Archive",
      tone: "danger",
      onConfirm: async () => {
        await archiveKitApi(kit.id);
        notify("Brand kit archived.");
        onRefresh();
      },
    });
  };

  const duplicateKit = async (kit: ApiBrandKit) => {
    try {
      await duplicateKitApi(kit.id);
      notify("Brand kit duplicated.");
      onRefresh();
    } catch (error) {
      notifyError(error, "Unable to duplicate this brand kit.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search brand kits…" className={cx(INPUT, "h-10 pl-8 pr-3")} />
        </div>
        <button
          type="button"
          onClick={() => setShowArchived((value) => !value)}
          className={cx(showArchived ? BTN_PRIMARY : BTN_SECONDARY, FOCUS)}
        >
          <Archive size={13} />
          {showArchived ? "Showing archived" : "Active"}
        </button>
        <button type="button" onClick={() => setEditing("new")} className={cx(BTN_PRIMARY, FOCUS)}>
          <Plus size={14} />
          Create Brand Kit
        </button>
      </div>

      {status === "loading" && kits.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className={cx(CARD, "h-[150px] animate-pulse")} />
          ))}
        </div>
      ) : visibleKits.length === 0 ? (
        <div className={CARD}>
          <EmptyState icon={Palette} title="No brand kits" description="Create a brand kit to group colours, logos, templates and guidelines for a brand." />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleKits.map((kit) => (
            <div key={kit.id} className={cx(CARD, "flex flex-col gap-3 p-4")}>
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => setEditing(kit)} className="min-w-0 text-left">
                  <p className="truncate text-[13px] font-semibold text-[var(--text)] hover:underline">{kit.name}</p>
                  <p className="truncate text-[10.5px] text-[var(--text-subtle)]">{kit.client ? kit.client.name : "No client · internal"}</p>
                </button>
                {kit.status === "ARCHIVED" && <Pill label="Archived" hue="var(--text-subtle)" />}
                {kit.status === "DRAFT" && <Pill label="Draft" hue="#D97706" />}
              </div>

              {(kit.primaryColors?.length || kit.secondaryColors?.length) ? (
                <div className="flex flex-wrap gap-1">
                  {[...(kit.primaryColors ?? []), ...(kit.secondaryColors ?? [])].slice(0, 8).map((color, index) => (
                    <span key={`${color}-${index}`} className="h-5 w-5 rounded-full border border-[var(--line)]" style={{ background: color }} title={color} />
                  ))}
                </div>
              ) : (
                <p className="text-[10.5px] text-[var(--text-subtle)]">No colours set yet</p>
              )}

              <div className="flex items-center gap-3 text-[10.5px] text-[var(--text-subtle)]">
                <span>{kit._count?.assets ?? 0} assets</span>
                <span>{kit._count?.templates ?? 0} templates</span>
                <span>{kit._count?.requests ?? 0} requests</span>
              </div>

              <div className="mt-auto flex items-center gap-1.5 border-t border-[var(--line)] pt-3">
                <button type="button" onClick={() => setEditing(kit)} className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT)}>
                  <Edit3 size={12} />
                  Edit
                </button>
                <button type="button" onClick={() => void duplicateKit(kit)} className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT)}>
                  <Copy size={12} />
                  Duplicate
                </button>
                {kit.status !== "ARCHIVED" && (
                  <button type="button" onClick={() => archiveKit(kit)} className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-500/10">
                    <Archive size={12} />
                    Archive
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <BrandKitEditor
          kit={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onRefresh();
          }}
          notify={notify}
          notifyError={notifyError}
        />
      )}
    </div>
  );
}

function BrandKitEditor({
  kit,
  onClose,
  onSaved,
  notify,
  notifyError,
}: {
  kit: ApiBrandKit | null;
  onClose: () => void;
  onSaved: () => void;
  notify: (message: string) => void;
  notifyError: (error: unknown, fallback: string) => void;
}) {
  const [name, setName] = useState(kit?.name ?? "");
  const [description, setDescription] = useState(kit?.description ?? "");
  const [clientId, setClientId] = useState(kit?.clientId ?? "");
  const [primaryColors, setPrimaryColors] = useState((kit?.primaryColors ?? []).join(", "));
  const [secondaryColors, setSecondaryColors] = useState((kit?.secondaryColors ?? []).join(", "));
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/client-options", { credentials: "include" })
      .then((response) => response.json())
      .then((payload) => {
        const options = payload?.clients ?? payload?.options ?? [];
        if (Array.isArray(options)) setClients(options);
      })
      .catch(() => undefined);
  }, []);

  const save = async () => {
    if (!name.trim()) {
      notifyError(new Error("A brand kit name is required."), "A brand kit name is required.");
      return;
    }
    setSaving(true);
    try {
      const colorsPrimary = primaryColors.split(",").map((value) => value.trim()).filter(Boolean);
      const colorsSecondary = secondaryColors.split(",").map((value) => value.trim()).filter(Boolean);

      if (kit) {
        await updateKitApi(kit.id, {
          name,
          description: description || null,
          clientId: clientId || null,
          primaryColors: colorsPrimary,
          secondaryColors: colorsSecondary,
        } as Partial<ApiBrandKit>);
        notify("Brand kit updated.");
      } else {
        await createKitApi({ name, description: description || null, clientId: clientId || null, primaryColors: colorsPrimary, secondaryColors: colorsSecondary });
        notify("Brand kit created.");
      }
      onSaved();
    } catch (error) {
      notifyError(error, "Unable to save this brand kit.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="sg-fade fixed inset-0 z-[150] flex items-end justify-center bg-black/45 sm:items-center sm:p-6">
      <div role="dialog" aria-modal="true" className="flex max-h-[88dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[24px] border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[var(--text)]">{kit ? "Edit brand kit" : "Create brand kit"}</h2>
          <IconButton label="Close" onClick={onClose} bordered>
            <X size={15} />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div>
            <label className={LABEL}>Name</label>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Syntra Grid" className={cx(INPUT, "h-10 px-3")} />
          </div>
          <div className="mt-3">
            <label className={LABEL}>Description</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className={cx(INPUT, "resize-y px-3 py-2")} />
          </div>
          <div className="mt-3">
            <label className={LABEL}>Client (leave blank for an internal / non-client brand)</label>
            <select value={clientId} onChange={(event) => setClientId(event.target.value)} className={cx(INPUT, "h-10 px-3")}>
              <option value="">No client — internal brand</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Primary colours (hex, comma separated)</label>
              <input value={primaryColors} onChange={(event) => setPrimaryColors(event.target.value)} placeholder="#0A66C2, #111827" className={cx(INPUT, "h-10 px-3")} />
            </div>
            <div>
              <label className={LABEL}>Secondary colours</label>
              <input value={secondaryColors} onChange={(event) => setSecondaryColors(event.target.value)} placeholder="#F4F4F5" className={cx(INPUT, "h-10 px-3")} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-3.5">
          <button type="button" onClick={onClose} className={cx(BTN_SECONDARY, FOCUS)}>
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={cx(BTN_PRIMARY, FOCUS)}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {kit ? "Save changes" : "Create kit"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   BRAND GUIDELINES
============================================================================= */

const GUIDELINE_FIELDS: Array<{
  section: string;
  fields: Array<{ key: keyof NonNullable<ApiBrandGuideline>; label: string; multiline?: boolean }>;
}> = [
  {
    section: "Brand identity",
    fields: [
      { key: "tagline", label: "Tagline" },
      { key: "mission", label: "Mission", multiline: true },
      { key: "vision", label: "Vision", multiline: true },
      { key: "personality", label: "Brand personality", multiline: true },
      { key: "toneOfVoice", label: "Tone of voice", multiline: true },
    ],
  },
  {
    section: "Visual identity",
    fields: [
      { key: "logoSpacingNotes", label: "Logo spacing", multiline: true },
      { key: "minLogoSizeNotes", label: "Minimum logo sizes", multiline: true },
      { key: "approvedUsageNotes", label: "Approved usage", multiline: true },
      { key: "incorrectUsageNotes", label: "Incorrect usage", multiline: true },
      { key: "fontUsageNotes", label: "Font usage", multiline: true },
    ],
  },
  {
    section: "Content guidelines",
    fields: [
      { key: "socialMediaGuidelines", label: "Social media guidelines", multiline: true },
      { key: "photographyGuidelines", label: "Photography guidelines", multiline: true },
      { key: "videoGuidelines", label: "Video guidelines", multiline: true },
      { key: "marketingStandards", label: "Marketing communication standards", multiline: true },
      { key: "emailSignatureGuidelines", label: "Email signature guidelines", multiline: true },
    ],
  },
];

function BrandGuidelinesWorkspace({ kits, notify, notifyError }: SharedWorkspaceProps) {
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [guideline, setGuideline] = useState<ApiBrandGuideline>(null);
  const [values, setValues] = useState<string>("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; versionNumber: number; note: string | null; createdAt: string }> | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);

  useEffect(() => {
    if (!selectedKitId) return;
    Promise.resolve().then(() => setStatus("loading"));
    fetchGuidelineApi(selectedKitId)
      .then((data) => {
        setGuideline(data);
        setFields(
          data
            ? (Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === "string")) as Record<string, string>)
            : {},
        );
        setValues((data?.values ?? []).join(", "));
        setStatus("ready");
        setVersions(null);
        setVersionsOpen(false);
      })
      .catch((error) => {
        setStatus("error");
        notifyError(error, "Unable to load this guideline.");
      });
  }, [selectedKitId, notifyError]);

  const save = async () => {
    if (!selectedKitId) return;
    setSaving(true);
    try {
      const input: Record<string, unknown> = { ...fields, values: values.split(",").map((value) => value.trim()).filter(Boolean) };
      const updated = await saveGuidelineApi(selectedKitId, input);
      setGuideline(updated);
      notify("Guideline saved as draft.");
    } catch (error) {
      notifyError(error, "Unable to save this guideline.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!selectedKitId) return;
    try {
      const updated = guideline?.status === "PUBLISHED" ? await unpublishGuidelineApi(selectedKitId) : await publishGuidelineApi(selectedKitId);
      setGuideline(updated);
      notify(updated?.status === "PUBLISHED" ? "Guideline published." : "Guideline moved back to draft.");
    } catch (error) {
      notifyError(error, "Unable to update the publish state.");
    }
  };

  const loadVersions = async () => {
    if (!selectedKitId) return;
    setVersionsOpen((open) => !open);
    if (versions === null) {
      try {
        setVersions(await fetchGuidelineVersionsApi(selectedKitId));
      } catch (error) {
        notifyError(error, "Unable to load version history.");
      }
    }
  };

  const selectedKit = kits.find((kit) => kit.id === selectedKitId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <section className={cx(CARD, "h-fit overflow-hidden")}>
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 className="text-[12px] font-semibold text-[var(--text)]">Brand kits</h3>
        </div>
        {kits.length === 0 ? (
          <p className="px-4 py-6 text-[11px] text-[var(--text-muted)]">Create a brand kit first.</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {kits.map((kit) => (
              <li key={kit.id}>
                <button
                  type="button"
                  onClick={() => setSelectedKitId(kit.id)}
                  className={cx(
                    "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-[11.5px] transition",
                    selectedKitId === kit.id ? "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]",
                  )}
                >
                  {kit.name}
                  {selectedKitId === kit.id && <Check size={13} className="text-[var(--accent)]" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!selectedKit ? (
        <div className={CARD}>
          <EmptyState icon={BookOpen} title="Pick a brand kit" description="Choose a brand kit on the left to view or edit its guideline document." />
        </div>
      ) : status === "loading" ? (
        <div className={cx(CARD, "h-[320px] animate-pulse")} />
      ) : (
        <div className="space-y-4">
          <div className={cx(CARD, "flex items-center justify-between gap-3 p-4")}>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--text)]">{selectedKit.name} guideline</h2>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                {guideline?.status === "PUBLISHED" ? "Published" : "Draft"}
                {guideline?.updatedBy ? ` · last updated by ${personName(guideline.updatedBy)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={loadVersions} className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT)}>
                <History size={13} />
                History
              </button>
              <button type="button" onClick={() => void togglePublish()} className={cx(guideline?.status === "PUBLISHED" ? BTN_SECONDARY : BTN_PRIMARY, FOCUS, BTN_COMPACT)}>
                {guideline?.status === "PUBLISHED" ? "Unpublish" : "Publish"}
              </button>
            </div>
          </div>

          {versionsOpen && (
            <div className={cx(CARD, "p-4")}>
              {versions === null ? (
                <p className="text-[11px] text-[var(--text-muted)]">Loading…</p>
              ) : versions.length === 0 ? (
                <p className="text-[11px] text-[var(--text-muted)]">No published versions yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {versions.map((version) => (
                    <li key={version.id} className="text-[11px] text-[var(--text-muted)]">
                      v{version.versionNumber} · {version.note} · {formatDate(version.createdAt)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <label className={LABEL}>Core values (comma separated)</label>
            <input value={values} onChange={(event) => setValues(event.target.value)} placeholder="Integrity, Craft, Momentum" className={cx(INPUT, "h-10 px-3")} />
          </div>

          {GUIDELINE_FIELDS.map((group) => (
            <section key={group.section} className={cx(CARD, "p-4")}>
              <h3 className="mb-3 text-[12.5px] font-semibold text-[var(--text)]">{group.section}</h3>
              <div className="space-y-3">
                {group.fields.map((field) => (
                  <div key={field.key}>
                    <label className={LABEL}>{field.label}</label>
                    {field.multiline ? (
                      <textarea
                        value={fields[field.key] ?? ""}
                        onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                        rows={2}
                        className={cx(INPUT, "resize-y px-3 py-2")}
                      />
                    ) : (
                      <input
                        value={fields[field.key] ?? ""}
                        onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                        className={cx(INPUT, "h-10 px-3")}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="flex justify-end">
            <button type="button" onClick={() => void save()} disabled={saving} className={cx(BTN_PRIMARY, FOCUS)}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save draft
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================================================================
   TEMPLATES
============================================================================= */

function TemplatesWorkspace({ kits, notify, notifyError }: SharedWorkspaceProps) {
  const [templates, setTemplates] = useState<ApiBrandTemplate[]>([]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<TemplateStatus>("ACTIVE");
  const [editing, setEditing] = useState<ApiBrandTemplate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadForm, setUploadForm] = useState<{ file: File; name: string; category: TemplateCategory; brandKitId: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(() => {
    Promise.resolve().then(() => setStatus("loading"));
    fetchTemplatesApi({ category: categoryFilter === "ALL" ? undefined : categoryFilter, status: statusFilter, search: search || undefined })
      .then(({ templates: result }) => {
        setTemplates(result);
        setStatus("ready");
      })
      .catch((error) => {
        setStatus("error");
        notifyError(error, "Unable to load templates.");
      });
  }, [categoryFilter, statusFilter, search, notifyError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startUpload = (file: File) => {
    setUploadForm({ file, name: file.name.replace(/\.[^./]+$/, ""), category: "OTHER", brandKitId: "" });
  };

  const confirmUpload = async () => {
    if (!uploadForm) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("name", uploadForm.name);
      formData.append("category", uploadForm.category);
      if (uploadForm.brandKitId) formData.append("brandKitId", uploadForm.brandKitId);
      await uploadTemplateApi(formData);
      notify("Template uploaded.");
      setUploadForm(null);
      refresh();
    } catch (error) {
      notifyError(error, "Unable to upload this template.");
    } finally {
      setUploading(false);
    }
  };

  const archiveOrRestore = async (template: ApiBrandTemplate) => {
    try {
      const updated = template.status === "ACTIVE" ? await archiveTemplateApi(template.id) : await restoreTemplateApi(template.id);
      setTemplates((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      notify(template.status === "ACTIVE" ? "Template archived." : "Template restored.");
    } catch (error) {
      notifyError(error, "Unable to update this template.");
    }
  };

  const duplicate = async (template: ApiBrandTemplate) => {
    try {
      await duplicateTemplateApi(template.id);
      notify("Template duplicated.");
      refresh();
    } catch (error) {
      notifyError(error, "Unable to duplicate this template.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search templates…" className={cx(INPUT, "h-10 pl-8 pr-3")} />
        </div>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as TemplateCategory | "ALL")} className={cx(INPUT, "h-10 w-auto px-2.5")}>
          <option value="ALL">All categories</option>
          {Object.entries(TEMPLATE_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TemplateStatus)} className={cx(INPUT, "h-10 w-auto px-2.5")}>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) startUpload(file);
            event.target.value = "";
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className={cx(BTN_PRIMARY, FOCUS)}>
          <Upload size={14} />
          Upload Template
        </button>
      </div>

      {status === "loading" && templates.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className={cx(CARD, "h-[150px] animate-pulse")} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className={CARD}>
          <EmptyState icon={Layers} title="No templates yet" description="Upload a real template file to make it available for the team to reuse." />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((template) => (
            <div key={template.id} className={cx(CARD, "flex flex-col overflow-hidden")}>
              <span className="relative flex aspect-[4/3] items-center justify-center bg-[var(--surface-muted)] text-[var(--text-subtle)]">
                {template.mimeType.startsWith("image/") ? (
                  <img src={template.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <FileText size={22} />
                )}
                {template.status === "ARCHIVED" && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold text-white">Archived</span>
                )}
              </span>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <button type="button" onClick={() => setEditing(template)} className="truncate text-left text-[11.5px] font-medium text-[var(--text)] hover:underline">
                  {template.name}
                </button>
                <span className="text-[10px] text-[var(--text-subtle)]">{TEMPLATE_CATEGORY_LABELS[template.category]} · {formatBytes(template.fileSizeBytes)}</span>
                <div className="mt-auto flex items-center gap-1 pt-2">
                  <a href={template.url} download target="_blank" rel="noreferrer" className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)]" title="Download">
                    <Download size={13} />
                  </a>
                  <button type="button" onClick={() => void duplicate(template)} title="Duplicate" className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)]">
                    <Copy size={13} />
                  </button>
                  <button type="button" onClick={() => void archiveOrRestore(template)} title={template.status === "ACTIVE" ? "Archive" : "Restore"} className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)]">
                    {template.status === "ACTIVE" ? <Archive size={13} /> : <ArchiveRestore size={13} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadForm && (
        <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setUploadForm(null)} className="sg-fade fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-[440px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl">
            <h3 className="text-[14px] font-semibold text-[var(--text)]">Upload template</h3>
            <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{uploadForm.file.name}</p>

            <div className="mt-3">
              <label className={LABEL}>Name</label>
              <input value={uploadForm.name} onChange={(event) => setUploadForm({ ...uploadForm, name: event.target.value })} className={cx(INPUT, "h-10 px-3")} />
            </div>
            <div className="mt-3">
              <label className={LABEL}>Category</label>
              <select value={uploadForm.category} onChange={(event) => setUploadForm({ ...uploadForm, category: event.target.value as TemplateCategory })} className={cx(INPUT, "h-10 px-3")}>
                {Object.entries(TEMPLATE_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3">
              <label className={LABEL}>Brand kit (optional)</label>
              <select value={uploadForm.brandKitId} onChange={(event) => setUploadForm({ ...uploadForm, brandKitId: event.target.value })} className={cx(INPUT, "h-10 px-3")}>
                <option value="">No brand kit</option>
                {kits.map((kit) => (
                  <option key={kit.id} value={kit.id}>
                    {kit.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setUploadForm(null)} disabled={uploading} className={cx(BTN_SECONDARY, FOCUS)}>
                Cancel
              </button>
              <button type="button" onClick={() => void confirmUpload()} disabled={uploading} className={cx(BTN_PRIMARY, FOCUS)}>
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <TemplateDetailPanel
          template={editing}
          kits={kits}
          onClose={() => setEditing(null)}
          onUpdated={(updated) => {
            setTemplates((current) => current.map((item) => (item.id === updated.id ? updated : item)));
            setEditing(updated);
          }}
          notify={notify}
          notifyError={notifyError}
        />
      )}
    </div>
  );
}

function TemplateDetailPanel({
  template,
  kits,
  onClose,
  onUpdated,
  notify,
  notifyError,
}: {
  template: ApiBrandTemplate;
  kits: ApiBrandKit[];
  onClose: () => void;
  onUpdated: (template: ApiBrandTemplate) => void;
  notify: (message: string) => void;
  notifyError: (error: unknown, fallback: string) => void;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [tags, setTags] = useState(template.tags.join(", "));
  const [brandKitId, setBrandKitId] = useState(template.brandKitId ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateTemplateApi(template.id, {
        name,
        description: description || null,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        brandKitId: brandKitId || null,
      });
      onUpdated(updated);
      notify("Template updated.");
    } catch (error) {
      notifyError(error, "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="sg-fade fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-[480px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">Edit template</h3>
          <IconButton label="Close" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>

        <div className="mt-3">
          <label className={LABEL}>Name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} className={cx(INPUT, "h-10 px-3")} />
        </div>
        <div className="mt-3">
          <label className={LABEL}>Description</label>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className={cx(INPUT, "resize-y px-3 py-2")} />
        </div>
        <div className="mt-3">
          <label className={LABEL}>Tags</label>
          <input value={tags} onChange={(event) => setTags(event.target.value)} className={cx(INPUT, "h-10 px-3")} />
        </div>
        <div className="mt-3">
          <label className={LABEL}>Brand kit</label>
          <select value={brandKitId} onChange={(event) => setBrandKitId(event.target.value)} className={cx(INPUT, "h-10 px-3")}>
            <option value="">No brand kit</option>
            {kits.map((kit) => (
              <option key={kit.id} value={kit.id}>
                {kit.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={cx(BTN_SECONDARY, FOCUS)}>
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className={cx(BTN_PRIMARY, FOCUS)}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   REQUESTS & APPROVALS
============================================================================= */

function RequestsWorkspace({ kits, notify, notifyError, setDialog }: SharedWorkspaceProps) {
  const [requests, setRequests] = useState<ApiBrandRequest[]>([]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "ALL">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<RequestPriority | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Promise.resolve().then(() => setStatus("loading"));
    fetchRequestsApi({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      priority: priorityFilter === "ALL" ? undefined : priorityFilter,
      search: search || undefined,
    })
      .then(({ requests: result }) => {
        setRequests(result);
        setStatus("ready");
      })
      .catch((error) => {
        setStatus("error");
        notifyError(error, "Unable to load requests.");
      });
  }, [statusFilter, priorityFilter, search, notifyError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests…" className={cx(INPUT, "h-10 pl-8 pr-3")} />
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as RequestStatus | "ALL")} className={cx(INPUT, "h-10 w-auto px-2.5")}>
          <option value="ALL">All statuses</option>
          {Object.entries(REQUEST_STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as RequestPriority | "ALL")} className={cx(INPUT, "h-10 w-auto px-2.5")}>
          <option value="ALL">All priorities</option>
          {Object.entries(PRIORITY_META).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setCreating(true)} className={cx(BTN_PRIMARY, FOCUS)}>
          <Plus size={14} />
          New Asset Request
        </button>
      </div>

      {status === "loading" && requests.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={cx(CARD, "h-[64px] animate-pulse")} />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className={CARD}>
          <EmptyState icon={Inbox} title="No requests" description="Requests for new logos, graphics, presentations and other assets will appear here." />
        </div>
      ) : (
        <div className={cx(CARD, "overflow-hidden")}>
          <ul className="divide-y divide-[var(--line)]">
            {requests.map((request) => (
              <li key={request.id}>
                <button type="button" onClick={() => setOpenRequestId(request.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-muted)] sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-[var(--text)]">{request.title}</span>
                    <span className="block text-[10.5px] text-[var(--text-subtle)]">
                      {REQUEST_TYPE_LABELS[request.type]} · requested by {personName(request.requestedBy)} · {relativeTime(request.createdAt)}
                    </span>
                  </span>
                  <Pill label={PRIORITY_META[request.priority].label} hue={PRIORITY_META[request.priority].hue} />
                  <Pill label={REQUEST_STATUS_META[request.status].label} hue={REQUEST_STATUS_META[request.status].hue} />
                  {request.assignedTo && <span className="hidden text-[10.5px] text-[var(--text-subtle)] sm:inline">→ {personName(request.assignedTo)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {creating && (
        <CreateRequestDialog
          kits={kits}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
          notifyError={notifyError}
        />
      )}

      {openRequestId && (
        <RequestDetailPanel
          requestId={openRequestId}
          onClose={() => setOpenRequestId(null)}
          onChanged={refresh}
          notify={notify}
          notifyError={notifyError}
          setDialog={setDialog}
        />
      )}
    </div>
  );
}

function CreateRequestDialog({
  kits,
  onClose,
  onCreated,
  notifyError,
}: {
  kits: ApiBrandKit[];
  onClose: () => void;
  onCreated: () => void;
  notifyError: (error: unknown, fallback: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<RequestType>("SOCIAL_GRAPHIC");
  const [priority, setPriority] = useState<RequestPriority>("MEDIUM");
  const [brandKitId, setBrandKitId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim() || !description.trim()) {
      notifyError(new Error("A title and description are required."), "A title and description are required.");
      return;
    }
    setSaving(true);
    try {
      await createRequestApi({
        title,
        description,
        type,
        priority,
        brandKitId: brandKitId || null,
        dueDate: dueDate || null,
      });
      onCreated();
    } catch (error) {
      notifyError(error, "Unable to create this request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="sg-fade fixed inset-0 z-[150] flex items-end justify-center bg-black/45 sm:items-center sm:p-6">
      <div role="dialog" aria-modal="true" className="flex max-h-[88dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[24px] border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:rounded-[24px]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[var(--text)]">New asset request</h2>
          <IconButton label="Close" onClick={onClose} bordered>
            <X size={15} />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div>
            <label className={LABEL}>Title</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. New Instagram carousel for product launch" className={cx(INPUT, "h-10 px-3")} />
          </div>
          <div className="mt-3">
            <label className={LABEL}>Description</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className={cx(INPUT, "resize-y px-3 py-2")} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Type</label>
              <select value={type} onChange={(event) => setType(event.target.value as RequestType)} className={cx(INPUT, "h-10 px-3")}>
                {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Priority</label>
              <select value={priority} onChange={(event) => setPriority(event.target.value as RequestPriority)} className={cx(INPUT, "h-10 px-3")}>
                {Object.entries(PRIORITY_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Brand kit</label>
              <select value={brandKitId} onChange={(event) => setBrandKitId(event.target.value)} className={cx(INPUT, "h-10 px-3")}>
                <option value="">No brand kit</option>
                {kits.map((kit) => (
                  <option key={kit.id} value={kit.id}>
                    {kit.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Due date</label>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={cx(INPUT, "h-10 px-3")} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-3.5">
          <button type="button" onClick={onClose} className={cx(BTN_SECONDARY, FOCUS)}>
            Cancel
          </button>
          <button type="button" onClick={() => void create()} disabled={saving} className={cx(BTN_PRIMARY, FOCUS)}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Submit request
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestDetailPanel({
  requestId,
  onClose,
  onChanged,
  notify,
  notifyError,
  setDialog,
}: {
  requestId: string;
  onClose: () => void;
  onChanged: () => void;
  notify: (message: string) => void;
  notifyError: (error: unknown, fallback: string) => void;
  setDialog: (request: DialogRequest | null) => void;
}) {
  const [request, setRequest] = useState<ApiBrandRequest | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    Promise.resolve().then(() => setStatus("loading"));
    fetchRequestApi(requestId)
      .then((data) => {
        setRequest(data);
        setStatus("ready");
      })
      .catch((error) => {
        setStatus("error");
        notifyError(error, "Unable to load this request.");
      });
  }, [requestId, notifyError]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (key: string, action: () => Promise<ApiBrandRequest>) => {
    if (busyAction) return;
    setBusyAction(key);
    try {
      const updated = await action();
      setRequest(updated);
      onChanged();
    } catch (error) {
      notifyError(error, "That action could not be completed.");
    } finally {
      setBusyAction(null);
    }
  };

  const addComment = async () => {
    if (!commentBody.trim()) return;
    try {
      const updated = await addCommentApi(requestId, commentBody.trim());
      setRequest(updated);
      setCommentBody("");
    } catch (error) {
      notifyError(error, "Unable to add this comment.");
    }
  };

  const addAttachment = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const updated = await addAttachmentApi(requestId, formData);
      setRequest(updated);
      notify("Attachment added.");
    } catch (error) {
      notifyError(error, "Unable to add this attachment.");
    }
  };

  const openRejectDialog = () => {
    setDialog({
      title: "Reject this request?",
      confirmLabel: "Reject",
      tone: "danger",
      input: { label: "Reason", type: "textarea", required: true },
      onConfirm: async (reason) => {
        await runAction("reject", () => requestAction(requestId, "reject", { reason }));
      },
    });
  };

  const openChangesDialog = () => {
    setDialog({
      title: "Request changes",
      confirmLabel: "Send",
      input: { label: "What needs to change", type: "textarea", required: true },
      onConfirm: async (notes) => {
        await runAction("changes", () => requestAction(requestId, "request-changes", { notes }));
      },
    });
  };

  if (status === "loading" && !request) {
    return (
      <div className="sg-fade fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4">
        <div className="h-[60dvh] w-full max-w-[640px] animate-pulse rounded-2xl bg-[var(--surface)]" />
      </div>
    );
  }

  if (!request) return null;

  const meta = REQUEST_STATUS_META[request.status];

  return (
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="sg-fade fixed inset-0 z-[150] flex items-end justify-center bg-black/45 sm:items-center sm:p-6">
      <div role="dialog" aria-modal="true" className="flex h-[92dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[24px] border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:h-auto sm:max-h-[88dvh] sm:rounded-[24px]">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-[var(--text)]">{request.title}</h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
              {REQUEST_TYPE_LABELS[request.type]} · requested by {personName(request.requestedBy)} on {formatDate(request.createdAt)}
            </p>
          </div>
          <IconButton label="Close" onClick={onClose} bordered>
            <X size={15} />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pill label={meta.label} hue={meta.hue} />
            <Pill label={PRIORITY_META[request.priority].label} hue={PRIORITY_META[request.priority].hue} />
            {request.brandKit && <span className="text-[10.5px] text-[var(--text-subtle)]">· {request.brandKit.name}</span>}
            {request.dueDate && <span className="text-[10.5px] text-[var(--text-subtle)]">· due {formatDate(request.dueDate)}</span>}
          </div>

          <p className="mt-3 whitespace-pre-wrap text-[12.5px] leading-6 text-[var(--text)]">{request.description}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {request.status === "SUBMITTED" && (
              <button type="button" onClick={() => void runAction("start", () => requestAction(requestId, "start"))} disabled={Boolean(busyAction)} className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT)}>
                {busyAction === "start" ? <Loader2 size={12} className="animate-spin" /> : <Clock3 size={12} />}
                Start progress
              </button>
            )}
            {request.status === "IN_PROGRESS" && (
              <button type="button" onClick={() => void runAction("submit", () => requestAction(requestId, "submit"))} disabled={Boolean(busyAction)} className={cx(BTN_PRIMARY, FOCUS, BTN_COMPACT)}>
                {busyAction === "submit" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Ready for review
              </button>
            )}
            {request.status === "READY_FOR_REVIEW" && (
              <>
                <button type="button" onClick={openChangesDialog} disabled={Boolean(busyAction)} className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT)}>
                  Request changes
                </button>
                <button type="button" onClick={openRejectDialog} disabled={Boolean(busyAction)} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-500/10">
                  Reject
                </button>
                <button type="button" onClick={() => void runAction("approve", () => requestAction(requestId, "approve"))} disabled={Boolean(busyAction)} className={cx(BTN_PRIMARY, FOCUS, BTN_COMPACT)}>
                  {busyAction === "approve" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Approve
                </button>
              </>
            )}
            {request.status === "CHANGES_REQUESTED" && (
              <button type="button" onClick={() => void runAction("resume", () => requestAction(requestId, "start"))} disabled={Boolean(busyAction)} className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT)}>
                Resume work
              </button>
            )}
            {request.status === "APPROVED" && (
              <button type="button" onClick={() => void runAction("complete", () => requestAction(requestId, "complete"))} disabled={Boolean(busyAction)} className={cx(BTN_PRIMARY, FOCUS, BTN_COMPACT)}>
                {busyAction === "complete" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Mark completed
              </button>
            )}
            {!["COMPLETED", "REJECTED", "CANCELLED"].includes(request.status) && (
              <button
                type="button"
                onClick={() =>
                  setDialog({
                    title: "Cancel this request?",
                    confirmLabel: "Cancel request",
                    tone: "danger",
                    onConfirm: async () => {
                      await runAction("cancel", () => requestAction(requestId, "cancel"));
                    },
                  })
                }
                disabled={Boolean(busyAction)}
                className="ml-auto flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-500/10"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="mt-5 flex items-center gap-2">
            <UserPlus size={13} className="text-[var(--text-subtle)]" />
            <span className="text-[11.5px] text-[var(--text-muted)]">
              {request.assignedTo ? `Assigned to ${personName(request.assignedTo)}` : "Unassigned"}
            </span>
          </div>

          <div className="mt-5">
            <h3 className="mb-2 text-[12px] font-semibold text-[var(--text)]">Attachments</h3>
            <input
              ref={attachmentInputRef}
              type="file"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void addAttachment(file);
                event.target.value = "";
              }}
            />
            <div className="space-y-1.5">
              {(request.attachments ?? []).map((attachment) => (
                <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-[11px] hover:bg-[color-mix(in_srgb,var(--surface-muted)_60%,var(--surface))]">
                  <span className="min-w-0 truncate">{attachment.name}</span>
                  <span className="shrink-0 text-[var(--text-subtle)]">{formatBytes(attachment.fileSizeBytes)}</span>
                </a>
              ))}
              <button type="button" onClick={() => attachmentInputRef.current?.click()} className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT)}>
                <Upload size={12} />
                Add attachment
              </button>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="mb-2 text-[12px] font-semibold text-[var(--text)]">Comments</h3>
            <div className="space-y-2">
              {(request.comments ?? []).map((comment) => (
                <div key={comment.id} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2">
                  <p className="text-[11px] font-semibold text-[var(--text)]">{personName(comment.author)}</p>
                  <p className="mt-0.5 text-[11.5px] leading-5 text-[var(--text)]">{comment.body}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">{formatDateTime(comment.createdAt)}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void addComment()}
                placeholder="Add a comment…"
                className={cx(INPUT, "h-10 flex-1 px-3")}
              />
              <button type="button" onClick={() => void addComment()} className={cx(BTN_SECONDARY, FOCUS, BTN_COMPACT)}>
                <MessageCircle size={13} />
              </button>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="mb-2 text-[12px] font-semibold text-[var(--text)]">Activity</h3>
            <ul className="space-y-1.5">
              {(request.activities ?? []).map((activity) => (
                <li key={activity.id} className="text-[10.5px] text-[var(--text-subtle)]">
                  <span className="font-medium text-[var(--text)]">{personName(activity.actor)}</span>{" "}
                  {(activity.description ?? activity.type.toLowerCase().replace(/_/g, " "))} · {formatDateTime(activity.createdAt)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
