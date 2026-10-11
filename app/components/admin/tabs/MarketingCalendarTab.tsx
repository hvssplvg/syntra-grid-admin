"use client";

import { CalendarDays, Clock3 } from "lucide-react";

/**
 * Initial empty state only. Marketing events and scheduled posts will be
 * connected after the Social Media and Campaigns modules have real data.
 * No dummy dates, campaigns, or publishing jobs are displayed.
 */
export default function MarketingCalendarTab() {
  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <section className="rounded-[26px] border border-[var(--line)] bg-[var(--surface)] px-5 py-6 shadow-sm sm:px-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--text)]">
            <CalendarDays size={20} strokeWidth={1.8} />
          </span>
          <div>
            <h1 className="text-[21px] font-semibold tracking-[-0.03em] text-[var(--text)]">Marketing Calendar</h1>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">Campaign milestones, content schedules and marketing deadlines.</p>
          </div>
        </div>
      </section>
      <section className="mt-5 flex min-h-[340px] flex-col items-center justify-center rounded-[26px] border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--text-muted)]">
          <Clock3 size={24} strokeWidth={1.6} />
        </span>
        <h2 className="mt-5 text-[16px] font-semibold text-[var(--text)]">No marketing activities yet</h2>
        <p className="mt-2 max-w-[460px] text-[12px] leading-6 text-[var(--text-muted)]">
          This calendar will display actual scheduled posts and campaign deadlines when those modules are connected. Nothing has been scheduled yet.
        </p>
        <span className="mt-5 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1.5 text-[10px] font-semibold text-[var(--text-muted)]">
          Integration pending
        </span>
      </section>
    </div>
  );
}
