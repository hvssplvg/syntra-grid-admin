"use client";

// Discover's triage mode. One card at a time, with the next two visible
// behind it so the queue reads as finite. Drag it, use the buttons, or
// stay on the keyboard: left passes, right keeps.

import { useCallback, useEffect, useRef, useState } from "react";
import { Calendar, Check, Image as ImageIcon, Info, Loader2, Sparkles, Undo2, Video, Wand2, X } from "lucide-react";

import { BTN_PRIMARY, BTN_SECONDARY, cx, FOCUS } from "../shared/styles";
import { TREND_PLATFORM_META, TREND_TYPE_META } from "./constants";
import type { TrendRecord } from "./api";
import { formatCompactNumber, readYoutubePopularity } from "./popularity";
import { YoutubeEmbed } from "./YoutubeEmbed";
import { extractYoutubeVideoId } from "./youtube";

const platformInk = (color: string) => `color-mix(in srgb, ${color} 76%, var(--text))`;

const THRESHOLD = 110;

/** A pointerdown that originated on (or inside) a button/link/form
 *  control must never start a drag — setPointerCapture on the card
 *  would otherwise redirect the matching pointerup, and therefore the
 *  synthesized click, away from that control. Exported for unit
 *  testing without needing a real DOM (this project's test
 *  environment is Node, not jsdom). */
export function isInteractiveDragTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Partial<Element>).closest !== "function") return false;
  return Boolean((target as Element).closest("button, a, input, textarea, select, [data-no-drag]"));
}

