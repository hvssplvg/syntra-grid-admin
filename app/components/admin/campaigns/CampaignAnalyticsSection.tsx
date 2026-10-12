// app/components/admin/campaigns/CampaignAnalyticsSection.tsx
"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, Plus, Target, Upload } from "lucide-react";
import { BTN_PRIMARY, BTN_SECONDARY, campaignsApi, cx, EmptyState, FOCUS, INPUT, LABEL, Spinner, StatusBadge, Toast, useNotice } from "./shared";

type Kpi = { id: string; name: string; metric: string; targetValue: number; actualValue: number; status: string; deadline: string | null };
type Dashboard = { hasMetrics: boolean; kpis: Kpi[]; byType: { metricType: string; value: number }[]; byChannel: { channel: string | null; value: number }[] };

const METRICS = [
  "IMPRESSIONS", "REACH", "ENGAGEMENT", "ENGAGEMENT_RATE", "CLICKS", "CTR", "LEADS", "CONVERSIONS",
  "CONVERSION_RATE", "CPC", "CPL", "CPA", "REVENUE_ATTRIBUTED", "ROAS", "ROI", "BUDGET_UTILISATION",
];

export function CampaignAnalyticsSection({ campaignId }: { campaignId: string }) {
  const { notice, setNotice, notify, notifyError } = useNotice();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [metric, setMetric] = useState(METRICS[0]);
  const [target, setTarget] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    campaignsApi<{ dashboard: Dashboard }>(`/${campaignId}/analytics`)
      .then((payload) => setDashboard(payload.dashboard))
      .catch((error) => notifyError(error, "Unable to load analytics."))
      .finally(() => setLoading(false));
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const createKpi = async () => {
    const value = Number(target);
    if (!name.trim() || !Number.isFinite(value) || value < 0) {
      notifyError(new Error("A name and non-negative target are required."), "A name and non-negative target are required.");
      return;
    }
    setCreating(true);
    try {
      await campaignsApi(`/${campaignId}/kpis`, { method: "POST", body: JSON.stringify({ name, metric, targetValue: value }) });
      setName("");
      setTarget("");
      notify("KPI created.");
      load();
    } catch (error) {
      notifyError(error, "Unable to create this KPI.");
    } finally {
      setCreating(false);
    }
  };

  const importCsv = async (file: File) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await campaignsApi<{ imported: number; errors: string[] }>(`/${campaignId}/metrics/import`, { method: "POST", body: formData });
      notify(`Imported ${result.imported} metric${result.imported === 1 ? "" : "s"}.${result.errors.length > 0 ? ` ${result.errors.length} row(s) had errors.` : ""}`);
      load();
    } catch (error) {
      notifyError(error, "Unable to import this CSV.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading || !dashboard) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text)]">
            <Target size={14} className="text-[var(--accent)]" />
            KPIs
          </h3>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-b border-[var(--line)] px-4 py-3">
          <div className="flex-1 min-w-[160px]">
            <label className={LABEL}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={cx(INPUT, "h-9 px-3")} placeholder="e.g. Generate 500 leads" />
          </div>
          <div>
            <label className={LABEL}>Metric</label>
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className={cx(INPUT, "h-9 px-3")}>
              {METRICS.map((m) => (
                <option key={m} value={m}>
                  {m.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Target</label>
            <input type="number" min={0} value={target} onChange={(e) => setTarget(e.target.value)} className={cx(INPUT, "h-9 w-28 px-3")} />
          </div>
          <button type="button" onClick={() => void createKpi()} disabled={creating} className={cx(BTN_PRIMARY, FOCUS)}>
            <Plus size={14} />
            Add
          </button>
        </div>

        {dashboard.kpis.length === 0 ? (
          <EmptyState icon={Target} title="No KPIs set" description="Define measurable targets for this campaign." />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {dashboard.kpis.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-[var(--text)]">{k.name}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
                    {Number(k.actualValue).toLocaleString("en-GB")} / {Number(k.targetValue).toLocaleString("en-GB")} ({k.metric.replaceAll("_", " ")})
                  </p>
                </div>
                <StatusBadge label={k.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text)]">
            <BarChart3 size={14} className="text-[var(--accent)]" />
            Metrics
          </h3>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importCsv(file);
              }}
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing} className={cx(BTN_SECONDARY, FOCUS)}>
              <Upload size={13} />
              Import CSV
            </button>
          </div>
        </div>

        {!dashboard.hasMetrics ? (
          <EmptyState icon={BarChart3} title="No analytics available yet" description="Import a CSV or record metrics manually once channels report real numbers." />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[10.5px] font-semibold text-[var(--text-muted)]">By metric type</p>
              <div className="space-y-1.5">
                {dashboard.byType.map((row) => (
                  <div key={row.metricType} className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-muted)]">{row.metricType.replaceAll("_", " ")}</span>
                    <span className="font-medium text-[var(--text)]">{row.value.toLocaleString("en-GB")}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10.5px] font-semibold text-[var(--text-muted)]">By channel</p>
              <div className="space-y-1.5">
                {dashboard.byChannel.map((row) => (
                  <div key={row.channel ?? "none"} className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-muted)]">{row.channel ?? "Unspecified"}</span>
                    <span className="font-medium text-[var(--text)]">{row.value.toLocaleString("en-GB")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {(["summary", "budget", "performance"] as const).map((type) => (
          <a key={type} href={`/api/admin/campaigns/${campaignId}/reports/${type}`} className={cx(BTN_SECONDARY, FOCUS)}>
            Export {type}
          </a>
        ))}
      </div>

      {notice && <Toast notice={notice} onDismiss={() => setNotice(null)} />}
    </div>
  );
}
