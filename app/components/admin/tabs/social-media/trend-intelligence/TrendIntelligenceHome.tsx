/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Trend Intelligence's home — one Trend model, filtered into the 7
// requested sections (see constants.ts's TREND_SECTIONS), rather than
// seven separate screens/tables. "Discover" is the only section that
// uses the swipe-to-triage stack; everything else is a browsable set.
//
// Layout: a section rail, a dense list, and a live preview beside it.
// Picking a row updates the preview instantly, so reading a trend costs
// no round trip and no scrolling — the modal is kept for the deep dive
// (analysis) only. The whole set is fetched once and filtered in memory,
// which is what makes search and the filters feel instant.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Calendar,
  Check,
  ChevronRight,
  Download,
  Hash,
  Image as ImageIcon,
  Info,
  Laugh,
  Layers,
  Loader2,
  Music,
  Play,
  Plus,
  Quote,
  RefreshCw,
  Search,
  Sparkles,
  Undo2,
  Video,
  Wand2,
  X,
} from "lucide-react";

import type { SocialPlatform } from "../shared/types";
import { BTN_PRIMARY, BTN_SECONDARY, CARD, cx, FOCUS, INPUT } from "../shared/styles";
import { TREND_PLATFORM_META, TREND_SECTIONS, TREND_TYPE_META, type TrendSection } from "./constants";
import { TrendSwiper } from "./TrendSwiper";
import { TrendDetailModal } from "./TrendDetailModal";
import { TrendImportForm } from "./TrendImportForm";
import { YoutubeEmbed } from "./YoutubeEmbed";
import { extractYoutubeVideoId, youtubeThumbnailUrl } from "./youtube";
import { formatCompactNumber, readYoutubePopularity } from "./popularity";
import { defaultPlatformForTrend, isSocialPlatform } from "./platformDefault";
import { resolveGenerationBrief } from "./generationFlow";
import {
  adaptTrendApi,
  analyzeTrendApi,
  discoverYoutubeTrendsApi,
  listTrendsApi,
  updateTrendStatusApi,
  type TrendPlatform,
  type TrendRecord,
} from "./api";

/* ------------------------------------------------------------------ */
/* Section model                                                       */
/* ------------------------------------------------------------------ */

type LoadStatus = "loading" | "ready" | "error";
type SortMode = "fit" | "unscored";

const TYPE_SECTIONS: Partial<Record<TrendSection, TrendRecord["type"]>> = {
  audio: "AUDIO",
  meme: "MEME",
  video_format: "VIDEO_FORMAT",
  hook: "HOOK",
};

/** Which rows belong to a section. Mirrors the old server-side query,
 *  minus dismissed rows, which were only ever noise in the type views. */
function sectionMatches(trend: TrendRecord, section: TrendSection): boolean {
  if (section === "discover") return trend.status === "NEW";
  if (section === "saved") return trend.status === "SAVED";
  if (section === "library") return trend.status === "SAVED" || trend.status === "USED" || trend.status === "ARCHIVED";
  const type = TYPE_SECTIONS[section];
  return trend.type === type && trend.status !== "DISMISSED";
}

const SECTION_GROUPS: { label: string; ids: TrendSection[] }[] = [
  { label: "Triage", ids: ["discover"] },
  { label: "By format", ids: ["audio", "meme", "video_format", "hook"] },
  { label: "Collections", ids: ["saved", "library"] },
];

const SECTION_BLURB: Record<TrendSection, string> = {
  discover: "New trends waiting on a keep or pass decision.",
  audio: "Sounds and tracks worth building a post around.",
  meme: "Formats that work as a reaction or a punchline.",
  video_format: "Repeatable shooting and editing structures.",
  hook: "Opening lines that earn the next three seconds.",
  saved: "Kept for this client and ready to turn into content.",
  library: "Everything kept, used or archived.",
};

const EMPTY_COPY: Record<TrendSection, { title: string; body: string }> = {
  discover: { title: "Nothing left to triage", body: "Pull in the latest from YouTube, or add a trend you spotted yourself." },
  audio: { title: "No audio trends yet", body: "Keep a sound from Discover and it lands here." },
  meme: { title: "No meme formats yet", body: "Keep a format from Discover and it lands here." },
  video_format: { title: "No video formats yet", body: "Keep a format from Discover and it lands here." },
  hook: { title: "No hooks yet", body: "Keep a hook from Discover and it lands here." },
  saved: { title: "Nothing saved yet", body: "Anything you keep in Discover shows up here, ready to brief." },
  library: { title: "The library is empty", body: "Saved, used and archived trends collect here over time." },
};

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return reduced;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(true);
  useEffect(() => {
    const list = window.matchMedia(query);
    const apply = () => setMatches(list.matches);
    apply();
    list.addEventListener("change", apply);
    return () => list.removeEventListener("change", apply);
  }, [query]);
  return matches;
}

function useDebounced<T>(value: T, delay = 180) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

type Toast = { id: number; message: string; undo?: () => void };

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, undo?: () => void) => {
      const id = (nextId.current += 1);
      setToasts((current) => [...current.slice(-2), { id, message, undo }]);
      window.setTimeout(() => dismiss(id), undo ? 6000 : 3200);
      return id;
    },
    [dismiss],
  );

  return { toasts, push, dismiss };
}

/** Brand colours like TikTok black vanish on a dark surface, so every
 *  platform colour is nudged a little toward the current text colour
 *  before it is used for ink. Backgrounds stay a plain tint. */
function platformInk(color: string) {
  return `color-mix(in srgb, ${color} 76%, var(--text))`;
}

