// app/components/admin/campaigns/CampaignBudgetSection.tsx
"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { CircleDollarSign, Plus } from "lucide-react";
import { BTN_PRIMARY, BTN_SECONDARY, campaignsApi, cx, EmptyState, formatMoney, FOCUS, INPUT, LABEL, Spinner, StatusBadge, Toast, useNotice } from "./shared";

type Summary = {
  currency: string;
  totalBudget: number | null;
  totalSpent: number;
  remaining: number | null;
  isOverBudget: boolean;
  byCategory: { category: string; currency: string; amount: number }[];
  otherCurrencyChannelSpend: { currency: string; amount: number }[];
};
type Expense = { id: string; description: string; category: string; amount: number; currency: string; expenseDate: string; approvalStatus: string; recordedBy: { firstName: string; lastName: string } | null };

const CATEGORIES = ["PAID_ADVERTISING", "CONTENT_PRODUCTION", "GRAPHIC_DESIGN", "VIDEO_PRODUCTION", "INFLUENCER_MARKETING", "EVENTS", "SOFTWARE_AND_TOOLS", "PHOTOGRAPHY", "PRINTING", "OTHER"];

export function CampaignBudgetSection({ campaignId }: { campaignId: string }) {
  const { notice, setNotice, notify, notifyError } = useNotice();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recording, setRecording] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      campaignsApi<{ summary: Summary }>(`/${campaignId}/budget/summary`),
      campaignsApi<{ expenses: Expense[] }>(`/${campaignId}/expenses`),
    ])
      .then(([s, e]) => {
        setSummary(s.summary);
        setExpenses(e.expenses);
      })
      .catch((error) => notifyError(error, "Unable to load the budget."))
      .finally(() => setLoading(false));
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const recordExpense = async () => {
    const value = Number(amount);
    if (!description.trim() || !Number.isFinite(value) || value < 0) {
      notifyError(new Error("A description and non-negative amount are required."), "A description and non-negative amount are required.");
      return;
    }
    setRecording(true);
    try {
      await campaignsApi(`/${campaignId}/expenses`, { method: "POST", body: JSON.stringify({ description, category, amount: value, expenseDate: date }) });
      setDescription("");
      setAmount("");
      notify("Expense recorded.");
      load();
    } catch (error) {
      notifyError(error, "Unable to record this expense.");
    } finally {
      setRecording(false);
    }
  };

  const decide = async (id: string, decision: "approve" | "reject") => {
    try {
      await campaignsApi(`/${campaignId}/expenses/${id}/${decision}`, { method: "POST" });
      notify(decision === "approve" ? "Expense approved." : "Expense rejected.");
      load();
    } catch (error) {
      notifyError(error, "That action could not be completed.");
    }
  };

  if (loading || !summary) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="text-[10.5px] text-[var(--text-muted)]">Budget</p>
          <p className="mt-1 text-[19px] font-semibold text-[var(--text)]">{summary.totalBudget != null ? formatMoney(summary.totalBudget, summary.currency) : "Not set"}</p>
        </div>
        <div className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="text-[10.5px] text-[var(--text-muted)]">Spent</p>
          <p className="mt-1 text-[19px] font-semibold text-[var(--text)]">{formatMoney(summary.totalSpent, summary.currency)}</p>
        </div>
        <div className={cx("rounded-[14px] border p-4", summary.isOverBudget ? "border-red-500/30 bg-red-500/5" : "border-[var(--line)] bg-[var(--surface)]")}>
          <p className="text-[10.5px] text-[var(--text-muted)]">Remaining</p>
          <p className={cx("mt-1 text-[19px] font-semibold", summary.isOverBudget ? "text-red-600" : "text-[var(--text)]")}>
            {summary.remaining != null ? formatMoney(summary.remaining, summary.currency) : "—"}
          </p>
        </div>
      </div>

      {summary.otherCurrencyChannelSpend.length > 0 && (
        <p className="text-[10.5px] text-[var(--text-subtle)]">
          Also recorded: {summary.otherCurrencyChannelSpend.map((row) => formatMoney(row.amount, row.currency)).join(", ")} — tracked separately, not converted or combined above.
        </p>
      )}

      <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-end gap-2 border-b border-[var(--line)] px-4 py-3">
          <div className="flex-1 min-w-[160px]">
            <label className={LABEL}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={cx(INPUT, "h-9 px-3")} placeholder="e.g. Facebook Ads — week 1" />
          </div>
          <div>
            <label className={LABEL}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={cx(INPUT, "h-9 px-3")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Amount</label>
            <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={cx(INPUT, "h-9 w-28 px-3")} />
          </div>
          <div>
            <label className={LABEL}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cx(INPUT, "h-9 px-3")} />
          </div>
          <button type="button" onClick={() => void recordExpense()} disabled={recording} className={cx(BTN_PRIMARY, FOCUS)}>
            <Plus size={14} />
            Record
          </button>
        </div>

        {expenses.length === 0 ? (
          <EmptyState icon={CircleDollarSign} title="No expenses recorded" description="Record spending against this campaign's budget." />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-[var(--text)]">{e.description}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
                    {e.category.replaceAll("_", " ")} · {formatMoney(e.amount, e.currency)} · {new Date(e.expenseDate).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge label={e.approvalStatus} />
                  {e.approvalStatus === "PENDING" && (
                    <>
                      <button type="button" onClick={() => void decide(e.id, "approve")} className={cx(BTN_PRIMARY, "h-7 px-2 text-[10px]", FOCUS)}>
                        Approve
                      </button>
                      <button type="button" onClick={() => void decide(e.id, "reject")} className={cx(BTN_SECONDARY, "h-7 px-2 text-[10px]", FOCUS)}>
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
