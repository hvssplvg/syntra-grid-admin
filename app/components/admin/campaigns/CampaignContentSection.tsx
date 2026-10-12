// app/components/admin/campaigns/CampaignContentSection.tsx
"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { BTN_PRIMARY, campaignsApi, ConfirmDialog, cx, type DialogRequest, EmptyState, FOCUS, IconButton, INPUT, LABEL, Spinner, StatusBadge, Toast, useNotice } from "./shared";

type ContentItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  caption: string | null;
  assets: { id: string; brandAsset: { id: string; name: string; url: string } }[];
};

const CONTENT_TYPES = [
  "SOCIAL_POST", "IMAGE", "VIDEO", "REEL", "STORY", "CAROUSEL", "BLOG_ARTICLE", "EMAIL",
  "WEBSITE_BANNER", "LANDING_PAGE", "ADVERTISEMENT", "PROMOTIONAL_GRAPHIC", "DOCUMENT", "OTHER",
];

const CONTENT_STATUSES = ["DRAFT", "IN_PROGRESS", "READY_FOR_REVIEW", "CHANGES_REQUESTED", "APPROVED", "SCHEDULED", "PUBLISHED", "CANCELLED", "ARCHIVED"];

export function CampaignContentSection({ campaignId }: { campaignId: string }) {
  const { notice, setNotice, notify, notifyError } = useNotice();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("SOCIAL_POST");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    campaignsApi<{ content: ContentItem[] }>(`/${campaignId}/content`)
      .then((payload) => setContent(payload.content))
      .catch((error) => notifyError(error, "Unable to load content."))
      .finally(() => setLoading(false));
  }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!newTitle.trim()) {
      notifyError(new Error("A title is required."), "A title is required.");
      return;
    }
    setCreating(true);
    try {
      await campaignsApi(`/${campaignId}/content`, { method: "POST", body: JSON.stringify({ title: newTitle, type: newType }) });
      setNewTitle("");
      notify("Content created.");
      load();
    } catch (error) {
      notifyError(error, "Unable to create this content item.");
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (id: string, status: string) => {
    try {
      const body: Record<string, string> = { status };
      if (status === "CHANGES_REQUESTED") {
        const notes = window.prompt("What needs to change?");
        if (!notes?.trim()) return;
        body.reviewNotes = notes.trim();
      }
      await campaignsApi(`/${campaignId}/content/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      notify("Content updated.");
      load();
    } catch (error) {
      notifyError(error, "Unable to update this content item.");
    }
  };

  const remove = (id: string, title: string) => {
    setDialog({
      title: "Delete this content item?",
      description: `"${title}" will be removed. This can't be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
      onConfirm: async () => {
        try {
          await campaignsApi(`/${campaignId}/content/${id}`, { method: "DELETE" });
          notify("Content deleted.");
          load();
        } catch (error) {
          notifyError(error, "Unable to delete this content item.");
        }
      },
    });
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[18px] border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-end gap-2 border-b border-[var(--line)] px-4 py-3">
          <div className="flex-1 min-w-[180px]">
            <label className={LABEL}>Title</label>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className={cx(INPUT, "h-9 px-3")} placeholder="e.g. Launch day carousel" />
          </div>
          <div>
            <label className={LABEL}>Type</label>
            <select value={newType} onChange={(e) => setNewType(e.target.value)} className={cx(INPUT, "h-9 px-3")}>
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={() => void create()} disabled={creating} className={cx(BTN_PRIMARY, FOCUS)}>
            <Plus size={14} />
            Add
          </button>
        </div>

        {content.length === 0 ? (
          <EmptyState icon={FileText} title="No content yet" description="Plan the creative deliverables for this campaign." />
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {content.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-[var(--text)]">{item.title}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-subtle)]">
                    {item.type.replaceAll("_", " ")} · {item.assets.length} asset{item.assets.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <select value={item.status} onChange={(e) => void setStatus(item.id, e.target.value)} className={cx(INPUT, "h-8 w-auto px-2 text-[10.5px]")}>
                    {CONTENT_STATUSES.map((s) => (
                      <option key={s} value={s} disabled={s === "PUBLISHED"}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <StatusBadge label={item.status} />
                  <IconButton label="Delete" onClick={() => remove(item.id, item.title)} bordered>
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
