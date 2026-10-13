/* eslint-disable react/no-unescaped-entities */
/* eslint-disable react-hooks/refs */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  Download,
  File as FileIcon,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Inbox,
  Loader2,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RotateCw,
  Search,
  Send,
  Trash2,
  UploadCloud,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  addGroupMember,
  attachmentDownloadUrl,
  type ChatConversation,
  type ChatMessage,
  type ChatUser,
  conversationTitle,
  createDirectConversation,
  createGroupConversation,
  deleteMessage,
  discardAttachment,
  editMessage,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  removeGroupMember,
  renameConversation,
  searchUsers,
  sendMessage,
  uploadAttachment,
  userDisplayName,
  userRoleLabel,
} from "./api";

/* ============================================================================
   CONSTANTS & TYPES
============================================================================ */

const MAX_MESSAGE_LENGTH = 4000;
/** Lower to 1 if your backend only accepts one attachment per message. */
const MAX_ATTACHMENTS = 5;
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const CONVERSATION_POLL_MS = 20_000;
const MESSAGE_POLL_MS = 5_000;
const MODAL_EXIT_MS = 200;
const EMPTY_IDS: ReadonlySet<string> = new Set();

/**
 * Modals render on document.body so they sit above the whole admin shell.
 * The chat root shares its element through this context so the modal can
 * copy the brand colours across (the admin theme variables may be scoped
 * to a wrapper rather than :root).
 */
const ThemeHostContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

const MODAL_BRAND_FALLBACKS: Record<string, string> = {
  "--accent": "#2563eb",
  "--accent-strong": "#1d4ed8",
  "--accent-tint": "rgba(37, 99, 235, 0.1)",
  "--danger": "#dc2626",
  "--danger-soft": "rgba(220, 38, 38, 0.08)",
};

type LoadStatus = "loading" | "ready" | "error";
type ListFilter = "all" | "unread" | "groups";
type SentAttachment = { id: string; originalFilename: string };
type DraftAttachment = {
  localId: string;
  name: string;
  status: "uploading" | "ready" | "error";
  id?: string;
  error?: string;
};
type PendingMessage = {
  tempId: string;
  body: string;
  attachments: SentAttachment[];
  createdAt: string;
  status: "sending" | "failed";
  error?: string;
};
type Member = ChatConversation["members"][number];

/* ============================================================================
   STYLES (scoped with the ic- prefix, no extra dependencies)
============================================================================ */

const STYLES = `
.ic-root, .ic-portal {
  --ic-ease: cubic-bezier(.22, 1, .36, 1);
  --ic-spring: cubic-bezier(.34, 1.56, .64, 1);
  --ic-accent-grad: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 150%);
}
@keyframes ic-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes ic-fade-up { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
@keyframes ic-slide-in { from { opacity: 0; transform: translateX(14px) } to { opacity: 1; transform: none } }
@keyframes ic-pop { 0% { opacity: 0; transform: scale(.55) } 70% { opacity: 1; transform: scale(1.08) } 100% { opacity: 1; transform: scale(1) } }
@keyframes ic-msg-in { from { opacity: 0; transform: translateY(10px) scale(.96) } to { opacity: 1; transform: none } }
@keyframes ic-expand { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: none } }
@keyframes ic-shimmer { from { background-position: 150% 0 } to { background-position: -50% 0 } }
@keyframes ic-backdrop-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes ic-backdrop-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes ic-sheet-in { from { transform: translateY(100%) } to { transform: none } }
@keyframes ic-sheet-out { from { transform: none } to { transform: translateY(100%) } }
@keyframes ic-modal-in { from { opacity: 0; transform: translateY(14px) scale(.96) } to { opacity: 1; transform: none } }
@keyframes ic-modal-out { from { opacity: 1; transform: none } to { opacity: 0; transform: translateY(8px) scale(.97) } }
@keyframes ic-ring { 0% { transform: scale(.8); opacity: .5 } 100% { transform: scale(1.7); opacity: 0 } }

.ic-fade { animation: ic-fade .3s var(--ic-ease) both; }
.ic-fade-up { animation: ic-fade-up .45s var(--ic-ease) both; }
.ic-slide-in { animation: ic-slide-in .32s var(--ic-ease) both; }
.ic-pop { animation: ic-pop .34s var(--ic-spring) both; }
.ic-expand { animation: ic-expand .26s var(--ic-ease) both; }
.ic-in-own { animation: ic-msg-in .32s var(--ic-ease) both; transform-origin: bottom right; }
.ic-in-other { animation: ic-msg-in .32s var(--ic-ease) both; transform-origin: bottom left; }
.ic-ring { animation: ic-ring 2.8s var(--ic-ease) infinite; }

.ic-skeleton {
  background: linear-gradient(90deg, var(--surface-muted) 25%, color-mix(in srgb, var(--line) 75%, var(--surface-muted)) 50%, var(--surface-muted) 75%);
  background-size: 200% 100%;
  animation: ic-shimmer 1.4s linear infinite;
}

.ic-press { transition: transform .16s var(--ic-ease), background-color .2s, color .2s, opacity .2s, box-shadow .2s, border-color .2s; }
.ic-press:active:not(:disabled) { transform: scale(.96); }
.ic-focus:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 65%, transparent); outline-offset: 2px; }

.ic-input { transition: border-color .2s, box-shadow .2s, background-color .2s; }
.ic-input:focus { border-color: var(--accent); background-color: var(--surface); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 14%, transparent); }
.ic-field { transition: border-color .2s, box-shadow .2s, background-color .2s; }
.ic-field:focus-within { border-color: var(--accent); background-color: var(--surface); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent); }

.ic-glass {
  background: color-mix(in srgb, var(--surface) 84%, transparent);
  -webkit-backdrop-filter: saturate(160%) blur(14px);
  backdrop-filter: saturate(160%) blur(14px);
}
.ic-thread-bg {
  background-color: var(--surface);
  background-image: radial-gradient(color-mix(in srgb, var(--text) 6%, transparent) 1px, transparent 1px);
  background-size: 20px 20px;
}
.ic-accent-fill { background: var(--ic-accent-grad); color: #fff; }

.ic-bubble-own {
  background: var(--ic-accent-grad);
  color: #fff;
  box-shadow: 0 1px 1px rgba(0,0,0,.05), 0 8px 18px -10px color-mix(in srgb, var(--accent) 75%, transparent);
}
.ic-bubble-other {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--line);
  box-shadow: 0 1px 2px rgba(0,0,0,.035);
}
.ic-bubble-deleted {
  background: transparent;
  color: var(--text-subtle);
  border: 1px dashed var(--line);
}

.ic-actions { opacity: 0; transform: scale(.9); pointer-events: none; transition: opacity .18s var(--ic-ease), transform .18s var(--ic-ease); }
.ic-msg:hover .ic-actions, .ic-msg:focus-within .ic-actions, .ic-actions[data-open="true"] { opacity: 1; transform: none; pointer-events: auto; }

.ic-row-indicator { transform: scaleY(0); transition: transform .32s var(--ic-spring); }
.ic-row[data-active="true"] .ic-row-indicator { transform: scaleY(1); }
.ic-reveal { opacity: 0; transition: opacity .15s; }
.ic-reveal-host:hover .ic-reveal, .ic-reveal-host:focus-within .ic-reveal { opacity: 1; }
@media (hover: none) { .ic-reveal { opacity: 1; } }

.ic-segment-thumb {
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 3px 10px -4px rgba(0,0,0,.12);
  transition: transform .36s var(--ic-spring);
}
.ic-send { transition: transform .26s var(--ic-spring), opacity .2s, box-shadow .2s; }
.ic-send:disabled { transform: scale(.86); opacity: .4; }
.ic-send:not(:disabled):hover { box-shadow: 0 8px 20px -8px color-mix(in srgb, var(--accent) 85%, transparent); }
.ic-send:not(:disabled):active { transform: scale(.92); }
.ic-check { transition: background-color .2s, border-color .2s; }

.ic-scroll { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--text) 16%, transparent) transparent; }
.ic-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.ic-scroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--text) 16%, transparent); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }

.ic-backdrop { animation: ic-backdrop-in .22s var(--ic-ease) both; }
.ic-backdrop[data-closing="true"] { animation: ic-backdrop-out .2s var(--ic-ease) both; }
.ic-panel { animation: ic-sheet-in .4s var(--ic-ease) both; }
.ic-panel[data-closing="true"] { animation: ic-sheet-out .22s cubic-bezier(.4, 0, 1, 1) both; }
@media (min-width: 640px) {
  .ic-panel { animation-name: ic-modal-in; animation-duration: .3s; }
  .ic-panel[data-closing="true"] { animation-name: ic-modal-out; animation-duration: .18s; }
}

/* Modals are always solid white with dark text. */
.ic-modal-theme {
  --surface: #ffffff;
  --surface-muted: #f4f4f5;
  --line: #e4e4e7;
  --text: #0a0a0a;
  --text-muted: #52525b;
  --text-subtle: #71717a;
  --shadow-popover: 0 28px 70px -20px rgba(0, 0, 0, .38), 0 2px 10px rgba(0, 0, 0, .08);
  color: #0a0a0a;
  color-scheme: light;
}

@media (prefers-reduced-motion: reduce) {
  .ic-root *, .ic-root *::before, .ic-root *::after,
  .ic-portal, .ic-portal *, .ic-portal *::before, .ic-portal *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
`;