function scoreTone(score: number) {
  if (score >= 70) return { label: "Strong fit", color: "var(--success)" };
  if (score >= 40) return { label: "Possible fit", color: "var(--warning)" };
  return { label: "Weak fit", color: "var(--text-subtle)" };
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-[var(--text-subtle)]">
        <span className="h-1 w-8 rounded-full bg-[var(--line-strong)]" />
        Not analysed
      </span>
    );
  }
  const tone = scoreTone(score);
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold tabular-nums" style={{ color: tone.color }}>
      <span className="relative h-1 w-8 overflow-hidden rounded-full bg-[var(--line-strong)]">
        <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out" style={{ width: `${score}%`, backgroundColor: tone.color }} />
      </span>
      {score}
    </span>
  );
}

const STATUS_PILL: Partial<Record<TrendRecord["status"], { label: string; tone: string }>> = {
  SAVED: { label: "Kept", tone: "var(--success)" },
  USED: { label: "Used", tone: "var(--accent)" },
  ARCHIVED: { label: "Archived", tone: "var(--text-subtle)" },
};

export function StatusPill({ status }: { status: TrendRecord["status"] }) {
  const meta = STATUS_PILL[status];
  if (!meta) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold"
      style={{ color: meta.tone, backgroundColor: `color-mix(in srgb, ${meta.tone} 13%, transparent)` }}
    >
      {meta.label}
    </span>
  );
}

/** Without a thumbnail the tile may as well say something, so it carries
 *  the format. That makes the list readable at a glance on the left edge. */
const TYPE_ICON: Partial<Record<TrendRecord["type"], typeof Video>> = {
  AUDIO: Music,
  MEME: Laugh,
  VIDEO_FORMAT: Video,
  HOOK: Quote,
};

/** One fixed slot at the head of every row and at the top of the preview, so
 *  the list keeps a straight edge whether or not a trend has a thumbnail. */
export function MediaThumb({ trend, size }: { trend: TrendRecord; size: number }) {
  const meta = TREND_PLATFORM_META[trend.platform];
  const videoId = trend.platform === "YOUTUBE" ? extractYoutubeVideoId(trend.sourceUrl) : null;
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg"
      style={{
        width: size,
        height: Math.round(size * 1.25),
        backgroundColor: `color-mix(in srgb, ${meta.color} 14%, var(--surface-muted))`,
      }}
      aria-hidden
    >
      {videoId ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={youtubeThumbnailUrl(videoId)} alt="" className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="h-3 w-3 fill-white text-white" />
          </span>
        </>
      ) : (
        (() => {
          const Icon = TYPE_ICON[trend.type] ?? Video;
          return <Icon style={{ color: platformInk(meta.color), width: size * 0.4, height: size * 0.4 }} strokeWidth={1.7} />;
        })()
      )}
    </span>
  );
}

