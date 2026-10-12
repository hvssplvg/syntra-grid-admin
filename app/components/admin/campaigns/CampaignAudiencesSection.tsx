// app/components/admin/campaigns/CampaignAudiencesSection.tsx
"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { BTN_PRIMARY, BTN_SECONDARY, campaignsApi, cx, EmptyState, FOCUS, IconButton, INPUT, LABEL, Spinner, Toast, useNotice } from "./shared";

type Audience = { id: string; name: string; category: string; estimatedSize: number | null; isEstimate: boolean };
type Assignment = { id: string; audience: Audience };

export function CampaignAudiencesSection({ campaignId }: { campaignId: string }) {
  const { notice, setNotice, notify, notifyError } = useNotice();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [library, setLibrary] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedToAssign, setSelectedToAssign] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSize, setNewSize] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      campaignsApi<{ assignments: Assignment[] }>(`/${campaignId}/audiences`),
      campaignsApi<{ audiences: Audience[] }>("/audiences"),
    ])
      .then(([a, lib]) => {
        setAssignments(a.assignments);
        setLibrary(lib.audiences);
      })
      .catch((error) => notifyError(error, "Unable to load audiences."))
      .finally(() => setLoading(false));
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const assign = async () => {
    if (!selectedToAssign) return;
    try {
      await campaignsApi(`/${campaignId}/audiences`, { method: "POST", body: JSON.stringify({ audienceId: selectedToAssign }) });
      setSelectedToAssign("");
      notify("Audience assigned.");
      load();
    } catch (error) {
      notifyError(error, "Unable to assign this audience.");
    }
  };

  const remove = async (assignmentId: string) => {
    try {
      await campaignsApi(`/${campaignId}/audiences/${assignmentId}`, { method: "DELETE" });
      notify("Audience removed.");
      load();
    } catch (error) {
      notifyError(error, "Unable to remove this audience.");
    }
  };

  const createAudience = async () => {
    if (!newName.trim()) {
      notifyError(new Error("A name is required."), "A name is required.");
      return;
    }
    setCreating(true);
    try {
      await campaignsApi("/audiences", {
        method: "POST",
        body: JSON.stringify({ name: newName, estimatedSize: newSize ? Number(newSize) : null, isEstimate: true }),
      });
      setNewName("");
      setNewSize("");
      setShowCreate(false);
      notify("Audience created.");
      load();
    } catch (error) {
      notifyError(error, "Unable to create this audience.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <Spinner />;

  const unassigned = library.filter((a) => !assignments.some((asn) => asn.audience.id === a.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[220px]">
          <label className={LABEL}>Assign an existing audience</label>
          <select value={selectedToAssign} onChange={(e) => setSelectedToAssign(e.target.value)} className={cx(INPUT, "h-10 px-3")}>
            <option value="">Select an audience</option>
            {unassigned.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.estimatedSize ? ` — ~${a.estimatedSize.toLocaleString("en-GB")}${a.isEstimate ? " (estimate)" : ""}` : ""}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => void assign()} disabled={!selectedToAssign} className={cx(BTN_PRIMARY, FOCUS)}>
          <Plus size={14} />
          Assign
        </button>
        <button type="button" onClick={() => setShowCreate((v) => !v)} className={cx(BTN_SECONDARY, FOCUS)}>
          New audience
        </button>
      </div>

      {showCreate && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
          <div className="flex-1 min-w-[180px]">
            <label className={LABEL}>Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className={cx(INPUT, "h-9 px-3")} placeholder="e.g. Existing customers — UK" />
          </div>
          <div>
            <label className={LABEL}>Estimated size</label>
            <input type="number" min={0} value={newSize} onChange={(e) => setNewSize(e.target.value)} className={cx(INPUT, "h-9 w-32 px-3")} placeholder="Optional" />
          </div>
          <button type="button" onClick={() => void createAudience()} disabled={creating} className={cx(BTN_PRIMARY, FOCUS)}>
            Create
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
        {assignments.length === 0 ? (
          <EmptyState icon={Users} title="No audiences assigned" description="Assign one or more target audiences to this campaign." />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-[var(--text)]">{a.audience.name}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
                    {a.audience.category.replaceAll("_", " ")}
                    {a.audience.estimatedSize ? ` · ~${a.audience.estimatedSize.toLocaleString("en-GB")}${a.audience.isEstimate ? " (estimate)" : ""}` : ""}
                  </p>
                </div>
                <IconButton label="Remove" onClick={() => void remove(a.id)} bordered>
                  <Trash2 size={13} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </div>

      {notice && <Toast notice={notice} onDismiss={() => setNotice(null)} />}
    </div>
  );
}
