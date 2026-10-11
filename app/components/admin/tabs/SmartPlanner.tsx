/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { createPortal } from "react-dom";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileSpreadsheet,
  FileText,
  FolderUp,
  Globe2,
  Loader2,
  LocateFixed,
  MapPin,
  Minus,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Video,
  WandSparkles,
  X,
} from "lucide-react";

import {
  DocumentReadError,
  documentKind,
  extractDocumentText,
  type DocumentKind,
} from "./extractDocumentText";

/* =============================================================================
   TYPES
============================================================================= */

type InputMode = "describe" | "upload" | "paste";

type PlannerStep = "input" | "review" | "complete";

type ReviewFilter = "all" | "ready" | "review" | "selected";

type EventType =
  | "MEETING"
  | "DEADLINE"
  | "MILESTONE"
  | "DEPLOYMENT"
  | "RELEASE"
  | "FINANCE"
  | "SUPPORT"
  | "MAINTENANCE"
  | "COMPANY"
  | "PERSONAL"
  | "FOCUS"
  | "REMINDER"
  | "OTHER";

type EventPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

type EventScope = "PERSONAL" | "TEAM" | "DEPARTMENT" | "COMPANY" | "WORKSPACE";

type CalendarEventPayload = {
  title: string;
  description?: string | null;
  type?: EventType;
  scope?: EventScope;
  priority?: EventPriority;
  startAt: string;
  endAt?: string | null;
  allDay?: boolean;
  timezone?: string | null;
  private?: boolean;
  location?: string | null;
  meetingUrl?: string | null;
  ownerId?: string | null;
  departmentId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  attendeeIds?: string[];
};

type RawScheduleRow = {
  row: number;
  title: string;
  date: string;
  time: string;
  endTime: string;
  duration: string;
  description: string;
  type: string;
  priority: string;
  scope: string;
  location: string;
  meetingUrl: string;
  allDay: string;
};

type PreviewEvent = {
  key: string;
  row: number;
  status: "ready" | "needs_review";
  issues: string[];
  source: RawScheduleRow;
  event: CalendarEventPayload | null;
};

type PreviewResponse = {
  success: boolean;
  previewOnly: boolean;
  source: {
    type: "TEXT" | "CSV";
    filename: string | null;
    timezone: string;
  };
  summary: {
    total: number;
    ready: number;
    needsReview: number;
  };
  events: PreviewEvent[];
  message: string;
};

type ImportedEvent = {
  key: string;
  eventId: string;
  title: string;
  startAt: string;
  endAt: string | null;
  ownerId: string;
};

type SkippedEvent = {
  key: string;
  title: string;
  reason: string;
  existingEventId?: string;
};

type ImportResponse = {
  success: boolean;
  summary: {
    total: number;
    imported: number;
    skipped: number;
    failed: number;
  };
  imported: ImportedEvent[];
  skipped: SkippedEvent[];
  message: string;
};

type ExtractedSource = {
  name: string;
  kind: DocumentKind;
  lines: number;
  pages?: number;
};

type PlannerEvent = PreviewEvent & {
  selected: boolean;
};

type SmartPlannerProps = {
  open: boolean;
  onClose: () => void;
  onImported?: (result: ImportResponse) => void | Promise<void>;
  canCreate?: boolean;
  isManager?: boolean;
  defaultTimezone?: string;
};

/* =============================================================================
   CONSTANTS
============================================================================= */

const PREVIEW_ENDPOINT = "/api/admin/calendar/smart-planner/preview";
const IMPORT_ENDPOINT = "/api/admin/calendar/smart-planner/import";

/* CSV and TXT files are sent to the server as they are, so they keep its 1 MB limit. */
const MAX_FILE_BYTES = 1024 * 1024;

/* PDF and Word files are read in the browser and only their text is sent. */
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

const ACCEPTED_FILES =
  ".csv,.txt,.pdf,.docx,text/csv,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_PREVIEW_EVENTS = 200;
const MAX_IMPORT_EVENTS = 100;

const EVENT_TYPES: Array<{ value: EventType; label: string; color: string }> = [
  { value: "MEETING", label: "Meeting", color: "#3B82F6" },
  { value: "DEADLINE", label: "Deadline", color: "#EF4444" },
  { value: "MILESTONE", label: "Milestone", color: "#8B5CF6" },
  { value: "DEPLOYMENT", label: "Deployment", color: "#10B981" },
  { value: "RELEASE", label: "Release", color: "#06B6D4" },
  { value: "FINANCE", label: "Finance", color: "#C99A2E" },
  { value: "SUPPORT", label: "Support", color: "#F97316" },
  { value: "MAINTENANCE", label: "Maintenance", color: "#64748B" },
  { value: "COMPANY", label: "Company", color: "#D946EF" },
  { value: "PERSONAL", label: "Personal", color: "#14B8A6" },
  { value: "FOCUS", label: "Focus", color: "#6366F1" },
  { value: "REMINDER", label: "Reminder", color: "#EAB308" },
  { value: "OTHER", label: "Other", color: "#A1A1AA" },
];

const PRIORITIES: Array<{ value: EventPriority; label: string }> = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const SCOPES: Array<{ value: EventScope; label: string }> = [
  { value: "PERSONAL", label: "Only me" },
  { value: "TEAM", label: "My team" },
  { value: "DEPARTMENT", label: "Department" },
  { value: "COMPANY", label: "Whole company" },
  { value: "WORKSPACE", label: "Workspace" },
];

const COMMON_TIMEZONES = [
  "Europe/London",
  "Africa/Lagos",
  "Africa/Abuja",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
  "UTC",
];

const EXAMPLE_SCHEDULE = `2026-11-03 | 10:00 | Instagram Product Announcement | Carousel introducing our new product
2026-11-05 | 13:00 | LinkedIn Company Update | Company announcement
2026-11-07 | 16:00 | TikTok Campaign Launch | Short promotional video
2026-11-09 | 11:00 | Monthly Content Review | Review scheduled content`;

const SAMPLE_CSV = [
  "Date,Time,Title,Description,Type,Priority,Duration",
  "2026-11-03,10:00,Instagram Product Announcement,Carousel introducing our product,OTHER,NORMAL,30",
  "2026-11-05,13:00,LinkedIn Company Update,Company announcement,OTHER,NORMAL,30",
  "2026-11-07,16:00,TikTok Campaign Launch,Promotional video,OTHER,HIGH,45",
].join("\n");

/*
 * The planner renders in a portal on document.body, outside the element that
 * defines the dashboard colour variables. It therefore carries its own solid
 * white and gold palette, and only borrows the dashboard accent when present.
 */
const PLANNER_VARS = {
  "--sp-bg": "#FFFFFF",
  "--sp-muted": "#FAF8F3",
  "--sp-muted-2": "#F3EFE5",
  "--sp-line": "#E7E1D3",
  "--sp-line-strong": "#D6CCB4",
  "--sp-text": "#16140E",
  "--sp-text-2": "#4A4535",
  "--sp-text-3": "#867E69",
  "--sp-gold": "var(--accent, #B8912F)",
  "--sp-gold-ink": "#FFFFFF",
} as CSSProperties;

/* =============================================================================
   UTILITIES
============================================================================= */

const subscribeNoop = () => () => {};

function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function isValidTimezone(value: string) {
  if (!value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
}

function formatTimeOnly(iso: string, timezone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).format(date);
  } catch {
    return "";
  }
}

function formatDayHeading(iso: string, timezone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date to confirm";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: timezone,
    }).format(date);
  } catch {
    return iso.slice(0, 10);
  }
}

function dayKey(iso: string, timezone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "invalid";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).format(date);
  } catch {
    return iso.slice(0, 10);
  }
}

function formatDateTime(iso: string, timezone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
      hour12: false,
    }).format(date);
  } catch {
    return iso;
  }
}