/* ============================================================================
   HELPERS
============================================================================ */

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function hueFor(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readString(source: unknown, key: string): string | null {
  if (!source || typeof source !== "object") return null;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Profile photo for a chat user. Same order as the admin header:
 * the linked Employee photo first, then the AdminUser photo.
 */
function userAvatarUrl(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const record = user as Record<string, unknown>;
  return (
    readString(record.employee, "avatarUrl") ||
    readString(record, "avatarUrl") ||
    readString(record, "image") ||
    null
  );
}

function otherMember(conversation: ChatConversation, currentAdminUserId: string): Member | undefined {
  return conversation.members.find((member) => member.adminUserId !== currentAdminUserId);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function daysAgo(iso: string): number {
  return Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatFull(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatListTimestamp(iso: string): string {
  const diff = daysAgo(iso);
  const date = new Date(iso);
  if (diff === 0) return formatTime(iso);
  if (diff === 1) return "Yesterday";
  if (diff < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: sameYear ? undefined : "numeric" });
}

function formatDayLabel(iso: string): string {
  const diff = daysAgo(iso);
  const date = new Date(iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: sameYear ? undefined : "numeric" });
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function sortMessages(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((message) => [message.id, message] as const));
  let changed = false;
  for (const message of incoming) {
    const existing = byId.get(message.id);
    if (
      !existing ||
      existing.body !== message.body ||
      existing.editedAt !== message.editedAt ||
      existing.deletedAt !== message.deletedAt ||
      existing.attachments.length !== message.attachments.length
    ) {
      byId.set(message.id, message);
      changed = true;
    }
  }
  return changed ? sortMessages(Array.from(byId.values())) : current;
}

function fileExtension(filename: string): string {
  return filename.includes(".") ? (filename.split(".").pop() ?? "").toLowerCase() : "";
}

function fileIcon(filename: string, size = 16): ReactNode {
  const ext = fileExtension(filename);
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "heic", "avif"].includes(ext)) return <ImageIcon size={size} />;
  if (["zip", "rar", "7z", "gz", "tar"].includes(ext)) return <FileArchive size={size} />;
  if (["xls", "xlsx", "csv", "numbers", "ods"].includes(ext)) return <FileSpreadsheet size={size} />;
  if (["pdf", "doc", "docx", "txt", "md", "rtf", "pages", "ppt", "pptx"].includes(ext)) return <FileText size={size} />;
  return <FileIcon size={size} />;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
}

/* ============================================================================
   HOOKS
============================================================================ */

function useAutosize(ref: RefObject<HTMLTextAreaElement | null>, value: string, maxHeight: number, enabled = true) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [ref, value, maxHeight, enabled]);
}

function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [ref, onOutside, active]);
}

/* ============================================================================
   SMALL UI PIECES
============================================================================ */

function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = url?.trim() ?? "";
  const showImage = imageUrl !== "" && failedUrl !== imageUrl;
  const hue = hueFor(name);

  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold"
      style={
        showImage
          ? { width: size, height: size, background: "var(--surface-muted)" }
          : {
              width: size,
              height: size,
              fontSize: Math.round(size * 0.36),
              background: `linear-gradient(135deg, hsl(${hue} 85% 62% / .24), hsl(${(hue + 40) % 360} 85% 58% / .14))`,
              color: `hsl(${hue} 52% 42%)`,
              boxShadow: `inset 0 0 0 1px hsl(${hue} 60% 50% / .18)`,
            }
      }
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

function GroupAvatar({ members, excludeId, size = 40 }: { members: Member[]; excludeId?: string; size?: number }) {
  const others = members.filter((member) => member.adminUserId !== excludeId);
  const people = (others.length >= 2 ? others : members).slice(0, 2).map((member) => ({
    name: userDisplayName(member.adminUser),
    url: userAvatarUrl(member.adminUser),
  }));

  if (people.length < 2) {
    return (
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-muted)]"
        style={{ width: size, height: size }}
      >
        <Users size={Math.round(size * 0.42)} />
      </span>
    );
  }

  const inner = Math.round(size * 0.68);
  return (
    <span aria-hidden className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <span className="absolute left-0 top-0">
        <Avatar name={people[0]!.name} url={people[0]!.url} size={inner} />
      </span>
      <span className="absolute bottom-0 right-0 rounded-full bg-[var(--surface)] ring-2 ring-[var(--surface)]">
        <Avatar name={people[1]!.name} url={people[1]!.url} size={inner} />
      </span>
    </span>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-[var(--line)] bg-[var(--surface)] px-1 font-sans text-[10px] font-medium text-[var(--text-muted)]">
      {children}
    </kbd>
  );
}

