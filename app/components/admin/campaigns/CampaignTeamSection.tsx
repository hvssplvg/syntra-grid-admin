// app/components/admin/campaigns/CampaignTeamSection.tsx
"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { BTN_PRIMARY, campaignsApi, cx, EmptyState, employeeName, fetchCampaignOptions, FOCUS, IconButton, INPUT, LABEL, type OptionsData, Spinner, Toast, useNotice } from "./shared";

type Member = { id: string; role: string; employee: { id: string; firstName: string; lastName: string; jobTitle: string } };

const ROLES = ["OWNER", "MANAGER", "CONTRIBUTOR", "REVIEWER", "STAKEHOLDER"];

export function CampaignTeamSection({ campaignId }: { campaignId: string }) {
  const { notice, setNotice, notify, notifyError } = useNotice();
  const [members, setMembers] = useState<Member[]>([]);
  const [options, setOptions] = useState<OptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedRole, setSelectedRole] = useState("CONTRIBUTOR");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([campaignsApi<{ members: Member[] }>(`/${campaignId}/members`), fetchCampaignOptions()])
      .then(([m, opts]) => {
        setMembers(m.members);
        setOptions(opts);
      })
      .catch((error) => notifyError(error, "Unable to load the team."))
      .finally(() => setLoading(false));
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!selectedEmployee) return;
    setAdding(true);
    try {
      await campaignsApi(`/${campaignId}/members`, { method: "POST", body: JSON.stringify({ employeeId: selectedEmployee, role: selectedRole }) });
      setSelectedEmployee("");
      notify("Team member added.");
      load();
    } catch (error) {
      notifyError(error, "Unable to add this team member.");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (memberId: string) => {
    try {
      await campaignsApi(`/${campaignId}/members/${memberId}`, { method: "DELETE" });
      notify("Team member removed.");
      load();
    } catch (error) {
      notifyError(error, "Unable to remove this team member.");
    }
  };

  if (loading || !options) return <Spinner />;

  const available = options.employees.filter((e) => !members.some((m) => m.employee.id === e.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className={LABEL}>Employee</label>
          <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className={cx(INPUT, "h-9 px-3")}>
            <option value="">Select an employee</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {employeeName(e)} — {e.jobTitle}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Role</label>
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className={cx(INPUT, "h-9 px-3")}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={() => void add()} disabled={adding || !selectedEmployee} className={cx(BTN_PRIMARY, FOCUS)}>
          <Plus size={14} />
          Add
        </button>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
        {members.length === 0 ? (
          <EmptyState icon={Users} title="No team members yet" description="Assign the people responsible for this campaign." />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-[var(--text)]">{employeeName(m.employee)}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
                    {m.employee.jobTitle} · {m.role}
                  </p>
                </div>
                <IconButton label="Remove" onClick={() => void remove(m.id)} bordered>
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
