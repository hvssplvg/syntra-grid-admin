import { Clock3 } from "lucide-react";

import type { AdminModuleStatus } from "@/app/components/admin/adminNav";

/* ============================================================================
   MODULE STATUS BADGE

   The one place module-availability badges are styled. Fed by
   adminNav.ts's ADMIN_TABS[...].status — never render "Active"/"Soon"
   text locally in a tab component; read the real status from there.
============================================================================ */

const LABEL: Record<AdminModuleStatus, string> = {
  ACTIVE: "Active",
  IN_DEVELOPMENT: "In development",
  PLANNED: "Planned",
};

export function ModuleStatusBadge({
  status,
  className,
}: {
  status: AdminModuleStatus;
  className?: string;
}) {
  if (status === "ACTIVE") {
    return (
      <span
        className={[
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--success)]/15 bg-[var(--success-soft)] px-2 py-1 text-[7px] font-bold uppercase tracking-[0.08em] text-[var(--success)]",
          className ?? "",
        ].join(" ")}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
        {LABEL.ACTIVE}
      </span>
    );
  }

  if (status === "IN_DEVELOPMENT") {
    return (
      <span
        className={[
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--warning)]/15 bg-[var(--warning-soft)] px-2 py-1 text-[7px] font-bold uppercase tracking-[0.08em] text-[var(--warning)]",
          className ?? "",
        ].join(" ")}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
        {LABEL.IN_DEVELOPMENT}
      </span>
    );
  }

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-2 py-1 text-[7px] font-bold uppercase tracking-[0.08em] text-[var(--text-subtle)]",
        className ?? "",
      ].join(" ")}
    >
      <Clock3 size={8} strokeWidth={2} />
      {LABEL.PLANNED}
    </span>
  );
}
