"use client";

// Restaurant Platform — onboarding and platform-level management for
// restaurants on the separate Restaurant Admin application. This never
// touches Restaurant Admin's Supabase project directly: every call goes
// through this app's own /api/admin/restaurant-platform routes, which
// hold the signing credential server-side and call Restaurant Admin's
// management API (lib/restaurant-platform/client.ts). Follows
// SystemsTab.tsx's exact structure and style constants — not reinvented.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  UtensilsCrossed,
  X,
} from "lucide-react";

import useSWR from "swr";
import { CLIENTS_ENDPOINT, fetchClientsPayload } from "@/lib/clients/clientsApi";
import {
  createRestaurantApi,
  fetchRestaurantDetail,
  fetchRestaurantsList,
  issueOwnerInvitationApi,
  retryProvisioningApi,
  setModuleEnabledApi,
  setRestaurantStatusApi,
  RestaurantPlatformApiError,
  type RemoteRestaurantStatus,
  type RestaurantDetail,
  type RestaurantListItem,
} from "@/lib/restaurant-platform/restaurantPlatformApi";

const CARD = "rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
const BTN_PRIMARY = "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 text-[11.5px] font-semibold text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50";
const BTN_SECONDARY = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[11.5px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-muted)]";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const STATUS_META: Record<RemoteRestaurantStatus, { label: string; colour: string; bg: string }> = {
  ACTIVE: { label: "Active", colour: "#059669", bg: "rgba(5,150,105,0.1)" },
  SUSPENDED: { label: "Suspended", colour: "#d97706", bg: "rgba(217,119,6,0.1)" },
  ARCHIVED: { label: "Archived", colour: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

function provisioningBadge(item: RestaurantListItem) {
  if (item.provisioningState === "PROVISIONED" && item.remoteStatus) {
    return STATUS_META[item.remoteStatus];
  }
  if (item.provisioningState === "FAILED") {
    return { label: "Provisioning failed", colour: "#dc2626", bg: "rgba(220,38,38,0.1)" };
  }
  return { label: "Pending onboarding", colour: "#6b7280", bg: "rgba(107,114,128,0.1)" };
}

type LoadStatus = "loading" | "ready" | "error";

export default function RestaurantPlatformTab() {
  const [items, setItems] = useState<RestaurantListItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(() => {
    setStatus("loading");
    setError(null);
    fetchRestaurantsList()
      .then((result) => {
        setItems(result);
        setStatus("ready");
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Could not load restaurants.");
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (item) => item.name.toLowerCase().includes(term) || (item.client?.name ?? "").toLowerCase().includes(term)
    );
  }, [items, search]);

  const counts = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.provisioningState === "PROVISIONED" && i.remoteStatus === "ACTIVE").length;
    const suspended = items.filter((i) => i.provisioningState === "PROVISIONED" && i.remoteStatus === "SUSPENDED").length;
    const pending = items.filter((i) => i.provisioningState !== "PROVISIONED").length;
    return { total, active, suspended, pending };
  }, [items]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--text)]">Restaurant Platform</h1>
          <p className="mt-1 max-w-[560px] text-[12px] leading-5 text-[var(--text-muted)]">
            Onboard and manage restaurants on the Restaurant Admin platform. Operational data (menus, orders, staff) stays in that application — this manages platform-level setup only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={status === "loading"} className={cx(BTN_SECONDARY, FOCUS, "h-9")}>
            <RefreshCw size={13} className={status === "loading" ? "animate-spin" : undefined} />
            Refresh
          </button>
          <button type="button" onClick={() => setCreateOpen(true)} className={cx(BTN_PRIMARY, FOCUS, "h-9")}>
            <Plus size={13} />
            Create Restaurant
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={cx(CARD, "p-3")}>
          <span className="block text-[15px] font-semibold text-[var(--text)]">{counts.total}</span>
          <span className="block text-[10px] text-[var(--text-muted)]">Total restaurants</span>
        </div>
        <div className={cx(CARD, "p-3")}>
          <span className="block text-[15px] font-semibold text-[var(--text)]">{counts.active}</span>
          <span className="block text-[10px] text-[var(--text-muted)]">Active</span>
        </div>
        <div className={cx(CARD, "p-3")}>
          <span className="block text-[15px] font-semibold text-[var(--text)]">{counts.suspended}</span>
          <span className="block text-[10px] text-[var(--text-muted)]">Suspended</span>
        </div>
        <div className={cx(CARD, "p-3")}>
          <span className="block text-[15px] font-semibold text-[var(--text)]">{counts.pending}</span>
          <span className="block text-[10px] text-[var(--text-muted)]">Pending onboarding</span>
        </div>
      </div>

      <div className={cx(CARD, "p-4")}>
        <div className="relative max-w-[280px]">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-subtle)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search restaurants…"
            className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-8 pr-3 text-[12px] text-[var(--text)]")}
          />
        </div>

        <div className="mt-4">
          {status === "loading" && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-[var(--text-subtle)]" />
            </div>
          )}

          {status === "error" && <p className="text-[12px] text-[var(--danger)]">{error}</p>}

          {status === "ready" && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <UtensilsCrossed size={22} className="text-[var(--text-subtle)]" />
              <p className="text-[12.5px] font-medium text-[var(--text)]">No restaurants yet</p>
              <p className="max-w-[360px] text-[11px] text-[var(--text-muted)]">Create a restaurant to onboard it onto the platform and invite its owner.</p>
            </div>
          )}

          {status === "ready" && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--line)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
                    <th className="px-2 py-2">Restaurant</th>
                    <th className="px-2 py-2">Client</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const badge = provisioningBadge(item);
                    return (
                      <tr key={item.id} onClick={() => setDetailId(item.id)} className="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-muted)]">
                        <td className="px-2 py-3">
                          <span className="block truncate text-[12.5px] font-medium text-[var(--text)]">{item.name}</span>
                          {item.externalSlug && <span className="block truncate text-[10px] text-[var(--text-subtle)]">{item.externalSlug}</span>}
                        </td>
                        <td className="px-2 py-3 text-[11px] text-[var(--text-muted)]">{item.client?.displayName || item.client?.name || "—"}</td>
                        <td className="px-2 py-3">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: badge.colour, backgroundColor: badge.bg }}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-[11px] text-[var(--text-muted)]">{new Date(item.createdAt).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <CreateRestaurantDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}

      {detailId && (
        <RestaurantDetailPanel managedSystemId={detailId} onClose={() => setDetailId(null)} onChanged={load} />
      )}
    </div>
  );
}

