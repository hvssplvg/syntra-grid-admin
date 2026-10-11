"use client";

import {
  BarChart3,
  Clock3,
  Sparkles,
} from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="flex min-h-[420px] w-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-[520px] text-center">

        {/* Module icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] border border-[var(--line)] bg-[var(--surface)] text-[var(--accent)] shadow-sm">
          <BarChart3
            size={22}
            strokeWidth={1.7}
          />
        </div>

        {/* Status */}
        <div className="mt-5 flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
            <Clock3
              size={9}
              strokeWidth={2}
            />
            Planned module
          </span>
        </div>

        {/* Title */}
        <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.035em] text-[var(--text)]">
          Analytics
        </h2>

        {/* Description */}
        <p className="mx-auto mt-2 max-w-[430px] text-[13px] leading-6 text-[var(--text-muted)]">
          The Syntra Grid analytics workspace is being prepared.
          Business performance, operational insights, reports and
          analytics tools will appear here once connected.
        </p>

        {/* Branding */}
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[9px] font-semibold text-[var(--text-muted)] shadow-sm">
          <Sparkles
            size={11}
            strokeWidth={1.8}
            className="text-[var(--accent)]"
          />
          Syntra Grid
        </div>

      </div>
    </div>
  );
}