function durationLabel(startAt: string, endAt?: string | null) {
  if (!endAt) return null;
  const minutes = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function utcInputValue(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function fromUtcInput(value: string) {
  if (!value) return null;
  const date = new Date(`${value}:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function getErrorMessage(value: unknown, fallback: string) {
  return value instanceof Error ? value.message : fallback;
}

async function readResponseError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    if (body && typeof body.error === "string") return body.error;
  } catch {
    // Fall through.
  }
  return fallback;
}

function downloadCsvTemplate() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "syntra-grid-calendar-template.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string) {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function sourceRowAsCsv(row: RawScheduleRow) {
  const headers = [
    "Title",
    "Date",
    "Time",
    "End Time",
    "Duration",
    "Description",
    "Type",
    "Priority",
    "Scope",
    "Location",
    "Meeting URL",
    "All Day",
  ];

  const values = [
    row.title,
    row.date,
    row.time,
    row.endTime,
    row.duration,
    row.description,
    row.type,
    row.priority,
    row.scope,
    row.location,
    row.meetingUrl,
    row.allDay,
  ];

  return [headers.map(escapeCsv).join(","), values.map(escapeCsv).join(",")].join("\n");
}

function typeMeta(type?: string | null) {
  return EVENT_TYPES.find((item) => item.value === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
}

/*
 * A light, client side look at typed lines so people can see what was picked
 * up before sending. The server still does the real parsing on Review.
 */
function quickScan(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const datePattern = /\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.]\d{1,2}[/.]\d{2,4})\b/;
  const timePattern = /\b([01]?\d|2[0-3])[:.][0-5]\d\b/;

  const rows = lines.map((line) => {
    const parts = line.split(/\s*[|\t]\s*/).filter(Boolean);
    const date = line.match(datePattern)?.[0] ?? "";
    const time = line.match(timePattern)?.[0] ?? "";
    const title =
      parts.find((part) => part !== date && part !== time && !datePattern.test(part) && !timePattern.test(part)) ??
      line;
    return { line, date, time, title, ok: Boolean(date && title) };
  });

  return { rows, ok: rows.filter((row) => row.ok).length };
}

/* =============================================================================
   COMPONENT
============================================================================= */

export default function SmartPlanner({
  open,
  onClose,
  onImported,
  canCreate = true,
  isManager = false,
  defaultTimezone,
}: SmartPlannerProps) {
  const isClient = useIsClient();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<PlannerStep>("input");
  const [mode, setMode] = useState<InputMode>("describe");
  const [scheduleText, setScheduleText] = useState("");
  const [timezone, setTimezone] = useState(defaultTimezone || "UTC");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [previewSource, setPreviewSource] = useState<PreviewResponse["source"] | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [recheckingKey, setRecheckingKey] = useState<string | null>(null);
  const [importName, setImportName] = useState("Smart Planner Schedule");
  const [extracting, setExtracting] = useState(false);
  const [extractedFrom, setExtractedFrom] = useState<ExtractedSource | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const busy = processing || importing || extracting || recheckingKey !== null;
  const timezoneValid = isValidTimezone(timezone);
  const browserTimezone = useMemo(() => getBrowserTimezone(), []);

  /* ---------- Initialise timezone ---------- */

  useEffect(() => {
    if (!open) return;
    setTimezone(defaultTimezone || getBrowserTimezone());
  }, [defaultTimezone, open]);

  /* ---------- Reset ---------- */

  const reset = useCallback(() => {
    setStep("input");
    setMode("describe");
    setScheduleText("");
    setFile(null);
    setDragging(false);
    setProcessing(false);
    setImporting(false);
    setError("");
    setEvents([]);
    setPreviewSource(null);
    setImportResult(null);
    setSearchQuery("");
    setReviewFilter("all");
    setExpandedKey(null);
    setRecheckingKey(null);
    setImportName("Smart Planner Schedule");
    setExtracting(false);
    setExtractedFrom(null);
  }, []);

  /* ---------- Close ---------- */

  const close = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  /* ---------- Modal keyboard, scroll lock and focus ---------- */

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
    });

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        if (!busy) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKey);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open, busy, onClose]);

  /* ---------- File validation ---------- */

  const chooseFile = useCallback(async (selected: File | null) => {
    if (!selected) return;

    const extension = selected.name.split(".").pop()?.toLowerCase() ?? "";
    const kind = documentKind(selected);
    const baseName = selected.name.replace(/\.[^.]+$/, "");

    if (extension === "doc") {
      setError("Older .doc files can't be read. Open it in Word and save it as .docx, or export it as PDF.");
      return;
    }

    /*
     * PDF and Word: read the text here, then hand it to the normal text flow
     * so it can be checked and edited before the server sees it.
     */
    if (kind) {
      if (selected.size > MAX_DOCUMENT_BYTES) {
        setError("PDF and Word files must be smaller than 15 MB.");
        return;
      }

      setExtracting(true);
      setError("");

      try {
        const result = await extractDocumentText(selected);
        setScheduleText(result.text);
        setExtractedFrom({ name: selected.name, kind: result.kind, lines: result.lineCount, pages: result.pageCount });
        setFile(null);
        setImportName(baseName);
        setMode("paste");
      } catch (caught) {
        setError(
          caught instanceof DocumentReadError
            ? caught.message
            : "That file couldn't be read. Try saving it again, or paste the schedule instead.",
        );
      } finally {
        setExtracting(false);
      }

      return;
    }

    if (extension !== "csv" && extension !== "txt") {
      setError("Supported files: CSV, TXT, PDF and Word (.docx).");
      return;
    }

    if (selected.size > MAX_FILE_BYTES) {
      setError("CSV and TXT files must be smaller than 1 MB.");
      return;
    }

    setFile(selected);
    setExtractedFrom(null);
    setError("");
    setImportName(baseName);
    setMode("upload");
  }, []);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void chooseFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  };

  /* ---------- Preview ---------- */

  const generatePreview = useCallback(async () => {
    if (!canCreate) {
      setError("You do not have permission to create calendar events.");
      return;
    }

    if (!isValidTimezone(timezone)) {
      setError("Enter a valid timezone, such as Europe/London or Africa/Lagos.");
      return;
    }

    if (mode === "upload" && !file) {
      setError("Choose a CSV or TXT file first.");
      return;
    }

    if (mode !== "upload" && !scheduleText.trim()) {
      setError("Enter your schedule to continue.");
      textareaRef.current?.focus();
      return;
    }

    setProcessing(true);
    setError("");

    try {
      let response: Response;

      if (mode === "upload" && file) {
        const form = new FormData();
        form.append("file", file);
        form.append("timezone", timezone.trim());

        response = await fetch(PREVIEW_ENDPOINT, {
          method: "POST",
          body: form,
          credentials: "include",
          cache: "no-store",
        });
      } else {
        response = await fetch(PREVIEW_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: scheduleText, timezone: timezone.trim() }),
          credentials: "include",
          cache: "no-store",
        });
      }

      if (!response.ok) {
        throw new Error(await readResponseError(response, "Could not process the schedule."));
      }

      const result = (await response.json()) as PreviewResponse;

      if (!Array.isArray(result.events)) throw new Error("The preview response is invalid.");
      if (result.events.length > MAX_PREVIEW_EVENTS) throw new Error("The schedule contains too many events.");

      setEvents(
        result.events.map((event) => ({
          ...event,
          selected: event.status === "ready" && Boolean(event.event),
        })),
      );

      // Text read from a PDF or Word file still records which document it came from.
      setPreviewSource(
        mode !== "upload" && extractedFrom ? { ...result.source, filename: extractedFrom.name } : result.source,
      );
      setImportResult(null);
      setSearchQuery("");
      setReviewFilter("all");
      setExpandedKey(null);
      setStep("review");
    } catch (caught) {
      setError(getErrorMessage(caught, "Could not process your schedule."));
    } finally {
      setProcessing(false);
    }
  }, [canCreate, timezone, mode, file, scheduleText, extractedFrom]);

  /* ---------- Update event ---------- */

  const updateEvent = useCallback((key: string, updates: Partial<CalendarEventPayload>) => {
    setEvents((current) =>
      current.map((item) => {
        if (item.key !== key || !item.event) return item;
        return { ...item, event: { ...item.event, ...updates } };
      }),
    );
  }, []);

  /* ---------- Update source row ---------- */

  const updateSource = useCallback((key: string, updates: Partial<RawScheduleRow>) => {
    setEvents((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              source: { ...item.source, ...updates },
              status: "needs_review",
              selected: false,
              issues: ["Recheck this row to validate your changes."],
            }
          : item,
      ),
    );
  }, []);

  /* ---------- Recheck row (sends the corrected row back to preview) ---------- */

  const recheckRow = useCallback(
    async (key: string) => {
      const item = events.find((event) => event.key === key);
      if (!item) return;

      setRecheckingKey(key);
      setError("");

      try {
        const form = new FormData();
        form.append("file", new File([sourceRowAsCsv(item.source)], "corrected-row.csv", { type: "text/csv" }));
        form.append("timezone", timezone);

        const response = await fetch(PREVIEW_ENDPOINT, {
          method: "POST",
          body: form,
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(await readResponseError(response, "Could not validate this row."));
        }

        const result = (await response.json()) as PreviewResponse;
        const corrected = result.events[0];

        if (!corrected) throw new Error("No event was found in the corrected row.");

        setEvents((current) =>
          current.map((existing) =>
            existing.key === key
              ? {
                  ...corrected,
                  key: existing.key,
                  row: existing.row,
                  source: { ...corrected.source, row: existing.row },
                  selected: corrected.status === "ready" && Boolean(corrected.event),
                }
              : existing,
          ),
        );

        if (corrected.status === "ready") setExpandedKey(null);
      } catch (caught) {
        setError(getErrorMessage(caught, "Could not recheck the selected event."));
      } finally {
        setRecheckingKey(null);
      }
    },
    [events, timezone],
  );

  /* ---------- Selection ---------- */

  const toggleSelection = useCallback((key: string) => {
    setEvents((current) => {
      const alreadySelected = current.filter((item) => item.selected).length;

      return current.map((item) => {
        if (item.key !== key || !item.event || item.status !== "ready") return item;
        if (!item.selected && alreadySelected >= MAX_IMPORT_EVENTS) return item;
        return { ...item, selected: !item.selected };
      });
    });
  }, []);

  const selectAll = useCallback((selected: boolean) => {
    setEvents((current) => {
      let count = 0;

      return current.map((item) => {
        const ready = item.status === "ready" && Boolean(item.event);
        if (!ready) return { ...item, selected: false };
        if (selected && count < MAX_IMPORT_EVENTS) {
          count += 1;
          return { ...item, selected: true };
        }
        return { ...item, selected: false };
      });
    });
  }, []);

  const removeRow = useCallback((key: string) => {
    setEvents((current) => current.filter((item) => item.key !== key));
    setExpandedKey((current) => (current === key ? null : current));
  }, []);

  /* ---------- Counts ---------- */

  const counts = useMemo(() => {
    const ready = events.filter((item) => item.status === "ready" && Boolean(item.event));
    const selected = ready.filter((item) => item.selected);

    return {
      total: events.length,
      ready: ready.length,
      needsReview: events.length - ready.length,
      selected: selected.length,
    };
  }, [events]);

  /* ---------- Filter and group for review ---------- */

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return events.filter((item) => {
      const ready = item.status === "ready" && Boolean(item.event);
      if (reviewFilter === "ready" && !ready) return false;
      if (reviewFilter === "review" && ready) return false;
      if (reviewFilter === "selected" && !item.selected) return false;
      if (!query) return true;

      return [item.event?.title, item.source.title, item.source.description, item.source.date, item.source.time]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [events, searchQuery, reviewFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, { heading: string; sort: string; items: PlannerEvent[] }>();

    filteredEvents.forEach((item) => {
      const key = item.event ? dayKey(item.event.startAt, timezone) : "unscheduled";
      const heading = item.event ? formatDayHeading(item.event.startAt, timezone) : "Needs a valid date";
      const sort = key === "unscheduled" ? "0000" : key;
      const group = map.get(key) ?? { heading, sort, items: [] };
      group.items.push(item);
      map.set(key, group);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[1].sort.localeCompare(b[1].sort))
      .map(([key, group]) => ({
        key,
        ...group,
        items: group.items.sort((a, b) =>
          a.event && b.event ? a.event.startAt.localeCompare(b.event.startAt) : a.row - b.row,
        ),
      }));
  }, [filteredEvents, timezone]);

  /* ---------- Import ---------- */

  const importSelected = useCallback(async () => {
    const selected = events.filter((item) => item.selected && item.status === "ready" && item.event);

    if (!selected.length) {
      setError("Select at least one valid event to import.");
      return;
    }

    if (selected.length > MAX_IMPORT_EVENTS) {
      setError(`You can import up to ${MAX_IMPORT_EVENTS} events at a time.`);
      return;
    }

    setImporting(true);
    setError("");

    try {
      const response = await fetch(IMPORT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          name: importName.trim() || "Smart Planner Import",
          sourceType: previewSource?.type ?? "TEXT",
          sourceFileName: previewSource?.filename ?? null,
          items: selected.map((item) => ({ key: item.key, event: item.event })),
        }),
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response, "Could not import the selected events."));
      }

      const result = (await response.json()) as ImportResponse;
      setImportResult(result);
      setStep("complete");
      await onImported?.(result);
    } catch (caught) {
      setError(getErrorMessage(caught, "Could not complete the import."));
    } finally {
      setImporting(false);
    }
  }, [events, importName, previewSource, onImported]);

  /* ---------- Shortcut: Ctrl or Cmd + Enter moves forward ---------- */

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
    event.preventDefault();
    if (step === "input" && !processing) void generatePreview();
    else if (step === "review" && !importing && counts.selected > 0) void importSelected();
  };

  /* ---------- Derived for input step ---------- */

  const scan = useMemo(() => quickScan(mode === "upload" ? "" : scheduleText), [mode, scheduleText]);

  const allReadySelected = counts.ready > 0 && counts.selected === Math.min(counts.ready, MAX_IMPORT_EVENTS);
  const someSelected = counts.selected > 0 && !allReadySelected;

  if (!isClient) return null;

  /* ==========================================================================
     RENDER
  ========================================================================== */

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          key="smart-planner"
          style={PLANNER_VARS}
          className="fixed inset-0 z-[180] flex items-end justify-center text-[var(--sp-text)] sm:items-center sm:p-5"
        >
          <motion.button
            type="button"
            aria-label="Close Smart Planner"
            onClick={close}
            disabled={busy}
            className="absolute inset-0 cursor-default bg-[#17140C]/45 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="smart-planner-title"
            onKeyDown={onPanelKeyDown}
            className="sp-panel relative flex h-[96dvh] w-full max-w-[1120px] flex-col overflow-hidden rounded-t-[28px] border border-[var(--sp-line)] bg-[var(--sp-bg)] shadow-[0_40px_120px_-20px_rgba(23,20,12,0.45)] sm:h-[min(92dvh,900px)] sm:rounded-[28px]"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
          >
            {/* Header */}
            <header className="relative shrink-0 overflow-hidden border-b border-[var(--sp-line)] bg-[var(--sp-bg)]">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full opacity-[0.16] blur-3xl"
                style={{ background: "var(--sp-gold)" }}
              />

              <div className="relative flex items-center justify-between gap-4 px-5 pb-4 pt-5 sm:px-7">
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--sp-gold)] text-[var(--sp-gold-ink)] shadow-[0_8px_20px_-8px_var(--sp-gold)]">
                    <WandSparkles size={20} strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <h2 id="smart-planner-title" className="truncate text-[17px] font-semibold tracking-[-0.03em]">
                      Smart Planner
                    </h2>
                    <p className="mt-0.5 truncate text-[11.5px] text-[var(--sp-text-3)]">
                      Turn a schedule into calendar events in three steps.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  aria-label="Close Smart Planner"
                  className="sp-icon-btn"
                >
                  <X size={17} />
                </button>
              </div>

              <Stepper step={step} />
            </header>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--sp-bg)]">
              {step === "input" && (
                <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0">
                    <h3 className="text-[22px] font-semibold tracking-[-0.04em]">What would you like to schedule?</h3>
                    <p className="mt-1.5 max-w-[620px] text-[12.5px] leading-6 text-[var(--sp-text-2)]">
                      Type a list, upload a file or paste a plan. You&apos;ll check every event before anything is added.
                    </p>

                    <div role="tablist" aria-label="How to add your schedule" className="mt-5 grid grid-cols-3 gap-2">
                      <ModeTab
                        active={mode === "describe"}
                        icon={<Sparkles size={16} />}
                        title="Type it"
                        hint="One event per line"
                        onClick={() => {
                          setMode("describe");
                          setExtractedFrom(null);
                          setError("");
                        }}
                      />
                      <ModeTab
                        active={mode === "upload"}
                        icon={<FolderUp size={16} />}
                        title="Upload"
                        hint="PDF, Word, CSV, TXT"
                        onClick={() => {
                          setMode("upload");
                          setError("");
                        }}
                      />
                      <ModeTab
                        active={mode === "paste"}
                        icon={<FileText size={16} />}
                        title="Paste"
                        hint="From another doc"
                        onClick={() => {
                          setMode("paste");
                          setError("");
                        }}
                      />
                    </div>

                    <div className="mt-5">
                      {mode === "upload" ? (
                        <UploadArea
                          file={file}
                          extracting={extracting}
                          dragging={dragging}
                          onDraggingChange={setDragging}
                          onChooseFile={(selected) => void chooseFile(selected)}
                          onBrowse={() => fileInputRef.current?.click()}
                          onRemove={() => setFile(null)}
                        />
                      ) : (
                        <div>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <label htmlFor="planner-schedule" className="text-[12px] font-semibold">
                              {mode === "describe" ? "Your schedule" : "Pasted schedule"}
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setScheduleText(EXAMPLE_SCHEDULE);
                                textareaRef.current?.focus();
                              }}
                              className="sp-link"
                            >
                              <Sparkles size={12} />
                              Fill with an example
                            </button>
                          </div>

                          {extractedFrom ? (
                            <div className="mb-3 flex items-center gap-3 rounded-[14px] border border-[color-mix(in_srgb,var(--sp-gold)_45%,white)] bg-[color-mix(in_srgb,var(--sp-gold)_8%,white)] px-3.5 py-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--sp-bg)] text-[var(--sp-gold)] ring-1 ring-[var(--sp-line)]">
                                <FileText size={15} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12px] font-semibold">Read from {extractedFrom.name}</span>
                                <span className="block text-[10.5px] text-[var(--sp-text-2)]">
                                  {[
                                    extractedFrom.pages ? `${extractedFrom.pages} ${extractedFrom.pages === 1 ? "page" : "pages"}` : null,
                                    `${extractedFrom.lines} lines`,
                                    "check and tidy the text, then review",
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setExtractedFrom(null);
                                  setScheduleText("");
                                  setMode("upload");
                                }}
                                className="sp-btn-secondary !min-h-8 !px-2.5 !text-[10.5px]"
                              >
                                Choose another
                              </button>
                            </div>
                          ) : null}

                          <div className="overflow-hidden rounded-[18px] border border-[var(--sp-line-strong)] bg-[var(--sp-bg)] transition focus-within:border-[var(--sp-gold)] focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--sp-gold)_14%,transparent)]">
                            <textarea
                              id="planner-schedule"
                              ref={textareaRef}
                              data-autofocus
                              value={scheduleText}
                              onChange={(event) => setScheduleText(event.target.value)}
                              rows={11}
                              spellCheck={false}
                              placeholder={
                                "2026-11-03 | 10:00 | Instagram Product Announcement | Description\n2026-11-05 | 13:00 | LinkedIn Company Update | Description"
                              }
                              className="block min-h-[240px] w-full resize-y bg-transparent p-4 font-mono text-[12px] leading-7 text-[var(--sp-text)] outline-none placeholder:text-[var(--sp-text-3)]"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--sp-line)] bg-[var(--sp-muted)] px-4 py-2.5">
                              <span className="text-[10.5px] text-[var(--sp-text-3)]">
                                Format: <span className="font-mono text-[var(--sp-text-2)]">Date | Time | Event | Description</span>
                              </span>
                              <span className="text-[10.5px] font-semibold text-[var(--sp-text-2)]">
                                {scan.rows.length
                                  ? `${scan.rows.length} ${scan.rows.length === 1 ? "line" : "lines"} · ${scan.ok} with a date`
                                  : "Nothing typed yet"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="planner-timezone" className="mb-2 block text-[12px] font-semibold">
                          Schedule timezone
                        </label>
                        <div
                          className={cx(
                            "flex h-11 items-center gap-2 rounded-xl border bg-[var(--sp-bg)] pl-3 pr-1.5 transition focus-within:border-[var(--sp-gold)]",
                            timezoneValid ? "border-[var(--sp-line-strong)]" : "border-red-400",
                          )}
                        >
                          <Globe2 size={15} className="shrink-0 text-[var(--sp-text-3)]" />
                          <input
                            id="planner-timezone"
                            list="planner-timezones"
                            value={timezone}
                            onChange={(event) => setTimezone(event.target.value)}
                            placeholder="Europe/London"
                            aria-invalid={!timezoneValid}
                            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--sp-text)] outline-none"
                          />
                          {timezoneValid ? (
                            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" aria-label="Valid timezone" />
                          ) : null}
                          {timezone !== browserTimezone ? (
                            <button
                              type="button"
                              onClick={() => setTimezone(browserTimezone)}
                              title={`Use ${browserTimezone}`}
                              className="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[10.5px] font-semibold text-[var(--sp-text-2)] hover:bg-[var(--sp-muted-2)]"
                            >
                              <LocateFixed size={12} />
                              Mine
                            </button>
                          ) : null}
                        </div>
                        <datalist id="planner-timezones">
                          {COMMON_TIMEZONES.map((zone) => (
                            <option key={zone} value={zone} />
                          ))}
                        </datalist>
                        <p className={cx("mt-1.5 text-[10.5px]", timezoneValid ? "text-[var(--sp-text-3)]" : "text-red-600")}>
                          {timezoneValid ? "Times in your schedule are read in this zone." : "That timezone isn't recognised."}
                        </p>
                      </div>

                      <div>
                        <label htmlFor="planner-name" className="mb-2 block text-[12px] font-semibold">
                          Schedule name
                        </label>
                        <input
                          id="planner-name"
                          value={importName}
                          onChange={(event) => setImportName(event.target.value)}
                          maxLength={150}
                          placeholder="November content calendar"
                          className="sp-input !h-11 !text-[12.5px]"
                        />
                        <p className="mt-1.5 text-[10.5px] text-[var(--sp-text-3)]">Helps you find this import later.</p>
                      </div>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_FILES}
                      onChange={onFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* Side guide */}
                  <aside className="space-y-4">
                    <div className="rounded-[20px] border border-[var(--sp-line)] bg-[var(--sp-muted)] p-4">
                      <p className="text-[12px] font-semibold">
                        {mode === "upload" ? "File checklist" : "Quick check"}
                      </p>

                      {mode === "upload" ? (
                        <ul className="mt-3 space-y-2.5 text-[11px] leading-5 text-[var(--sp-text-2)]">
                          <GuideItem>PDF and Word: a table with one row per event works best.</GuideItem>
                          <GuideItem>You&apos;ll see the text we read and can tidy it before review.</GuideItem>
                          <GuideItem>CSV: first row holds column names such as Date, Time and Title.</GuideItem>
                          <GuideItem>Dates as 2026-11-03, times as 10:00.</GuideItem>
                          <GuideItem>Scanned PDFs (photos of pages) have no text to read.</GuideItem>
                        </ul>
                      ) : scan.rows.length ? (
                        <ul className="mt-3 space-y-1.5">
                          {scan.rows.slice(0, 6).map((row, index) => (
                            <li
                              key={`${index}-${row.line}`}
                              className="flex items-center gap-2.5 rounded-[11px] border border-[var(--sp-line)] bg-[var(--sp-bg)] px-2.5 py-2"
                            >
                              <span
                                className={cx(
                                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                                  row.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                                )}
                              >
                                {row.ok ? <Check size={11} strokeWidth={3} /> : <Minus size={11} strokeWidth={3} />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[11px] font-semibold">{row.title}</span>
                                <span className="block truncate text-[10px] text-[var(--sp-text-3)]">
                                  {[row.date || "No date", row.time].filter(Boolean).join(" · ")}
                                </span>
                              </span>
                            </li>
                          ))}
                          {scan.rows.length > 6 ? (
                            <li className="px-1 pt-1 text-[10.5px] text-[var(--sp-text-3)]">
                              and {scan.rows.length - 6} more
                            </li>
                          ) : null}
                        </ul>
                      ) : (
                        <p className="mt-2 text-[11px] leading-5 text-[var(--sp-text-3)]">
                          Start typing and each line will show here, so you can spot missing dates early.
                        </p>
                      )}
                    </div>

                    <div className="rounded-[20px] border border-[var(--sp-line)] p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[color-mix(in_srgb,var(--sp-gold)_14%,white)] text-[var(--sp-gold)]">
                          <ShieldCheck size={15} />
                        </span>
                        <div>
                          <p className="text-[12px] font-semibold">Nothing is added without you</p>
                          <p className="mt-1 text-[11px] leading-5 text-[var(--sp-text-2)]">
                            Review, fix and pick events on the next step. Supports text, PDF, Word, CSV and TXT.
                          </p>
                        </div>
                      </div>
                      <button type="button" onClick={downloadCsvTemplate} className="sp-btn-secondary mt-4 w-full">
                        <FileSpreadsheet size={14} />
                        Download CSV template
                      </button>
                    </div>
                  </aside>
                </div>
              )}

              {step === "review" && (
                <div className="pb-6">
                  {/* Sticky toolbar */}
                  <div className="sticky top-0 z-10 border-b border-[var(--sp-line)] bg-[var(--sp-bg)]/95 px-5 pb-4 pt-5 backdrop-blur sm:px-7">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h3 className="text-[20px] font-semibold tracking-[-0.035em]">Review your schedule</h3>
                        <p className="mt-1 text-[12px] text-[var(--sp-text-2)]">
                          {counts.total} found ·{" "}
                          <span className="font-semibold text-emerald-700">{counts.ready} ready</span>
                          {counts.needsReview ? (
                            <>
                              {" "}·{" "}
                              <span className="font-semibold text-amber-700">{counts.needsReview} to fix</span>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--sp-line)] bg-[var(--sp-muted)] px-3 py-1.5 text-[10.5px] font-semibold text-[var(--sp-text-2)]">
                        <Clock3 size={12} />
                        {timezone}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <SelectAllBox
                        checked={allReadySelected}
                        indeterminate={someSelected}
                        disabled={counts.ready === 0}
                        onChange={() => selectAll(!allReadySelected)}
                      />

                      <div role="tablist" aria-label="Filter events" className="flex flex-wrap gap-1 rounded-xl bg-[var(--sp-muted-2)] p-1">
                        {(
                          [
                            ["all", "All", counts.total],
                            ["ready", "Ready", counts.ready],
                            ["review", "To fix", counts.needsReview],
                            ["selected", "Selected", counts.selected],
                          ] as Array<[ReviewFilter, string, number]>
                        ).map(([value, label, count]) => (
                          <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={reviewFilter === value}
                            onClick={() => setReviewFilter(value)}
                            className={cx(
                              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition",
                              reviewFilter === value
                                ? "bg-[var(--sp-bg)] text-[var(--sp-text)] shadow-sm"
                                : "text-[var(--sp-text-3)] hover:text-[var(--sp-text)]",
                            )}
                          >
                            {label}
                            <span
                              className={cx(
                                "rounded-md px-1.5 py-px text-[9.5px] tabular-nums",
                                reviewFilter === value
                                  ? value === "review"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-[var(--sp-gold)] text-[var(--sp-gold-ink)]"
                                  : "bg-[var(--sp-bg)]/70",
                              )}
                            >
                              {count}
                            </span>
                          </button>
                        ))}
                      </div>

                      <label className="ml-auto flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-[var(--sp-line-strong)] px-3 transition focus-within:border-[var(--sp-gold)] sm:max-w-[280px]">
                        <Search size={14} className="text-[var(--sp-text-3)]" />
                        <input
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          placeholder="Search events"
                          aria-label="Search extracted events"
                          className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--sp-text)] outline-none placeholder:text-[var(--sp-text-3)]"
                        />
                        {searchQuery ? (
                          <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search" className="text-[var(--sp-text-3)] hover:text-[var(--sp-text)]">
                            <X size={13} />
                          </button>
                        ) : null}
                      </label>
                    </div>
                  </div>

                  {/* Grouped list */}
                  <div className="px-5 pt-5 sm:px-7">
                    {groups.length === 0 ? (
                      <div className="rounded-[20px] border border-dashed border-[var(--sp-line-strong)] py-14 text-center">
                        <Search size={22} className="mx-auto text-[var(--sp-text-3)]" />
                        <p className="mt-3 text-[13px] font-semibold">No events here</p>
                        <p className="mt-1 text-[11.5px] text-[var(--sp-text-3)]">Try another filter or clear the search.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {groups.map((group) => (
                          <section key={group.key}>
                            <div className="mb-2.5 flex items-center gap-3">
                              <span
                                className={cx(
                                  "flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-semibold",
                                  group.key === "unscheduled"
                                    ? "bg-amber-100 text-amber-900"
                                    : "bg-[color-mix(in_srgb,var(--sp-gold)_14%,white)] text-[var(--sp-text)]",
                                )}
                              >
                                <CalendarDays size={13} />
                                {group.heading}
                              </span>
                              <span className="h-px flex-1 bg-[var(--sp-line)]" />
                              <span className="text-[10.5px] font-medium text-[var(--sp-text-3)]">
                                {group.items.length} {group.items.length === 1 ? "event" : "events"}
                              </span>
                            </div>

                            <div className="space-y-2">
                              {group.items.map((item) => (
                                <PlannerEventCard
                                  key={item.key}
                                  item={item}
                                  expanded={expandedKey === item.key}
                                  rechecking={recheckingKey === item.key}
                                  timezone={timezone}
                                  isManager={isManager}
                                  onToggleExpanded={() =>
                                    setExpandedKey((current) => (current === item.key ? null : item.key))
                                  }
                                  onToggleSelected={() => toggleSelection(item.key)}
                                  onUpdateEvent={(updates) => updateEvent(item.key, updates)}
                                  onUpdateSource={(updates) => updateSource(item.key, updates)}
                                  onRecheck={() => void recheckRow(item.key)}
                                  onRemove={() => removeRow(item.key)}
                                />
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    )}

                    <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[var(--sp-text-3)]">
                      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--sp-gold)]" />
                      Syntra Grid checks selected events again before creating them. Duplicates may be skipped. Up to{" "}
                      {MAX_IMPORT_EVENTS} events per import.
                    </p>
                  </div>
                </div>
              )}

              {step === "complete" && importResult && <CompleteStep result={importResult} timezone={timezone} />}
            </div>

            {/* Error */}
            <AnimatePresence>
              {error ? (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="mx-5 mb-3 flex shrink-0 items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11.5px] font-medium text-red-700 sm:mx-7"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button type="button" onClick={() => setError("")} aria-label="Dismiss error" className="rounded p-0.5 hover:bg-red-100">
                    <X size={13} />
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Footer */}
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--sp-line)] bg-[var(--sp-muted)] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
              {step === "input" && (
                <>
                  <button type="button" onClick={close} disabled={busy} className="sp-btn-secondary">
                    Cancel
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="hidden items-center gap-1 text-[10.5px] text-[var(--sp-text-3)] md:inline-flex">
                      <Kbd>Ctrl</Kbd>
                      <Kbd>Enter</Kbd>
                    </span>
                    <button
                      type="button"
                      onClick={() => void generatePreview()}
                      disabled={processing || extracting || !canCreate}
                      className="sp-btn-primary"
                    >
                      {processing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                      {processing ? "Reading your schedule…" : "Review schedule"}
                      {!processing && <ArrowRight size={14} />}
                    </button>
                  </div>
                </>
              )}

              {step === "review" && (
                <>
                  <button type="button" onClick={() => setStep("input")} disabled={busy} className="sp-btn-secondary">
                    <ArrowLeft size={14} />
                    Back
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="hidden text-[11.5px] text-[var(--sp-text-2)] sm:inline">
                      <span className="font-semibold text-[var(--sp-text)]">{counts.selected}</span> of {counts.ready} ready
                      selected
                    </span>
                    <button
                      type="button"
                      onClick={() => void importSelected()}
                      disabled={importing || counts.selected === 0 || recheckingKey !== null}
                      className="sp-btn-primary"
                    >
                      {importing ? <Loader2 size={15} className="animate-spin" /> : <CalendarCheck2 size={15} />}
                      {importing
                        ? "Adding to calendar…"
                        : `Add ${counts.selected} ${counts.selected === 1 ? "event" : "events"}`}
                    </button>
                  </div>
                </>
              )}

              {step === "complete" && (
                <>
                  <button type="button" onClick={reset} className="sp-btn-secondary">
                    <RefreshCw size={14} />
                    New import
                  </button>
                  <button type="button" onClick={close} className="sp-btn-primary">
                    <Check size={15} />
                    Done
                  </button>
                </>
              )}
            </footer>
          </motion.div>

          <style>{PLANNER_CSS}</style>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* =============================================================================
   SCOPED STYLES
============================================================================= */

const PLANNER_CSS = `
.sp-panel { font-family: var(--font-sans), Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.sp-panel *:focus-visible { outline: 2px solid var(--sp-gold); outline-offset: 2px; }

.sp-btn-primary {
  display: inline-flex; height: 42px; align-items: center; justify-content: center; gap: 9px;
  border: 0; border-radius: 13px; background: var(--sp-gold); padding: 0 18px;
  color: var(--sp-gold-ink); font-size: 12px; font-weight: 650; white-space: nowrap; cursor: pointer;
  box-shadow: 0 10px 24px -12px var(--sp-gold), inset 0 1px 0 rgba(255,255,255,0.25);
  transition: transform 150ms ease, filter 150ms ease, opacity 150ms ease;
}
.sp-btn-primary:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
.sp-btn-primary:disabled { cursor: not-allowed; opacity: 0.45; box-shadow: none; }

.sp-btn-secondary {
  display: inline-flex; min-height: 40px; align-items: center; justify-content: center; gap: 8px;
  border: 1px solid var(--sp-line-strong); border-radius: 12px; padding: 0 14px;
  background: var(--sp-bg); color: var(--sp-text); font-size: 11.5px; font-weight: 600; white-space: nowrap; cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}
.sp-btn-secondary:hover:not(:disabled) { background: var(--sp-muted-2); }
.sp-btn-secondary:disabled { cursor: not-allowed; opacity: 0.45; }

.sp-icon-btn {
  display: flex; width: 38px; height: 38px; flex-shrink: 0; align-items: center; justify-content: center;
  border: 1px solid var(--sp-line); border-radius: 12px; background: var(--sp-bg); color: var(--sp-text-2); cursor: pointer;
  transition: background 150ms ease;
}
.sp-icon-btn:hover:not(:disabled) { background: var(--sp-muted-2); color: var(--sp-text); }
.sp-icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.sp-link {
  display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; padding: 4px 6px; border-radius: 8px;
  color: var(--sp-gold); font-size: 11px; font-weight: 650; cursor: pointer; filter: brightness(0.85);
}
.sp-link:hover { background: color-mix(in srgb, var(--sp-gold) 10%, white); }

.sp-input {
  width: 100%; height: 40px; border: 1px solid var(--sp-line-strong); border-radius: 11px; background: var(--sp-bg);
  padding: 0 12px; font-size: 12px; color: var(--sp-text); outline: none; transition: border-color 150ms ease, box-shadow 150ms ease;
}
.sp-input::placeholder { color: var(--sp-text-3); }
.sp-input:focus { border-color: var(--sp-gold); box-shadow: 0 0 0 4px color-mix(in srgb, var(--sp-gold) 14%, transparent); }
.sp-input:disabled { opacity: 0.45; background: var(--sp-muted); }

.sp-field-label { display: block; margin-bottom: 6px; font-size: 11px; font-weight: 600; color: var(--sp-text-2); }
`;

/* =============================================================================
   STEPPER
============================================================================= */

function Stepper({ step }: { step: PlannerStep }) {
  const steps: Array<{ id: PlannerStep; label: string; hint: string }> = [
    { id: "input", label: "Prepare", hint: "Add your schedule" },
    { id: "review", label: "Review", hint: "Check and choose" },
    { id: "complete", label: "Import", hint: "Added to calendar" },
  ];
  const index = steps.findIndex((item) => item.id === step);

  return (
    <ol className="relative grid grid-cols-3 gap-2 px-5 pb-4 sm:px-7">
      {steps.map((item, position) => {
        const done = position < index;
        const active = position === index;
        return (
          <li key={item.id} className="min-w-0">
            <div className={cx("h-1 rounded-full transition-colors", done || active ? "bg-[var(--sp-gold)]" : "bg-[var(--sp-line)]")} />
            <div className="mt-2.5 flex items-center gap-2">
              <span
                className={cx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold",
                  done || active
                    ? "bg-[var(--sp-gold)] text-[var(--sp-gold-ink)]"
                    : "border border-[var(--sp-line-strong)] text-[var(--sp-text-3)]",
                )}
              >
                {done ? <Check size={12} strokeWidth={3} /> : position + 1}
              </span>
              <span className="min-w-0">
                <span className={cx("block truncate text-[11.5px] font-semibold", active || done ? "text-[var(--sp-text)]" : "text-[var(--sp-text-3)]")}>
                  {item.label}
                </span>
                <span className="hidden truncate text-[10px] text-[var(--sp-text-3)] sm:block">{item.hint}</span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* =============================================================================
   INPUT PIECES
============================================================================= */

function ModeTab({
  active,
  icon,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cx(
        "flex items-center gap-3 rounded-[16px] border p-3 text-left transition",
        active
          ? "border-[var(--sp-gold)] bg-[color-mix(in_srgb,var(--sp-gold)_8%,white)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--sp-gold)_14%,transparent)]"
          : "border-[var(--sp-line)] bg-[var(--sp-bg)] hover:border-[var(--sp-line-strong)] hover:bg-[var(--sp-muted)]",
      )}
    >
      <span
        className={cx(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]",
          active ? "bg-[var(--sp-gold)] text-[var(--sp-gold-ink)]" : "bg-[var(--sp-muted-2)] text-[var(--sp-text-2)]",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-semibold text-[var(--sp-text)]">{title}</span>
        <span className="hidden truncate text-[10.5px] text-[var(--sp-text-3)] sm:block">{hint}</span>
      </span>
    </button>
  );
}

function GuideItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check size={13} className="mt-1 shrink-0 text-[var(--sp-gold)]" strokeWidth={2.6} />
      <span>{children}</span>
    </li>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-[var(--sp-line-strong)] bg-[var(--sp-bg)] px-1.5 text-[9.5px] font-semibold text-[var(--sp-text-2)]">
      {children}
    </kbd>
  );
}

function UploadArea({
  file,
  extracting,
  dragging,
  onDraggingChange,
  onChooseFile,
  onBrowse,
  onRemove,
}: {
  file: File | null;
  extracting: boolean;
  dragging: boolean;
  onDraggingChange: (value: boolean) => void;
  onChooseFile: (file: File | null) => void;
  onBrowse: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        onDraggingChange(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        onDraggingChange(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDraggingChange(false);
        onChooseFile(event.dataTransfer.files[0] ?? null);
      }}
      className={cx(
        "flex min-h-[280px] flex-col items-center justify-center rounded-[22px] border-2 border-dashed p-6 text-center transition",
        dragging
          ? "scale-[1.01] border-[var(--sp-gold)] bg-[color-mix(in_srgb,var(--sp-gold)_8%,white)]"
          : "border-[var(--sp-line-strong)] bg-[var(--sp-muted)]",
      )}
    >
      {extracting ? (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--sp-bg)] text-[var(--sp-gold)] shadow-sm ring-1 ring-[var(--sp-line)]">
            <Loader2 size={22} className="animate-spin" />
          </span>
          <p className="mt-4 text-[14px] font-semibold">Reading your document…</p>
          <p className="mt-1 text-[11.5px] text-[var(--sp-text-3)]">This happens on your device. Nothing is added yet.</p>
        </>
      ) : file ? (
        <div className="flex w-full max-w-[420px] items-center gap-3 rounded-[16px] border border-[var(--sp-line)] bg-[var(--sp-bg)] p-3 text-left shadow-sm">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[color-mix(in_srgb,var(--sp-gold)_14%,white)] text-[var(--sp-gold)]">
            <FileSpreadsheet size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold">{file.name}</span>
            <span className="mt-0.5 flex items-center gap-1 text-[10.5px] text-emerald-700">
              <CheckCircle2 size={11} />
              {(file.size / 1024).toFixed(1)} KB · ready to read
            </span>
          </span>
          <button type="button" onClick={onRemove} aria-label="Remove file" className="sp-icon-btn !h-9 !w-9 hover:!text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <>
          <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--sp-bg)] text-[var(--sp-gold)] shadow-sm ring-1 ring-[var(--sp-line)]">
            <Upload size={22} />
          </span>
          <p className="mt-4 text-[14px] font-semibold">{dragging ? "Drop to upload" : "Drop your schedule here"}</p>
          <p className="mt-1 text-[11.5px] text-[var(--sp-text-3)]">or choose it from your computer</p>
          <button type="button" data-autofocus onClick={onBrowse} className="sp-btn-primary mt-5">
            <FolderUp size={14} />
            Choose file
          </button>
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            {["PDF", "Word .docx", "CSV", "TXT"].map((label) => (
              <span key={label} className="rounded-md border border-[var(--sp-line)] bg-[var(--sp-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--sp-text-2)]">
                {label}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] text-[var(--sp-text-3)]">PDF and Word up to 15 MB · CSV and TXT up to 1 MB</p>
        </>
      )}
    </div>
  );
}

/* =============================================================================
   REVIEW PIECES
============================================================================= */

function SelectAllBox({
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      disabled={disabled}
      onClick={onChange}
      className="sp-btn-secondary !min-h-10 !gap-2.5 !pl-2.5"
    >
      <CheckMark checked={checked} indeterminate={indeterminate} />
      {checked ? "Deselect all" : "Select all ready"}
    </button>
  );
}

function CheckMark({ checked, indeterminate = false, disabled = false }: { checked: boolean; indeterminate?: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border-2 transition",
        checked || indeterminate
          ? "border-[var(--sp-gold)] bg-[var(--sp-gold)] text-[var(--sp-gold-ink)]"
          : disabled
            ? "border-[var(--sp-line)] bg-[var(--sp-muted)]"
            : "border-[var(--sp-line-strong)] bg-[var(--sp-bg)]",
      )}
    >
      {indeterminate ? <Minus size={12} strokeWidth={3.5} /> : checked ? <Check size={12} strokeWidth={3.5} /> : null}
    </span>
  );
}

function PlannerEventCard({
  item,
  expanded,
  rechecking,
  timezone,
  isManager,
  onToggleExpanded,
  onToggleSelected,
  onUpdateEvent,
  onUpdateSource,
  onRecheck,
  onRemove,
}: {
  item: PlannerEvent;
  expanded: boolean;
  rechecking: boolean;
  timezone: string;
  isManager: boolean;
  onToggleExpanded: () => void;
  onToggleSelected: () => void;
  onUpdateEvent: (updates: Partial<CalendarEventPayload>) => void;
  onUpdateSource: (updates: Partial<RawScheduleRow>) => void;
  onRecheck: () => void;
  onRemove: () => void;
}) {
  const ready = item.status === "ready" && Boolean(item.event);
  const title = item.event?.title || item.source.title || "Untitled event";
  const meta = typeMeta(item.event?.type ?? item.source.type);
  const time = item.event
    ? item.event.allDay
      ? "All day"
      : formatTimeOnly(item.event.startAt, timezone)
    : item.source.time || "No time";
  const endTime = item.event && !item.event.allDay && item.event.endAt ? formatTimeOnly(item.event.endAt, timezone) : null;
  const duration = item.event ? durationLabel(item.event.startAt, item.event.endAt) : null;
  const highPriority = item.event?.priority === "HIGH" || item.event?.priority === "URGENT";

  return (
    <div
      className={cx(
        "overflow-hidden rounded-[18px] border transition",
        !ready
          ? "border-amber-300 bg-amber-50/60"
          : item.selected
            ? "border-[color-mix(in_srgb,var(--sp-gold)_55%,white)] bg-[var(--sp-bg)] shadow-[0_8px_24px_-16px_var(--sp-gold)]"
            : "border-[var(--sp-line)] bg-[var(--sp-bg)] opacity-80 hover:opacity-100",
      )}
    >
      <div className="flex items-stretch">
        {/* Selection zone */}
        <button
          type="button"
          role="checkbox"
          aria-checked={ready && item.selected}
          disabled={!ready}
          onClick={onToggleSelected}
          aria-label={ready ? `${item.selected ? "Deselect" : "Select"} ${title}` : `${title} needs fixing before it can be selected`}
          className="flex shrink-0 items-center pl-4 pr-3 disabled:cursor-not-allowed"
        >
          <CheckMark checked={ready && item.selected} disabled={!ready} />
        </button>

        <span className="my-3 w-[4px] shrink-0 rounded-full" style={{ background: ready ? meta.color : "#F59E0B" }} />

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-4 py-3.5 pl-4 pr-2 text-left"
        >
          <span className="w-[62px] shrink-0">
            <span className="block text-[14px] font-semibold tabular-nums tracking-[-0.02em]">{time}</span>
            <span className="block text-[10px] text-[var(--sp-text-3)]">
              {endTime ? `to ${endTime}` : duration ?? (ready ? "" : "to fix")}
            </span>
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold">{title}</span>
              {highPriority ? (
                <span className="shrink-0 rounded-md bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-red-700">
                  {item.event?.priority === "URGENT" ? "Urgent" : "High"}
                </span>
              ) : null}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-[var(--sp-text-2)]">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                {meta.label}
              </span>
              {item.event?.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={11} />
                  {item.event.location}
                </span>
              ) : null}
              {item.event?.meetingUrl ? (
                <span className="inline-flex items-center gap-1">
                  <Video size={11} />
                  Online
                </span>
              ) : null}
              {!ready ? (
                <span className="font-semibold text-amber-800">
                  {item.source.date || "No date"} · row {item.row}
                </span>
              ) : null}
            </span>
          </span>

          <span
            className={cx(
              "hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:inline-flex",
              ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800",
            )}
          >
            {ready ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
            {ready ? "Ready" : "Needs a fix"}
          </span>

          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--sp-text-3)]">
            {expanded ? <ChevronDown size={16} className="rotate-180 transition-transform" /> : <Pencil size={14} />}
          </span>
        </button>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${title}`}
          className="flex w-11 shrink-0 items-center justify-center border-l border-[var(--sp-line)] text-[var(--sp-text-3)] transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {item.issues.length > 0 && !expanded ? (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex w-full items-start gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-left text-[11px] leading-5 text-amber-900 hover:bg-amber-100/60"
        >
          <AlertCircle size={13} className="mt-1 shrink-0" />
          <span className="flex-1">{item.issues.join(" ")}</span>
          <span className="shrink-0 font-semibold underline underline-offset-2">Fix it</span>
        </button>
      ) : null}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--sp-line)] bg-[var(--sp-muted)] p-4 sm:p-5">
              {ready && item.event ? (
                <EventEditor event={item.event} isManager={isManager} onUpdate={onUpdateEvent} />
              ) : (
                <SourceRowEditor
                  source={item.source}
                  issues={item.issues}
                  rechecking={rechecking}
                  onUpdate={onUpdateSource}
                  onRecheck={onRecheck}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =============================================================================
   EVENT EDITOR

   Date and time inputs are explicitly UTC so nothing is silently converted
   between the browser and server timezones.
============================================================================= */

function EventEditor({
  event,
  isManager,
  onUpdate,
}: {
  event: CalendarEventPayload;
  isManager: boolean;
  onUpdate: (updates: Partial<CalendarEventPayload>) => void;
}) {
  const scopes = isManager ? SCOPES : SCOPES.filter((scope) => scope.value === "PERSONAL");

  return (
    <div className="space-y-4">
      <PlannerField label="Event title">
        <input value={event.title} onChange={(input) => onUpdate({ title: input.target.value })} className="sp-input !h-11 !text-[13px] !font-semibold" />
      </PlannerField>

      <div>
        <span className="sp-field-label">Type</span>
        <div className="flex flex-wrap gap-1.5">
          {EVENT_TYPES.map((type) => {
            const selected = (event.type || "OTHER") === type.value;
            return (
              <button
                key={type.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onUpdate({ type: type.value })}
                className={cx(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition",
                  selected
                    ? "border-transparent text-white"
                    : "border-[var(--sp-line-strong)] bg-[var(--sp-bg)] text-[var(--sp-text-2)] hover:border-[var(--sp-text-3)]",
                )}
                style={selected ? { background: type.color } : undefined}
              >
                {!selected ? <span className="h-2 w-2 rounded-full" style={{ background: type.color }} /> : <Check size={12} strokeWidth={3} />}
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PlannerField label="Starts (UTC)">
          <input
            type="datetime-local"
            value={utcInputValue(event.startAt)}
            onChange={(input) => {
              const value = fromUtcInput(input.target.value);
              if (value) onUpdate({ startAt: value });
            }}
            className="sp-input [color-scheme:light]"
          />
        </PlannerField>

        <PlannerField label="Ends (UTC)">
          <input
            type="datetime-local"
            value={utcInputValue(event.endAt)}
            disabled={Boolean(event.allDay)}
            onChange={(input) => onUpdate({ endAt: fromUtcInput(input.target.value) })}
            className="sp-input [color-scheme:light]"
          />
        </PlannerField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="sp-field-label">Priority</span>
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-[var(--sp-muted-2)] p-1">
            {PRIORITIES.map((priority) => {
              const selected = (event.priority || "NORMAL") === priority.value;
              return (
                <button
                  key={priority.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onUpdate({ priority: priority.value })}
                  className={cx(
                    "h-8 rounded-lg text-[11px] font-semibold transition",
                    selected
                      ? priority.value === "HIGH" || priority.value === "URGENT"
                        ? "bg-red-600 text-white shadow-sm"
                        : "bg-[var(--sp-bg)] text-[var(--sp-text)] shadow-sm"
                      : "text-[var(--sp-text-3)] hover:text-[var(--sp-text)]",
                  )}
                >
                  {priority.label}
                </button>
              );
            })}
          </div>
        </div>

        <PlannerField label="Who can see it">
          <select
            value={event.scope || "PERSONAL"}
            onChange={(input) => onUpdate({ scope: input.target.value as EventScope })}
            className="sp-input"
          >
            {scopes.map((scope) => (
              <option key={scope.value} value={scope.value}>
                {scope.label}
              </option>
            ))}
          </select>
        </PlannerField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PlannerField label="Location">
          <input
            value={event.location || ""}
            onChange={(input) => onUpdate({ location: input.target.value })}
            placeholder="Optional"
            className="sp-input"
          />
        </PlannerField>
        <PlannerField label="Meeting link">
          <input
            value={event.meetingUrl || ""}
            onChange={(input) => onUpdate({ meetingUrl: input.target.value })}
            placeholder="Optional"
            className="sp-input"
          />
        </PlannerField>
      </div>

      <PlannerField label="Notes">
        <textarea
          value={event.description || ""}
          onChange={(input) => onUpdate({ description: input.target.value })}
          rows={3}
          className="sp-input !h-auto resize-y py-2.5 leading-5"
        />
      </PlannerField>

      <p className="flex items-start gap-2 text-[10.5px] leading-5 text-[var(--sp-text-3)]">
        <Clock3 size={12} className="mt-1 shrink-0" />
        Start and end in this editor are UTC. Your calendar shows them in its own local time.
      </p>
    </div>
  );
}

/* =============================================================================
   SOURCE ROW EDITOR (rows the preview could not read)
============================================================================= */

function SourceRowEditor({
  source,
  issues,
  rechecking,
  onUpdate,
  onRecheck,
}: {
  source: RawScheduleRow;
  issues: string[];
  rechecking: boolean;
  onUpdate: (updates: Partial<RawScheduleRow>) => void;
  onRecheck: () => void;
}) {
  return (
    <div>
      {issues.length ? (
        <div className="mb-4 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-[11.5px] font-semibold text-amber-900">What needs fixing</p>
          <ul className="mt-1.5 space-y-1">
            {issues.map((issue, index) => (
              <li key={index} className="flex items-start gap-2 text-[11px] leading-5 text-amber-900">
                <AlertCircle size={12} className="mt-1 shrink-0" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <PlannerField label="Event title">
          <input value={source.title} onChange={(input) => onUpdate({ title: input.target.value })} className="sp-input" />
        </PlannerField>
        <PlannerField label="Date">
          <input value={source.date} onChange={(input) => onUpdate({ date: input.target.value })} placeholder="2026-11-03" className="sp-input" />
        </PlannerField>
        <PlannerField label="Start time">
          <input value={source.time} onChange={(input) => onUpdate({ time: input.target.value })} placeholder="10:00" className="sp-input" />
        </PlannerField>
        <PlannerField label="End time">
          <input value={source.endTime} onChange={(input) => onUpdate({ endTime: input.target.value })} placeholder="10:30" className="sp-input" />
        </PlannerField>
        <PlannerField label="Duration in minutes">
          <input value={source.duration} onChange={(input) => onUpdate({ duration: input.target.value })} placeholder="30" className="sp-input" />
        </PlannerField>
        <PlannerField label="Type">
          <select value={source.type || "OTHER"} onChange={(input) => onUpdate({ type: input.target.value })} className="sp-input">
            {EVENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </PlannerField>
      </div>

      <PlannerField label="Notes" className="mt-4">
        <textarea
          value={source.description}
          onChange={(input) => onUpdate({ description: input.target.value })}
          rows={3}
          className="sp-input !h-auto resize-y py-2.5 leading-5"
        />
      </PlannerField>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[10.5px] text-[var(--sp-text-3)]">Rechecking validates this row again. Nothing is created yet.</p>
        <button type="button" onClick={onRecheck} disabled={rechecking} className="sp-btn-primary">
          {rechecking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {rechecking ? "Checking…" : "Recheck row"}
        </button>
      </div>
    </div>
  );
}

function PlannerField({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="sp-field-label">{label}</span>
      {children}
    </label>
  );
}

/* =============================================================================
   IMPORT COMPLETE
============================================================================= */

function CompleteStep({ result, timezone }: { result: ImportResponse; timezone: string }) {
  const hasImported = result.summary.imported > 0;

  return (
    <div className="px-5 py-8 sm:px-7">
      <div className="mx-auto max-w-[640px] text-center">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 18 }}
          className={cx(
            "mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[24px]",
            hasImported
              ? "bg-[var(--sp-gold)] text-[var(--sp-gold-ink)] shadow-[0_18px_40px_-16px_var(--sp-gold)]"
              : "bg-amber-100 text-amber-700",
          )}
        >
          {hasImported ? <CheckCheck size={32} /> : <CircleHelp size={32} />}
        </motion.span>

        <h3 className="mt-5 text-[25px] font-semibold tracking-[-0.045em]">
          {hasImported ? "Your schedule is on the calendar" : "No new events added"}
        </h3>
        <p className="mt-2 text-[12.5px] leading-6 text-[var(--sp-text-2)]">{result.message}</p>
      </div>

      <div className="mx-auto mt-7 grid max-w-[560px] grid-cols-3 gap-3">
        <ResultStat label="Submitted" value={result.summary.total} />
        <ResultStat label="Added" value={result.summary.imported} tone="gold" />
        <ResultStat label="Skipped" value={result.summary.skipped} tone={result.summary.skipped ? "amber" : "default"} />
      </div>

      <div className="mx-auto mt-7 grid max-w-[860px] gap-5 md:grid-cols-2">
        {result.imported.length > 0 && (
          <section>
            <h4 className="mb-2.5 text-[12.5px] font-semibold">Added to calendar</h4>
            <div className="overflow-hidden rounded-[18px] border border-[var(--sp-line)]">
              {result.imported.map((event) => (
                <div key={event.key} className="flex items-center gap-3 border-b border-[var(--sp-line)] px-4 py-3 last:border-b-0">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">{event.title}</p>
                    <p className="mt-0.5 text-[10.5px] text-[var(--sp-text-3)]">{formatDateTime(event.startAt, timezone)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {result.skipped.length > 0 && (
          <section>
            <h4 className="mb-2.5 text-[12.5px] font-semibold">Skipped</h4>
            <div className="overflow-hidden rounded-[18px] border border-amber-200">
              {result.skipped.map((event) => (
                <div key={event.key} className="flex items-start gap-3 border-b border-amber-100 bg-amber-50/50 px-4 py-3 last:border-b-0">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold">{event.title}</p>
                    <p className="mt-0.5 text-[10.5px] leading-5 text-amber-900">{event.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ResultStat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "gold" | "amber" }) {
  return (
    <div
      className={cx(
        "rounded-[18px] border p-4 text-center",
        tone === "gold"
          ? "border-[color-mix(in_srgb,var(--sp-gold)_45%,white)] bg-[color-mix(in_srgb,var(--sp-gold)_10%,white)]"
          : tone === "amber"
            ? "border-amber-200 bg-amber-50"
            : "border-[var(--sp-line)] bg-[var(--sp-muted)]",
      )}
    >
      <p className="text-[28px] font-semibold tabular-nums tracking-[-0.05em]">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-[var(--sp-text-2)]">{label}</p>
    </div>
  );
}