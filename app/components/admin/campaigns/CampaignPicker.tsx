// app/components/admin/campaigns/CampaignPicker.tsx
//
// Planner/Content/Audiences/Budget/Analytics/Approvals are all built as
// per-campaign workspaces (every API route in this module is nested
// under /api/admin/campaigns/[id]/...) — there is no cross-campaign
// aggregation endpoint yet. Each of those top-level tabs asks the caller
// to pick a campaign first rather than silently showing nothing or fake
// aggregated data. A richer cross-campaign board is a real follow-up, not
// something faked here.
"use client";

import { useEffect, useState } from "react";
import { FolderKanban } from "lucide-react";
import { campaignsApi, cx, EmptyState, INPUT, Spinner } from "./shared";

type CampaignOption = { id: string; name: string; status: string };

export function CampaignPicker({
  selectedId,
  onSelect,
  title,
  description,
}: {
  selectedId: string | null;
  onSelect: (id: string, name: string) => void;
  title: string;
  description: string;
}) {
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    campaignsApi<{ campaigns: CampaignOption[] }>("?pageSize=100")
      .then((payload) => setCampaigns(payload.campaigns))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  if (campaigns.length === 0) {
    return <EmptyState icon={FolderKanban} title="No campaigns yet" description="Create a campaign first, then come back here to plan it." />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-semibold text-[var(--text)]">{title}</h3>
        <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">{description}</p>
      </div>

      <select
        value={selectedId ?? ""}
        onChange={(event) => {
          const campaign = campaigns.find((c) => c.id === event.target.value);
          if (campaign) onSelect(campaign.id, campaign.name);
        }}
        className={cx(INPUT, "h-10 max-w-[360px] px-3")}
      >
        <option value="" disabled>
          Select a campaign
        </option>
        {campaigns.map((campaign) => (
          <option key={campaign.id} value={campaign.id}>
            {campaign.name} ({campaign.status})
          </option>
        ))}
      </select>
    </div>
  );
}
