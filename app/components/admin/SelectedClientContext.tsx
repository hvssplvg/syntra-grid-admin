"use client";

// Shared "which client am I working on" state — the ONE piece of new
// cross-tab infrastructure the client-context switcher needs (audited
// first: nothing like this existed anywhere in the codebase; the
// switcher itself was purely cosmetic before this, read/written only by
// AdminHeader.tsx's own local state). Mirrors FullWorkspaceContext.tsx's
// proven shape (context + provider + hook) — a different concern
// (full-bleed layout vs. selected client), same pattern.
//
// Deliberately stores only the id, not a resolved client record:
// AdminHeader.tsx already fetches the full client list for its dropdown
// (useSWR(CLIENTS_ENDPOINT, ...)) — duplicating that fetch here would
// just be a second cache of the same data. Any consumer that needs the
// full record (name, logo, ...) already has or can fetch the client
// list and look up this id in it, exactly as AdminHeader already did
// before this context existed.
//
// Persistence (two ways, so deep links/refresh/back-forward all work):
// a `?client=` URL param (added/removed via history.replaceState, same
// pattern AdminHome.tsx already uses for `?tab=`/`?workspace=`) takes
// precedence when present; falls back to localStorage under the same
// key AdminHeader.tsx already used before this context existed, so an
// already-persisted choice still loads; null (company-wide) otherwise.
//
// NEVER a security boundary: ClientAssignment (see prisma/schema.prisma)
// is not enforced by any server route yet — selecting a client here
// only ever narrows what full-access-you chooses to look at. It must
// never be the sole gate in front of any API response.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const CLIENT_CONTEXT_STORAGE_KEY = "syntragrid.workspace-context";
const CLIENT_URL_PARAM = "client";

/** Fired only by an actual selectClient() call that changes the id — never
 *  by hydration (see the hydration effect below, which sets the raw state
 *  directly). ClientSwitchOverlay.tsx watches this to know when to play the
 *  branded transition, keyed on `token` so re-firing the same destination
 *  id still triggers a fresh overlay. */
type LastSwitch = { toClientId: string | null; token: number };

type SelectedClientContextValue = {
  /** null until the initial URL/localStorage read completes (client-side
   *  only) — consumers that persist a choice based on "nothing selected"
   *  should wait for this to avoid clobbering a value that's still
   *  loading. */
  hydrated: boolean;
  /** null means company-wide (Syntra Grid) — the default, and the only
   *  value possible on the server/before hydration. */
  selectedClientId: string | null;
  selectClient: (id: string | null) => void;
  /** See LastSwitch above. null until the first real switch happens. */
  lastSwitch: LastSwitch | null;
};

const SelectedClientContext = createContext<SelectedClientContextValue>({
  hydrated: false,
  selectedClientId: null,
  selectClient: () => {},
  lastSwitch: null,
});

function readUrlClientId(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get(CLIENT_URL_PARAM);
  return value && value !== "company" ? value : null;
}

function syncUrl(id: string | null) {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set(CLIENT_URL_PARAM, id);
  } else {
    url.searchParams.delete(CLIENT_URL_PARAM);
  }
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export function SelectedClientProvider({ children }: { children: ReactNode }) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [lastSwitch, setLastSwitch] = useState<LastSwitch | null>(null);
  const switchTokenRef = useRef(0);
  // Mirrors selectedClientId so selectClient (a stable, no-deps callback)
  // can compare against the current value synchronously without reading a
  // stale closure — kept in lockstep by the hydration effect below and by
  // selectClient itself, never read during render.
  const selectedClientIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fromUrl = readUrlClientId();
    if (fromUrl) {
      selectedClientIdRef.current = fromUrl;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedClientId(fromUrl);
      setHydrated(true);
      return;
    }

    try {
      const stored = window.localStorage.getItem(CLIENT_CONTEXT_STORAGE_KEY);
      // The pre-existing key's value was always either "company" or
      // `client:<id>` (see AdminHeader.tsx's COMPANY_CONTEXT/client
      // context ids) — only the second form selects an actual client.
      if (stored?.startsWith("client:")) {
        const id = stored.slice("client:".length);
        selectedClientIdRef.current = id;
        setSelectedClientId(id);
      }
    } catch {
      // Optional local preference.
    } finally {
      setHydrated(true);
    }
  }, []);

  const selectClient = useCallback((id: string | null) => {
    if (selectedClientIdRef.current !== id) {
      switchTokenRef.current += 1;
      setLastSwitch({ toClientId: id, token: switchTokenRef.current });
    }
    selectedClientIdRef.current = id;
    setSelectedClientId(id);
    syncUrl(id);
    try {
      window.localStorage.setItem(CLIENT_CONTEXT_STORAGE_KEY, id ? `client:${id}` : "company");
    } catch {
      // Optional local preference.
    }
  }, []);

  const value = useMemo(
    () => ({ hydrated, selectedClientId, selectClient, lastSwitch }),
    [hydrated, selectedClientId, selectClient, lastSwitch],
  );

  return <SelectedClientContext.Provider value={value}>{children}</SelectedClientContext.Provider>;
}

export function useSelectedClient() {
  return useContext(SelectedClientContext);
}