/* ============================================================================
   CREATE DIALOG
============================================================================ */

type ClientOption = { id: string; name: string; displayName: string | null };

function CreateRestaurantDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: clientsPayload } = useSWR(CLIENTS_ENDPOINT, fetchClientsPayload, { dedupingInterval: 60_000 });
  const clients = useMemo(() => (clientsPayload?.clients ?? []) as unknown as ClientOption[], [clientsPayload]);

  const [isNewClient, setIsNewClient] = useState(true);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ inviteLink: string | null } | null>(null);

  const submit = async () => {
    if (!name.trim() || !ownerEmail.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createRestaurantApi({
        name: name.trim(),
        ownerEmail: ownerEmail.trim(),
        currency: currency.trim().toUpperCase(),
        timezone: timezone.trim(),
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        clientId: !isNewClient && clientId ? clientId : undefined,
        newClient: isNewClient ? { name: name.trim() } : undefined,
      });
      setSuccess({ inviteLink: result.inviteLink });
    } catch (caught) {
      setError(caught instanceof RestaurantPlatformApiError ? caught.message : "Could not create this restaurant.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div role="dialog" aria-modal aria-label="Restaurant created" className="fixed inset-0 z-[320] flex items-center justify-center bg-black/55 p-4">
        <div className="w-full max-w-[460px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[var(--success)]" />
            <h3 className="text-[13px] font-semibold text-[var(--text)]">Restaurant created</h3>
          </div>
          {success.inviteLink ? (
            <>
              <p className="mt-2 text-[11.5px] leading-5 text-[var(--text-muted)]">
                Send this owner activation link — it is shown once and cannot be retrieved again. If it&apos;s lost, reissue a new one from the restaurant&apos;s detail page.
              </p>
              <div className="mt-3 break-all rounded-xl bg-[var(--surface-muted)] px-3 py-2 text-[11px] text-[var(--text)]">{success.inviteLink}</div>
            </>
          ) : (
            <p className="mt-2 text-[11.5px] leading-5 text-[var(--text-muted)]">
              This restaurant already existed from an earlier attempt — its invitation link was already shown once and can&apos;t be retrieved again. Reissue a new one from the restaurant&apos;s detail page.
            </p>
          )}
          <button type="button" onClick={() => { onCreated(); }} className={cx(BTN_PRIMARY, FOCUS, "mt-4 h-9 w-full")}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal aria-label="Create restaurant" className="fixed inset-0 z-[320] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-[460px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)]">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[var(--text)]">Create a restaurant</h3>
          <button type="button" onClick={onClose} aria-label="Close" className={cx(FOCUS, "flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]")}>
            <X size={14} />
          </button>
        </div>

        <div className="mt-3 max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
          <div>
            <label htmlFor="restaurant-name" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Restaurant name</label>
            <input id="restaurant-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Joe's Diner" className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
          </div>

          <div>
            <label htmlFor="restaurant-owner-email" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Owner email</label>
            <input id="restaurant-owner-email" type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="owner@restaurant.com" className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="restaurant-currency" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Currency</label>
              <input id="restaurant-currency" value={currency} onChange={(event) => setCurrency(event.target.value)} placeholder="USD" className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
            </div>
            <div>
              <label htmlFor="restaurant-timezone" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Timezone</label>
              <input id="restaurant-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="UTC" className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="restaurant-city" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">City</label>
              <input id="restaurant-city" value={city} onChange={(event) => setCity(event.target.value)} className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
            </div>
            <div>
              <label htmlFor="restaurant-country" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Country</label>
              <input id="restaurant-country" value={country} onChange={(event) => setCountry(event.target.value)} className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")} />
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1 text-[11.5px] text-[var(--text)]">
            <input type="checkbox" checked={isNewClient} onChange={(event) => setIsNewClient(event.target.checked)} />
            Create a new Syntra Grid client for this restaurant
          </label>

          {!isNewClient && (
            <div>
              <label htmlFor="restaurant-client" className="mb-1 block text-[10.5px] font-medium text-[var(--text-muted)]">Existing client</label>
              <select id="restaurant-client" value={clientId} onChange={(event) => setClientId(event.target.value)} className={cx(FOCUS, "h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)]")}>
                <option value="">Select a client…</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.displayName || client.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && <p className="mt-2 text-[11px] text-[var(--danger)]">{error}</p>}

        <button type="button" disabled={submitting || !name.trim() || !ownerEmail.trim() || (!isNewClient && !clientId)} onClick={() => void submit()} className={cx(BTN_PRIMARY, FOCUS, "mt-4 h-9 w-full disabled:opacity-50")}>
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Create restaurant
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   DETAIL PANEL
============================================================================ */

function RestaurantDetailPanel({ managedSystemId, onClose, onChanged }: { managedSystemId: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reissueEmail, setReissueEmail] = useState("");
  const [reissueLink, setReissueLink] = useState<string | null>(null);

  const reload = useCallback(() => {
    setStatus("loading");
    fetchRestaurantDetail(managedSystemId)
      .then((result) => {
        setDetail(result);
        setStatus("ready");
        setReissueEmail(result.remote?.email ?? "");
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : "Could not load this restaurant.");
        setStatus("error");
      });
  }, [managedSystemId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  const handleRetry = async () => {
    setBusy(true);
    try {
      const result = await retryProvisioningApi(managedSystemId);
      if (result.inviteLink) setReissueLink(result.inviteLink);
      reload();
      onChanged();
    } catch (caught) {
      setError(caught instanceof RestaurantPlatformApiError ? caught.message : "Retry failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (next: RemoteRestaurantStatus) => {
    if (!detail?.remote) return;
    setBusy(true);
    try {
      await setRestaurantStatusApi(managedSystemId, next);
      reload();
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleModuleToggle = async (moduleKey: string, enabled: boolean) => {
    setBusy(true);
    try {
      await setModuleEnabledApi(managedSystemId, moduleKey, enabled);
      reload();
    } finally {
      setBusy(false);
    }
  };

  const handleReissue = async () => {
    if (!reissueEmail.trim()) return;
    setBusy(true);
    try {
      const result = await issueOwnerInvitationApi(managedSystemId, reissueEmail.trim());
      setReissueLink(result.inviteLink);
      reload();
    } catch (caught) {
      setError(caught instanceof RestaurantPlatformApiError ? caught.message : "Could not issue the invitation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal aria-label="Restaurant detail" className="fixed inset-0 z-[300] flex justify-end bg-black/45" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="flex h-full w-full max-w-[560px] flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-popover)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
          <h2 className="text-[14px] font-semibold text-[var(--text)]">{detail?.remote?.name ?? "Restaurant"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={cx(FOCUS, "flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-subtle)] hover:bg-[var(--surface-muted)]")}>
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {status === "loading" && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-[var(--text-subtle)]" />
            </div>
          )}

          {status === "error" && <p className="text-[12px] text-[var(--danger)]">{error}</p>}

          {status === "ready" && detail && detail.provisioningState !== "PROVISIONED" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-xl bg-[rgba(220,38,38,0.08)] px-3 py-2.5 text-[11.5px] text-[var(--danger)]">
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  {detail.provisioningState === "FAILED" ? "Provisioning failed: " : "Provisioning pending: "}
                  {detail.provisioningError ?? "No further detail available."}
                </span>
              </div>
              <p className="text-[11.5px] text-[var(--text-muted)]">
                The local record exists but the restaurant has not been created on Restaurant Admin yet. Retrying reuses the exact same request — it will never create a duplicate.
              </p>
              <button type="button" disabled={busy} onClick={() => void handleRetry()} className={cx(BTN_PRIMARY, FOCUS, "h-9 w-full")}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Retry provisioning
              </button>
            </div>
          )}

          {status === "ready" && detail?.remote && (
            <div className="space-y-6">
              <div>
                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: STATUS_META[detail.remote.status].colour, backgroundColor: STATUS_META[detail.remote.status].bg }}>
                  {STATUS_META[detail.remote.status].label}
                </span>
                <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">{detail.remote.slug} · {detail.client?.displayName || detail.client?.name || "No linked client"}</p>
              </div>

              <section className="grid grid-cols-2 gap-2 text-[11px]">
                <span className="rounded-lg border border-[var(--line)] px-2.5 py-2 text-[var(--text-muted)]">Currency: {detail.remote.currency}</span>
                <span className="rounded-lg border border-[var(--line)] px-2.5 py-2 text-[var(--text-muted)]">Timezone: {detail.remote.timezone}</span>
                {detail.remote.city && <span className="rounded-lg border border-[var(--line)] px-2.5 py-2 text-[var(--text-muted)]">{[detail.remote.city, detail.remote.country].filter(Boolean).join(", ")}</span>}
              </section>

              <section>
                <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">Lifecycle</h3>
                <div className="mt-2 flex gap-2">
                  {(["ACTIVE", "SUSPENDED", "ARCHIVED"] as RemoteRestaurantStatus[]).map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      disabled={busy || detail.remote!.status === candidate}
                      onClick={() => void handleStatusChange(candidate)}
                      className={cx(BTN_SECONDARY, FOCUS, "h-8 px-2.5 text-[10.5px] disabled:opacity-40")}
                    >
                      {STATUS_META[candidate].label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">Modules</h3>
                <ul className="mt-2 space-y-1.5">
                  {[...detail.remote.enabledModules, ...detail.remote.disabledModules].sort().map((moduleKey) => {
                    const enabled = detail.remote!.enabledModules.includes(moduleKey);
                    return (
                      <li key={moduleKey} className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-[11.5px]">
                        <span className="text-[var(--text)]">{moduleKey}</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleModuleToggle(moduleKey, !enabled)}
                          className={cx(FOCUS, "rounded-full px-2 py-0.5 text-[10px] font-semibold", enabled ? "text-[var(--success)]" : "text-[var(--text-subtle)]")}
                          style={{ backgroundColor: enabled ? "rgba(5,150,105,0.1)" : "rgba(107,114,128,0.1)" }}
                        >
                          {enabled ? "Enabled" : "Disabled"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section>
                <h3 className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">Administrators</h3>
                {detail.invitations.length === 0 ? (
                  <p className="mt-2 text-[12px] text-[var(--text-muted)]">No invitations issued yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {detail.invitations.map((invitation) => (
                      <li key={invitation.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-[11px]">
                        <span className="min-w-0 truncate text-[var(--text)]">{invitation.email} · {invitation.role}</span>
                        <span className="shrink-0 flex items-center gap-1 text-[var(--text-subtle)]">
                          {invitation.status === "PENDING" && <Clock size={11} />}
                          {invitation.status === "ACCEPTED" && <CheckCircle2 size={11} className="text-[var(--success)]" />}
                          {invitation.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={reissueEmail}
                    onChange={(event) => setReissueEmail(event.target.value)}
                    placeholder="owner@restaurant.com"
                    className={cx(FOCUS, "h-8 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11.5px] text-[var(--text)]")}
                  />
                  <button type="button" disabled={busy || !reissueEmail.trim()} onClick={() => void handleReissue()} className={cx(BTN_SECONDARY, FOCUS, "h-8 px-2.5 text-[10.5px] disabled:opacity-40")}>
                    Reissue invite
                  </button>
                </div>
                {reissueLink && (
                  <div className="mt-2 break-all rounded-lg bg-[var(--surface-muted)] px-2.5 py-2 text-[10.5px] text-[var(--text)]">
                    {reissueLink}
                    <span className="mt-1 block text-[var(--text-subtle)]">Shown once — copy it now.</span>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
