// app/components/admin/campaigns/shared.tsx
//
// Shared style tokens, primitives and API helper for every Campaigns
// sub-section component (Planner/Content/Audiences/Budget/Analytics/
// Approvals/detail). Kept separate from CampaignsTab.tsx's own local
// copies of the same primitives — each admin tab file in this codebase
// is already self-contained (BrandAssetsTab/SocialMediaTab each have
// their own copies too) — but shared across this directory since these
// components are all new and genuinely reused by each other.
"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";
export const BTN_PRIMARY =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 text-[11.5px] font-semibold text-white transition-[filter,transform,opacity] duration-150 hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
export const BTN_SECONDARY =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[11.5px] font-semibold text-[var(--text)] transition-[background-color,transform,opacity] duration-150 hover:bg-[var(--surface-muted)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
export const BTN_DANGER =
  "inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-red-600 px-3.5 text-[11.5px] font-semibold text-white transition-[background-color,transform,opacity] duration-150 hover:bg-red-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
export const INPUT =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[12px] text-[var(--text)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--accent)_14%,transparent)]";
export const LABEL = "mb-1.5 block text-[11px] font-semibold text-[var(--text)]";

export type Notice = { id: number; message: string; tone: "success" | "error" };

export function useNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const notify = (message: string) => setNotice({ id: Date.now(), message, tone: "success" });
  const notifyError = (error: unknown, fallback: string) =>
    setNotice({ id: Date.now(), message: error instanceof Error ? error.message : fallback, tone: "error" });
  return { notice, setNotice, notify, notifyError };
}

export function Toast({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className={cx(
        "fixed bottom-5 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[12px] font-medium shadow-lg",
        notice.tone === "success" ? "border-emerald-500/25 bg-[var(--surface)] text-[var(--text)]" : "border-red-500/25 bg-[var(--surface)] text-[var(--text)]",
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

export function IconButton({
  label,
  onClick,
  bordered,
  children,
}: {
  label: string;
  onClick: () => void;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:text-[var(--text)]",
        bordered ? "border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]" : "hover:bg-[var(--surface-muted)]",
        FOCUS,
      )}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; description: string }) {
  return (
    <div className="flex min-h-[160px] flex-col items-center justify-center px-5 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
        <Icon size={18} />
      </div>
      <h3 className="mt-3 text-[12.5px] font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-1 max-w-[320px] text-[11px] leading-5 text-[var(--text-muted)]">{description}</p>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex min-h-[160px] items-center justify-center">
      <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
    </div>
  );
}

export function StatusBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">
      {label
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())}
    </span>
  );
}

export type DialogRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger";
  onConfirm: () => Promise<void>;
};

export function ConfirmDialog({ request, onClose }: { request: DialogRequest; onClose: () => void }) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await request.onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-[400px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-2xl">
        <h2 className="text-[14px] font-semibold text-[var(--text)]">{request.title}</h2>
        <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-muted)]">{request.description}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className={cx(BTN_SECONDARY, FOCUS)}>
            Cancel
          </button>
          <button type="button" onClick={() => void confirm()} disabled={busy} className={cx(request.tone === "danger" ? BTN_DANGER : BTN_PRIMARY, FOCUS)}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : null}
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   API — a separate base from Social Media/Brand Assets; Campaigns has its
   own permission scope throughout (lib/campaigns/permissions.ts).
============================================================================ */

const API_BASE = "/api/admin/campaigns";

export class ApiError extends Error {}

export async function campaignsApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...init,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new ApiError(payload?.error ?? "Something went wrong.");
  }

  return payload as T;
}

export type OptionsData = {
  clients: { id: string; name: string; slug: string }[];
  projects: { id: string; name: string; clientId: string }[];
  departments: { id: string; name: string }[];
  employees: { id: string; firstName: string; lastName: string; jobTitle: string; departmentId: string | null }[];
};

export async function fetchCampaignOptions(): Promise<OptionsData> {
  const payload = await campaignsApi<{ ok: true } & OptionsData>("/options");
  return payload;
}

export function employeeName(employee: { firstName: string; lastName: string } | null | undefined): string {
  if (!employee) return "—";
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-GB")}`;
  }
}

export function formatDateShort(value: string | Date | null): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