function ErrorBanner({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div role="alert" className="ic-expand flex items-start gap-2 rounded-xl bg-[var(--danger-soft)] px-3 py-2.5 text-[12px] text-[var(--danger)]">
      <AlertCircle size={14} className="mt-px shrink-0" />
      <span className="flex-1">{message}</span>
      {action}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        "ic-press ic-focus inline-flex h-7 w-7 items-center justify-center rounded-full",
        danger
          ? "text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
          : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
      )}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string; icon?: ReactNode; badge?: number }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  return (
    <div
      role="tablist"
      aria-label={label}
      className="relative grid rounded-xl bg-[var(--surface-muted)] p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="ic-segment-thumb absolute bottom-1 left-1 top-1 rounded-lg"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cx(
              "ic-focus relative z-[1] flex h-8 items-center justify-center gap-1.5 rounded-lg text-[12px] font-medium transition-colors",
              active ? "text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {option.icon}
            {option.label}
            {option.badge ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9.5px] font-bold text-white">
                {option.badge > 99 ? "99+" : option.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-1 px-1 pt-1" aria-hidden>
      {[72, 56, 64, 48, 60, 52, 68].map((width, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
          <span className="ic-skeleton h-10 w-10 shrink-0 rounded-full" />
          <span className="flex-1 space-y-2">
            <span className="ic-skeleton block h-3 rounded-full" style={{ width: `${width}%` }} />
            <span className="ic-skeleton block h-2.5 rounded-full" style={{ width: `${width - 18}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

function ThreadSkeleton() {
  const rows = [
    { own: false, width: "58%" },
    { own: false, width: "34%" },
    { own: true, width: "46%" },
    { own: false, width: "62%" },
    { own: true, width: "30%" },
    { own: true, width: "52%" },
  ];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 pt-2" aria-hidden>
      {rows.map((row, index) => (
        <div key={index} className={cx("flex", row.own ? "justify-end" : "justify-start")}>
          <span className="ic-skeleton block h-10 rounded-[20px]" style={{ width: row.width }} />
        </div>
      ))}
    </div>
  );
}

function AttachmentTile({ name, href, tone }: { name: string; href?: string; tone: "own" | "other" }) {
  const ext = fileExtension(name);
  const className = cx(
    "ic-press ic-focus mt-2 flex min-w-[200px] items-center gap-2.5 rounded-xl px-2.5 py-2 text-left first:mt-0",
    tone === "own" ? "bg-white/15 hover:bg-white/20" : "bg-[var(--surface-muted)] hover:bg-[color-mix(in_srgb,var(--line)_60%,var(--surface-muted))]",
  );
  const content = (
    <>
      <span
        className={cx(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
          tone === "own" ? "bg-white/20 text-white" : "bg-[var(--surface)] text-[var(--accent-strong)]",
        )}
      >
        {fileIcon(name, 16)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium">{name}</span>
        {ext ? <span className={cx("block text-[10.5px]", tone === "own" ? "text-white/70" : "text-[var(--text-subtle)]")}>{ext.toUpperCase()} file</span> : null}
      </span>
      {href ? <Download size={14} className={tone === "own" ? "text-white/80" : "text-[var(--text-subtle)]"} /> : null}
    </>
  );

  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

/* ============================================================================
   ROOT WORKSPACE
============================================================================ */

export default function InternalChatWorkspace({
  currentAdminUserId,
  initialConversationId,
  onBack,
}: {
  currentAdminUserId: string;
  /** Pre-selects a conversation on mount — used by notification
   *  click-through (see AdminHome.tsx's openMessagesConversation). */
  initialConversationId?: string | null;
  onBack: () => void;
}) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId ?? null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshConversations = useCallback(() => {
    fetchConversations()
      .then(({ conversations: result }) => {
        setConversations(result);
        setStatus("ready");
      })
      .catch(() => setStatus((current) => (current === "ready" ? current : "error")));
  }, []);

  useEffect(() => {
    if (initialConversationId) markConversationRead(initialConversationId).catch(() => {});
    // Deliberately runs once on mount only — initialConversationId is a
    // one-shot "open with this selected" instruction, not a controlled prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshConversations();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshConversations();
    }, CONVERSATION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshConversations();
    };
    // Same events the admin header listens to when someone changes their photo.
    const onProfileChange = () => refreshConversations();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("syntragrid:employee-avatar-updated", onProfileChange);
    window.addEventListener("syntragrid:employee-profile-updated", onProfileChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("syntragrid:employee-avatar-updated", onProfileChange);
      window.removeEventListener("syntragrid:employee-profile-updated", onProfileChange);
    };
  }, [refreshConversations]);

  // Press "/" anywhere to jump to search.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const retryLoad = useCallback(() => {
    setStatus("loading");
    refreshConversations();
  }, [refreshConversations]);

  const upsertConversation = useCallback((conversation: ChatConversation) => {
    setConversations((current) => {
      const existing = current.findIndex((item) => item.id === conversation.id);
      if (existing === -1) return [conversation, ...current];
      const next = [...current];
      next[existing] = { ...next[existing]!, ...conversation };
      return next;
    });
  }, []);

  const bumpWithMessage = useCallback((conversationId: string, message: ChatMessage) => {
    setConversations((current) => {
      const index = current.findIndex((item) => item.id === conversationId);
      if (index === -1) return current;
      const updated = { ...current[index]!, messages: [message], lastMessageAt: message.createdAt };
      return [updated, ...current.slice(0, index), ...current.slice(index + 1)];
    });
  }, []);

  const removeConversation = useCallback((id: string) => {
    setConversations((current) => current.filter((item) => item.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const openConversation = useCallback((id: string) => {
    setSelectedId(id);
    markConversationRead(id).catch(() => {});
    setConversations((current) => current.map((item) => (item.id === id ? { ...item, unreadCount: 0 } : item)));
  }, []);

  const setDraft = useCallback((conversationId: string, value: string) => {
    setDrafts((current) => ({ ...current, [conversationId]: value }));
  }, []);

  const rows = useMemo(
    () =>
      conversations.map((conversation) => {
        const title = conversationTitle(conversation, currentAdminUserId);
        const last = conversation.messages?.[0] ?? null;
        const deleted = Boolean(last?.deletedAt);
        const fromSelf = readString(last, "senderId") === currentAdminUserId;
        const text = !last ? "No messages yet" : deleted ? "Message deleted" : last.body?.trim() || "Sent an attachment";
        return {
          conversation,
          title,
          avatarUrl: conversation.type === "GROUP" ? null : userAvatarUrl(otherMember(conversation, currentAdminUserId)?.adminUser),
          preview: fromSelf && last && !deleted ? `You: ${text}` : text,
          deleted,
          unread: conversation.id === selectedId ? 0 : conversation.unreadCount ?? 0,
        };
      }),
    [conversations, currentAdminUserId, selectedId],
  );

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "unread" && row.unread === 0) return false;
      if (filter === "groups" && row.conversation.type !== "GROUP") return false;
      if (!query) return true;
      return row.title.toLowerCase().includes(query) || row.preview.toLowerCase().includes(query);
    });
  }, [rows, search, filter]);

  const totalUnread = rows.reduce((sum, row) => sum + row.unread, 0);
  const unreadConversations = rows.filter((row) => row.unread > 0).length;
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;

  const emptyListText =
    conversations.length === 0
      ? null
      : search.trim()
        ? `No conversations match "${search.trim()}".`
        : filter === "unread"
          ? "You're all caught up."
          : "No group conversations yet.";

  return (
    <ThemeHostContext.Provider value={rootRef}>
    <div ref={rootRef} className="ic-root flex h-[calc(100dvh-56px)] w-full flex-col bg-[var(--surface)] text-[var(--text)]">
      <style>{STYLES}</style>

      <header className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          className="ic-press ic-focus group inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={15} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span className="hidden sm:inline">Back to Command Overview</span>
          <span className="sm:hidden">Back</span>
        </button>
        <span aria-hidden className="h-5 w-px bg-[var(--line)]" />
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--accent-tint)] text-[var(--accent-strong)]">
            <MessagesSquare size={14} />
          </span>
          <h1 className="truncate text-[14px] font-semibold tracking-[-0.01em]">Team chat</h1>
          {totalUnread > 0 ? (
            <span key={totalUnread} className="ic-pop rounded-full bg-[var(--accent-tint)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--accent-strong)]">
              {totalUnread} unread
            </span>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------------- Conversation list ---------------- */}
        <aside className={cx("flex w-full min-w-0 flex-col border-r border-[var(--line)] sm:w-[340px] sm:shrink-0", selected && "hidden sm:flex")}>
          <div className="space-y-2.5 p-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="ic-field relative flex h-10 flex-1 items-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]">
                <Search size={14} className="pointer-events-none ml-3 shrink-0 text-[var(--text-subtle)]" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setSearch("");
                      event.currentTarget.blur();
                    }
                  }}
                  placeholder="Search conversations"
                  aria-label="Search conversations"
                  className="h-full w-full min-w-0 bg-transparent px-2.5 text-[12.5px] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      searchRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="ic-focus mr-2 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--text-subtle)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                  >
                    <X size={13} />
                  </button>
                ) : (
                  <span className="mr-2.5 hidden shrink-0 sm:inline-flex">
                    <Kbd>/</Kbd>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowNewConversation(true)}
                aria-label="New message"
                title="New message"
                className="ic-press ic-focus ic-accent-fill inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-[0_6px_16px_-8px_var(--accent)] hover:brightness-110"
              >
                <Plus size={18} />
              </button>
            </div>

            <Segmented
              label="Filter conversations"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "unread", label: "Unread", badge: unreadConversations },
                { value: "groups", label: "Groups" },
              ]}
            />
          </div>

          <div className="ic-scroll flex-1 overflow-y-auto px-2 pb-3">
            {status === "loading" ? (
              <ConversationListSkeleton />
            ) : status === "error" ? (
              <div className="ic-fade flex flex-col items-center px-6 py-12 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
                  <AlertCircle size={18} />
                </span>
                <p className="mt-3 text-[13px] font-semibold">Conversations didn&apos;t load</p>
                <p className="mt-1 text-[12px] text-[var(--text-muted)]">Check your connection, then try again.</p>
                <button
                  type="button"
                  onClick={retryLoad}
                  className="ic-press ic-focus mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--surface-muted)]"
                >
                  <RotateCw size={13} /> Try again
                </button>
              </div>
            ) : conversations.length === 0 ? (
              <div className="ic-fade flex flex-col items-center px-6 py-12 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--accent-tint)] text-[var(--accent-strong)]">
                  <Inbox size={18} />
                </span>
                <p className="mt-3 text-[13px] font-semibold">No conversations yet</p>
                <p className="mt-1 text-[12px] text-[var(--text-muted)]">Message a teammate or set up a group for your team.</p>
                <button
                  type="button"
                  onClick={() => setShowNewConversation(true)}
                  className="ic-press ic-focus ic-accent-fill mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold"
                >
                  <Plus size={14} /> New message
                </button>
              </div>
            ) : visibleRows.length === 0 ? (
              <p className="ic-fade px-4 py-10 text-center text-[12.5px] text-[var(--text-subtle)]">{emptyListText}</p>
            ) : (
              <div className="space-y-0.5">
                {visibleRows.map((row) => {
                  const active = row.conversation.id === selectedId;
                  return (
                    <button
                      key={row.conversation.id}
                      type="button"
                      onClick={() => openConversation(row.conversation.id)}
                      data-active={active}
                      aria-current={active ? "true" : undefined}
                      className={cx(
                        "ic-row ic-focus relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200",
                        active ? "bg-[var(--accent-tint)]" : "hover:bg-[var(--surface-muted)]",
                      )}
                    >
                      <span aria-hidden className="ic-row-indicator absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full bg-[var(--accent)]" />
                      {row.conversation.type === "GROUP" ? (
                        <GroupAvatar members={row.conversation.members} excludeId={currentAdminUserId} size={40} />
                      ) : (
                        <Avatar name={row.title} url={row.avatarUrl} size={40} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={cx("truncate text-[13.5px] text-[var(--text)]", row.unread ? "font-semibold" : "font-medium")}>{row.title}</span>
                          {row.conversation.lastMessageAt ? (
                            <span className={cx("shrink-0 text-[10.5px]", row.unread ? "font-semibold text-[var(--accent)]" : "text-[var(--text-subtle)]")}>
                              {formatListTimestamp(row.conversation.lastMessageAt)}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span
                            className={cx(
                              "truncate text-[12px]",
                              row.unread ? "font-medium text-[var(--text)]" : "text-[var(--text-muted)]",
                              row.deleted && "italic",
                            )}
                          >
                            {row.preview}
                          </span>
                          {row.unread ? (
                            <span
                              key={row.unread}
                              className="ic-pop inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[10px] font-bold text-white"
                            >
                              {row.unread > 99 ? "99+" : row.unread}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ---------------- Active conversation ---------------- */}
        <section className={cx("relative flex min-w-0 flex-1 flex-col", !selected && "hidden sm:flex")}>
          {selected ? (
            <ConversationThread
              key={selected.id}
              conversation={selected}
              currentAdminUserId={currentAdminUserId}
              draft={drafts[selected.id] ?? ""}
              onDraftChange={(value) => setDraft(selected.id, value)}
              onBackToList={() => setSelectedId(null)}
              onConversationUpdated={upsertConversation}
              onMessageSent={bumpWithMessage}
              onLeft={() => removeConversation(selected.id)}
            />
          ) : (
            <EmptySelection onNew={() => setShowNewConversation(true)} />
          )}
        </section>
      </div>

      {showNewConversation ? (
        <NewConversationModal
          onClose={() => setShowNewConversation(false)}
          onCreated={(conversation) => {
            upsertConversation(conversation);
            setSelectedId(conversation.id);
          }}
        />
      ) : null}
    </div>
    </ThemeHostContext.Provider>
  );
}

function EmptySelection({ onNew }: { onNew: () => void }) {
  return (
    <div className="ic-thread-bg flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="ic-fade-up flex flex-col items-center">
        <div className="relative mb-6 grid h-20 w-20 place-items-center">
          <span aria-hidden className="ic-ring absolute inset-0 rounded-full border border-[var(--accent)]" />
          <span aria-hidden className="ic-ring absolute inset-0 rounded-full border border-[var(--accent)]" style={{ animationDelay: "1.4s" }} />
          <span className="ic-accent-fill relative grid h-16 w-16 place-items-center rounded-[20px] shadow-[0_14px_30px_-14px_var(--accent)]">
            <MessagesSquare size={26} />
          </span>
        </div>
        <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Pick up where you left off</h2>
        <p className="mt-1.5 max-w-[300px] text-[12.5px] leading-5 text-[var(--text-muted)]">
          Choose a conversation from the list, or start a new one with someone on your team.
        </p>
        <button
          type="button"
          onClick={onNew}
          className="ic-press ic-focus ic-accent-fill mt-5 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[12.5px] font-semibold shadow-[0_10px_24px_-12px_var(--accent)] hover:brightness-110"
        >
          <Plus size={15} /> New message
        </button>
        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[var(--text-subtle)]">
          Press <Kbd>/</Kbd> to search
        </p>
      </div>
    </div>
  );
}

/* ============================================================================
   CONVERSATION THREAD
============================================================================ */

type TimelineEntry =
  | { kind: "day"; key: string; label: string }
  | { kind: "message"; key: string; message: ChatMessage; groupStart: boolean; groupEnd: boolean }
  | { kind: "pending"; key: string; pending: PendingMessage; groupStart: boolean; groupEnd: boolean };

function ConversationThread({
  conversation,
  currentAdminUserId,
  draft,
  onDraftChange,
  onBackToList,
  onConversationUpdated,
  onMessageSent,
  onLeft,
}: {
  conversation: ChatConversation;
  currentAdminUserId: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onBackToList: () => void;
  onConversationUpdated: (conversation: ChatConversation) => void;
  onMessageSent: (conversationId: string, message: ChatMessage) => void;
  onLeft: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [quietIds, setQuietIds] = useState<Set<string>>(() => new Set());
  const [atBottom, setAtBottom] = useState(true);
  const [seenKey, setSeenKey] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showManage, setShowManage] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const restoreRef = useRef<number | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const dragDepthRef = useRef(0);
  const attachmentsRef = useRef<DraftAttachment[]>([]);
  const removedUploadsRef = useRef<Set<string>>(new Set());

  const isGroup = conversation.type === "GROUP";
  const title = conversationTitle(conversation, currentAdminUserId);
  const directAvatarUrl = isGroup ? null : userAvatarUrl(otherMember(conversation, currentAdminUserId)?.adminUser);

  /* ---------- loading & polling ---------- */

  const load = useCallback(() => {
    fetchMessages(conversation.id)
      .then(({ messages: result, nextCursor: cursor }) => {
        const sorted = sortMessages(result);
        setMessages(sorted);
        setQuietIds(new Set(sorted.map((message) => message.id)));
        setSeenKey(sorted[sorted.length - 1]?.id ?? null);
        setNextCursor(cursor);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [conversation.id]);

  useEffect(() => {
    load();
    markConversationRead(conversation.id).catch(() => {});

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchMessages(conversation.id)
        .then(({ messages: result }) => {
          setMessages((current) => mergeMessages(current, result));
          markConversationRead(conversation.id).catch(() => {});
        })
        .catch(() => {});
    }, MESSAGE_POLL_MS);

    return () => window.clearInterval(interval);
  }, [conversation.id, load]);

  const retryLoad = useCallback(() => {
    setStatus("loading");
    load();
  }, [load]);

  const loadOlder = useCallback(() => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    fetchMessages(conversation.id, nextCursor)
      .then(({ messages: older, nextCursor: cursor }) => {
        const element = scrollRef.current;
        if (element) restoreRef.current = element.scrollHeight - element.scrollTop;
        setQuietIds((current) => {
          const next = new Set(current);
          for (const message of older) next.add(message.id);
          return next;
        });
        setMessages((current) => mergeMessages(current, older));
        setNextCursor(cursor);
      })
      .catch(() => {})
      .finally(() => setLoadingOlder(false));
  }, [conversation.id, nextCursor, loadingOlder]);

  /* ---------- timeline (day separators + grouping) ---------- */

  const timeline = useMemo(() => {
    const base = [
      ...messages.map((message) => ({ key: message.id, senderId: message.senderId, createdAt: message.createdAt, message, pending: null })),
      ...pending.map((item) => ({ key: item.tempId, senderId: currentAdminUserId, createdAt: item.createdAt, message: null, pending: item })),
    ];

    const sameGroup = (a: (typeof base)[number], b: (typeof base)[number]) =>
      a.senderId === b.senderId &&
      dayKey(a.createdAt) === dayKey(b.createdAt) &&
      Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) < GROUP_WINDOW_MS;

    const items: TimelineEntry[] = [];
    base.forEach((entry, index) => {
      const previous = base[index - 1];
      const next = base[index + 1];
      if (!previous || dayKey(previous.createdAt) !== dayKey(entry.createdAt)) {
        items.push({ kind: "day", key: `day-${dayKey(entry.createdAt)}`, label: formatDayLabel(entry.createdAt) });
      }
      const groupStart = !previous || !sameGroup(previous, entry);
      const groupEnd = !next || !sameGroup(entry, next);
      if (entry.message) items.push({ kind: "message", key: entry.key, message: entry.message, groupStart, groupEnd });
      else if (entry.pending) items.push({ kind: "pending", key: entry.key, pending: entry.pending, groupStart, groupEnd });
    });

    const last = base[base.length - 1];
    return { items, lastKey: last?.key ?? null, lastIsOwn: last ? last.senderId === currentAdminUserId : false };
  }, [messages, pending, currentAdminUserId]);

  /* ---------- scrolling ---------- */

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element || status !== "ready") return;

    if (restoreRef.current !== null) {
      element.scrollTop = element.scrollHeight - restoreRef.current;
      restoreRef.current = null;
      return;
    }

    if (timeline.lastKey === lastKeyRef.current) return;
    const isFirst = lastKeyRef.current === null;
    lastKeyRef.current = timeline.lastKey;

    if (isFirst || stickRef.current || timeline.lastIsOwn) {
      element.scrollTo({ top: element.scrollHeight, behavior: isFirst ? "auto" : "smooth" });
    }
  }, [timeline.lastKey, timeline.lastIsOwn, messages.length, status]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const near = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
    stickRef.current = near;
    setAtBottom(near);
    if (near) setSeenKey(timeline.lastKey);
    if (element.scrollTop < 80) loadOlder();
  };

  const scrollToBottom = () => {
    const element = scrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  };

  const unseenCount = useMemo(() => {
    if (atBottom || !seenKey) return 0;
    const index = messages.findIndex((message) => message.id === seenKey);
    if (index === -1) return 0;
    return messages.slice(index + 1).filter((message) => message.senderId !== currentAdminUserId).length;
  }, [atBottom, seenKey, messages, currentAdminUserId]);

  /* ---------- attachments ---------- */

  const updateAttachments = useCallback((updater: (current: DraftAttachment[]) => DraftAttachment[]) => {
    const next = updater(attachmentsRef.current);
    attachmentsRef.current = next;
    setAttachments(next);
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const room = MAX_ATTACHMENTS - attachmentsRef.current.length;
      const accepted = files.slice(0, Math.max(0, room));
      if (accepted.length === 0) return;

      const entries = accepted.map((file) => ({ file, localId: makeId("upload") }));
      updateAttachments((current) => [
        ...current,
        ...entries.map(({ file, localId }): DraftAttachment => ({ localId, name: file.name, status: "uploading" })),
      ]);

      for (const { file, localId } of entries) {
        uploadAttachment(file)
          .then(({ attachment }) => {
            if (removedUploadsRef.current.has(localId)) {
              discardAttachment(attachment.id).catch(() => {});
              return;
            }
            updateAttachments((current) =>
              current.map((item) =>
                item.localId === localId ? { ...item, status: "ready", id: attachment.id, name: attachment.originalFilename } : item,
              ),
            );
          })
          .catch((error) =>
            updateAttachments((current) =>
              current.map((item) => (item.localId === localId ? { ...item, status: "error", error: errorMessage(error, "Upload failed") } : item)),
            ),
          );
      }
    },
    [updateAttachments],
  );

  const removeAttachment = useCallback(
    (localId: string) => {
      const target = attachmentsRef.current.find((item) => item.localId === localId);
      if (!target) return;
      if (target.status === "uploading") removedUploadsRef.current.add(localId);
      if (target.status === "ready" && target.id) discardAttachment(target.id).catch(() => {});
      updateAttachments((current) => current.filter((item) => item.localId !== localId));
    },
    [updateAttachments],
  );

  // Clean up unsent uploads when leaving the conversation.
  useEffect(() => {
    const removed = removedUploadsRef.current;
    const tracked = attachmentsRef;
    return () => {
      for (const item of tracked.current) {
        if (item.status === "uploading") removed.add(item.localId);
        else if (item.status === "ready" && item.id) discardAttachment(item.id).catch(() => {});
      }
    };
  }, []);

  /* ---------- sending (optimistic) ---------- */

  const deliver = useCallback(
    (item: PendingMessage) => {
      sendMessage(
        conversation.id,
        item.body,
        item.attachments.map((attachment) => attachment.id),
      )
        .then(({ message }) => {
          setQuietIds((current) => new Set(current).add(message.id));
          setMessages((current) => (current.some((existing) => existing.id === message.id) ? current : sortMessages([...current, message])));
          setPending((current) => current.filter((entry) => entry.tempId !== item.tempId));
          onMessageSent(conversation.id, message);
        })
        .catch((error) =>
          setPending((current) =>
            current.map((entry) =>
              entry.tempId === item.tempId ? { ...entry, status: "failed", error: errorMessage(error, "Not delivered") } : entry,
            ),
          ),
        );
    },
    [conversation.id, onMessageSent],
  );

  const send = useCallback(() => {
    const body = draft.trim();
    if (attachmentsRef.current.some((item) => item.status === "uploading")) return;
    const ready: SentAttachment[] = attachmentsRef.current
      .filter((item) => item.status === "ready" && item.id)
      .map((item) => ({ id: item.id!, originalFilename: item.name }));
    if (!body && ready.length === 0) return;

    const item: PendingMessage = {
      tempId: makeId("pending"),
      body,
      attachments: ready,
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    stickRef.current = true;
    setPending((current) => [...current, item]);
    onDraftChange("");
    updateAttachments(() => []);
    deliver(item);
  }, [draft, deliver, onDraftChange, updateAttachments]);

  const retryPending = useCallback(
    (tempId: string) => {
      const item = pending.find((entry) => entry.tempId === tempId);
      if (!item) return;
      const retried: PendingMessage = { ...item, status: "sending", error: undefined };
      setPending((current) => current.map((entry) => (entry.tempId === tempId ? retried : entry)));
      deliver(retried);
    },
    [pending, deliver],
  );

  const discardPending = useCallback(
    (tempId: string) => {
      const item = pending.find((entry) => entry.tempId === tempId);
      item?.attachments.forEach((attachment) => discardAttachment(attachment.id).catch(() => {}));
      setPending((current) => current.filter((entry) => entry.tempId !== tempId));
    },
    [pending],
  );

  const handleEdited = useCallback((message: ChatMessage) => {
    setMessages((current) => current.map((item) => (item.id === message.id ? message : item)));
  }, []);

  /* ---------- drag & drop ---------- */

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

  const dragHandlers = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current += 1;
      setDragActive(true);
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (hasFiles(event)) event.preventDefault();
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setDragActive(false);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setDragActive(false);
      addFiles(Array.from(event.dataTransfer.files));
    },
  };

  /* ---------- header copy ---------- */

  const otherMembers = conversation.members.filter((member) => member.adminUserId !== currentAdminUserId);
  const subtitle = isGroup
    ? (() => {
        const names = otherMembers.map((member) => firstName(userDisplayName(member.adminUser)));
        const shown = names.slice(0, 3).join(", ");
        const extra = names.length > 3 ? ` and ${names.length - 3} more` : "";
        return names.length ? `You, ${shown}${extra}` : "Just you so far";
      })()
    : (otherMembers[0] ? userRoleLabel(otherMembers[0].adminUser) ?? otherMembers[0].adminUser.email : "");

  return (
    <div className="ic-slide-in relative flex min-h-0 flex-1 flex-col" {...dragHandlers}>
      <header className="ic-glass relative z-10 flex items-center gap-3 border-b border-[var(--line)] px-3 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={onBackToList}
          aria-label="Back to conversations"
          className="ic-press ic-focus -ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] sm:hidden"
        >
          <ChevronLeft size={19} />
        </button>

        {isGroup ? (
          <GroupAvatar members={conversation.members} excludeId={currentAdminUserId} size={38} />
        ) : (
          <Avatar name={title} url={directAvatarUrl} size={38} />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold tracking-[-0.01em]">{title}</p>
          {subtitle ? <p className="truncate text-[11.5px] text-[var(--text-muted)]">{subtitle}</p> : null}
        </div>

        {isGroup ? (
          <button
            type="button"
            onClick={() => setShowManage(true)}
            aria-label="Group details"
            title="Group details"
            className="ic-press ic-focus inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
          >
            <MoreHorizontal size={17} />
          </button>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} onScroll={handleScroll} className="ic-scroll ic-thread-bg absolute inset-0 overflow-y-auto px-3 pb-4 sm:px-6">
          {status === "loading" ? (
            <div className="pt-4">
              <ThreadSkeleton />
            </div>
          ) : status === "error" ? (
            <div className="ic-fade flex h-full flex-col items-center justify-center text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
                <AlertCircle size={18} />
              </span>
              <p className="mt-3 text-[13px] font-semibold">Messages didn't load</p>
              <button
                type="button"
                onClick={retryLoad}
                className="ic-press ic-focus mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-medium hover:bg-[var(--surface-muted)]"
              >
                <RotateCw size={13} /> Try again
              </button>
            </div>
          ) : timeline.items.length === 0 ? (
            <div className="ic-fade-up flex h-full flex-col items-center justify-center px-6 text-center">
              {isGroup ? (
                <GroupAvatar members={conversation.members} excludeId={currentAdminUserId} size={64} />
              ) : (
                <Avatar name={title} url={directAvatarUrl} size={64} />
              )}
              <p className="mt-4 text-[14px] font-semibold">{isGroup ? `${title} is ready` : `Start chatting with ${firstName(title)}`}</p>
              <p className="mt-1 max-w-xs text-[12.5px] text-[var(--text-muted)]">Your first message will appear here.</p>
            </div>
          ) : (
            <div className="ic-fade mx-auto flex max-w-3xl flex-col pt-2">
              {nextCursor ? (
                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    onClick={loadOlder}
                    disabled={loadingOlder}
                    className="ic-press ic-focus inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-60"
                  >
                    {loadingOlder ? <Loader2 size={12} className="animate-spin" /> : null}
                    {loadingOlder ? "Loading earlier messages" : "Load earlier messages"}
                  </button>
                </div>
              ) : (
                <p className="py-3 text-center text-[11px] text-[var(--text-subtle)]">This is the start of your conversation.</p>
              )}

              {timeline.items.map((item) => {
                if (item.kind === "day") {
                  return (
                    <div key={item.key} className="sticky top-2 z-[2] my-3 flex justify-center">
                      <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)] shadow-[0_2px_8px_-4px_rgba(0,0,0,.15)]">
                        {item.label}
                      </span>
                    </div>
                  );
                }
                if (item.kind === "pending") {
                  return (
                    <PendingBubble
                      key={item.key}
                      pending={item.pending}
                      groupStart={item.groupStart}
                      onRetry={() => retryPending(item.pending.tempId)}
                      onDiscard={() => discardPending(item.pending.tempId)}
                    />
                  );
                }
                return (
                  <MessageBubble
                    key={item.key}
                    message={item.message}
                    isOwn={item.message.senderId === currentAdminUserId}
                    isGroup={isGroup}
                    groupStart={item.groupStart}
                    groupEnd={item.groupEnd}
                    animate={!quietIds.has(item.key)}
                    onUpdated={handleEdited}
                  />
                );
              })}
            </div>
          )}
        </div>

        {!atBottom && status === "ready" ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
            <span className="ic-pop pointer-events-auto">
              <button
                type="button"
                onClick={scrollToBottom}
                className="ic-press ic-focus inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--text)] shadow-[var(--shadow-popover)] hover:bg-[var(--surface-muted)]"
              >
                <ArrowDown size={13} />
                {unseenCount > 0 ? `${unseenCount} new message${unseenCount === 1 ? "" : "s"}` : "Jump to latest"}
              </button>
            </span>
          </div>
        ) : null}
      </div>

      <MessageComposer
        value={draft}
        onChange={onDraftChange}
        attachments={attachments}
        canAttachMore={attachments.length < MAX_ATTACHMENTS}
        onAddFiles={addFiles}
        onRemoveAttachment={removeAttachment}
        onSend={send}
        placeholder={isGroup ? `Message ${title}` : `Message ${firstName(title)}`}
      />

      {dragActive ? (
        <div className="ic-fade pointer-events-none absolute inset-0 z-20 grid place-items-center bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] p-6 backdrop-blur-sm">
          <div className="flex h-full w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[var(--accent)] text-center">
            <span className="ic-pop ic-accent-fill grid h-14 w-14 place-items-center rounded-2xl">
              <UploadCloud size={24} />
            </span>
            <p className="mt-3 text-[14px] font-semibold">Drop to attach</p>
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">Up to {MAX_ATTACHMENTS} files per message</p>
          </div>
        </div>
      ) : null}

      {showManage ? (
        <GroupManageModal
          conversation={conversation}
          currentAdminUserId={currentAdminUserId}
          onClose={() => setShowManage(false)}
          onUpdated={onConversationUpdated}
          onLeft={onLeft}
        />
      ) : null}
    </div>
  );
}

/* ============================================================================
   MESSAGE BUBBLES
============================================================================ */

function bubbleRadius(isOwn: boolean, groupStart: boolean, groupEnd: boolean): string {
  return cx(
    "rounded-[20px]",
    isOwn ? !groupStart && "rounded-tr-[6px]" : !groupStart && "rounded-tl-[6px]",
    isOwn ? !groupEnd && "rounded-br-[6px]" : !groupEnd && "rounded-bl-[6px]",
  );
}

function MessageBubble({
  message,
  isOwn,
  isGroup,
  groupStart,
  groupEnd,
  animate,
  onUpdated,
}: {
  message: ChatMessage;
  isOwn: boolean;
  isGroup: boolean;
  groupStart: boolean;
  groupEnd: boolean;
  animate: boolean;
  onUpdated: (message: ChatMessage) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.body ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const isDeleted = Boolean(message.deletedAt);
  const hasBody = Boolean(message.body?.trim());
  const showAvatarSlot = isGroup && !isOwn;
  const senderName = userDisplayName(message.sender);
  const senderRole = userRoleLabel(message.sender);

  useAutosize(editRef, editValue, 200, editing);

  useEffect(() => {
    if (!editing) return;
    const element = editRef.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, [editing]);

  const closeConfirm = useCallback(() => setConfirmDelete(false), []);
  useClickOutside(actionsRef, closeConfirm, confirmDelete);

  const startEdit = () => {
    setEditValue(message.body ?? "");
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const saveEdit = () => {
    const trimmed = editValue.trim();
    if (!trimmed || busy) return;
    if (trimmed === (message.body ?? "").trim()) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    editMessage(message.id, trimmed)
      .then(({ message: updated }) => {
        onUpdated(updated);
        setEditing(false);
      })
      .catch((err) => setError(errorMessage(err, "Changes weren't saved. Try again.")))
      .finally(() => setBusy(false));
  };

  const remove = () => {
    setBusy(true);
    setError(null);
    deleteMessage(message.id)
      .then(({ message: updated }) => onUpdated(updated))
      .catch((err) => setError(errorMessage(err, "Message wasn't deleted. Try again.")))
      .finally(() => {
        setBusy(false);
        setConfirmDelete(false);
      });
  };

  const copy = () => {
    navigator.clipboard
      ?.writeText(message.body ?? "")
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => {});
  };

  const handleEditKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      saveEdit();
    }
  };

  const showActions = !isDeleted && !editing && (hasBody || isOwn);

  return (
    <div
      className={cx(
        "ic-msg flex items-end gap-2",
        isOwn ? "justify-end" : "justify-start",
        groupStart ? "mt-3" : "mt-[3px]",
        animate && (isOwn ? "ic-in-own" : "ic-in-other"),
      )}
    >
      {showAvatarSlot ? (
        groupEnd ? (
          <span className="mb-5" title={senderName}>
            <Avatar name={senderName} url={userAvatarUrl(message.sender)} size={28} />
          </span>
        ) : (
          <span aria-hidden className="w-7 shrink-0" />
        )
      ) : null}

      <div className={cx("flex min-w-0 max-w-[82%] flex-col sm:max-w-[68%]", isOwn ? "items-end" : "items-start")}>
        {isGroup && !isOwn && groupStart ? (
          <p className="mb-1 flex items-baseline gap-1.5 px-1 text-[11px] font-semibold" style={{ color: `hsl(${hueFor(senderName)} 50% 45%)` }}>
            {senderName}
            {senderRole ? <span className="text-[10px] font-normal text-[var(--text-subtle)]">{senderRole}</span> : null}
          </p>
        ) : null}

        <div className={cx("flex max-w-full items-center gap-1.5", isOwn && "flex-row-reverse")}>
          <div
            tabIndex={0}
            title={formatFull(message.createdAt)}
            className={cx(
              "ic-focus min-w-0 px-3.5 py-2.5 text-[13.5px] leading-[1.45]",
              bubbleRadius(isOwn, groupStart, groupEnd),
              isDeleted ? "ic-bubble-deleted italic" : isOwn ? "ic-bubble-own" : "ic-bubble-other",
              editing && "w-[min(420px,70vw)]",
            )}
          >
            {isDeleted ? (
              <span className="inline-flex items-center gap-1.5 text-[12.5px]">
                <Trash2 size={12} /> This message was deleted
              </span>
            ) : editing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={editRef}
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                  onKeyDown={handleEditKeyDown}
                  rows={1}
                  aria-label="Edit message"
                  className={cx(
                    "w-full resize-none rounded-xl px-2.5 py-2 text-[13.5px] leading-[1.45] outline-none",
                    isOwn
                      ? "bg-white/15 text-white placeholder:text-white/60 focus:bg-white/20"
                      : "bg-[var(--surface-muted)] text-[var(--text)] focus:ring-2 focus:ring-[var(--accent)]",
                  )}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className={cx("text-[10.5px]", isOwn ? "text-white/70" : "text-[var(--text-subtle)]")}>Esc to cancel, Enter to save</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className={cx(
                        "ic-press ic-focus rounded-full px-2.5 py-1 text-[11px] font-medium",
                        isOwn ? "text-white/85 hover:bg-white/15" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]",
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={busy || !editValue.trim()}
                      className={cx(
                        "ic-press ic-focus inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold disabled:opacity-50",
                        isOwn ? "bg-white text-[var(--accent-strong)]" : "ic-accent-fill",
                      )}
                    >
                      {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {hasBody ? <span className="block whitespace-pre-wrap break-words">{message.body}</span> : null}
                {message.attachments.length > 0 ? (
                  <div className={cx(hasBody && "mt-2")}>
                    {message.attachments.map((attachment) => (
                      <AttachmentTile
                        key={attachment.id}
                        name={attachment.originalFilename}
                        href={attachmentDownloadUrl(attachment.id)}
                        tone={isOwn ? "own" : "other"}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {showActions ? (
            <div
              ref={actionsRef}
              data-open={confirmDelete}
              className="ic-actions flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5 shadow-[var(--shadow-popover)]"
            >
              {confirmDelete ? (
                <>
                  <span className="pl-2 pr-1 text-[11px] font-medium text-[var(--text-muted)]">Delete for everyone?</span>
                  <IconAction label="Keep message" onClick={() => setConfirmDelete(false)}>
                    <X size={13} />
                  </IconAction>
                  <button
                    type="button"
                    onClick={remove}
                    disabled={busy}
                    className="ic-press ic-focus inline-flex h-7 items-center gap-1 rounded-full bg-[var(--danger)] px-2.5 text-[11px] font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    Delete
                  </button>
                </>
              ) : (
                <>
                  {hasBody ? (
                    <IconAction label={copied ? "Copied" : "Copy text"} onClick={copy}>
                      {copied ? <Check size={13} className="text-[var(--accent)]" /> : <Copy size={13} />}
                    </IconAction>
                  ) : null}
                  {isOwn && hasBody ? (
                    <IconAction label="Edit" onClick={startEdit}>
                      <Pencil size={13} />
                    </IconAction>
                  ) : null}
                  {isOwn ? (
                    <IconAction label="Delete" danger onClick={() => setConfirmDelete(true)}>
                      <Trash2 size={13} />
                    </IconAction>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>

        {error ? <p className="ic-expand mt-1 px-1 text-[11px] text-[var(--danger)]">{error}</p> : null}

        {groupEnd ? (
          <div className={cx("mt-1 flex items-center gap-1.5 px-1 text-[10.5px] text-[var(--text-subtle)]", isOwn ? "justify-end" : "justify-start")}>
            <span>{formatTime(message.createdAt)}</span>
            {message.editedAt && !isDeleted ? <span>Edited</span> : null}
            {isOwn && !isDeleted ? <Check size={12} aria-label="Sent" /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PendingBubble({
  pending,
  groupStart,
  onRetry,
  onDiscard,
}: {
  pending: PendingMessage;
  groupStart: boolean;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const failed = pending.status === "failed";
  return (
    <div className={cx("ic-msg ic-in-own flex justify-end", groupStart ? "mt-3" : "mt-[3px]")}>
      <div className="flex min-w-0 max-w-[82%] flex-col items-end sm:max-w-[68%]">
        <div
          className={cx(
            "ic-bubble-own min-w-0 px-3.5 py-2.5 text-[13.5px] leading-[1.45] transition-opacity duration-300",
            bubbleRadius(true, groupStart, true),
            failed ? "opacity-55" : "opacity-80",
          )}
        >
          {pending.body ? <span className="block whitespace-pre-wrap break-words">{pending.body}</span> : null}
          {pending.attachments.length > 0 ? (
            <div className={cx(pending.body && "mt-2")}>
              {pending.attachments.map((attachment) => (
                <AttachmentTile key={attachment.id} name={attachment.originalFilename} tone="own" />
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2 px-1 text-[10.5px]">
          {failed ? (
            <>
              <span className="inline-flex items-center gap-1 font-medium text-[var(--danger)]">
                <AlertCircle size={12} /> {pending.error || "Not delivered"}
              </span>
              <button type="button" onClick={onRetry} className="ic-focus inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline">
                <RotateCw size={11} /> Retry
              </button>
              <button type="button" onClick={onDiscard} className="ic-focus font-medium text-[var(--text-muted)] hover:underline">
                Discard
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 text-[var(--text-subtle)]">
              <Clock size={11} /> Sending
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   COMPOSER
============================================================================ */

function MessageComposer({
  value,
  onChange,
  attachments,
  canAttachMore,
  onAddFiles,
  onRemoveAttachment,
  onSend,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  attachments: DraftAttachment[];
  canAttachMore: boolean;
  onAddFiles: (files: File[]) => void;
  onRemoveAttachment: (localId: string) => void;
  onSend: () => void;
  placeholder: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useAutosize(textareaRef, value, 168);

  useEffect(() => {
    if (window.matchMedia("(min-width: 640px)").matches) textareaRef.current?.focus();
  }, []);

  const uploading = attachments.some((item) => item.status === "uploading");
  const hasReady = attachments.some((item) => item.status === "ready");
  const canSend = !uploading && (value.trim().length > 0 || hasReady);
  const nearLimit = value.length > MAX_MESSAGE_LENGTH * 0.85;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length > 0) {
      event.preventDefault();
      onAddFiles(files);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    onAddFiles(files);
  };

  return (
    <div className="ic-glass relative z-10 border-t border-[var(--line)] px-3 pb-3 pt-2.5 sm:px-6">
      <div className="mx-auto max-w-3xl">
        {attachments.length > 0 ? (
          <div className="ic-scroll mb-2 flex gap-2 overflow-x-auto pb-1">
            {attachments.map((item) => (
              <div
                key={item.localId}
                className={cx(
                  "ic-pop flex max-w-[230px] shrink-0 items-center gap-2 rounded-xl border px-2 py-1.5",
                  item.status === "error" ? "border-transparent bg-[var(--danger-soft)]" : "border-[var(--line)] bg-[var(--surface)]",
                )}
              >
                <span
                  className={cx(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                    item.status === "error" ? "text-[var(--danger)]" : "bg-[var(--surface-muted)] text-[var(--accent-strong)]",
                  )}
                >
                  {item.status === "uploading" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : item.status === "error" ? (
                    <AlertCircle size={14} />
                  ) : (
                    fileIcon(item.name, 14)
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-[var(--text)]">{item.name}</span>
                  <span className={cx("block text-[10.5px]", item.status === "error" ? "text-[var(--danger)]" : "text-[var(--text-subtle)]")}>
                    {item.status === "uploading" ? "Uploading" : item.status === "error" ? item.error : "Ready to send"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(item.localId)}
                  aria-label={`Remove ${item.name}`}
                  className="ic-focus grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="ic-field flex items-end gap-1 rounded-[22px] border border-[var(--line)] bg-[var(--surface-muted)] p-1.5">
          <input ref={fileInputRef} type="file" hidden multiple={MAX_ATTACHMENTS > 1} onChange={handleFileChange} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canAttachMore}
            aria-label="Attach files"
            title={canAttachMore ? "Attach files" : `Up to ${MAX_ATTACHMENTS} files per message`}
            className="ic-press ic-focus grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:opacity-40"
          >
            <Paperclip size={16} />
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            aria-label="Message"
            rows={1}
            className="ic-scroll min-h-9 flex-1 resize-none bg-transparent px-1.5 py-2 text-[13.5px] leading-5 text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
          />

          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
            className="ic-send ic-focus ic-accent-fill grid h-9 w-9 shrink-0 place-items-center rounded-full"
          >
            <Send size={15} className="-translate-x-px translate-y-px" />
          </button>
        </div>

        <div className={cx("mt-1.5 items-center justify-between gap-3 px-2 text-[10.5px] text-[var(--text-subtle)]", nearLimit ? "flex" : "hidden sm:flex")}>
          <span className="hidden items-center gap-1 sm:inline-flex">
            <Kbd>Enter</Kbd> to send, <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> for a new line
          </span>
          {nearLimit ? (
            <span className={cx("ml-auto tabular-nums", value.length >= MAX_MESSAGE_LENGTH && "font-semibold text-[var(--danger)]")}>
              {value.length.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   MODAL SHELL (portal, animated enter + exit, Esc, scroll lock)
============================================================================ */

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: (close: () => void) => ReactNode;
  footer?: (close: () => void) => ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const themeHost = useContext(ThemeHostContext);

  // Copy the brand colours from the chat workspace onto the portal before paint.
  useLayoutEffect(() => {
    const target = portalRef.current;
    if (!target) return;
    const computed = themeHost?.current ? window.getComputedStyle(themeHost.current) : null;
    for (const [name, fallback] of Object.entries(MODAL_BRAND_FALLBACKS)) {
      const value = computed?.getPropertyValue(name).trim();
      target.style.setProperty(name, value || fallback);
    }
  }, [themeHost]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    timeoutRef.current = window.setTimeout(onClose, MODAL_EXIT_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return createPortal(
    <div ref={portalRef} className="ic-portal ic-modal-theme fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ic-backdrop absolute inset-0 bg-black/50 backdrop-blur-[4px]" data-closing={closing} onClick={requestClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        data-closing={closing}
        className="ic-panel relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-[#e4e4e7] bg-white text-[#0a0a0a] shadow-[var(--shadow-popover)] outline-none sm:max-w-[440px] sm:rounded-[24px]"
      >
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-[var(--line)]" />
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
          <div className="min-w-0">
            <h2 className="text-[15.5px] font-semibold tracking-[-0.01em]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="ic-press ic-focus -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="ic-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children(requestClose)}</div>
        {footer ? (
          <div className="border-t border-[var(--line)] px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3.5">{footer(requestClose)}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/* ============================================================================
   USER SEARCH PICKER (debounced, keyboard navigable)
============================================================================ */

function UserSearchPicker({
  selected,
  onToggle,
  disabledIds = EMPTY_IDS,
  disabledLabel = "In group",
  autoFocus,
}: {
  selected: ReadonlySet<string>;
  onToggle: (user: ChatUser) => void;
  disabledIds?: ReadonlySet<string>;
  disabledLabel?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      searchUsers(query.trim())
        .then(({ users: result }) => {
          if (cancelled) return;
          setUsers(result);
          setActiveIndex(0);
        })
        .catch(() => {
          if (!cancelled) setUsers([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const updateQuery = (next: string) => {
    setQuery(next);
    setLoading(true);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, users.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const user = users[activeIndex];
      if (user && !disabledIds.has(user.id)) onToggle(user);
    }
  };

  return (
    <div>
      <div className="ic-field flex h-10 items-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]">
        <Search size={14} className="ml-3 shrink-0 text-[var(--text-subtle)]" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by name or email"
          aria-label="Search people"
          className="h-full w-full min-w-0 bg-transparent px-2.5 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
        />
        {loading && users.length > 0 ? <Loader2 size={13} className="mr-3 shrink-0 animate-spin text-[var(--text-subtle)]" /> : null}
        {query && !loading ? (
          <button
            type="button"
            onClick={() => updateQuery("")}
            aria-label="Clear search"
            className="ic-focus mr-2 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--text-subtle)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            <X size={12} />
          </button>
        ) : null}
      </div>

      <div ref={listRef} role="listbox" aria-multiselectable className="ic-scroll -mx-1 mt-2 max-h-64 overflow-y-auto px-1">
        {loading && users.length === 0 ? (
          <div className="space-y-1" aria-hidden>
            {[60, 45, 52].map((width, index) => (
              <div key={index} className="flex items-center gap-3 px-2.5 py-2">
                <span className="ic-skeleton h-[34px] w-[34px] shrink-0 rounded-full" />
                <span className="flex-1 space-y-1.5">
                  <span className="ic-skeleton block h-3 rounded-full" style={{ width: `${width}%` }} />
                  <span className="ic-skeleton block h-2.5 rounded-full" style={{ width: `${width + 15}%` }} />
                </span>
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="ic-fade py-8 text-center text-[12.5px] text-[var(--text-subtle)]">
            {query.trim() ? `Nobody matches "${query.trim()}".` : "No teammates to show yet."}
          </p>
        ) : (
          users.map((user, index) => {
            const isSelected = selected.has(user.id);
            const isDisabled = disabledIds.has(user.id);
            const name = userDisplayName(user);
            const role = userRoleLabel(user);
            const email = readString(user, "email");
            const subtitle = role ?? email;
            return (
              <button
                key={user.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-index={index}
                disabled={isDisabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onToggle(user)}
                className={cx(
                  "ic-focus flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                  index === activeIndex && !isDisabled && "bg-[var(--surface-muted)]",
                  isDisabled && "cursor-default opacity-55",
                )}
              >
                <Avatar name={name} url={userAvatarUrl(user)} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-[var(--text)]">{name}</span>
                  {subtitle && subtitle !== name ? <span className="block truncate text-[11.5px] text-[var(--text-muted)]">{subtitle}</span> : null}
                </span>
                {isDisabled ? (
                  <span className="shrink-0 text-[10.5px] font-medium text-[var(--text-subtle)]">{disabledLabel}</span>
                ) : (
                  <span
                    aria-hidden
                    className={cx(
                      "ic-check grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                      isSelected ? "border-transparent bg-[var(--accent)] text-white" : "border-[var(--line)] bg-[var(--surface)]",
                    )}
                  >
                    {isSelected ? <Check key="on" size={12} strokeWidth={3} className="ic-pop" /> : null}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   NEW CONVERSATION MODAL
============================================================================ */

function NewConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conversation: ChatConversation) => void;
}) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [selected, setSelected] = useState<Map<string, ChatUser>>(() => new Map());
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(() => new Set(selected.keys()), [selected]);
  const selectedUsers = useMemo(() => Array.from(selected.values()), [selected]);
  const first = selectedUsers[0];

  const switchMode = (next: "direct" | "group") => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    // Carry a single pick across modes; clear a multi-pick when going back to direct.
    setSelected((current) => (next === "group" || current.size <= 1 ? current : new Map()));
  };

  const toggle = useCallback(
    (user: ChatUser) => {
      setError(null);
      setSelected((current) => {
        if (mode === "direct") return current.has(user.id) ? new Map() : new Map([[user.id, user]]);
        const next = new Map(current);
        if (next.has(user.id)) next.delete(user.id);
        else next.set(user.id, user);
        return next;
      });
    },
    [mode],
  );

  const removeSelected = (id: string) => {
    setSelected((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  };

  const canSubmit = mode === "direct" ? Boolean(first) : selected.size > 0 && groupName.trim().length > 0;

  const submit = (close: () => void) => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);

    const succeed = (conversation: ChatConversation) => {
      onCreated(conversation);
      close();
    };
    const fail = (err: unknown, fallback: string) => {
      setError(errorMessage(err, fallback));
      setBusy(false);
    };

    if (mode === "direct" && first) {
      createDirectConversation(first.id)
        .then(({ conversation }) => succeed(conversation))
        .catch((err) => fail(err, "That conversation didn't open. Try again."));
    } else {
      createGroupConversation(groupName.trim(), Array.from(selected.keys()))
        .then(({ conversation }) => succeed(conversation))
        .catch((err) => fail(err, "The group wasn't created. Try again."));
    }
  };

  const buttonLabel = busy
    ? mode === "direct"
      ? "Opening conversation"
      : "Creating group"
    : mode === "direct"
      ? first
        ? `Message ${firstName(userDisplayName(first))}`
        : "Choose someone to message"
      : selected.size === 0
        ? "Add at least one person"
        : !groupName.trim()
          ? "Give the group a name"
          : `Create group with ${selected.size} ${selected.size === 1 ? "person" : "people"}`;

  return (
    <ModalShell
      title="New message"
      subtitle={mode === "direct" ? "Send a private message to one teammate." : "Bring several teammates into one conversation."}
      onClose={onClose}
      footer={(close) => (
        <button
          type="button"
          onClick={() => submit(close)}
          disabled={!canSubmit || busy}
          className="ic-press ic-focus ic-accent-fill flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-semibold shadow-[0_10px_24px_-14px_var(--accent)] transition-[filter] hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : mode === "direct" ? <Send size={15} /> : <Users size={15} />}
          {buttonLabel}
        </button>
      )}
    >
      {() => (
        <div className="space-y-4">
          <Segmented
            label="Conversation type"
            value={mode}
            onChange={switchMode}
            options={[
              { value: "direct", label: "Direct", icon: <User size={13} /> },
              { value: "group", label: "Group", icon: <Users size={13} /> },
            ]}
          />

          {mode === "group" ? (
            <div key="group-fields" className="ic-expand space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-muted)]">Group name</span>
                <input
                  autoFocus
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value.slice(0, 80))}
                  placeholder="For example, Operations team"
                  className="ic-input h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
                />
              </label>

              {selectedUsers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedUsers.map((user) => {
                    const name = userDisplayName(user);
                    return (
                      <span
                        key={user.id}
                        className="ic-pop inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] py-0.5 pl-0.5 pr-1 text-[12px] font-medium"
                      >
                        <Avatar name={name} url={userAvatarUrl(user)} size={22} />
                        <span className="max-w-[120px] truncate">{name}</span>
                        <button
                          type="button"
                          onClick={() => removeSelected(user.id)}
                          aria-label={`Remove ${name}`}
                          className="ic-focus grid h-5 w-5 place-items-center rounded-full text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-muted)]">{mode === "direct" ? "To" : "Add people"}</span>
            <UserSearchPicker selected={selectedIds} onToggle={toggle} autoFocus={mode === "direct"} />
          </div>

          {error ? <ErrorBanner message={error} /> : null}
        </div>
      )}
    </ModalShell>
  );
}

/* ============================================================================
   GROUP MANAGE MODAL
============================================================================ */

function GroupManageModal({
  conversation,
  currentAdminUserId,
  onClose,
  onUpdated,
  onLeft,
}: {
  conversation: ChatConversation;
  currentAdminUserId: string;
  onClose: () => void;
  onUpdated: (conversation: ChatConversation) => void;
  onLeft: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(conversation.name ?? "");
  const [adding, setAdding] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selfMember = conversation.members.find((member) => member.adminUserId === currentAdminUserId);
  const isAdmin = selfMember?.role === "ADMIN";
  const memberIds = useMemo(() => new Set(conversation.members.map((member) => member.adminUserId)), [conversation.members]);
  const memberCount = conversation.members.length;

  const sortedMembers = useMemo(
    () =>
      [...conversation.members].sort((a, b) => {
        if (a.adminUserId === currentAdminUserId) return -1;
        if (b.adminUserId === currentAdminUserId) return 1;
        if (a.role !== b.role) return a.role === "ADMIN" ? -1 : 1;
        return userDisplayName(a.adminUser).localeCompare(userDisplayName(b.adminUser));
      }),
    [conversation.members, currentAdminUserId],
  );

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    if (trimmed === (conversation.name ?? "")) {
      setRenaming(false);
      return;
    }
    setBusy("rename");
    setError(null);
    renameConversation(conversation.id, trimmed)
      .then(({ conversation: updated }) => {
        onUpdated(updated);
        setRenaming(false);
      })
      .catch((err) => setError(errorMessage(err, "The group name wasn't saved.")))
      .finally(() => setBusy(null));
  };

  const addMember = (user: ChatUser) => {
    if (busy) return;
    setBusy(`add-${user.id}`);
    setError(null);
    addGroupMember(conversation.id, user.id)
      .then(({ conversation: updated }) => onUpdated(updated))
      .catch((err) => setError(errorMessage(err, `${userDisplayName(user)} wasn't added.`)))
      .finally(() => setBusy(null));
  };

  const removeMember = (adminUserId: string) => {
    setBusy(`remove-${adminUserId}`);
    setError(null);
    removeGroupMember(conversation.id, adminUserId)
      .then(() => {
        onUpdated({ ...conversation, members: conversation.members.filter((member) => member.adminUserId !== adminUserId) });
        setConfirmRemoveId(null);
      })
      .catch((err) => setError(errorMessage(err, "That person wasn't removed.")))
      .finally(() => setBusy(null));
  };

  const leave = (close: () => void) => {
    setBusy("leave");
    setError(null);
    removeGroupMember(conversation.id, currentAdminUserId)
      .then(() => {
        close();
        window.setTimeout(onLeft, MODAL_EXIT_MS + 20);
      })
      .catch((err) => {
        setError(errorMessage(err, "You weren't removed from the group. Try again."));
        setBusy(null);
      });
  };

  return (
    <ModalShell
      title="Group details"
      onClose={onClose}
      footer={(close) =>
        confirmLeave ? (
          <div className="ic-expand space-y-3">
            <p className="text-[12px] leading-5 text-[var(--text-muted)]">
              You'll stop getting messages from {conversation.name || "this group"}. Someone in the group would need to add you back.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="ic-press ic-focus h-10 flex-1 rounded-xl border border-[var(--line)] text-[12.5px] font-medium hover:bg-[var(--surface-muted)]"
              >
                Stay in group
              </button>
              <button
                type="button"
                onClick={() => leave(close)}
                disabled={busy === "leave"}
                className="ic-press ic-focus inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--danger)] text-[12.5px] font-semibold text-white disabled:opacity-60"
              >
                {busy === "leave" ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                Leave group
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            className="ic-press ic-focus flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] text-[12.5px] font-semibold text-[var(--danger)] hover:border-transparent hover:bg-[var(--danger-soft)]"
          >
            <LogOut size={14} /> Leave group
          </button>
        )
      }
    >
      {() => (
        <div className="space-y-5">
          <div className="flex items-center gap-3.5 rounded-2xl bg-[var(--surface-muted)] p-3.5">
            <GroupAvatar members={conversation.members} excludeId={currentAdminUserId} size={52} />
            <div className="min-w-0 flex-1">
              {renaming ? (
                <div className="ic-expand flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value.slice(0, 80))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") saveName();
                      if (event.key === "Escape") {
                        event.stopPropagation();
                        setName(conversation.name ?? "");
                        setRenaming(false);
                      }
                    }}
                    aria-label="Group name"
                    className="ic-input h-9 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[13px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={saveName}
                    disabled={busy === "rename" || !name.trim()}
                    aria-label="Save name"
                    className="ic-press ic-focus ic-accent-fill grid h-9 w-9 shrink-0 place-items-center rounded-lg disabled:opacity-40"
                  >
                    {busy === "rename" ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setName(conversation.name ?? "");
                      setRenaming(false);
                    }}
                    aria-label="Cancel rename"
                    className="ic-press ic-focus grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface)]"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[14.5px] font-semibold tracking-[-0.01em]">{conversation.name || "Untitled group"}</p>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setRenaming(true)}
                      aria-label="Rename group"
                      title="Rename group"
                      className="ic-press ic-focus grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--text-subtle)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
                    >
                      <Pencil size={13} />
                    </button>
                  ) : null}
                </div>
              )}
              <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                {memberCount} member{memberCount === 1 ? "" : "s"}
                {isAdmin ? ", you're an admin" : ""}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12.5px] font-semibold">Members</p>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setAdding((value) => !value)}
                  className="ic-press ic-focus inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--accent)] hover:bg-[var(--accent-tint)]"
                >
                  {adding ? <Check size={13} /> : <UserPlus size={13} />}
                  {adding ? "Done" : "Add people"}
                </button>
              ) : null}
            </div>

            {adding ? (
              <div className="ic-expand mb-3 rounded-2xl border border-[var(--line)] p-3">
                <UserSearchPicker selected={EMPTY_IDS} disabledIds={memberIds} onToggle={addMember} autoFocus />
              </div>
            ) : null}

            <div className="flex flex-col gap-0.5">
              {sortedMembers.map((member) => {
                const memberName = userDisplayName(member.adminUser);
                const email = readString(member.adminUser, "email");
                const memberSubtitle = userRoleLabel(member.adminUser) ?? (email !== memberName ? email : null);
                const isSelf = member.adminUserId === currentAdminUserId;
                const confirming = confirmRemoveId === member.adminUserId;
                const removing = busy === `remove-${member.adminUserId}`;
                return (
                  <div key={member.adminUserId} className="ic-reveal-host flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--surface-muted)]">
                    <Avatar name={memberName} url={userAvatarUrl(member.adminUser)} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">
                        {memberName}
                        {isSelf ? <span className="font-normal text-[var(--text-subtle)]"> (you)</span> : null}
                      </p>
                      {memberSubtitle ? <p className="truncate text-[11.5px] text-[var(--text-muted)]">{memberSubtitle}</p> : null}
                    </div>
                    {member.role === "ADMIN" ? (
                      <span className="shrink-0 rounded-full bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">Admin</span>
                    ) : null}
                    {isAdmin && !isSelf ? (
                      confirming ? (
                        <span className="ic-pop flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(null)}
                            className="ic-focus rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--text-muted)] hover:bg-[var(--surface)]"
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMember(member.adminUserId)}
                            disabled={removing}
                            className="ic-press ic-focus inline-flex items-center gap-1 rounded-lg bg-[var(--danger)] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                          >
                            {removing ? <Loader2 size={11} className="animate-spin" /> : null}
                            Remove
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(member.adminUserId)}
                          aria-label={`Remove ${memberName}`}
                          title={`Remove ${memberName}`}
                          className="ic-reveal ic-focus grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--text-subtle)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                        >
                          <X size={14} />
                        </button>
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {error ? <ErrorBanner message={error} /> : null}
        </div>
      )}
    </ModalShell>
  );
}