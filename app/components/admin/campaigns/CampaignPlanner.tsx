// app/components/admin/campaigns/CampaignPlanner.tsx
"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, ListTodo, Plus, Trash2 } from "lucide-react";
import {
  BTN_PRIMARY,
  campaignsApi,
  ConfirmDialog,
  cx,
  type DialogRequest,
  EmptyState,
  FOCUS,
  formatDateShort,
  IconButton,
  INPUT,
  LABEL,
  Spinner,
  StatusBadge,
  Toast,
  useNotice,
} from "./shared";

type Milestone = { id: string; title: string; description: string | null; dueAt: string; status: string; owner: { id: string; firstName: string; lastName: string } | null };
type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  assignee: { id: string; firstName: string; lastName: string } | null;
  milestone: { id: string; title: string } | null;
};

export function CampaignPlanner({ campaignId }: { campaignId: string }) {
  const { notice, setNotice, notify, notifyError } = useNotice();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDue, setNewMilestoneDue] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creatingMilestone, setCreatingMilestone] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      campaignsApi<{ milestones: Milestone[] }>(`/${campaignId}/milestones`),
      campaignsApi<{ tasks: Task[] }>(`/${campaignId}/tasks`),
    ])
      .then(([m, t]) => {
        setMilestones(m.milestones);
        setTasks(t.tasks);
      })
      .catch((error) => notifyError(error, "Unable to load the planner."))
      .finally(() => setLoading(false));
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const createMilestone = async () => {
    if (!newMilestoneTitle.trim() || !newMilestoneDue) {
      notifyError(new Error("A title and due date are required."), "A title and due date are required.");
      return;
    }
    setCreatingMilestone(true);
    try {
      await campaignsApi(`/${campaignId}/milestones`, { method: "POST", body: JSON.stringify({ title: newMilestoneTitle, dueAt: newMilestoneDue }) });
      setNewMilestoneTitle("");
      setNewMilestoneDue("");
      notify("Milestone created.");
      load();
    } catch (error) {
      notifyError(error, "Unable to create this milestone.");
    } finally {
      setCreatingMilestone(false);
    }
  };

  const completeMilestone = async (id: string) => {
    try {
      await campaignsApi(`/${campaignId}/milestones/${id}`, { method: "PATCH", body: JSON.stringify({ status: "COMPLETED" }) });
      notify("Milestone completed.");
      load();
    } catch (error) {
      notifyError(error, "Unable to update this milestone.");
    }
  };

  const deleteMilestone = (id: string, title: string) => {
    setDialog({
      title: "Delete this milestone?",
      description: `"${title}" will be removed, along with its calendar entry if it had one. This can't be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
      onConfirm: async () => {
        try {
          await campaignsApi(`/${campaignId}/milestones/${id}`, { method: "DELETE" });
          notify("Milestone deleted.");
          load();
        } catch (error) {
          notifyError(error, "Unable to delete this milestone.");
        }
      },
    });
  };

  const createTask = async () => {
    if (!newTaskTitle.trim()) {
      notifyError(new Error("A task title is required."), "A task title is required.");
      return;
    }
    setCreatingTask(true);
    try {
      await campaignsApi(`/${campaignId}/tasks`, { method: "POST", body: JSON.stringify({ title: newTaskTitle }) });
      setNewTaskTitle("");
      notify("Task created.");
      load();
    } catch (error) {
      notifyError(error, "Unable to create this task.");
    } finally {
      setCreatingTask(false);
    }
  };

  const setTaskStatus = async (id: string, status: string) => {
    try {
      await campaignsApi(`/${campaignId}/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      notify("Task updated.");
      load();
    } catch (error) {
      notifyError(error, "Unable to update this task.");
    }
  };

  const deleteTask = (id: string, title: string) => {
    setDialog({
      title: "Delete this task?",
      description: `"${title}" will be removed. Tasks depending on it will be unlinked, not deleted.`,
      confirmLabel: "Delete",
      tone: "danger",
      onConfirm: async () => {
        try {
          await campaignsApi(`/${campaignId}/tasks/${id}`, { method: "DELETE" });
          notify("Task deleted.");
          load();
        } catch (error) {
          notifyError(error, "Unable to delete this task.");
        }
      },
    });
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text)]">
            <CalendarDays size={14} className="text-[var(--accent)]" />
            Milestones
          </h3>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-b border-[var(--line)] px-4 py-3">
          <div className="flex-1 min-w-[180px]">
            <label className={LABEL}>Title</label>
            <input value={newMilestoneTitle} onChange={(e) => setNewMilestoneTitle(e.target.value)} className={cx(INPUT, "h-9 px-3")} placeholder="e.g. Launch assets ready" />
          </div>
          <div>
            <label className={LABEL}>Due date</label>
            <input type="date" value={newMilestoneDue} onChange={(e) => setNewMilestoneDue(e.target.value)} className={cx(INPUT, "h-9 px-3")} />
          </div>
          <button type="button" onClick={() => void createMilestone()} disabled={creatingMilestone} className={cx(BTN_PRIMARY, FOCUS)}>
            <Plus size={14} />
            Add
          </button>
        </div>

        {milestones.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No milestones yet" description="Add the key dates for this campaign." />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {milestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-[var(--text)]">{m.title}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
                    Due {formatDateShort(m.dueAt)}
                    {m.owner ? ` · ${m.owner.firstName} ${m.owner.lastName}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge label={m.status} />
                  {m.status === "PENDING" && (
                    <IconButton label="Mark complete" onClick={() => void completeMilestone(m.id)} bordered>
                      <CheckCircle2 size={13} />
                    </IconButton>
                  )}
                  <IconButton label="Delete" onClick={() => deleteMilestone(m.id, m.title)} bordered>
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text)]">
            <ListTodo size={14} className="text-[var(--accent)]" />
            Tasks
          </h3>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-b border-[var(--line)] px-4 py-3">
          <div className="flex-1 min-w-[180px]">
            <label className={LABEL}>Title</label>
            <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className={cx(INPUT, "h-9 px-3")} placeholder="e.g. Draft Instagram carousel" />
          </div>
          <button type="button" onClick={() => void createTask()} disabled={creatingTask} className={cx(BTN_PRIMARY, FOCUS)}>
            <Plus size={14} />
            Add
          </button>
        </div>

        {tasks.length === 0 ? (
          <EmptyState icon={ListTodo} title="No tasks yet" description="Break this campaign down into trackable work." />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-[var(--text)]">{t.title}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
                    {t.dueAt ? `Due ${formatDateShort(t.dueAt)}` : "No due date"}
                    {t.assignee ? ` · ${t.assignee.firstName} ${t.assignee.lastName}` : ""}
                    {t.milestone ? ` · ${t.milestone.title}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select value={t.status} onChange={(e) => void setTaskStatus(t.id, e.target.value)} className={cx(INPUT, "h-8 w-auto px-2 text-[10.5px]")}>
                    {["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "COMPLETED", "CANCELLED"].map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <IconButton label="Delete" onClick={() => deleteTask(t.id, t.title)} bordered>
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {dialog && <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />}
      {notice && <Toast notice={notice} onDismiss={() => setNotice(null)} />}
    </div>
  );
}
