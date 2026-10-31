"use client";

// Manual capture. Paste a link or type what you saw; everything except
// the title is optional, so logging a trend takes seconds.
//
// NOTE: point `createTrendApi` at whatever the project's existing create
// function is called — the rest of this form does not change.

import { useEffect, useRef, useState } from "react";
import { Hash, Link2, Loader2, Plus, X } from "lucide-react";

import { BTN_PRIMARY, BTN_SECONDARY, cx, FOCUS, INPUT } from "../shared/styles";
import { TREND_PLATFORM_META, TREND_TYPE_META } from "./constants";
import { createTrendApi, type TrendPlatform, type TrendRecord } from "./api";

type TrendType = TrendRecord["type"];

export function TrendImportForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [platform, setPlatform] = useState<TrendPlatform>("TIKTOK");
  const [type, setType] = useState<TrendType>("VIDEO_FORMAT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    titleRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, saving]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Give the trend a title so it can be found later.");
      titleRef.current?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createTrendApi({
        platform,
        type,
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        hashtags: hashtags.split(/[,\s]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save. Try again.");
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Add a trend"
      className="fixed inset-0 z-[220] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}
    >
      <form
        onSubmit={submit}
        className="ti-modal flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-popover)] sm:rounded-2xl"
      >
        <style>{`
          @keyframes ti-modal-in { from { opacity: 0; transform: translateY(14px) scale(.985) } to { opacity: 1; transform: none } }
          .ti-modal { animation: ti-modal-in 300ms cubic-bezier(0.22,1,0.36,1) both }
          @media (prefers-reduced-motion: reduce) { .ti-modal { animation: none } }
        `}</style>

        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text)]">Add a trend</h2>
            <p className="mt-0.5 text-[11px] text-[var(--text-subtle)]">Only the title is required.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className={cx("flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]", FOCUS)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">Platform</label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TREND_PLATFORM_META) as TrendPlatform[]).map((value) => {
                const meta = TREND_PLATFORM_META[value];
                const on = platform === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPlatform(value)}
                    aria-pressed={on}
                    className={cx("inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium transition", FOCUS, on ? "text-[var(--text)]" : "border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]")}
                    style={on ? { borderColor: meta.color, backgroundColor: `color-mix(in srgb, ${meta.color} 12%, transparent)` } : undefined}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">Type</label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {(Object.keys(TREND_TYPE_META) as TrendType[]).map((value) => {
                const on = type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    aria-pressed={on}
                    className={cx("h-8 rounded-lg border text-[11.5px] font-medium transition", FOCUS, on ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]")}
                  >
                    {TREND_TYPE_META[value].label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="trend-title" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">Title</label>
            <input id="trend-title" ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What is the trend, in one line" className={cx(INPUT, "h-9 px-3")} />
          </div>

          <div>
            <label htmlFor="trend-desc" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">What makes it work</label>
            <textarea id="trend-desc" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="The structure, the hook, why people stop scrolling" className={cx(INPUT, "resize-y px-3 py-2 leading-relaxed")} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="trend-cat" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">Category</label>
              <input id="trend-cat" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Walkthrough, Curiosity..." className={cx(INPUT, "h-9 px-3")} />
            </div>
            <div>
              <label htmlFor="trend-url" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">Link</label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-subtle)]" />
                <input id="trend-url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Paste the post URL" className={cx(INPUT, "h-9 pl-9 pr-3")} />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="trend-tags" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">Hashtags</label>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-subtle)]" />
              <input id="trend-tags" value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="Separate with spaces or commas" className={cx(INPUT, "h-9 pl-9 pr-3")} />
            </div>
            {hashtags.trim() && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hashtags.split(/[,\s]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean).map((tag) => (
                  <span key={tag} className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10.5px] text-[var(--text-muted)]">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-[11.5px] text-[var(--danger)]">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--line)] p-3">
          <button type="button" onClick={onClose} disabled={saving} className={cx(BTN_SECONDARY, "!h-9 !px-3 !text-[11.5px]")}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={cx(BTN_PRIMARY, "!h-9 !px-3 !text-[11.5px]")}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {saving ? "Saving" : "Add trend"}
          </button>
        </div>
      </form>
    </div>
  );
}