export function TrendSwiper({
  trends,
  onSave,
  onSkip,
  onViewDetails,
  onAnalyze,
  analyzingId,
  onGenerateVideo,
  onGenerateAiVideo,
  onGenerateGraphic,
  generatingId,
  onAddToCalendar,
  onExhausted,
}: {
  trends: TrendRecord[];
  onSave: (trend: TrendRecord) => void;
  onSkip: (trend: TrendRecord) => void;
  onViewDetails: (trend: TrendRecord) => void;
  onAnalyze: (trend: TrendRecord) => void;
  analyzingId: string | null;
  /** Standard Video — free animated text/motion graphics. */
  onGenerateVideo: (trend: TrendRecord) => void;
  /** AI Video — real Luma-generated footage. A separate destination
   *  from onGenerateVideo above, never a replacement for it. */
  onGenerateAiVideo: (trend: TrendRecord) => void;
  onGenerateGraphic: (trend: TrendRecord) => void;
  /** Trend id currently running the adapt-then-open round trip —
   *  shows a spinner on whichever Generate button was clicked. */
  generatingId: string | null;
  onAddToCalendar: (trend: TrendRecord) => void;
  onExhausted: () => void;
}) {
  const [drag, setDrag] = useState({ x: 0, active: false });
  const [leaving, setLeaving] = useState<"save" | "skip" | null>(null);
  const startX = useRef(0);
  const pointerId = useRef<number | null>(null);

  const top = trends[0] ?? null;
  const behind = trends.slice(1, 3);

  useEffect(() => {
    if (trends.length === 0) onExhausted();
  }, [trends.length, onExhausted]);

  const commit = useCallback(
    (direction: "save" | "skip") => {
      if (!top || leaving) return;
      setLeaving(direction);
      window.setTimeout(() => {
        (direction === "save" ? onSave : onSkip)(top);
        setLeaving(null);
        setDrag({ x: 0, active: false });
      }, 220);
    },
    [top, leaving, onSave, onSkip],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!top) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); commit("skip"); }
      else if (event.key === "ArrowRight") { event.preventDefault(); commit("save"); }
      else if (event.key === "Enter") { event.preventDefault(); onViewDetails(top); }
      else if (event.key.toLowerCase() === "g") onGenerateVideo(top);
      else if (event.key.toLowerCase() === "c") onAddToCalendar(top);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [top, commit, onViewDetails, onGenerateVideo, onAddToCalendar]);

  if (!top) return null;

  const offset = leaving ? (leaving === "save" ? 520 : -520) : drag.x;
  const rotation = offset / 26;
  const intent = offset > 60 ? "save" : offset < -60 ? "skip" : null;
  const meta = TREND_PLATFORM_META[top.platform];
  const videoId = top.platform === "YOUTUBE" ? extractYoutubeVideoId(top.sourceUrl) : null;
  const popularity = readYoutubePopularity(top);
  const analyzing = analyzingId === top.id;
  const generating = generatingId === top.id;

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center py-2">
      <p className="mb-2 text-[11px] text-[var(--text-subtle)]">
        <span className="font-semibold tabular-nums text-[var(--text)]">{trends.length}</span> left to triage
      </p>

      <div className="relative w-full max-w-[460px]" style={{ height: "min(440px, 100%)", minHeight: 340 }}>
        {behind.map((trend, index) => (
          <div
            key={trend.id}
            aria-hidden
            className="absolute inset-x-0 top-0 rounded-2xl border border-[var(--line)] bg-[var(--surface)] transition-transform duration-300"
            style={{
              height: "100%",
              transform: `translateY(${(index + 1) * 10}px) scale(${1 - (index + 1) * 0.035})`,
              opacity: 1 - (index + 1) * 0.35,
              zIndex: 1,
            }}
          />
        ))}

        <div
          role="group"
          aria-label={top.title}
          onPointerDown={(event) => {
            if (leaving) return;
            // A pointerdown that starts on a button (or anything
            // interactive inside the card — e.g. the embedded player)
            // must never be captured for dragging: setPointerCapture
            // redirects the matching pointerup — and therefore the
            // synthesized click — to this element instead of the
            // button, which is exactly why Analyse/Details/Generate
            // appeared visible but never responded to clicks.
            if (isInteractiveDragTarget(event.target)) return;
            pointerId.current = event.pointerId;
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            startX.current = event.clientX;
            setDrag({ x: 0, active: true });
          }}
          onPointerMove={(event) => {
            if (!drag.active || pointerId.current !== event.pointerId) return;
            setDrag({ x: event.clientX - startX.current, active: true });
          }}
          onPointerUp={(event) => {
            if (pointerId.current !== event.pointerId) return;
            pointerId.current = null;
            if (drag.x > THRESHOLD) commit("save");
            else if (drag.x < -THRESHOLD) commit("skip");
            else setDrag({ x: 0, active: false });
          }}
          onPointerCancel={() => { pointerId.current = null; setDrag({ x: 0, active: false }); }}
          className="absolute inset-0 z-[2] flex cursor-grab flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)] active:cursor-grabbing"
          style={{
            transform: `translateX(${offset}px) rotate(${rotation}deg)`,
            opacity: leaving ? 0 : 1,
            transition: drag.active ? "none" : "transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease",
            touchAction: "pan-y",
          }}
        >
          <div aria-hidden className="h-[3px] w-full shrink-0" style={{ background: `linear-gradient(90deg, ${platformInk(meta.color)}, color-mix(in srgb, ${meta.color} 20%, transparent))` }} />

          {/* drag intent */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-4 top-4 rounded-lg border-2 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide transition-opacity duration-150"
            style={{ borderColor: "var(--success)", color: "var(--success)", opacity: intent === "save" ? 1 : 0, transform: "rotate(10deg)" }}
          >
            Keep
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute left-4 top-4 rounded-lg border-2 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide transition-opacity duration-150"
            style={{ borderColor: "var(--text-subtle)", color: "var(--text-subtle)", opacity: intent === "skip" ? 1 : 0, transform: "rotate(-10deg)" }}
          >
            Pass
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {videoId && (
              <div className="mb-4 max-w-[220px]">
                <YoutubeEmbed videoId={videoId} title={top.title} variant="compact" />
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 12%, var(--surface-muted))`, color: platformInk(meta.color) }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: platformInk(meta.color) }} />
                {meta.label}
              </span>
              <span className="text-[10.5px] text-[var(--text-subtle)]">
                {TREND_TYPE_META[top.type].label}
                {top.category ? ` · ${top.category}` : ""}
              </span>
              {top.relevanceScore !== null && (
                <span className="ml-auto text-[11px] font-semibold tabular-nums" style={{ color: top.relevanceScore >= 70 ? "var(--success)" : top.relevanceScore >= 40 ? "var(--warning)" : "var(--text-subtle)" }}>
                  {top.relevanceScore}/100 fit
                </span>
              )}
            </div>

            <h3 className="mt-3 text-[18px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text)]">{top.title}</h3>

            {videoId && (popularity.channelTitle || popularity.views !== null || popularity.publishedAt) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[10.5px] text-[var(--text-subtle)]">
                {popularity.channelTitle && <span>{popularity.channelTitle}</span>}
                {popularity.views !== null && <span>{formatCompactNumber(popularity.views)} views</span>}
                {popularity.publishedAt && <span>{new Date(popularity.publishedAt).toLocaleDateString()}</span>}
              </p>
            )}

            <p className="mt-2.5 text-[12.5px] leading-[1.65] text-[var(--text-muted)]">{top.description}</p>

            {top.recommendedFormats.length > 0 && (
              <p className="mt-2.5 text-[10.5px] text-[var(--text-subtle)]">
                Suggested format: <span className="text-[var(--text-muted)]">{top.recommendedFormats[0]}</span>
              </p>
            )}

            {top.aiAnalysis?.adaptationIdea && (
              <div className="mt-4 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-tint)] p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">
                  <Sparkles className="h-3 w-3" /> How to adapt it
                </p>
                <p className="mt-1.5 text-[12px] leading-[1.6] text-[var(--text)]">{top.aiAnalysis.adaptationIdea}</p>
              </div>
            )}

            {top.hashtags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {top.hashtags.map((tag) => (
                  <span key={tag} className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10.5px] text-[var(--text-muted)]">#{tag}</span>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-1.5 border-t border-[var(--line)] p-3">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => onAnalyze(top)} disabled={analyzing} className={cx(BTN_SECONDARY, "!h-8 flex-1 !px-2 !text-[11px]")}>
                {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Analyse
              </button>
              <button type="button" onClick={() => onViewDetails(top)} className={cx(BTN_SECONDARY, "!h-8 flex-1 !px-2 !text-[11px]")}>
                <Info className="h-3 w-3" /> Details
              </button>
              <button type="button" onClick={() => onAddToCalendar(top)} className={cx(BTN_SECONDARY, "!h-8 flex-1 !px-2 !text-[11px]")}>
                <Calendar className="h-3 w-3" /> Calendar
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => onGenerateVideo(top)} disabled={generating} title="Free animated text and motion graphics" className={cx(BTN_PRIMARY, "!h-8 flex-1 !px-2 !text-[11px]")}>
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Video className="h-3 w-3" />} Standard
              </button>
              <button type="button" onClick={() => onGenerateAiVideo(top)} disabled={generating} title="Real AI-generated footage (Luma) — paid, confirmed before every clip" className={cx(BTN_PRIMARY, "!h-8 flex-1 !px-2 !text-[11px]")}>
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} AI Video
              </button>
              <button type="button" onClick={() => onGenerateGraphic(top)} disabled={generating} title="Generate graphic" className={cx(BTN_SECONDARY, "!h-8 flex-1 !px-2 !text-[11px]")}>
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => commit("skip")}
          aria-label="Pass"
          className={cx("flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] shadow-[var(--shadow-soft)] transition hover:scale-105 hover:text-[var(--text)] active:scale-95", FOCUS)}
        >
          <X className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => onViewDetails(top)}
          aria-label="Details"
          className={cx("flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--text-subtle)] transition hover:scale-105 hover:text-[var(--text)] active:scale-95", FOCUS)}
        >
          <Info className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => commit("save")}
          aria-label="Keep"
          className={cx(BTN_PRIMARY, "!h-12 !w-12 !rounded-full !px-0 shadow-[var(--shadow-soft)] transition hover:scale-105 active:scale-95")}
        >
          <Check className="h-5 w-5" />
        </button>
      </div>

      <p className="mt-3 flex items-center gap-3 text-[10px] text-[var(--text-subtle)]">
        {[["←", "pass"], ["→", "keep"], ["enter", "details"], ["G", "generate"]].map(([key, label]) => (
          <span key={key} className="inline-flex items-center gap-1">
            <kbd className="rounded border border-[var(--line)] bg-[var(--surface-muted)] px-1 py-px font-sans text-[9.5px] text-[var(--text-muted)]">{key}</kbd>
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <Undo2 className="h-2.5 w-2.5" /> undo from the toast
        </span>
      </p>
    </div>
  );
}
