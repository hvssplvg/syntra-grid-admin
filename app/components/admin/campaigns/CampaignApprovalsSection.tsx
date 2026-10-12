// app/components/admin/campaigns/CampaignApprovalsSection.tsx
"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Plus } from "lucide-react";
import { BTN_PRIMARY, BTN_SECONDARY, campaignsApi, cx, EmptyState, FOCUS, INPUT, LABEL, Spinner, StatusBadge, Toast, useNotice } from "./shared";

type Approval = {
  id: string;
  type: string;
  status: string;
  requestedBy: { firstName: string; lastName: string } | null;
  assignedApprover: { firstName: string; lastName: string } | null;
  createdAt: string;
};

const TYPES = ["LAUNCH", "BUDGET", "CONTENT", "EXPENSE", "CHANGE", "COMPLETION"];

export function CampaignApprovalsSection({ campaignId }: { campaignId: string }) {
  const { notice, setNotice, notify, notifyError } = useNotice();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState(TYPES[0]);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    campaignsApi<{ approvals: Approval[] }>(`/${campaignId}/approvals`)
      .then((payload) => setApprovals(payload.approvals))
      .catch((error) => notifyError(error, "Unable to load approvals."))
      .finally(() => setLoading(false));
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const request = async () => {
    setRequesting(true);
    try {
      await campaignsApi(`/${campaignId}/approvals`, { method: "POST", body: JSON.stringify({ type }) });
      notify("Approval requested.");
      load();
    } catch (error) {
      notifyError(error, "Unable to request this approval.");
    } finally {
      setRequesting(false);
    }
  };

  const decide = async (id: string, action: "approve" | "reject" | "request-changes") => {
    try {
      const body: Record<string, string> = {};
      if (action !== "approve") {
        const comment = window.prompt(action === "reject" ? "Reason for rejecting (required):" : "What needs to change (required):");
        if (!comment?.trim()) return;
        body.comment = comment.trim();
      }
      await campaignsApi(`/${campaignId}/approvals/${id}/${action}`, { method: "POST", body: JSON.stringify(body) });
      notify("Decision recorded.");
      load();
    } catch (error) {
      notifyError(error, "That decision could not be recorded.");
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className={LABEL}>Request type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={cx(INPUT, "h-10 px-3")}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => void request()} disabled={requesting} className={cx(BTN_PRIMARY, FOCUS)}>
          <Plus size={14} />
          Request approval
        </button>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
        {approvals.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No approval requests" description="Submit a request when this campaign — or a budget or content change — needs sign-off." />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {approvals.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-[var(--text)]">{a.type} approval</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
                    Requested by {a.requestedBy ? `${a.requestedBy.firstName} ${a.requestedBy.lastName}` : "—"}
                    {a.assignedApprover ? ` · Assigned to ${a.assignedApprover.firstName} ${a.assignedApprover.lastName}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge label={a.status} />
                  {a.status === "PENDING" && (
                    <>
                      <button type="button" onClick={() => void decide(a.id, "approve")} className={cx(BTN_PRIMARY, "h-7 px-2 text-[10px]", FOCUS)}>
                        Approve
                      </button>
                      <button type="button" onClick={() => void decide(a.id, "request-changes")} className={cx(BTN_SECONDARY, "h-7 px-2 text-[10px]", FOCUS)}>
                        Changes
                      </button>
                      <button type="button" onClick={() => void decide(a.id, "reject")} className={cx(BTN_SECONDARY, "h-7 px-2 text-[10px]", FOCUS)}>
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {notice && <Toast notice={notice} onDismiss={() => setNotice(null)} />}
    </div>
  );
}
