/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Lists the signed-in admin's saved ContentProjects on Content Home
// (Part 5). Honestly empty until the admin saves one from the Graphic
// editor. Open/Rename/Duplicate/Delete all operate on the one existing
// ContentProject table — no new persistence introduced here.

import { useEffect, useState } from "react";
import { Copy, Loader2, Pencil, Trash2 } from "lucide-react";

import {
  AiApiError,
  deleteContentProjectApi,
  duplicateContentProjectApi,
  listContentProjectsApi,
  updateContentProjectApi,
  type ContentProjectSummary,
} from "../api";
import { cx, FOCUS } from "../../shared/styles";
import { IconButton } from "../../shared/primitives";

export function ProjectsPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [projects, setProjects] = useState<ContentProjectSummary[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const result = await listContentProjectsApi();
    setProjects(result);
    setStatus("ready");
  };

  useEffect(() => {
    void load();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-1.5 py-2 text-[10.5px] text-[var(--text-subtle)]">
        <Loader2 size={11} className="animate-spin" />
        Checking for saved projects…
      </div>
    );
  }

  if (projects.length === 0) return null; // honestly nothing to show yet — no empty-state hero per Phase 1's own guidance

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
      <h3 className="mb-2 text-[12px] font-semibold text-[var(--text)]">Your saved projects</h3>
      {error && <p className="mb-2 text-[10.5px] text-red-600">{error}</p>}
      <div className="space-y-1">
        {projects.map((project) => (
          <div key={project.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2">
            {renamingId === project.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={async () => {
                  setRenamingId(null);
                  if (!renameValue.trim() || renameValue === project.title) return;
                  try {
                    await updateContentProjectApi(project.id, { title: renameValue.trim() });
                    await load();
                  } catch (caught) {
                    setError(caught instanceof AiApiError ? caught.message : "Rename failed.");
                  }
                }}
                onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                className="h-7 flex-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-[11px]"
              />
            ) : (
              <button type="button" onClick={() => onOpen(project.id)} className="min-w-0 flex-1 truncate text-left text-[11.5px] font-medium text-[var(--text)] hover:text-[var(--accent)]">
                {project.title}
              </button>
            )}

            <div className="flex shrink-0 items-center gap-0.5">
              <IconButton
                label="Rename"
                onClick={() => {
                  setRenamingId(project.id);
                  setRenameValue(project.title);
                }}
                size="sm"
              >
                <Pencil size={12} />
              </IconButton>
              <IconButton
                label="Duplicate"
                onClick={async () => {
                  setBusyId(project.id);
                  try {
                    await duplicateContentProjectApi(project.id);
                    await load();
                  } catch (caught) {
                    setError(caught instanceof AiApiError ? caught.message : "Duplicate failed.");
                  } finally {
                    setBusyId(null);
                  }
                }}
                size="sm"
              >
                {busyId === project.id ? <Loader2 size={12} className="animate-spin" /> : <Copy size={12} />}
              </IconButton>
              <IconButton label="Delete" onClick={() => setConfirmDeleteId(project.id)} size="sm">
                <Trash2 size={12} />
              </IconButton>
            </div>

            {confirmDeleteId === project.id && (
              <div
                role="alertdialog"
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setConfirmDeleteId(null);
                }}
              >
                <div className="w-full max-w-[360px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]">
                  <p className="text-[12.5px] font-semibold text-[var(--text)]">Delete &ldquo;{project.title}&rdquo;?</p>
                  <p className="mt-1 text-[11px] text-[var(--text-subtle)]">This can&apos;t be undone.</p>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button type="button" onClick={() => setConfirmDeleteId(null)} className={cx("h-8 rounded-lg px-3 text-[11px] font-medium text-[var(--text-muted)]", FOCUS)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setConfirmDeleteId(null);
                        setBusyId(project.id);
                        try {
                          await deleteContentProjectApi(project.id);
                          await load();
                        } catch (caught) {
                          setError(caught instanceof AiApiError ? caught.message : "Delete failed.");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className={cx("h-8 rounded-lg bg-red-600 px-3 text-[11px] font-semibold text-white hover:bg-red-700", FOCUS)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
