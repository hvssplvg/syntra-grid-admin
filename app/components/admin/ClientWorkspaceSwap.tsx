'use client';

/**
 * Renders ClientWorkspace standalone, for departments that swap their own
 * content area for a client's workspace when one is selected (Executive's
 * Overview, Technology's Monitoring landing, Finance's placeholder tabs —
 * see adminNav.ts's CLIENT_WORKSPACE_SWAP_TABS in AdminHome.tsx).
 *
 * ClientWorkspace itself takes `accountOwners`/`optionsLoading` as props
 * (used only by its "Edit client" modal's owner dropdown) because
 * ClientsTab.tsx already fetches them once for its own use. Every other
 * caller doesn't have that fetch sitting around, so this wrapper fetches
 * the same /api/admin/client-options payload itself rather than widening
 * ClientWorkspace's own props to make them optional.
 */

import { useEffect, useState } from 'react';
import ClientWorkspace, { type WorkspaceTab } from '../clients/ClientWorkspace';

type AccountOwner = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatarUrl: string | null;
  role?: string;
};

type ClientOptionsResponse = {
  ok: boolean;
  accountOwners?: AccountOwner[];
  error?: string;
};

export default function ClientWorkspaceSwap({
  clientId,
  initialTab,
  onBack,
}: {
  clientId: string;
  initialTab?: WorkspaceTab;
  onBack: () => void;
}) {
  const [accountOwners, setAccountOwners] = useState<AccountOwner[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // optionsLoading already starts true — this effect only ever runs
    // once (empty deps), so there's nothing to re-arm here.
    fetch('/api/admin/client-options', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then((response) => response.json().catch(() => ({ ok: false })))
      .then((payload: ClientOptionsResponse) => {
        if (cancelled) return;
        if (payload.ok) setAccountOwners(payload.accountOwners ?? []);
      })
      .catch(() => {
        // Only used by the "Edit client" modal's owner dropdown — a
        // failed fetch just leaves it empty, not a workspace-breaking error.
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ClientWorkspace
      clientId={clientId}
      onBack={onBack}
      accountOwners={accountOwners}
      optionsLoading={optionsLoading}
      initialTab={initialTab}
    />
  );
}
