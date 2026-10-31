"use client";

// The deep dive. Everything the preview pane shows, plus the AI analysis
// controls, which are the only reason to leave the two pane view.

import { useEffect, useRef, useState } from "react";
import { Archive, Calendar, Check, ExternalLink, Hash, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Upload, Video, Wand2, X } from "lucide-react";

import { AiApiError, analyzeReferenceImageApi, uploadMediaAssetApi } from "../content-studio/api";
import { BTN_PRIMARY, BTN_SECONDARY, cx, FOCUS, INPUT } from "../shared/styles";
import { TREND_PLATFORM_META, TREND_TYPE_META } from "./constants";
import type { TrendRecord } from "./api";
import { formatCompactNumber, readYoutubePopularity } from "./popularity";
import { YoutubeEmbed } from "./YoutubeEmbed";
import { extractYoutubeVideoId } from "./youtube";

const platformInk = (color: string) => `color-mix(in srgb, ${color} 76%, var(--text))`;

export function TrendDetailModal({
  trend,
  analyzing,
  generating,
  onAnalyze,
  onSave,
  onSkip,
  onGenerateVideo,
  onGenerateAiVideo,
  onGenerateGraphic,
  onAddToCalendar,
  onClose,
}: {
  trend: TrendRecord;
  analyzing: boolean;
  /** True while the Trend Adaptation Engine round trip for this trend
   *  is in flight — see TrendIntelligenceHome.tsx's generatingId. */
  generating: boolean;
  onAnalyze: (force: boolean) => void;
  onSave: () => void;
  onSkip: () => void;
  /** additionalContext is whatever the admin typed in the optional
   *  "Add context" field below — passed straight to adaptTrendApi.
   *  Standard Video — free animated text/motion graphics. */
  onGenerateVideo: (additionalContext?: string) => void;
  /** AI Video — real Luma-generated footage, a separate destination
   *  from onGenerateVideo above, never a replacement for it. Also
   *  reads the reference image below, same as onGenerateGraphic — an
   *  authorised reference informs the AI video concepts' visual
   *  direction without claiming its motion/camera work was analysed
   *  (only a still image was). */
  onGenerateAiVideo: (additionalContext?: string, referenceImage?: { url: string; analysis: string }) => void;
  /** referenceImage is set only when the admin uploaded (and we
   *  analysed) an authorised reference image below — it drives a
   *  real, reference-conditioned image generation in Graphic Studio
   *  instead of the default free AI-designed layout. animateIntent is
   *  set only by "Generate Graphic → Animate" below — it never changes
   *  what gets generated, only whether Graphic Studio shows a
   *  contextual nudge toward "Animate with AI" once an image exists,
   *  and whether this trend stays linked through to the eventual video. */
  onGenerateGraphic: (additionalContext?: string, referenceImage?: { url: string; analysis: string }, animateIntent?: boolean) => void;
  onAddToCalendar: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [additionalContext, setAdditionalContext] = useState("");
  const [contextOpen, setContextOpen] = useState(false);
  const [referenceImage, setReferenceImage] = useState<{ url: string; analysis: string } | null>(null);
  const [referenceUploading, setReferenceUploading] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const meta = TREND_PLATFORM_META[trend.platform];
  const score = trend.relevanceScore;
  const tone = score === null ? "var(--text-subtle)" : score >= 70 ? "var(--success)" : score >= 40 ? "var(--warning)" : "var(--text-subtle)";
  const idea = trend.aiAnalysis?.adaptationIdea;
  const videoId = trend.platform === "YOUTUBE" ? extractYoutubeVideoId(trend.sourceUrl) : null;
  const popularity = readYoutubePopularity(trend);

  async function handleReferenceFile(file: File) {
    setReferenceUploading(true);
    setReferenceError(null);
    try {
      const asset = await uploadMediaAssetApi(file, file.name);
      const analysis = await analyzeReferenceImageApi(asset.url);
      setReferenceImage({ url: asset.url, analysis });
    } catch (err) {
      setReferenceError(err instanceof AiApiError ? err.message : "Couldn't analyse that image. Try again.");
    } finally {
      setReferenceUploading(false);
    }
  }

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal
      aria-label={trend.title}
      className="fixed inset-0 z-[220] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="ti-modal flex max-h-[92vh] w-full max-w-[620px] flex-col overflow-hidden rounded-t-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-popover)] outline-none sm:rounded-2xl"
      >
        <style>{`
          @keyframes ti-modal-in { from { opacity: 0; transform: translateY(14px) scale(.985) } to { opacity: 1; transform: none } }
          .ti-modal { animation: ti-modal-in 300ms cubic-bezier(0.22,1,0.36,1) both }
          @media (prefers-reduced-motion: reduce) { .ti-modal { animation: none } }
        `}</style>

        <div aria-hidden className="h-[3px] w-full shrink-0" style={{ background: `linear-gradient(90deg, ${platformInk(meta.color)}, color-mix(in srgb, ${meta.color} 20%, transparent))` }} />

        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 12%, var(--surface-muted))`, color: platformInk(meta.color) }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: platformInk(meta.color) }} />
                {meta.label}
              </span>
              <span className="text-[10.5px] text-[var(--text-subtle)]">
                {TREND_TYPE_META[trend.type].label}
                {trend.category ? ` · ${trend.category}` : ""}
              </span>
            </div>
            <h2 className="mt-2 text-[18px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text)]">{trend.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--text)]", FOCUS)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {videoId && (
            <div className="mb-4 max-w-[260px]">
              <YoutubeEmbed videoId={videoId} title={trend.title} variant="full" />
            </div>
          )}

          {videoId && (popularity.channelTitle || popularity.views !== null || popularity.publishedAt) && (
            <p className="mb-3 flex flex-wrap items-center gap-x-2.5 text-[11px] text-[var(--text-subtle)]">
              {popularity.channelTitle && <span className="font-medium text-[var(--text-muted)]">{popularity.channelTitle}</span>}
              {popularity.views !== null && <span>{formatCompactNumber(popularity.views)} views</span>}
              {popularity.publishedAt && <span>Published {new Date(popularity.publishedAt).toLocaleDateString()}</span>}
            </p>
          )}

          <p className="text-[12.5px] leading-[1.7] text-[var(--text-muted)]">{trend.description}</p>

          {trend.recommendedFormats.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {trend.recommendedFormats.map((format) => (
                <span key={format} className="rounded-md bg-[var(--accent-tint)] px-1.5 py-0.5 text-[10.5px] text-[var(--accent)]">{format}</span>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">Relevance</p>
                <p className="mt-1 text-[22px] font-bold leading-none tabular-nums" style={{ color: tone }}>
                  {score === null ? "Not analysed" : `${score}`}
                  {score !== null && <span className="text-[12px] font-medium text-[var(--text-subtle)]">/100</span>}
                </p>
              </div>
              <button type="button" onClick={() => onAnalyze(score !== null)} disabled={analyzing} className={cx(BTN_SECONDARY, "!h-8 !px-2.5 !text-[11px]")}>
                {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : score === null ? <Sparkles className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />}
                {analyzing ? "Analysing" : score === null ? "Analyse fit" : "Re-analyse"}
              </button>
            </div>
            {score !== null && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--line-strong)]">
                <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${score}%`, backgroundColor: tone }} />
              </div>
            )}
          </div>

          {idea && (
            <div className="mt-4 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-tint)] p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
                <Sparkles className="h-3 w-3" /> How to adapt it
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.65] text-[var(--text)]">{idea}</p>
            </div>
          )}

          {trend.suggestedCaptions.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">Suggested captions</p>
              <ul className="mt-2 space-y-2">
                {trend.suggestedCaptions.map((caption) => (
                  <li key={caption} className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-[12px] leading-[1.6] text-[var(--text)]">
                    {caption}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {trend.hashtags.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">Hashtags</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {trend.hashtags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-0.5 rounded-md bg-[var(--surface-muted)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
                    <Hash className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {trend.sourceUrl && (
            <a href={trend.sourceUrl} target="_blank" rel="noreferrer" className={cx("mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--accent)] hover:underline", FOCUS)}>
              <ExternalLink className="h-3 w-3" /> View the original
            </a>
          )}

          {contextOpen ? (
            <div className="mt-4">
              <label htmlFor="trend-additional-context" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-subtle)]">
                Additional context for the AI
              </label>
              <textarea
                id="trend-additional-context"
                value={additionalContext}
                onChange={(event) => setAdditionalContext(event.target.value)}
                rows={2}
                placeholder="Anything you noticed watching it that metadata alone wouldn't show"
                className={cx(INPUT, "mt-1.5 resize-none !h-auto p-2.5 text-[12.5px]")}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setContextOpen(true)} className={cx("mt-4 text-[11px] font-medium text-[var(--accent)] hover:underline", FOCUS)}>
              + Add context before generating
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleReferenceFile(file);
            }}
          />
          <div className="mt-3">
            {referenceImage ? (
              <div className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={referenceImage.url} alt="Reference" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">Reference image — informs Generate Graphic and Generate AI Video</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-[1.5] text-[var(--text-muted)]">{referenceImage.analysis}</p>
                </div>
                <button type="button" onClick={() => setReferenceImage(null)} aria-label="Remove reference image" className={cx("shrink-0 text-[var(--text-subtle)] hover:text-[var(--text)]", FOCUS)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={referenceUploading}
                className={cx("inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent)] hover:underline", FOCUS)}
              >
                {referenceUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {referenceUploading ? "Analysing…" : "+ Upload a reference image you have the rights to use"}
              </button>
            )}
            {referenceError && <p className="mt-1.5 text-[11px] text-[var(--danger)]">{referenceError}</p>}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--line)] p-3">
          <button type="button" onClick={onSkip} className={cx(BTN_SECONDARY, "!h-9 !px-3 !text-[11.5px]")}>
            <Archive className="h-3.5 w-3.5" /> Pass
          </button>
          <button type="button" onClick={onSave} className={cx(BTN_SECONDARY, "!h-9 !px-3 !text-[11.5px]")}>
            <Check className="h-3.5 w-3.5" /> Keep
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onAddToCalendar} className={cx(BTN_SECONDARY, "!h-9 !px-3 !text-[11.5px]")}>
              <Calendar className="h-3.5 w-3.5" /> Calendar
            </button>
            <button type="button" onClick={() => onGenerateGraphic(additionalContext.trim() || undefined, referenceImage ?? undefined)} disabled={generating} className={cx(BTN_SECONDARY, "!h-9 !px-3 !text-[11.5px]")}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />} Generate Graphic
            </button>
            <button
              type="button"
              onClick={() => onGenerateGraphic(additionalContext.trim() || undefined, referenceImage ?? undefined, true)}
              disabled={generating}
              title="Creates a premium image first — once it's ready, Graphic Studio will prompt you to turn it into real video footage with 'Animate with AI' (a separate, explicitly confirmed step)."
              className={cx(BTN_SECONDARY, "!h-9 !px-3 !text-[11.5px]")}
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />} Generate Graphic → Animate
            </button>
            <button type="button" onClick={() => onGenerateVideo(additionalContext.trim() || undefined)} disabled={generating} title="Free animated text and motion graphics" className={cx(BTN_SECONDARY, "!h-9 !px-3 !text-[11.5px]")}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />} Standard Video
            </button>
            <button
              type="button"
              onClick={() => onGenerateAiVideo(additionalContext.trim() || undefined, referenceImage ?? undefined)}
              disabled={generating}
              title="Real AI-generated footage (Luma) — paid, confirmed before every clip"
              className={cx(BTN_PRIMARY, "!h-9 !px-3 !text-[11.5px]")}
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Generate AI Video
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
