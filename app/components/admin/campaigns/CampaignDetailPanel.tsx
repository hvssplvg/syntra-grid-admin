// app/components/admin/campaigns/CampaignDetailPanel.tsx
//
// The full per-campaign workspace (Team/Planner/Content/Audiences/
// Budget/Analytics/Approvals/Activity), reached from "Manage" on a
// campaign row. The top-level Planner/Content/Audiences/Budget/
// Analytics/Approvals tabs reuse the exact same section components via
// CampaignPicker — nothing here is duplicated logic.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, BarChart3, CalendarDays, ClipboardCheck, CircleDollarSign, FileText, Users, X } from "lucide-react";
import { campaignsApi, cx, FOCUS, IconButton, Spinner } from "./shared";
import { CampaignPlanner } from "./CampaignPlanner";
import { CampaignContentSection } from "./CampaignContentSection";
import { CampaignAudiencesSection } from "./CampaignAudiencesSection";
import { CampaignBudgetSection } from "./CampaignBudgetSection";
import { CampaignAnalyticsSection } from "./CampaignAnalyticsSection";
import { CampaignApprovalsSection } from "./CampaignApprovalsSection";
import { CampaignTeamSection } from "./CampaignTeamSection";

type DetailTab = "planner" | "content" | "audiences" | "budget" | "analytics" | "approvals" | "team" | "activity";

type CampaignDetail = { id: string; name: string; status: string; description: string | null };
type ActivityRow = { id: string; type: string; description: string | null; createdAt: string; actor: { firstName: string; lastName: string } | null };

const TABS: { id: DetailTab; label: string; icon: typeof Users }[] = [
  { id: "team", label: "Team", icon: Users },
  { id: "planner", label: "Planner", icon: CalendarDays },
  { id: "content", label: "Content", icon: FileText },
  { id: "audiences", label: "Audiences", icon: Users },
  { id: "budget", label: "Budget", icon: CircleDollarSign },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "approvals", label: "Approvals", icon: ClipboardCheck },
  { id: "activity", label: "Activity", icon: Activity },
];

function ActivityLog({ campaignId }: { campaignId: string }) {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    campaignsApi<{ activities: ActivityRow[] }>(`/${campaignId}/activity`)
      .then((payload) => setActivities(payload.activities))
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <Spinner />;
  if (activities.length === 0) return <p className="px-4 py-8 text-center text-[11.5px] text-[var(--text-muted)]">No activity recorded yet.</p>;

  return (
    <div className="divide-y divide-[var(--line)] overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
      {activities.map((a) => (
        <div key={a.id} className="px-4 py-3">
          <p className="text-[12px] text-[var(--text)]">{a.description ?? a.type}</p>
          <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
            {a.actor ? `${a.actor.firstName} ${a.actor.lastName}` : "System"} · {new Date(a.createdAt).toLocaleString("en-GB")}
          </p>
        </div>
      ))}
    </div>
  );
}

export function CampaignDetailPanel({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [tab, setTab] = useState<DetailTab>("team");

  const load = useCallback(() => {
    campaignsApi<{ campaign: CampaignDetail }>(`/${campaignId}`).then((payload) => setCampaign(payload.campaign));
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-[150] flex items-end justify-center bg-black/45 sm:items-center sm:p-6">
      <div role="dialog" aria-modal="true" className="flex h-[92dvh] w-full max-w-[860px] flex-col overflow-hidden rounded-t-[24px] border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:h-[86dvh] sm:rounded-[24px]">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-[var(--text)]">{campaign?.name ?? "Loading…"}</h2>
            {campaign?.description && <p className="mt-1 line-clamp-1 text-[11.5px] text-[var(--text-muted)]">{campaign.description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} bordered>
            <X size={15} />
          </IconButton>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--line)] px-3 py-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cx(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition-colors",
                  active ? "bg-[var(--surface-muted)] text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
                  FOCUS,
                )}
              >
                <Icon size={13} className={active ? "text-[var(--accent)]" : ""} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!campaign ? (
            <Spinner />
          ) : tab === "team" ? (
            <CampaignTeamSection campaignId={campaignId} />
          ) : tab === "planner" ? (
            <CampaignPlanner campaignId={campaignId} />
          ) : tab === "content" ? (
            <CampaignContentSection campaignId={campaignId} />
          ) : tab === "audiences" ? (
            <CampaignAudiencesSection campaignId={campaignId} />
          ) : tab === "budget" ? (
            <CampaignBudgetSection campaignId={campaignId} />
          ) : tab === "analytics" ? (
            <CampaignAnalyticsSection campaignId={campaignId} />
          ) : tab === "approvals" ? (
            <CampaignApprovalsSection campaignId={campaignId} />
          ) : (
            <ActivityLog campaignId={campaignId} />
          )}
        </div>
      </div>
    </div>
  );
}