function PlatformChip({ platform, small }: { platform: TrendPlatform; small?: boolean }) {
  const meta = TREND_PLATFORM_META[platform];
  return (
    <span
      className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold", small ? "px-1.5 py-0.5 text-[9.5px]" : "px-2 py-0.5 text-[10.5px]")}
      style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 12%, var(--surface-muted))`, color: platformInk(meta.color) }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: platformInk(meta.color) }} />
      {meta.label}
    </span>
  );
}

function TrendRow({
  trend,
  active,
  index,
  reduced,
  showStatus,
  onSelect,
  onOpen,
}: {
  trend: TrendRecord;
  active: boolean;
  index: number;
  reduced: boolean;
  showStatus: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const meta = TREND_PLATFORM_META[trend.platform];
  const popularity = readYoutubePopularity(trend);
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-row={trend.id}
      onClick={onSelect}
      onDoubleClick={onOpen}
      style={reduced ? undefined : { animationDelay: `${Math.min(index, 12) * 26}ms` }}
      className={cx(
        "group relative flex w-full items-center gap-3 rounded-xl py-2.5 pl-3.5 pr-2 text-left transition-colors duration-200",
        reduced ? "" : "ti-rise",
        FOCUS,
        active ? "bg-[var(--accent)]/[0.08] shadow-[var(--shadow-soft)]" : "hover:bg-[var(--surface-muted)]",
      )}
    >
      <span
        aria-hidden
        className={cx("absolute inset-y-2 left-0 w-[3px] rounded-full transition-all duration-300", active ? "opacity-100" : "opacity-0 group-hover:opacity-40")}
        style={{ backgroundColor: platformInk(meta.color) }}
      />

      <MediaThumb trend={trend} size={34} />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <PlatformChip platform={trend.platform} small />
          <span className="truncate text-[10.5px] text-[var(--text-subtle)]">
            {TREND_TYPE_META[trend.type].label}
            {trend.category ? ` · ${trend.category}` : ""}
          </span>
          {showStatus && <StatusPill status={trend.status} />}
        </span>

        <span className="mt-1 block truncate text-[12.5px] font-semibold leading-snug text-[var(--text)]">
          {trend.title}
        </span>

        <span className="mt-1 flex items-center gap-2">
          <ScoreBar score={trend.relevanceScore} />
          {popularity.views !== null && (
            <span className="truncate text-[10px] text-[var(--text-subtle)]">{formatCompactNumber(popularity.views)} views</span>
          )}
        </span>
      </span>

      <ChevronRight
        className={cx("h-3.5 w-3.5 shrink-0 transition-all duration-300", active ? "translate-x-0 text-[var(--text-muted)] opacity-100" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60")}
      />
    </button>
  );
}

function RowSkeleton({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl py-2.5 pl-3.5 pr-2" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="ti-pulse h-[42px] w-[34px] shrink-0 rounded-lg bg-[var(--surface-muted)]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="ti-pulse h-3 w-24 rounded-full bg-[var(--surface-muted)]" />
        <div className="ti-pulse h-3.5 w-[78%] rounded-full bg-[var(--surface-muted)]" />
        <div className="ti-pulse h-2.5 w-16 rounded-full bg-[var(--surface-muted)]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Preview pane                                                        */
/* ------------------------------------------------------------------ */

function PreviewPane({
  trend,
  busy,
  analyzing,
  generating,
  onAnalyze,
  onDetails,
  onGenerateVideo,
  onGenerateAiVideo,
  onGenerateGraphic,
  onCalendar,
  onSave,
  onArchive,
  showSave,
  showArchive,
}: {
  trend: TrendRecord;
  busy: boolean;
  analyzing: boolean;
  generating: boolean;
  onAnalyze: () => void;
  onDetails: () => void;
  onGenerateVideo: () => void;
  onGenerateAiVideo: () => void;
  onGenerateGraphic: () => void;
  onCalendar: () => void;
  onSave: () => void;
  onArchive: () => void;
  showSave: boolean;
  showArchive: boolean;
}) {
  const meta = TREND_PLATFORM_META[trend.platform];
  const caption = trend.suggestedCaptions[0];
  const idea = trend.aiAnalysis?.adaptationIdea;
  const videoId = trend.platform === "YOUTUBE" ? extractYoutubeVideoId(trend.sourceUrl) : null;
  const popularity = readYoutubePopularity(trend);
  const score = trend.relevanceScore;
  const tone = score === null ? { label: "Not analysed", color: "var(--text-subtle)" } : scoreTone(score);

  // The clip is evidence, not the headline, so it stays folded away until
  // it is asked for. Opening it used to push the whole trend off screen.
  const [playing, setPlaying] = useState(false);
  useEffect(() => setPlaying(false), [trend.id]);

  return (
    <div key={trend.id} className="ti-fade flex h-full min-h-0 flex-col">
      <div
        aria-hidden
        className="h-[3px] w-full shrink-0 rounded-full"
        style={{ background: `linear-gradient(90deg, ${platformInk(meta.color)}, color-mix(in srgb, ${meta.color} 16%, transparent))` }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {/* identity */}
        <div className="flex items-start gap-3">
          {videoId ? (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label="Play the original clip"
              className={cx("shrink-0 rounded-lg transition-transform hover:scale-[1.03]", FOCUS)}
            >
              <MediaThumb trend={trend} size={56} />
            </button>
          ) : (
            <MediaThumb trend={trend} size={56} />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <PlatformChip platform={trend.platform} />
              <span className="text-[10.5px] text-[var(--text-subtle)]">
                {TREND_TYPE_META[trend.type].label}
                {trend.category ? ` · ${trend.category}` : ""}
              </span>
              <StatusPill status={trend.status} />
            </div>
            <h3 className="mt-1.5 text-[16px] font-semibold leading-tight tracking-[-0.01em] text-[var(--text)]">{trend.title}</h3>
            {(popularity.channelTitle || popularity.views !== null || popularity.publishedAt) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[10.5px] text-[var(--text-subtle)]">
                {popularity.channelTitle && <span className="truncate">{popularity.channelTitle}</span>}
                {popularity.views !== null && <span>{formatCompactNumber(popularity.views)} views</span>}
                {popularity.publishedAt && <span>{new Date(popularity.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
              </p>
            )}
          </div>
        </div>

        {playing && videoId && (
          <div className="ti-fade mt-3 max-w-[200px]">
            <YoutubeEmbed videoId={videoId} title={trend.title} variant="compact" />
            <button type="button" onClick={() => setPlaying(false)} className={cx("mt-1 text-[10.5px] text-[var(--text-subtle)] hover:text-[var(--text)]", FOCUS)}>
              Hide clip
            </button>
          </div>
        )}

        {/* fit, with the analyse action where you notice it is missing */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[18px] font-bold leading-none tabular-nums" style={{ color: tone.color }}>
                {score === null ? "–" : score}
              </span>
              <span className="text-[11.5px] font-semibold" style={{ color: tone.color }}>{tone.label}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--line-strong)]">
              <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${score ?? 0}%`, backgroundColor: tone.color }} />
            </div>
          </div>
          {score === null && (
            <button type="button" onClick={onAnalyze} disabled={analyzing} className={cx(BTN_SECONDARY, "!h-8 shrink-0 !px-2.5 !text-[11px]")}>
              {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Analyse
            </button>
          )}
        </div>

        <p className="mt-4 text-[12.5px] leading-[1.65] text-[var(--text-muted)]">{trend.description}</p>

        {trend.recommendedFormats.length > 0 && (
          <p className="mt-3 text-[11px] text-[var(--text-subtle)]">
            Suggested format: <span className="text-[var(--text-muted)]">{trend.recommendedFormats[0]}</span>
          </p>
        )}

        {idea && (
          <div className="mt-4 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-tint)] p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">
              <Sparkles className="h-3 w-3" /> How to adapt it
            </p>
            <p className="mt-1.5 text-[12px] leading-[1.6] text-[var(--text)]">{idea}</p>
          </div>
        )}

        {caption && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">Suggested caption</p>
            <p className="mt-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-[12px] leading-[1.6] text-[var(--text)]">
              {caption}
            </p>
          </div>
        )}

        {trend.hashtags.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-subtle)]">Hashtags</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {trend.hashtags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-0.5 rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10.5px] text-[var(--text-muted)]">
                  <Hash className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--line)] p-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onGenerateVideo} disabled={busy || generating} title="Free animated text and motion graphics" className={cx(BTN_PRIMARY, "!h-9 flex-1 !text-[11.5px]")}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />} Standard Video
          </button>
          <button type="button" onClick={onGenerateAiVideo} disabled={busy || generating} title="Real AI-generated footage (Luma) — paid, confirmed before every clip" className={cx(BTN_PRIMARY, "!h-9 flex-1 !text-[11.5px]")}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} AI Video
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <button type="button" onClick={onGenerateGraphic} disabled={busy || generating} title="Generate graphic" className={cx(BTN_SECONDARY, "!h-9 flex-1 !px-2.5 !text-[11.5px]")}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />} Graphic
          </button>
          <button type="button" onClick={onCalendar} disabled={busy} title="Add to calendar" aria-label="Add to calendar" className={cx(BTN_SECONDARY, "!h-9 !w-9 shrink-0 !px-0")}>
            <Calendar className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDetails} title="Open full details" aria-label="Open full details" className={cx(BTN_SECONDARY, "!h-9 !w-9 shrink-0 !px-0")}>
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
        {(showSave || showArchive) && (
          <div className="mt-2 flex items-center gap-2">
            {showSave && (
              <button type="button" onClick={onSave} disabled={busy} className={cx(BTN_SECONDARY, "!h-8 flex-1 !text-[11px]")}>
                <Check className="h-3 w-3" /> Keep for this client
              </button>
            )}
            {showArchive && (
              <button type="button" onClick={onArchive} disabled={busy} className={cx(BTN_SECONDARY, "!h-8 flex-1 !text-[11px]")}>
                <Archive className="h-3 w-3" /> Archive
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function TrendIntelligenceHome({
  onGenerateGraphic,
  onGenerateVideo,
  onGenerateAiVideo,
  onAddToCalendar,
}: {
  /** Opens the Graphic Studio pre-filled with a brief built from this
   *  trend, and — when the admin uploaded one — an authorised
   *  reference image to generate a real, reference-conditioned image
   *  from (see TrendDetailModal's "Add reference image"). animateIntent
   *  and trendId are set only by "Generate Graphic → Animate" — they
   *  never affect what's generated, only whether Graphic Studio nudges
   *  toward "Animate with AI" once an image exists, and whether the
   *  eventual video stays linked back to this trend. */
  onGenerateGraphic: (brief: string, referenceImage?: { url: string; analysis: string }, animateIntent?: boolean, trendId?: string) => void;
  /** Opens the Video Studio (Standard Video — free animated text/
   *  motion-graphics) pre-filled with a brief built from this trend,
   *  pre-selecting a sensible platform (see platformDefault.ts). */
  onGenerateVideo: (brief: string, platform: SocialPlatform) => void;
  /** Opens the Video Studio in AI Video mode (real Luma-generated
   *  footage) pre-filled with the same adapted brief — a separate
   *  destination from onGenerateVideo above, never a replacement for
   *  it. trendId lets the resulting project be linked back to this
   *  trend once saved; referenceImage carries over whatever authorised
   *  reference TrendDetailModal's upload produced, same as
   *  onGenerateGraphic. */
  onGenerateAiVideo: (brief: string, platform: SocialPlatform, trendId: string, referenceImage?: { url: string; analysis: string }) => void;
  /** Opens the post composer pre-filled with a caption built from this
   *  trend — the admin picks the schedule date there, same existing
   *  mechanism GraphicWorkspace/VideoWorkspace already use. */
  onAddToCalendar: (caption: string) => void;
}) {
  const reduced = useReducedMotion();
  const { toasts, push, dismiss } = useToasts();

  const [section, setSection] = useState<TrendSection>("discover");
  const [platformFilter, setPlatformFilter] = useState<TrendPlatform | "">("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("fit");

  const [all, setAll] = useState<TrendRecord[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTrend, setDetailTrend] = useState<TrendRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const keyboardMove = useRef(false);
  const hasPreviewPane = useMediaQuery("(min-width: 1280px)");

  const debouncedSearch = useDebounced(search);
  const debouncedIndustry = useDebounced(industryFilter);

  /* ---- load once; every filter after that is in memory -------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listTrendsApi({});
        if (cancelled) return;
        setAll(list);
        setStatus("ready");
        setError(null);
      } catch {
        if (!cancelled) setStatus("error");
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }, []);

  /* ---- counts, filtering, sorting ----------------------------------- */
  const counts = useMemo(() => {
    const map = {} as Record<TrendSection, number>;
    for (const item of TREND_SECTIONS) map[item.id] = all.filter((trend) => sectionMatches(trend, item.id)).length;
    return map;
  }, [all]);

  const visible = useMemo(() => {
    const needle = debouncedSearch.trim().toLowerCase();
    const industry = debouncedIndustry.trim().toLowerCase();
    const rows = all.filter((trend) => {
      if (!sectionMatches(trend, section)) return false;
      if (platformFilter && trend.platform !== platformFilter) return false;
      if (industry && !`${trend.category ?? ""} ${trend.description}`.toLowerCase().includes(industry)) return false;
      if (needle) {
        const haystack = `${trend.title} ${trend.description} ${trend.category ?? ""} ${trend.hashtags.join(" ")}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    return rows.sort((a, b) => {
      if (sort === "unscored") {
        const aNull = a.relevanceScore === null ? 0 : 1;
        const bNull = b.relevanceScore === null ? 0 : 1;
        if (aNull !== bNull) return aNull - bNull;
      }
      return (b.relevanceScore ?? -1) - (a.relevanceScore ?? -1);
    });
  }, [all, section, platformFilter, debouncedIndustry, debouncedSearch, sort]);

  const selected = useMemo(
    () => visible.find((trend) => trend.id === selectedId) ?? visible[0] ?? null,
    [visible, selectedId],
  );

  const filtersActive = Boolean(platformFilter || industryFilter.trim() || search.trim());

  function clearFilters() {
    setPlatformFilter("");
    setIndustryFilter("");
    setSearch("");
  }

  /* ---- mutations ----------------------------------------------------- */
  const applyLocal = useCallback((updated: TrendRecord) => {
    setAll((current) => current.map((trend) => (trend.id === updated.id ? updated : trend)));
    setDetailTrend((current) => (current?.id === updated.id ? updated : current));
  }, []);

  const setStatusOptimistic = useCallback(
    async (trend: TrendRecord, next: TrendRecord["status"], note: string) => {
      const previous = trend.status;
      const index = visible.findIndex((item) => item.id === trend.id);
      const successor = visible[index + 1] ?? visible[index - 1] ?? null;

      setAll((current) => current.map((item) => (item.id === trend.id ? { ...item, status: next } : item)));
      if (successor && sectionMatches(trend, section)) setSelectedId(successor.id);
      setBusyId(trend.id);

      const undo = async () => {
        setAll((current) => current.map((item) => (item.id === trend.id ? { ...item, status: previous } : item)));
        setSelectedId(trend.id);
        try {
          await updateTrendStatusApi(trend.id, previous);
        } catch {
          reload();
        }
      };

      try {
        const updated = await updateTrendStatusApi(trend.id, next);
        applyLocal(updated);
        push(note, () => void undo());
      } catch {
        setAll((current) => current.map((item) => (item.id === trend.id ? { ...item, status: previous } : item)));
        push("That didn't save. Nothing was changed.");
      } finally {
        setBusyId(null);
      }
    },
    [applyLocal, push, reload, section, visible],
  );

  const handleSave = useCallback(
    (trend: TrendRecord) => void setStatusOptimistic(trend, "SAVED", `Kept "${trend.title}"`),
    [setStatusOptimistic],
  );
  const handleSkip = useCallback(
    (trend: TrendRecord) => void setStatusOptimistic(trend, "DISMISSED", "Passed on that one"),
    [setStatusOptimistic],
  );
  const handleArchive = useCallback(
    (trend: TrendRecord) => void setStatusOptimistic(trend, "ARCHIVED", "Moved to archive"),
    [setStatusOptimistic],
  );

  async function handleAnalyze(trendId: string, force: boolean) {
    if (analyzingId === trendId) return; // one click, one in-flight request
    setAnalyzingId(trendId);
    setError(null);
    try {
      const updated = await analyzeTrendApi(trendId, force);
      applyLocal(updated);
      push("Trend analysis complete.");
    } catch (err) {
      console.error("[TrendIntelligence] analyze failed", err);
      setError("Unable to analyse this trend. Please try again.");
    } finally {
      setAnalyzingId(null);
    }
  }

  /** Pulls in the trend's AI analysis (hook/storytelling/emotional
   *  appeal/adaptation idea/audience) so the brief handed to the AI
   *  concept generator is actually informed by why the trend works —
   *  not just its title and description. Ends with an explicit
   *  non-copying instruction, reinforced again at the prompt layer in
   *  lib/ai/videoConcepts.ts's STRUCTURE_RULES. */
  function buildBrief(trend: TrendRecord): string {
    const parts = [
      `A trending ${TREND_PLATFORM_META[trend.platform].label} ${TREND_TYPE_META[trend.type].label.toLowerCase()} titled "${trend.title}" caught our attention: ${trend.description}`,
    ];
    const analysis = trend.aiAnalysis;
    if (analysis?.whyInteresting) parts.push(`Why it's working: ${analysis.whyInteresting}`);
    if (analysis?.hookEffectiveness) parts.push(`What makes its hook effective: ${analysis.hookEffectiveness}`);
    if (analysis?.storytellingStructure) parts.push(`Its storytelling structure: ${analysis.storytellingStructure}`);
    if (analysis?.emotionalAppeal) parts.push(`Its emotional appeal: ${analysis.emotionalAppeal}`);
    if (analysis?.adaptationIdea) parts.push(`A fitting way to adapt the idea for our brand: ${analysis.adaptationIdea}`);
    if (trend.suitableAudiences.length > 0) parts.push(`Target audience: ${trend.suitableAudiences.join(", ")}`);
    if (trend.hashtags.length > 0) parts.push(`Relevant hashtags: ${trend.hashtags.map((tag) => `#${tag}`).join(" ")}`);
    parts.push(
      "Create an ORIGINAL piece only inspired by this trend's hook style, pacing and structure — write entirely new on-screen text, " +
        "scenes and visuals for our own brand. Do not reuse, quote, paraphrase, or closely describe the specific content, footage, dialogue, or imagery of the source.",
    );
    return parts.join(" ");
  }

  const markUsed = useCallback(
    async (trend: TrendRecord) => {
      try {
        const updated = await updateTrendStatusApi(trend.id, "USED");
        applyLocal(updated);
      } catch {
        /* best-effort — the row will reflect reality on next refresh */
      }
    },
    [applyLocal],
  );

  /** The Trend Adaptation Engine step shared by both Generate actions
   *  — the actual logic lives in generationFlow.ts (pure, unit-tested
   *  without a DOM or a live AI call); this just wires it to the
   *  real API functions and local state. */
  const adaptTrendForGeneration = useCallback(
    async (trend: TrendRecord, additionalContext: string | undefined, referenceImage?: { url: string; analysis: string }) => {
      const result = await resolveGenerationBrief(
        trend,
        additionalContext,
        {
          analyzeTrend: analyzeTrendApi,
          adaptTrend: adaptTrendApi,
          buildBrief,
          notify: push,
        },
        referenceImage,
      );
      applyLocal(result.trend);
      return result;
    },
    [applyLocal, push],
  );

  const handleGenerateGraphic = useCallback(
    async (trend: TrendRecord, additionalContext?: string, referenceImage?: { url: string; analysis: string }, animateIntent?: boolean) => {
      if (generatingId === trend.id) return; // one click, one in-flight request
      setGeneratingId(trend.id);
      setError(null);
      push("Preparing your graphic…");
      try {
        const { brief } = await adaptTrendForGeneration(trend, additionalContext, referenceImage);
        onGenerateGraphic(brief, referenceImage, animateIntent, trend.id);
        setDetailTrend(null);
        await markUsed(trend);
      } catch (err) {
        console.error("[TrendIntelligence] Generate Graphic failed", err);
        setError("Couldn't open the Graphic Studio for this trend. Please try again.");
      } finally {
        setGeneratingId(null);
      }
    },
    [adaptTrendForGeneration, onGenerateGraphic, markUsed, push, generatingId],
  );

  const handleGenerateVideo = useCallback(
    async (trend: TrendRecord, additionalContext?: string) => {
      if (generatingId === trend.id) return; // one click, one in-flight request
      setGeneratingId(trend.id);
      setError(null);
      push("Preparing your video…");
      try {
        const { brief, suitablePlatforms } = await adaptTrendForGeneration(trend, additionalContext);
        const platform = suitablePlatforms.find(isSocialPlatform);
        onGenerateVideo(brief, platform ?? defaultPlatformForTrend(trend));
        setDetailTrend(null);
        await markUsed(trend);
      } catch (err) {
        console.error("[TrendIntelligence] Generate Video failed", err);
        setError("Couldn't open the Video Studio for this trend. Please try again.");
      } finally {
        setGeneratingId(null);
      }
    },
    [adaptTrendForGeneration, onGenerateVideo, markUsed, push, generatingId],
  );

  /** "Generate AI Video" — a separate destination from Generate Video
   *  above, never a silent substitute for it. Same Trend Adaptation
   *  Engine round trip, with the trend's id and any analysed reference
   *  image carried through (the reference describes a single still
   *  image, never the source video's own motion/camera work/editing —
   *  see aiVideoConcepts.ts's prompt instructions for how that
   *  limitation is communicated to the model). */
  const handleGenerateAiVideo = useCallback(
    async (trend: TrendRecord, additionalContext?: string, referenceImage?: { url: string; analysis: string }) => {
      if (generatingId === trend.id) return; // one click, one in-flight request
      setGeneratingId(trend.id);
      setError(null);
      push("Preparing your AI video…");
      try {
        const { brief, suitablePlatforms } = await adaptTrendForGeneration(trend, additionalContext, referenceImage);
        const platform = suitablePlatforms.find(isSocialPlatform);
        onGenerateAiVideo(brief, platform ?? defaultPlatformForTrend(trend), trend.id, referenceImage);
        setDetailTrend(null);
        await markUsed(trend);
      } catch (err) {
        console.error("[TrendIntelligence] Generate AI Video failed", err);
        setError("Couldn't open the AI Video Studio for this trend. Please try again.");
      } finally {
        setGeneratingId(null);
      }
    },
    [adaptTrendForGeneration, onGenerateAiVideo, markUsed, push, generatingId],
  );

  const handleAddToCalendar = useCallback(
    (trend: TrendRecord) => {
      const caption = trend.suggestedCaptions[0] ?? buildBrief(trend);
      onAddToCalendar(caption);
      push("Opened the composer with this trend's caption");
    },
    [onAddToCalendar, push],
  );

  async function handleDiscover() {
    setDiscovering(true);
    setError(null);
    try {
      const result = await discoverYoutubeTrendsApi();
      reload();
      if (result.discovered === 0) {
        push("No matching YouTube Shorts right now. The trending mix changes through the day — try again later.");
      } else {
        const parts: string[] = [];
        if (result.created > 0) parts.push(`${result.created} new`);
        if (result.updated > 0) parts.push(`${result.updated} refreshed`);
        let message = `${result.discovered} YouTube trend${result.discovered === 1 ? "" : "s"} pulled (${parts.join(", ")})`;
        if (section !== "discover" || filtersActive) message += ". Open Discover with filters cleared to see them.";
        push(message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed.");
    } finally {
      setDiscovering(false);
    }
  }

  /* ---- keyboard ------------------------------------------------------- */
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing || detailTrend || importOpen || section === "discover") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (visible.length === 0) return;

      const index = Math.max(0, visible.findIndex((trend) => trend.id === selected?.id));

      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        keyboardMove.current = true;
        setSelectedId(visible[Math.min(index + 1, visible.length - 1)].id);
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        keyboardMove.current = true;
        setSelectedId(visible[Math.max(index - 1, 0)].id);
      } else if (selected) {
        if (event.key === "Enter") {
          event.preventDefault();
          setDetailTrend(selected);
        } else if (event.key.toLowerCase() === "v") {
          handleGenerateVideo(selected);
        } else if (event.key.toLowerCase() === "g") {
          handleGenerateGraphic(selected);
        } else if (event.key.toLowerCase() === "c") {
          handleAddToCalendar(selected);
        } else if (event.key.toLowerCase() === "s" && selected.status !== "SAVED") {
          handleSave(selected);
        } else if (event.key.toLowerCase() === "a" && selected.status !== "ARCHIVED") {
          handleArchive(selected);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, selected, section, detailTrend, importOpen, handleAddToCalendar, handleSave, handleArchive, handleGenerateVideo, handleGenerateGraphic]);

  /* Follow the selection only when the keyboard moved it. Doing this on
     every change made a plain click nudge the list under the pointer. */
  useEffect(() => {
    if (!selected || !keyboardMove.current) return;
    keyboardMove.current = false;
    listRef.current?.querySelector(`[data-row="${CSS.escape(selected.id)}"]`)?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [selected, reduced]);

  const sectionLabel = TREND_SECTIONS.find((item) => item.id === section)?.label ?? "";
  const isDiscover = section === "discover";

  /* ------------------------------------------------------------------ */
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <style>{`
        @keyframes ti-rise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes ti-fade { from { opacity: 0; transform: translateX(6px) } to { opacity: 1; transform: none } }
        @keyframes ti-pulse { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
        @keyframes ti-toast { from { opacity: 0; transform: translateY(8px) scale(.97) } to { opacity: 1; transform: none } }
        .ti-rise { animation: ti-rise 420ms cubic-bezier(0.22,1,0.36,1) both }
        .ti-fade { animation: ti-fade 320ms cubic-bezier(0.22,1,0.36,1) both }
        .ti-pulse { animation: ti-pulse 1.4s ease-in-out infinite }
        .ti-toast { animation: ti-toast 260ms cubic-bezier(0.22,1,0.36,1) both }
        @media (prefers-reduced-motion: reduce) {
          .ti-rise, .ti-fade, .ti-pulse, .ti-toast { animation: none !important }
        }
      `}</style>

      {/* ---------------------------------------------------------- bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-[230px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-subtle)]" />
          <input
            ref={searchRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && setSearch("")}
            placeholder="Search trends"
            aria-label="Search trends"
            className={cx(INPUT, "h-9 pl-9 pr-8")}
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className={cx("absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-[var(--text-subtle)] hover:text-[var(--text)]", FOCUS)}>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setPlatformFilter("")}
            className={cx("h-9 shrink-0 rounded-lg px-2.5 text-[11px] font-medium transition-colors", FOCUS, platformFilter === "" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]")}
          >
            All
          </button>
          {(Object.keys(TREND_PLATFORM_META) as TrendPlatform[]).map((value) => {
            const meta = TREND_PLATFORM_META[value];
            const on = platformFilter === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setPlatformFilter(on ? "" : value)}
                aria-pressed={on}
                className={cx("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium transition-colors", FOCUS, on ? "text-[var(--text)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]")}
                style={on ? { backgroundColor: `color-mix(in srgb, ${meta.color} 14%, var(--surface-muted))`, color: platformInk(meta.color) } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: platformInk(meta.color) }} />
                {meta.label}
              </button>
            );
          })}
        </div>

        <input
          value={industryFilter}
          onChange={(event) => setIndustryFilter(event.target.value)}
          placeholder="Industry"
          aria-label="Filter by industry"
          className={cx(INPUT, "h-9 !w-[104px] shrink-0 px-3")}
        />

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={reload} disabled={refreshing} title="Refresh" aria-label="Refresh" className={cx(BTN_SECONDARY, "!h-9 !w-9 !px-0")}>
            <RefreshCw className={cx("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
          <button type="button" onClick={handleDiscover} disabled={discovering} className={cx(BTN_SECONDARY, "!h-9 !px-3 !text-[11px]")}>
            {discovering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Discover</span>
          </button>
          <button type="button" onClick={() => setImportOpen(true)} className={cx(BTN_PRIMARY, "!h-9 !px-3 !text-[11px]")}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Add trend</span>
          </button>
        </div>
      </div>

      {error && (
        <div className={cx(CARD, "flex items-center justify-between gap-3 border-[var(--danger)]/30 bg-[var(--danger)]/[0.06] px-3 py-2")}>
          <p className="text-[11.5px] text-[var(--danger)]">{error}</p>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className={cx("text-[var(--danger)]", FOCUS)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* --------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1 gap-4 max-lg:flex-col" style={{ minHeight: 460 }}>
        {/* rail */}
        <aside className="hidden w-44 shrink-0 lg:block">
          <nav className="space-y-4">
            {SECTION_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-[0.13em] text-[var(--text-subtle)]">{group.label}</p>
                <div className="space-y-0.5">
                  {group.ids.map((id) => {
                    const item = TREND_SECTIONS.find((entry) => entry.id === id);
                    if (!item) return null;
                    const on = section === id;
                    const count = counts[id] ?? 0;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSection(id)}
                        aria-current={on}
                        className={cx(
                          "group relative flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[12px] font-medium transition-colors duration-200",
                          FOCUS,
                          on ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cx("absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-[var(--accent)] transition-all duration-300", on ? "opacity-100" : "scale-y-0 opacity-0")}
                        />
                        <span className="truncate">{item.label}</span>
                        <span className={cx("ml-auto shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums transition-colors", on ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "bg-[var(--surface-muted)] text-[var(--text-subtle)]")}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* mobile section rail */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
          {TREND_SECTIONS.map((item) => {
            const on = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cx("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-medium transition-colors", FOCUS, on ? "bg-[var(--accent)]/12 text-[var(--accent)]" : "bg-[var(--surface-muted)] text-[var(--text-muted)]")}
              >
                {item.label}
                <span className="text-[10px] tabular-nums opacity-70">{counts[item.id] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* main */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="mb-2 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[14px] font-semibold tracking-[-0.01em] text-[var(--text)]">{sectionLabel}</h2>
              <p className="truncate text-[11px] text-[var(--text-subtle)]">
                {status === "ready" && filtersActive
                  ? `${visible.length} of ${counts[section] ?? 0} match`
                  : SECTION_BLURB[section]}
              </p>
            </div>
            {!isDiscover && status === "ready" && (
              <div className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--surface-muted)] p-0.5">
                {([["fit", "Best fit"], ["unscored", "Needs analysis"]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSort(value)}
                    aria-pressed={sort === value}
                    className={cx("rounded-md px-2 py-1 text-[10.5px] font-medium transition-colors", FOCUS, sort === value ? "bg-[var(--surface)] text-[var(--text)] shadow-sm" : "text-[var(--text-subtle)] hover:text-[var(--text)]")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* loading */}
          {status === "loading" && (
            <div className={cx(CARD, "min-h-0 flex-1 overflow-hidden p-2")}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <RowSkeleton key={index} index={index} />
              ))}
            </div>
          )}

          {/* error */}
          {status === "error" && (
            <div className={cx(CARD, "flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center")}>
              <Layers className="h-6 w-6 text-[var(--text-subtle)]" />
              <div>
                <p className="text-[13px] font-semibold text-[var(--text)]">Couldn&apos;t load trends</p>
                <p className="mt-1 text-[11.5px] text-[var(--text-subtle)]">The request didn&apos;t come back. Check the connection and try again.</p>
              </div>
              <button type="button" onClick={reload} className={cx(BTN_SECONDARY, "!h-9 !px-3 !text-[11.5px]")}>
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          )}

          {/* discover: triage */}
          {status === "ready" && isDiscover && visible.length > 0 && (
            <div className="mx-auto min-h-0 w-full max-w-[520px] flex-1">
              <TrendSwiper
                trends={visible}
                onSave={handleSave}
                onSkip={handleSkip}
                onViewDetails={setDetailTrend}
                onAnalyze={(trend) => handleAnalyze(trend.id, false)}
                analyzingId={analyzingId}
                onGenerateVideo={handleGenerateVideo}
                onGenerateAiVideo={handleGenerateAiVideo}
                onGenerateGraphic={handleGenerateGraphic}
                generatingId={generatingId}
                onAddToCalendar={handleAddToCalendar}
                onExhausted={() => undefined}
              />
            </div>
          )}

          {/* list + preview */}
          {status === "ready" && !isDiscover && visible.length > 0 && (
            <div className="flex min-h-0 flex-1 gap-3">
              <div ref={listRef} role="listbox" aria-label={`${sectionLabel} trends`} className={cx(CARD, "min-h-0 w-full overflow-y-auto p-1.5 xl:w-[46%] xl:max-w-[440px]")}>
                {visible.map((trend, index) => (
                  <TrendRow
                    key={trend.id}
                    trend={trend}
                    index={index}
                    reduced={reduced}
                    active={selected?.id === trend.id}
                    showStatus={section === "library"}
                    onSelect={() => {
                      setSelectedId(trend.id);
                      // Under xl there is no preview pane, so a bare select
                      // would look like nothing happened.
                      if (!hasPreviewPane) setDetailTrend(trend);
                    }}
                    onOpen={() => setDetailTrend(trend)}
                  />
                ))}
              </div>

              {selected && (
                <div className={cx(CARD, "hidden min-h-0 flex-1 overflow-hidden xl:flex xl:flex-col")}>
                  <PreviewPane
                    trend={selected}
                    busy={busyId === selected.id}
                    analyzing={analyzingId === selected.id}
                    generating={generatingId === selected.id}
                    onAnalyze={() => handleAnalyze(selected.id, false)}
                    showSave={selected.status !== "SAVED"}
                    showArchive={section === "saved" || section === "library"}
                    onDetails={() => setDetailTrend(selected)}
                    onGenerateVideo={() => handleGenerateVideo(selected)}
                    onGenerateAiVideo={() => handleGenerateAiVideo(selected)}
                    onGenerateGraphic={() => handleGenerateGraphic(selected)}
                    onCalendar={() => handleAddToCalendar(selected)}
                    onSave={() => handleSave(selected)}
                    onArchive={() => handleArchive(selected)}
                  />
                </div>
              )}
            </div>
          )}

          {/* empty */}
          {status === "ready" && visible.length === 0 && (
            <div className={cx(CARD, "flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center")}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--text-subtle)]">
                <Layers className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-[var(--text)]">
                  {filtersActive ? "Nothing matches those filters" : EMPTY_COPY[section].title}
                </p>
                <p className="mx-auto mt-1 max-w-[320px] text-[11.5px] leading-relaxed text-[var(--text-subtle)]">
                  {filtersActive ? "Try a different platform, or clear the filters to see everything in this section." : EMPTY_COPY[section].body}
                </p>
              </div>
              {filtersActive ? (
                <button type="button" onClick={clearFilters} className={cx(BTN_SECONDARY, "!h-9 !px-3 !text-[11.5px]")}>
                  <X className="h-3.5 w-3.5" /> Clear filters
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleDiscover} disabled={discovering} className={cx(BTN_SECONDARY, "!h-9 !px-3 !text-[11.5px]")}>
                    {discovering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Discover trends
                  </button>
                  <button type="button" onClick={() => setImportOpen(true)} className={cx(BTN_PRIMARY, "!h-9 !px-3 !text-[11.5px]")}>
                    <Plus className="h-3.5 w-3.5" /> Add one manually
                  </button>
                </div>
              )}
            </div>
          )}

          {/* shortcut hint */}
          {status === "ready" && !isDiscover && visible.length > 0 && (
            <p className="mt-2 hidden items-center gap-3 text-[10px] text-[var(--text-subtle)] xl:flex">
              {[["↑ ↓", "move"], ["enter", "details"], ["V", "video"], ["G", "graphic"], ["C", "calendar"], ["S", "keep"], ["/", "search"]].map(([key, label]) => (
                <span key={key} className="inline-flex items-center gap-1">
                  <kbd className="rounded border border-[var(--line)] bg-[var(--surface-muted)] px-1 py-px font-sans text-[9.5px] text-[var(--text-muted)]">{key}</kbd>
                  {label}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------- modals */}
      {detailTrend && (
        <TrendDetailModal
          trend={detailTrend}
          analyzing={analyzingId === detailTrend.id}
          generating={generatingId === detailTrend.id}
          onAnalyze={(force) => handleAnalyze(detailTrend.id, force)}
          onSave={() => {
            handleSave(detailTrend);
            setDetailTrend(null);
          }}
          onSkip={() => {
            handleSkip(detailTrend);
            setDetailTrend(null);
          }}
          onGenerateVideo={(ctx) => handleGenerateVideo(detailTrend, ctx)}
          onGenerateAiVideo={(ctx, referenceImage) => handleGenerateAiVideo(detailTrend, ctx, referenceImage)}
          onGenerateGraphic={(ctx, referenceImage, animateIntent) => handleGenerateGraphic(detailTrend, ctx, referenceImage, animateIntent)}
          onAddToCalendar={() => handleAddToCalendar(detailTrend)}
          onClose={() => setDetailTrend(null)}
        />
      )}

      {importOpen && (
        <TrendImportForm
          onClose={() => setImportOpen(false)}
          onCreated={() => {
            setImportOpen(false);
            reload();
            push("Trend added");
          }}
        />
      )}

      {/* -------------------------------------------------------- toasts */}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[240] flex -translate-x-1/2 flex-col items-center gap-2">
          {toasts.map((toast) => (
            <div key={toast.id} className="ti-toast pointer-events-auto flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-2 pl-4 pr-2 shadow-[var(--shadow-popover)]">
              <span className="max-w-[320px] text-[11.5px] font-medium leading-snug text-[var(--text)]">{toast.message}</span>
              {toast.undo && (
                <button
                  type="button"
                  onClick={() => {
                    toast.undo?.();
                    dismiss(toast.id);
                  }}
                  className={cx("inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10", FOCUS)}
                >
                  <Undo2 className="h-3 w-3" /> Undo
                </button>
              )}
              <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss" className={cx("flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-subtle)] hover:text-[var(--text)]", FOCUS)}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}