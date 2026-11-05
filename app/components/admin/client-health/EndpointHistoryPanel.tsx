"use client";

// Monitoring history for one MonitoredEndpoint — read-only, built entirely
// from existing HealthCheck rows (no new table). Embedded as an expandable
// section under the endpoint row in ClientHealthTab.tsx (admin, full
// controls) and mirrored read-only in ClientWorkspace.tsx's health panel.
//
// Chart follows this session's dataviz pass: a single response-time series
// needs no legend (one series only), uses the app's own theme-aware
// --accent token rather than a hand-picked hex so light/dark both work
// automatically, and status is encoded separately via the existing
// --success/--warning/--danger tokens (already used for exactly this
// purpose elsewhere, e.g. ProjectsTab.tsx's STATUS_TONE) rather than
// reusing the line's color for a second, unrelated meaning. The table
// beneath the chart is the accessible fallback view, not an afterthought.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fetchEndpointHistoryApi, type EndpointHistoryRange, type EndpointHistoryResult } from "@/lib/client-health/clientHealthApi";

const RANGES: Array<{ id: EndpointHistoryRange; label: string }> = [
  { id: "24h", label: "24h" },
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
];

const STATUS_COLOR: Record<string, string> = {
  HEALTHY: "var(--success, #16a34a)",
  DEGRADED: "var(--warning, #d97706)",
  OFFLINE: "var(--danger, #dc2626)",
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function EndpointHistoryPanel({ endpointId }: { endpointId: string }) {
  const [range, setRange] = useState<EndpointHistoryRange>("24h");
  const [result, setResult] = useState<EndpointHistoryResult | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    fetchEndpointHistoryApi(endpointId, range)
      .then((payload) => {
        if (cancelled) return;
        setResult(payload);
        setStatus("ready");
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "Could not load monitoring history.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [endpointId, range]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    return load();
  }, [load]);

  const chartData = useMemo(
    () =>
      (result?.checks ?? []).map((check) => ({
        checkedAt: check.checkedAt,
        responseTimeMs: check.responseTimeMs,
        status: check.status,
        statusCode: check.statusCode,
      })),
    [result],
  );

  return (
    <div className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-[var(--surface-muted)] p-0.5">
          {RANGES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRange(option.id)}
              className={cx(
                "rounded-md px-2 py-1 text-[10px] font-semibold transition-colors",
                range === option.id ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-subtle)] hover:text-[var(--text)]",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {result && (
          <span className="text-[10px] font-semibold text-[var(--text-subtle)]">
            {result.uptimePercent === null ? "No observed uptime yet" : `${result.uptimePercent.toFixed(1)}% observed uptime`}
          </span>
        )}
      </div>

      {status === "loading" && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={16} className="animate-spin text-[var(--text-subtle)]" />
        </div>
      )}

      {status === "error" && <p className="mt-3 text-[11px] text-[var(--danger)]">{error}</p>}

      {status === "ready" && result && result.totalChecks === 0 && (
        <p className="mt-3 text-[11px] text-[var(--text-muted)]">No checks have been recorded yet for this range.</p>
      )}

      {status === "ready" && result && result.totalChecks > 0 && (
        <>
          {result.insufficientData && (
            <p className="mt-2 text-[9.5px] leading-4 text-[var(--text-subtle)]">
              Not enough history yet for a reliable uptime figure in this range — shown numbers are observed from {result.totalChecks} real check{result.totalChecks === 1 ? "" : "s"} only, not a guarantee of continuous uptime.
            </p>
          )}

          {!result.insufficientData && (
            <p className="mt-2 text-[9.5px] leading-4 text-[var(--text-subtle)]">
              Observed from {result.totalChecks} real checks in this range — not a guarantee of continuous uptime between them.
            </p>
          )}

          <div className="mt-3 h-[110px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis dataKey="checkedAt" tickFormatter={(value) => formatTimestamp(value)} tick={{ fontSize: 9, fill: "var(--text-subtle)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} minTickGap={40} />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-subtle)" }} axisLine={false} tickLine={false} width={34} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as (typeof chartData)[number];
                    return (
                      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-2.5 py-1.5 text-[10px] shadow-[var(--shadow-popover)]">
                        <p className="font-semibold text-[var(--text)]">{formatTimestamp(point.checkedAt)}</p>
                        <p style={{ color: STATUS_COLOR[point.status] ?? "var(--text-muted)" }} className="font-medium">
                          {point.status} {point.statusCode ? `· HTTP ${point.statusCode}` : ""}
                        </p>
                        <p className="text-[var(--text-muted)]">{point.responseTimeMs ?? "?"}ms</p>
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="responseTimeMs" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex flex-wrap gap-[2px]" aria-hidden="true">
            {chartData.map((point, index) => (
              <span
                key={index}
                title={`${formatTimestamp(point.checkedAt)} · ${point.status}`}
                className="h-2 w-2 rounded-[2px]"
                style={{ background: STATUS_COLOR[point.status] ?? "var(--text-subtle)" }}
              />
            ))}
          </div>

          <div className="mt-3 max-h-[160px] overflow-y-auto rounded-lg border border-[var(--line)]">
            <table className="w-full text-left text-[10px]">
              <caption className="sr-only">Recent check results</caption>
              <thead className="sticky top-0 bg-[var(--surface-muted)] text-[var(--text-subtle)]">
                <tr>
                  <th scope="col" className="px-2 py-1 font-semibold">Checked at</th>
                  <th scope="col" className="px-2 py-1 font-semibold">Status</th>
                  <th scope="col" className="px-2 py-1 font-semibold">HTTP</th>
                  <th scope="col" className="px-2 py-1 font-semibold">Response</th>
                </tr>
              </thead>
              <tbody>
                {chartData
                  .slice()
                  .reverse()
                  .map((point, index) => (
                    <tr key={index} className="border-t border-[var(--line)] text-[var(--text)]">
                      <td className="px-2 py-1">{formatTimestamp(point.checkedAt)}</td>
                      <td className="px-2 py-1" style={{ color: STATUS_COLOR[point.status] ?? undefined }}>
                        {point.status}
                      </td>
                      <td className="px-2 py-1">{point.statusCode ?? "—"}</td>
                      <td className="px-2 py-1">{point.responseTimeMs ?? "—"}ms</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
