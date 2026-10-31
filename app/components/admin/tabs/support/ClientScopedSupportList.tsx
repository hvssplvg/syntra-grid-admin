'use client';

/**
 * The real, per-client Support experience — shown by SupportTab.tsx in
 * place of its (pre-existing, unrelated) mocked company-wide ticket queue
 * whenever a client is selected in the header's client-context switcher.
 *
 * Reuses the same client-health detail fetch and the same SupportPanel
 * rendering already built for ClientWorkspace.tsx's own Support tab —
 * no new backend, no duplicated UI. Company-wide Support (no client
 * selected) is unchanged and out of scope here: rebuilding a real,
 * cross-client ticket queue is a separate, larger task.
 */

import { useCallback, useEffect, useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { fetchClientHealthDetail, type ClientHealthDetail } from '@/lib/client-health/clientHealthApi';
import { SupportPanel } from '@/app/components/clients/ClientWorkspace';
import { useSelectedClient } from '@/app/components/admin/SelectedClientContext';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export default function ClientScopedSupportList({ clientId }: { clientId: string }) {
  const { selectClient } = useSelectedClient();

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClientHealthDetail | null>(null);

  const load = useCallback(() => {
    setStatus('loading');
    setError(null);

    fetchClientHealthDetail(clientId)
      .then((result) => {
        setDetail(result);
        setStatus('ready');
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : 'Support data could not be loaded.');
        setStatus('error');
      });
  }, [clientId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetail(null);
    load();
  }, [load]);

  const clientName = detail?.client.displayName || detail?.client.name;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--text)]">Support</h1>
          <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
            {clientName ? `${clientName}'s support tickets, from real records.` : "This client's support tickets."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-[var(--line)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text)] hover:bg-[var(--surface-muted)]"
        >
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-[11.5px] text-[var(--text-muted)]">
        <LifeBuoy size={13} className="shrink-0 text-[var(--accent)]" />
        <span>
          Filtered to <span className="font-semibold text-[var(--text)]">{clientName || 'one client'}</span> — set from the header&apos;s client switcher.
        </span>
        <button
          type="button"
          onClick={() => selectClient(null)}
          className="ml-auto text-[11px] font-semibold text-[var(--accent)] hover:underline"
        >
          Show all clients
        </button>
      </div>

      <SupportPanel
        status={status}
        error={error}
        detail={detail}
        openCount={detail?.openTicketCount ?? 0}
        totalCount={detail?.tickets.length ?? 0}
      />
    </div>
  );
}
