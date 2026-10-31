/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Full-workspace Video Studio — the video counterpart to
// GraphicWorkspace.tsx, same full-bleed rendering convention (see
// FullWorkspaceContext.tsx / SocialMediaTab.tsx) and now the same
// layout language: a four-item rail, one panel at a time with a pinned
// action footer, and notices that float instead of shoving the preview
// down the page.
//
// Deliberately a SMALLER editor than the Graphic Studio: no drag/
// resize/transform — a scene's on-screen text is edited via plain form
// fields, not by dragging it on the canvas. The Konva Stage here exists
// to render and RECORD the real video, not to be a general-purpose
// layout tool.
//
// What the scene list used to be is now a timeline: a filmstrip whose
// tiles are as wide as the scenes are long, with a playhead and a
// scrub track above it. Selecting, reordering, duplicating and
// trimming all happen there, which is why the left panel can be the
// scene's properties rather than a list stacked on top of an editor.
//
// No server-side video rendering exists anywhere in this app (no
// ffmpeg/Remotion/headless-Chromium) and none is added here. Instead,
// the Stage's own merged frame (stage.toCanvas()) is drawn onto a
// hidden capture <canvas> every animation frame while the scene
// timeline plays in real time, and canvas.captureStream() feeds a
// MediaRecorder producing a video/webm Blob — entirely client-side,
// uploaded through the exact same /media/upload route every other
// image already uses (it already accepts video/webm, see
// lib/social-media/media.ts).
//
// No trending-sound matching — explicitly out of scope (no public API
// for it). Every recorded video is silent; the admin adds sound
// manually later if they want it.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text as KonvaText } from "react-konva";
import type Konva from "konva";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Film,
  ImagePlus,
  Loader2,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  Video as VideoIcon,
  Wand2,
  X,
} from "lucide-react";

import {
  AiApiError,
  createAiVideoJobApi,
  createContentProjectApi,
  generateAiVideoConceptsApi,
  generateGraphicImageApi,
  generateMotionSuggestionsApi,
  generateVideoConceptsApi,
  getAiVideoJobApi,
  getBrandKitApi,
  getImageUsageApi,
  listAiVideoJobsApi,
  updateContentProjectApi,
  uploadMediaAssetApi,
  type CompanyBrandKit,
  type ImageUsageSnapshot,
  type MotionSuggestion,
  type UploadedAsset,
} from "../api";
import { MediaLibraryPicker } from "./MediaLibraryPicker";
import type { MediaLibraryAsset } from "../api";
import { BTN_PRIMARY, BTN_SECONDARY, cx, FOCUS, INPUT } from "../../shared/styles";
import { PLATFORMS } from "../../shared/constants";
import type { SocialPlatform } from "../../shared/types";
import { canvasSizeForPlatform, newLayerId, type ImageLayer } from "./canvas";
import { VIDEO_SCENE_IMAGE_QUALITY, VIDEO_SCENE_IMAGE_SIZE } from "@/lib/ai/videoImageDefaults";
import type { VideoConcept } from "@/lib/ai/types";
import type { AiVideoConcept } from "@/lib/ai/aiVideoTypes";
import { AI_VIDEO_DURATIONS, AI_VIDEO_RESOLUTIONS, type AiVideoDurationSeconds, type AiVideoResolution } from "@/lib/ai/videoGenTypes";
import { estimateVideoCostUsd, nearestAvailableDuration } from "@/lib/ai/videoCost";
import {
  conceptToAiVideoCanvasData,
  conceptToVideoCanvasData,
  MAX_SCENES,
  newScene,
  textLayerOf,
  totalDurationSeconds,
  VIDEO_BACKGROUND_SWATCHES,
  withLogo,
  withoutLogo,
  withSceneText,
  type VideoCanvasData,
  type VideoScene,
} from "./videoCanvas";
import { applyVideoTemplate, VIDEO_TEMPLATE_IDS, VIDEO_TEMPLATE_LABELS } from "./videoTemplates";
import { VideoConceptSwiper } from "./VideoConceptSwiper";

/** The prop type call sites already pass. Kept as-is so nothing
 *  upstream changes; mapped once on mount onto the rail's sections. */
type LeftPanelTab = "concepts" | "scenes";
type AiStatus = "idle" | "loading" | "ready" | "error" | "not-configured";

type Section = "create" | "scene" | "video";

const SECTION_FOR_TAB: Record<LeftPanelTab, Section> = {
  concepts: "create",
  scenes: "scene",
};

const SECTIONS: { id: Section; label: string; icon: typeof Film; hint: string }[] = [
  { id: "create", label: "Create", icon: Sparkles, hint: "Describe it, let AI storyboard it" },
  { id: "scene", label: "Scene", icon: Film, hint: "Edit the selected scene" },
  { id: "video", label: "Video", icon: SlidersHorizontal, hint: "Caption, branding and format" },
];

const FADE_SECONDS = 0.35;
const TEXT_ENTRANCE_SECONDS = 0.4;
const KEN_BURNS_MAX_SCALE = 0.08;
const MAX_SCENE_SECONDS = 12;
const MIN_SCENE_SECONDS = 1;

/** Far enough into a scene that its transition and text entrance have
 *  both finished. Parking the playhead here when idle is what stops a
 *  fade scene previewing as an empty black frame. */
const SETTLE_SECONDS = Math.max(FADE_SECONDS, TEXT_ENTRANCE_SECONDS) + 0.15;

const TRANSITIONS: { id: VideoScene["transition"]; label: string }[] = [
  { id: "cut", label: "Cut" },
  { id: "fade", label: "Fade" },
  { id: "slide", label: "Slide" },
  { id: "zoom", label: "Zoom" },
];

const TEXT_ENTRANCES: { id: VideoScene["textEntrance"]; label: string }[] = [
  { id: "none", label: "None" },
  { id: "slide-up-fade", label: "Slide up" },
  { id: "pop", label: "Pop" },
];

const DURATION_PRESETS = [2, 3, 4, 5, 6, 8];

const WORKSPACE_CSS = `
.vw-rise { animation: vw-rise 220ms cubic-bezier(0.22,1,0.36,1) both; }
@keyframes vw-rise { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
.vw-fade { animation: vw-fade 180ms ease-out both; }
@keyframes vw-fade { from { opacity: 0; } to { opacity: 1; } }
.vw-notice { animation: vw-notice 260ms cubic-bezier(0.22,1,0.36,1) both; }
@keyframes vw-notice { from { opacity: 0; transform: translateY(-8px) scale(0.985); } to { opacity: 1; transform: none; } }
.vw-rec { animation: vw-rec 1.3s ease-in-out infinite; }
@keyframes vw-rec { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
.vw-pulse { animation: vw-pulse 1.8s ease-in-out infinite; }
@keyframes vw-pulse { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }
.vw-scroll { scrollbar-width: thin; scrollbar-color: var(--line-strong) transparent; }
.vw-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
.vw-scroll::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 99px; border: 3px solid transparent; background-clip: content-box; }
.vw-scroll::-webkit-scrollbar-track { background: transparent; }
.vw-norail { scrollbar-width: none; }
.vw-norail::-webkit-scrollbar { display: none; }
.vw-scrub { -webkit-appearance: none; appearance: none; background: transparent; }
.vw-scrub::-webkit-slider-runnable-track { height: 100%; background: transparent; }
.vw-scrub::-moz-range-track { height: 100%; background: transparent; }
.vw-scrub::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 3px; height: 20px; border-radius: 2px; background: var(--accent); box-shadow: 0 0 0 1px var(--surface); cursor: ew-resize; }
.vw-scrub::-moz-range-thumb { width: 3px; height: 20px; border: none; border-radius: 2px; background: var(--accent); cursor: ew-resize; }
@media (prefers-reduced-motion: reduce) {
  .vw-rise, .vw-fade, .vw-notice, .vw-rec, .vw-pulse { animation: none !important; }
}
`;

function useKonvaImage(src: string | null): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = src;
  }, [src]);

  return image;
}

/** A slow, deterministic pan/zoom on AI-generated scene backgrounds —
 *  no randomness, so what's previewed is exactly what gets recorded.
 *  Direction alternates by scene index purely for visual variety. */
function SceneBackgroundImage({
  src,
  width,
  height,
  progress,
  zoomOut,
}: {
  src: string;
  width: number;
  height: number;
  /** 0-1 across the scene's own duration. */
  progress: number;
  zoomOut: boolean;
}) {
  const image = useKonvaImage(src);
  if (!image) return null;
  const t = zoomOut ? 1 - progress : progress;
  const scale = 1 + KEN_BURNS_MAX_SCALE * t;
  return (
    <KonvaImage
      image={image}
      x={width / 2}
      y={height / 2}
      offsetX={width / 2}
      offsetY={height / 2}
      width={width}
      height={height}
      scaleX={scale}
      scaleY={scale}
    />
  );
}

function SceneLogoImage({ layer }: { layer: ImageLayer }) {
  const image = useKonvaImage(layer.src || null);
  if (!image) return null;
  return <KonvaImage image={image} x={layer.x} y={layer.y} width={layer.width} height={layer.height} />;
}

/** The whole-scene transition — a pure function of local time, so the
 *  live preview and the frame-by-frame recording always match. "cut"
 *  is the identity transform. */
function sceneGroupTransform(scene: VideoScene, localTime: number): { opacity: number; x: number; scaleX: number; scaleY: number } {
  const t = Math.min(1, Math.max(0, localTime / FADE_SECONDS));
  switch (scene.transition) {
    case "fade":
      return { opacity: t, x: 0, scaleX: 1, scaleY: 1 };
    case "slide":
      return { opacity: 1, x: 60 * (1 - t), scaleX: 1, scaleY: 1 };
    case "zoom":
      return { opacity: t, x: 0, scaleX: 0.94 + 0.06 * t, scaleY: 0.94 + 0.06 * t };
    case "cut":
    default:
      return { opacity: 1, x: 0, scaleX: 1, scaleY: 1 };
  }
}

/** The on-screen text's own entrance — independent of, and shorter
 *  than, the whole-scene transition above. */
function textEntranceTransform(scene: VideoScene, localTime: number): { opacity: number; yOffset: number } {
  const t = Math.min(1, Math.max(0, localTime / TEXT_ENTRANCE_SECONDS));
  switch (scene.textEntrance) {
    case "slide-up-fade":
      return { opacity: t, yOffset: 24 * (1 - t) };
    case "pop":
      return { opacity: t, yOffset: 0 };
    case "none":
    default:
      return { opacity: 1, yOffset: 0 };
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*);base64/)?.[1] ?? "image/png";
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mime });
}

function locateScene(scenes: VideoScene[], time: number): { scene: VideoScene; index: number; localTime: number } | null {
  let elapsed = 0;
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    if (time < elapsed + scene.durationSeconds || i === scenes.length - 1) {
      return { scene, index: i, localTime: time - elapsed };
    }
    elapsed += scene.durationSeconds;
  }
  return null;
}

function sceneStartSeconds(scenes: VideoScene[], index: number): number {
  let elapsed = 0;
  for (let i = 0; i < index && i < scenes.length; i++) elapsed += scenes[i].durationSeconds;
  return elapsed;
}

/** Where the playhead parks when a scene is picked rather than played:
 *  past its own entrance, so the frame on screen is the scene itself. */
function settledTimeForScene(scenes: VideoScene[], index: number): number {
  const scene = scenes[index];
  if (!scene) return 0;
  return sceneStartSeconds(scenes, index) + Math.min(scene.durationSeconds * 0.6, SETTLE_SECONDS);
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function pickMediaRecorderMimeType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) ?? "";
}

/** A reasonable aspect-ratio string for Luma from the canvas's own
 *  pixel dimensions — this app's canvases are always one of
 *  portrait/landscape/square per the selected platform, so a simple
 *  comparison is enough; no need for a full GCD-ratio calculation. */
function aspectRatioForCanvas(width: number, height: number): string {
  if (width === height) return "1:1";
  return width > height ? "16:9" : "9:16";
}

/* ---------------------------------------------------------------- *
 * Small presentational pieces, local so the toolbar and the transport
 * can carry disabled and pressed states without changing the shared
 * button styles every other admin tab relies on.
 * ---------------------------------------------------------------- */

function ToolButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg transition duration-150 disabled:opacity-30",
        pressed
          ? "bg-[var(--accent-tint)] text-[var(--accent)]"
          : "text-[var(--text-muted)] enabled:hover:bg-[var(--surface-hover)] enabled:hover:text-[var(--text)]",
        FOCUS,
      )}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[10px] font-semibold tracking-[0.07em] text-[var(--text-subtle)] uppercase">{children}</p>;
}

function Chip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition duration-150 disabled:opacity-40",
        active
          ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]"
          : "border-[var(--line)] text-[var(--text-muted)] enabled:hover:border-[var(--line-strong)] enabled:hover:text-[var(--text)]",
        FOCUS,
      )}
    >
      {children}
    </button>
  );
}

export function VideoWorkspace({
  title: initialTitle,
  initialCanvasData,
  projectId: initialProjectId,
  initialPanel = "concepts",
  initialBrief = "",
  initialPlatform,
  initialVideoMode = "standard",
  initialReferenceImage = null,
  initialStartFrameImage = null,
  autoGenerateConcepts = false,
  onClose,
  onCreateWithAsset,
  onProjectSaved,
}: {
  title: string;
  initialCanvasData: VideoCanvasData;
  projectId: string | null;
  /** "concepts" for a brand-new video, "scenes" when reopening a saved
   *  project (nothing to generate). */
  initialPanel?: LeftPanelTab;
  /** Pre-fills the concepts brief — used by Trend Intelligence's
   *  "Generate content" action to seed the brief from a trend's hook/
   *  adaptation idea. The admin can still edit it before generating. */
  initialBrief?: string;
  /** Pre-selects the platform dropdown (and sizes initialCanvasData
   *  accordingly, via blankVideoCanvasDataForPlatform — see
   *  videoCanvas.ts) when opening from a trend. Defaults to TikTok for
   *  a plain "new video" with no trend context, same as before this
   *  prop existed. */
  initialPlatform?: SocialPlatform;
  /** Which Create-panel flow is active on mount — "ai" when Trend
   *  Intelligence's "Generate AI Video" (not the plain "Generate
   *  Video") hands off here, so the auto-fire effect below calls
   *  generateAiConcepts() instead of the Standard Video generateConcepts().
   *  Defaults to "standard" for every other entry point, unchanged. */
  initialVideoMode?: "standard" | "ai";
  /** An admin-uploaded, authorised reference image (its stable URL plus
   *  the vision provider's analysis) carried over from Trend
   *  Intelligence's TrendDetailModal — informs the AI Video concept
   *  prompts' visual direction (see generateAiConcepts below). Only
   *  meaningful alongside initialVideoMode="ai"; Standard Video ignores
   *  it, same as before this prop existed. */
  initialReferenceImage?: { url: string; analysis: string } | null;
  /** An image to animate, carried over from Graphic Studio's "Animate
   *  with AI" (see GraphicWorkspace.tsx's onAnimateWithAi) — when set,
   *  the Image-to-Video sub-mode opens pre-selected with this image
   *  already attached, so the admin never re-uploads anything. url is
   *  always one of our own Cloudinary delivery URLs (re-validated
   *  server-side regardless — see resolveTrustedStartFrame). */
  initialStartFrameImage?: { url: string; assetId?: string } | null;
  /** Fires generateConcepts() once on mount when true and a brief is
   *  present — used only by the Trend Intelligence hand-off so one
   *  click goes straight to 3 concepts. Default false preserves every
   *  other entry point's existing manual-click behaviour. */
  autoGenerateConcepts?: boolean;
  onClose: () => void;
  /** Same contract as GraphicWorkspace's prop of the same name — opens
   *  the existing composer with the recorded video already attached. */
  onCreateWithAsset: (caption: string, asset: UploadedAsset) => void;
  /** Called once, right after this workspace's very first save creates
   *  a brand-new ContentProject (never on a later update to an already-
   *  saved one) — lets a Trend Intelligence hand-off link the trend to
   *  the resulting project for traceability, without VideoWorkspace
   *  itself needing to know anything about trends. Optional; every
   *  non-trend entry point simply omits it. */
  onProjectSaved?: (projectId: string) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [canvasData, setCanvasData] = useState<VideoCanvasData>(initialCanvasData);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [section, setSection] = useState<Section>(SECTION_FOR_TAB[initialPanel]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(initialCanvasData.scenes[0]?.id ?? null);
  const [caption, setCaption] = useState("");

  // Real brand colours/logo (Graphic Studio's BrandKitPanel already
  // uses this exact call).
  const [brandKit, setBrandKit] = useState<CompanyBrandKit | null>(null);
  const [logoEnabled, setLogoEnabled] = useState(true);
  useEffect(() => {
    void getBrandKitApi().then(setBrandKit);
  }, []);
  const swatches = brandKit?.primaryColors?.length ? [...brandKit.primaryColors, ...(brandKit.secondaryColors ?? [])].slice(0, 6) : VIDEO_BACKGROUND_SWATCHES;

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);

  const [containerSize, setContainerSize] = useState({ width: 420, height: 560 });

  // Playback preview (not recording).
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTimeState] = useState(() => settledTimeForScene(initialCanvasData.scenes, 0));
  const timeRef = useRef(currentTime);

  /** Single writer for the playhead, so the rAF loops and the scrub
   *  track never disagree about where it is. */
  const seek = useCallback((seconds: number) => {
    timeRef.current = seconds;
    setCurrentTimeState(seconds);
  }, []);

  // Recording — drives its own timing loop independently of the
  // preview loop below; `recording` gates that effect off so the two
  // never both advance the playhead.
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [recordMode, setRecordMode] = useState<"publish" | "download">("publish");

  // Undo/redo over the whole canvas document, matching the Graphic
  // Studio. Typing into a field updates live; the history entry lands
  // when the edit is finished (blur, or a discrete control changing).
  const historyRef = useRef<VideoCanvasData[]>([initialCanvasData]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // "Create with AI" concepts step.
  const [brief, setBrief] = useState(initialBrief);
  const [platform, setPlatform] = useState<SocialPlatform>(initialPlatform ?? "TIKTOK");
  const [conceptStatus, setConceptStatus] = useState<AiStatus>("idle");
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [conceptMissingEnvVars, setConceptMissingEnvVars] = useState<string[]>([]);
  const [concepts, setConcepts] = useState<VideoConcept[] | null>(null);

  // Per-scene "generate AI background" — a separate paid call, same
  // mandatory cost-confirm idiom as the Graphic Studio's image path.
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [imageUsage, setImageUsage] = useState<ImageUsageSnapshot | null>(null);
  const [imageConfirm, setImageConfirm] = useState<{ sceneId: string; estimatedCostUsd: number } | null>(null);

  // AI Video — real generated footage via Luma, a separate "Mode B"
  // from the free text/motion-graphics flow above. videoMode only
  // changes which Create-panel flow is shown; it never affects scenes
  // already on the canvas (a scene from either path behaves the same
  // way once it exists).
  const [videoMode, setVideoMode] = useState<"standard" | "ai">(initialVideoMode);
  // Read once on mount — this is Trend Intelligence hand-off context,
  // never edited afterward (there's no UI to change/clear it; starting
  // a fresh AI Video brief from scratch just means not coming from a
  // trend in the first place).
  const [aiReferenceImage] = useState(initialReferenceImage);
  const [aiConceptStatus, setAiConceptStatus] = useState<AiStatus>("idle");
  const [aiConceptError, setAiConceptError] = useState<string | null>(null);
  const [aiConceptMissingEnvVars, setAiConceptMissingEnvVars] = useState<string[]>([]);
  const [aiConcepts, setAiConcepts] = useState<AiVideoConcept[] | null>(null);
  const [videoResolution, setVideoResolution] = useState<AiVideoResolution>("360p");
  const [videoDuration, setVideoDuration] = useState<AiVideoDurationSeconds>(5);
  const [videoJobConfirm, setVideoJobConfirm] = useState<{ sceneId: string; estimatedCostUsd: number } | null>(null);
  const [generatingVideoSceneId, setGeneratingVideoSceneId] = useState<string | null>(null);
  const [videoJobError, setVideoJobError] = useState<string | null>(null);
  const aiConceptRequestRef = useRef(false);

  // Image to Video — the second AI Video generation method, alongside
  // Text to Video above. aiGenerationMethod only changes which
  // Create-panel flow is shown within videoMode === "ai"; a scene
  // created either way behaves identically afterward (see
  // startFrameImageUrl on VideoScene in videoCanvas.ts).
  const [aiGenerationMethod, setAiGenerationMethod] = useState<"text" | "image">(initialStartFrameImage ? "image" : "text");
  const [startFrameImage, setStartFrameImage] = useState<{ url: string; assetId?: string } | null>(initialStartFrameImage);
  const [motionPrompt, setMotionPrompt] = useState("");
  const [imageAttachUploading, setImageAttachUploading] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [motionSuggestStatus, setMotionSuggestStatus] = useState<AiStatus>("idle");
  const [motionSuggestError, setMotionSuggestError] = useState<string | null>(null);
  const [motionSuggestions, setMotionSuggestions] = useState<MotionSuggestion[] | null>(null);
  const imageAttachFileInputRef = useRef<HTMLInputElement>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const recordCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backgroundTargetRef = useRef<string | null>(null);
  const conceptRequestRef = useRef(false);
  const publishingRef = useRef(false);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setContainerSize({ width: rect.width, height: rect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const scale = Math.min(1, containerSize.width / canvasData.width, containerSize.height / canvasData.height);
  const totalSeconds = totalDurationSeconds(canvasData);
  const scenes = canvasData.scenes;
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? scenes[0] ?? null;

  // The playhead is the single source of truth for what the stage
  // shows, playing or not. Parking it past a scene's entrance (see
  // settledTimeForScene) is what keeps a paused fade scene visible
  // instead of rendering at opacity zero.
  const located = locateScene(scenes, currentTime);
  const displayScene = located?.scene ?? null;
  const displayLocalTime = located?.localTime ?? 0;
  const displaySceneIndex = located?.index ?? -1;
  const groupTransform = displayScene ? sceneGroupTransform(displayScene, displayLocalTime) : { opacity: 1, x: 0, scaleX: 1, scaleY: 1 };
  const textTransform = displayScene ? textEntranceTransform(displayScene, displayLocalTime) : { opacity: 1, yOffset: 0 };
  const kenBurnsProgress = displayScene && displayScene.durationSeconds > 0 ? Math.min(1, displayLocalTime / displayScene.durationSeconds) : 0;

  /* ----------------------------- history ---------------------------- */

  const pushHistory = (next: VideoCanvasData) => {
    const truncated = historyRef.current.slice(0, historyIndexRef.current + 1);
    truncated.push(next);
    while (truncated.length > 50) truncated.shift();
    historyRef.current = truncated;
    historyIndexRef.current = truncated.length - 1;
  };

  /** Live update — no history entry (typing, dragging a colour). */
  const setLive = (updater: (current: VideoCanvasData) => VideoCanvasData) => {
    setCanvasData(updater);
    setDirty(true);
  };

  /** Committed update — the edit is finished, so it becomes an undo
   *  step (add/remove/reorder/duplicate, a picker changing, a blur). */
  const commit = (updater: (current: VideoCanvasData) => VideoCanvasData) => {
    setCanvasData((current) => {
      const next = updater(current);
      pushHistory(next);
      return next;
    });
    setDirty(true);
    setCanUndo(true);
    setCanRedo(false);
  };

  /** Marks whatever the live edits produced as one history step. */
  const commitCurrent = () => commit((current) => current);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setCanvasData(historyRef.current[historyIndexRef.current]);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
    setDirty(true);
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setCanvasData(historyRef.current[historyIndexRef.current]);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    setDirty(true);
  }, []);

  /* ---------------------------- playback ---------------------------- */

  // Preview-only playback loop — never runs while recording (that has
  // its own loop, see runRecording()).
  useEffect(() => {
    if (!playing || recording || totalSeconds <= 0) return;
    let raf = 0;
    let last = performance.now();
    let time = timeRef.current;
    const tick = (now: number) => {
      time += (now - last) / 1000;
      last = now;
      if (time >= totalSeconds) {
        seek(settledTimeForScene(scenes, 0));
        setPlaying(false);
        return;
      }
      seek(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, recording, totalSeconds, seek]);

  // Keeps the live-preview <video> element (real AI/Luma footage — see
  // the Stage JSX, which draws nothing for a "video" background since
  // Konva has no native video node) in sync with the playhead: playing
  // while the preview plays, paused and seeked to match while scrubbed
  // or paused. Runs after every render (cheap, threshold-guarded) since
  // it has to react to displayLocalTime changing continuously during
  // playback, which a dependency array can't usefully express here.
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || displayScene?.background.kind !== "video") return;
    if (playing && !recording) {
      if (video.paused) void video.play().catch(() => undefined);
    } else {
      if (!video.paused) video.pause();
      if (Math.abs(video.currentTime - displayLocalTime) > 0.1) video.currentTime = displayLocalTime;
    }
  });

  const selectScene = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    const index = scenes.findIndex((scene) => scene.id === sceneId);
    if (index >= 0) seek(settledTimeForScene(scenes, index));
    setSection("scene");
    setPanelOpen(true);
  };

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      // Pausing hands the panel whatever the playhead landed on, so the
      // preview and the scene being edited never drift apart.
      const at = locateScene(scenes, timeRef.current);
      if (at) setSelectedSceneId(at.scene.id);
      return;
    }
    if (timeRef.current >= totalSeconds - 0.05) seek(0);
    setPlaying(true);
  };

  const restart = () => {
    seek(0);
    setPlaying(true);
  };

  /* ------------------------------ scenes ---------------------------- */

  function updateScene(sceneId: string, updater: (scene: VideoScene) => VideoScene, shouldCommit = true) {
    const apply = (current: VideoCanvasData): VideoCanvasData => ({
      ...current,
      scenes: current.scenes.map((scene) => (scene.id === sceneId ? updater(scene) : scene)),
    });
    if (shouldCommit) commit(apply);
    else setLive(apply);
  }

  function addScene() {
    if (scenes.length >= MAX_SCENES) return;
    let scene = newScene({ text: "", durationSeconds: 4, width: canvasData.width, height: canvasData.height });
    if (logoEnabled && brandKit?.logoUrl) scene = withLogo(scene, brandKit.logoUrl, canvasData.width, canvasData.height);
    commit((current) => ({ ...current, scenes: [...current.scenes, scene] }));
    setSelectedSceneId(scene.id);
    setSection("scene");
    setPanelOpen(true);
  }

  function duplicateScene(sceneId: string) {
    if (scenes.length >= MAX_SCENES) return;
    const index = scenes.findIndex((scene) => scene.id === sceneId);
    const source = scenes[index];
    if (!source) return;
    const copy: VideoScene = {
      ...source,
      id: newLayerId(),
      layers: source.layers.map((layer) => ({ ...layer, id: newLayerId() })),
    };
    commit((current) => {
      const next = [...current.scenes];
      next.splice(index + 1, 0, copy);
      return { ...current, scenes: next };
    });
    setSelectedSceneId(copy.id);
  }

  /** Applies/strips the logo layer on every scene — called when the
   *  toggle changes, and from selectConcept() so a fresh set of AI
   *  scenes starts consistent with the current toggle state. */
  function applyLogoToggle(data: VideoCanvasData, enabled: boolean): VideoCanvasData {
    if (!brandKit?.logoUrl) return data;
    return {
      ...data,
      scenes: data.scenes.map((scene) => (enabled ? withLogo(scene, brandKit.logoUrl as string, data.width, data.height) : withoutLogo(scene))),
    };
  }

  function toggleLogo(enabled: boolean) {
    setLogoEnabled(enabled);
    commit((current) => applyLogoToggle(current, enabled));
  }

  function removeScene(sceneId: string) {
    const index = scenes.findIndex((scene) => scene.id === sceneId);
    commit((current) => ({ ...current, scenes: current.scenes.filter((scene) => scene.id !== sceneId) }));
    const remaining = scenes.filter((scene) => scene.id !== sceneId);
    const fallback = remaining[Math.min(index, remaining.length - 1)] ?? null;
    setSelectedSceneId(fallback?.id ?? null);
    seek(fallback ? settledTimeForScene(remaining, Math.min(index, remaining.length - 1)) : 0);
  }

  function moveScene(sceneId: string, direction: -1 | 1) {
    commit((current) => {
      const index = current.scenes.findIndex((scene) => scene.id === sceneId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.scenes.length) return current;
      const next = [...current.scenes];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, scenes: next };
    });
  }

  async function uploadSceneBackground(file: File) {
    const sceneId = backgroundTargetRef.current;
    if (!sceneId) return;
    setUploadingBackground(true);
    setError(null);
    try {
      const asset = await uploadMediaAssetApi(file, file.name);
      updateScene(sceneId, (current) => ({ ...current, background: { kind: "image", src: asset.url }, pendingImagePrompt: undefined }));
    } catch (caught) {
      setError(caught instanceof AiApiError ? caught.message : "Image upload failed.");
    } finally {
      setUploadingBackground(false);
    }
  }

  /* -------------------------------- AI ------------------------------ */

  async function generateConcepts() {
    if (conceptRequestRef.current || !brief.trim()) return;
    conceptRequestRef.current = true;
    setConceptStatus("loading");
    setConceptError(null);
    try {
      const result = await generateVideoConceptsApi({ brief: brief.trim(), platform });
      setConcepts(result);
      setConceptStatus("ready");
    } catch (caught) {
      if (caught instanceof AiApiError && caught.missingEnvVars?.length) {
        setConceptMissingEnvVars(caught.missingEnvVars);
        setConceptStatus("not-configured");
      } else {
        setConceptError(caught instanceof Error ? caught.message : "Couldn't generate video concepts.");
        setConceptStatus("error");
      }
    } finally {
      conceptRequestRef.current = false;
    }
  }

  // Trend Intelligence hand-off only — fires exactly once, never on a
  // brief/platform edit after mount. Dispatches to whichever flow
  // initialVideoMode selected — "Generate Video" (Standard, free) vs
  // "Generate AI Video" (real Luma footage) are two distinct trend
  // destinations, never silently substituted for one another.
  const autoGenerateFiredRef = useRef(false);
  useEffect(() => {
    if (!autoGenerateConcepts || autoGenerateFiredRef.current || !initialBrief.trim()) return;
    autoGenerateFiredRef.current = true;
    setSection("create");
    if (initialVideoMode === "ai") void generateAiConcepts();
    else void generateConcepts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectConcept(concept: VideoConcept) {
    const sized = conceptToVideoCanvasData(concept, canvasData.width, canvasData.height, canvasData.fps, swatches);
    // Scene 1 is the hook (per lib/ai/videoConcepts.ts's prompt rules) —
    // give it the bolder template; the rest get the calmer one. Still
    // fully overridable afterward via the per-scene "Style" picker.
    const templated: VideoCanvasData = {
      ...sized,
      scenes: sized.scenes.map((scene, index) =>
        applyVideoTemplate(scene, index === 0 ? "bold-hook" : "minimal-caption", { width: sized.width, height: sized.height }),
      ),
    };
    const next = applyLogoToggle(templated, logoEnabled);
    commit(() => next);
    setCaption(concept.caption);
    setSelectedSceneId(next.scenes[0]?.id ?? null);
    seek(settledTimeForScene(next.scenes, 0));
    setSection("scene");
  }

  async function openSceneImageConfirm(scene: VideoScene) {
    try {
      const { usage, estimatedCostUsd } = await getImageUsageApi(VIDEO_SCENE_IMAGE_SIZE, VIDEO_SCENE_IMAGE_QUALITY, "generate");
      setImageUsage(usage);
      setImageConfirm({ sceneId: scene.id, estimatedCostUsd });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't check today's usage.");
    }
  }

  async function generateSceneImage(sceneId: string) {
    const scene = scenes.find((item) => item.id === sceneId);
    if (!scene?.pendingImagePrompt || generatingSceneId) return;
    setImageConfirm(null);
    setGeneratingSceneId(sceneId);
    setError(null);
    try {
      const result = await generateGraphicImageApi({ brief: scene.pendingImagePrompt, platform, size: VIDEO_SCENE_IMAGE_SIZE, quality: VIDEO_SCENE_IMAGE_QUALITY, background: true });
      const blob = dataUrlToBlob(`data:${result.mimeType};base64,${result.base64}`);
      const asset = await uploadMediaAssetApi(blob, "scene-background.png");
      setImageUsage(result.usage);
      updateScene(sceneId, (current) => ({ ...current, background: { kind: "image", src: asset.url }, pendingImagePrompt: undefined }));
    } catch (caught) {
      setError(caught instanceof AiApiError ? caught.message : "Couldn't generate the background.");
    } finally {
      setGeneratingSceneId(null);
    }
  }

  /* ------------------------- save and record ------------------------ */

  // A plain function (not useCallback) — this file's dominant pattern
  // for handlers (generateConcepts, record, etc.); the React Compiler
  // could not preserve useCallback's manual memoization once this
  // function gained a second return path (needed so a brand-new,
  // never-saved project's id is available immediately to the caller —
  // see generateSceneVideo), and stable identity across renders isn't
  // load-bearing for save() the way it would be for, say, a prop passed
  // down to a memoized child.
  async function save(): Promise<string | null> {
    setSaving(true);
    setError(null);
    try {
      let id = projectId;
      if (id) {
        await updateContentProjectApi(id, { title, canvasData });
      } else {
        const project = await createContentProjectApi(title, canvasData, "VIDEO");
        id = project.id;
        setProjectId(id);
        onProjectSaved?.(id);
      }
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 1600);
      return id;
    } catch (caught) {
      setError(caught instanceof AiApiError ? caught.message : "Save failed.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function generateAiConcepts() {
    if (aiConceptRequestRef.current || !brief.trim()) return;
    aiConceptRequestRef.current = true;
    setAiConceptStatus("loading");
    setAiConceptError(null);
    try {
      const result = await generateAiVideoConceptsApi({
        brief: brief.trim(),
        platform,
        aspectRatio: aspectRatioForCanvas(canvasData.width, canvasData.height),
        referenceAnalysis: aiReferenceImage?.analysis,
      });
      setAiConcepts(result);
      setAiConceptStatus("ready");
    } catch (caught) {
      if (caught instanceof AiApiError && caught.missingEnvVars?.length) {
        setAiConceptMissingEnvVars(caught.missingEnvVars);
        setAiConceptStatus("not-configured");
      } else {
        setAiConceptError(caught instanceof Error ? caught.message : "Couldn't generate video concepts.");
        setAiConceptStatus("error");
      }
    } finally {
      aiConceptRequestRef.current = false;
    }
  }

  function selectAiConcept(concept: AiVideoConcept) {
    const sized = conceptToAiVideoCanvasData(concept, canvasData.width, canvasData.height, canvasData.fps, swatches);
    const next = applyLogoToggle(sized, logoEnabled);
    commit(() => next);
    setCaption(concept.suggestedCaption);
    setAiConcepts(null);
    setSelectedSceneId(next.scenes[0]?.id ?? null);
    seek(settledTimeForScene(next.scenes, 0));
    setSection("scene");
  }

  async function attachImageFile(file: File) {
    setImageAttachUploading(true);
    setVideoJobError(null);
    try {
      const asset = await uploadMediaAssetApi(file, file.name);
      setStartFrameImage({ url: asset.url, assetId: asset.id });
      setMotionSuggestions(null);
    } catch (caught) {
      setVideoJobError(caught instanceof AiApiError ? caught.message : "Couldn't upload that image.");
    } finally {
      setImageAttachUploading(false);
    }
  }

  function selectLibraryImage(asset: MediaLibraryAsset) {
    setStartFrameImage({ url: asset.url, assetId: asset.id });
    setMotionSuggestions(null);
    setMediaPickerOpen(false);
  }

  function removeStartFrameImage() {
    setStartFrameImage(null);
    setMotionSuggestions(null);
    setMotionSuggestStatus("idle");
  }

  async function suggestMotion() {
    if (!startFrameImage) return;
    setMotionSuggestStatus("loading");
    setMotionSuggestError(null);
    try {
      const result = await generateMotionSuggestionsApi({ imageUrl: startFrameImage.url, userContext: brief.trim() || undefined });
      setMotionSuggestions(result);
      setMotionSuggestStatus("ready");
    } catch (caught) {
      if (caught instanceof AiApiError && caught.missingEnvVars?.length) {
        setMotionSuggestStatus("not-configured");
      } else {
        setMotionSuggestError(caught instanceof Error ? caught.message : "Couldn't suggest motion for this image.");
        setMotionSuggestStatus("error");
      }
    }
  }

  /** Builds one new scene from the attached image + motion prompt and
   *  goes straight into the existing cost-confirm flow — image-to-video
   *  doesn't go through the 3-concepts/storyboard step (that's the
   *  text-to-video flow above); it's a direct single-clip generation,
   *  per the primary workflow: Generate Image → Select Image → Animate
   *  with AI → Configure Motion → Confirm Cost → Generate Video. */
  function startImageToVideoGeneration() {
    if (!startFrameImage || !motionPrompt.trim()) return;
    const scene: VideoScene = {
      ...newScene({ text: "", durationSeconds: 5, width: canvasData.width, height: canvasData.height }),
      aiVideoPrompt: motionPrompt.trim(),
      startFrameImageUrl: startFrameImage.url,
    };
    const withLogoApplied = logoEnabled && brandKit?.logoUrl ? withLogo(scene, brandKit.logoUrl, canvasData.width, canvasData.height) : scene;
    const newIndex = scenes.length;
    commit((current) => ({ ...current, scenes: [...current.scenes, withLogoApplied] }));
    setSelectedSceneId(withLogoApplied.id);
    seek(settledTimeForScene([...scenes, withLogoApplied], newIndex));
    setSection("scene");
    openVideoJobConfirm(withLogoApplied);
  }

  function openVideoJobConfirm(scene: VideoScene) {
    // Image-to-video is 5s-only at Luma (verified against their own
    // docs: start_frame/end_frame are rejected with duration "10s") —
    // enforced here, not just hoped for, so the dialog never offers an
    // invalid combination in the first place.
    if (scene.startFrameImageUrl) {
      const estimate = estimateVideoCostUsd(videoResolution, 5);
      if (!estimate.available) {
        setVideoJobError(`${videoResolution} isn't available yet — choose a different resolution.`);
        return;
      }
      setVideoDuration(5);
      setVideoJobError(null);
      setVideoJobConfirm({ sceneId: scene.id, estimatedCostUsd: estimate.estimatedCostUsd });
      return;
    }

    // Default the duration picker to whatever this scene's own timeline
    // slot already is, falling back to one actually priced at the
    // current resolution (see nearestAvailableDuration's own comment —
    // found via a real trend-adapted 10s scene silently failing to
    // open this dialog at the default 360p resolution, which only
    // prices 5s).
    const resolvedDuration = nearestAvailableDuration(videoResolution, scene.durationSeconds);
    const estimate = estimateVideoCostUsd(videoResolution, resolvedDuration);
    if (!estimate.available) {
      setVideoJobError(`${videoResolution} isn't available yet — choose a different resolution.`);
      return;
    }
    setVideoDuration(resolvedDuration);
    setVideoJobError(null);
    setVideoJobConfirm({ sceneId: scene.id, estimatedCostUsd: estimate.estimatedCostUsd });
  }

  async function generateSceneVideo(sceneId: string) {
    const scene = scenes.find((item) => item.id === sceneId);
    if (!scene?.aiVideoPrompt?.trim() || generatingVideoSceneId) return;
    setVideoJobConfirm(null);
    setGeneratingVideoSceneId(sceneId);
    setVideoJobError(null);
    try {
      // A scene-linked job needs a saved project to attach to, so the
      // "resume on reopen" lookup (listAiVideoJobsApi) has something to
      // key off — save first if this is a brand-new, never-saved project.
      const targetProjectId = projectId ?? (await save());
      if (!targetProjectId) {
        setVideoJobError("Couldn't save the project — try Save first.");
        return;
      }
      const job = await createAiVideoJobApi({
        prompt: scene.aiVideoPrompt.trim(),
        aspectRatio: aspectRatioForCanvas(canvasData.width, canvasData.height),
        resolution: videoResolution,
        durationSeconds: videoDuration,
        contentProjectId: targetProjectId,
        sceneId,
        // The server re-validates this is one of our own Cloudinary
        // delivery URLs regardless (resolveTrustedStartFrame) — never
        // trusted just because it's present here.
        sourceImageUrl: scene.startFrameImageUrl,
      });
      updateScene(sceneId, (current) => ({ ...current, pendingVideoJobId: job.id }));
    } catch (caught) {
      setVideoJobError(caught instanceof AiApiError ? caught.message : "Couldn't start video generation.");
    } finally {
      setGeneratingVideoSceneId(null);
    }
  }

  // Live-tab polling — while this project is open, any scene with a
  // pending Luma job is checked every ~5s and applied the moment it
  // completes or fails. The cron poller (app/api/cron/ai-video-poll)
  // is the safety net for a job started and then abandoned; this is the
  // fast path for the common case of staying on the page.
  const pendingVideoJobsKey = scenes.map((scene) => scene.pendingVideoJobId ?? "").join(",");
  useEffect(() => {
    const pending = scenes.filter((scene): scene is VideoScene & { pendingVideoJobId: string } => Boolean(scene.pendingVideoJobId));
    if (pending.length === 0) return;

    let cancelled = false;
    const interval = setInterval(() => {
      void (async () => {
        for (const scene of pending) {
          try {
            const job = await getAiVideoJobApi(scene.pendingVideoJobId);
            if (cancelled) return;
            if (job.status === "COMPLETED" && job.outputVideoUrl) {
              const url = job.outputVideoUrl;
              updateScene(scene.id, (current) =>
                current.pendingVideoJobId === job.id
                  ? { ...current, background: { kind: "video", src: url }, pendingVideoJobId: undefined, durationSeconds: job.durationSeconds }
                  : current,
              );
            } else if (job.status === "FAILED") {
              setVideoJobError(job.errorMessage ?? "Video generation failed.");
              updateScene(scene.id, (current) => (current.pendingVideoJobId === job.id ? { ...current, pendingVideoJobId: undefined } : current));
            }
          } catch {
            // Transient — retried on the next tick, same posture as
            // publishing.ts's TikTok poller.
          }
        }
      })();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVideoJobsKey]);

  // Resume-on-reopen — any job that finished (or failed) while this
  // project's tab was closed is reconciled here, once, on mount.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      const jobs = await listAiVideoJobsApi(projectId);
      if (cancelled) return;
      for (const job of jobs) {
        if (!job.sceneId) continue;
        if (job.status === "COMPLETED" && job.outputVideoUrl) {
          const url = job.outputVideoUrl;
          updateScene(job.sceneId, (current) =>
            current.pendingVideoJobId === job.id
              ? { ...current, background: { kind: "video", src: url }, pendingVideoJobId: undefined, durationSeconds: job.durationSeconds }
              : current,
          );
        } else if (job.status === "FAILED" || job.status === "CANCELLED") {
          updateScene(job.sceneId, (current) => (current.pendingVideoJobId === job.id ? { ...current, pendingVideoJobId: undefined } : current));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  /** Plays the timeline once in real time, copying the Stage's merged
   *  frame onto the hidden capture canvas each tick, and resolves with
   *  the recorded webm. Shared by both the publish and download paths
   *  so there is only ever one recording implementation. */
  async function runRecording(): Promise<Blob> {
    const stage = stageRef.current;
    const captureCanvas = recordCanvasRef.current;
    if (!stage || !captureCanvas) throw new Error("Couldn't access the canvas.");

    captureCanvas.width = canvasData.width;
    captureCanvas.height = canvasData.height;
    const ctx = captureCanvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't set up recording.");

    const mimeType = pickMediaRecorderMimeType();
    if (!mimeType) throw new Error("This browser can't record video. Try Chrome or Edge.");

    const stream = (captureCanvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(canvasData.fps);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    // Real AI video (Luma) scene backgrounds have no Konva node (Konva
    // has no native video element) — their frames are drawn straight
    // into the capture canvas here, underneath the Konva Stage's own
    // frame (which, for a "video" background, draws no opaque
    // rect — see the Stage JSX — so only its text/logo layers composite
    // on top). Each clip is played in real time rather than seeked
    // frame-by-frame, since HTMLVideoElement.currentTime seeks are
    // asynchronous and unreliable inside a tight rAF loop; this is a
    // known v1 simplification — a recording with several DIFFERENT
    // video-background scenes may show a brief loading frame at each
    // cut while the next clip's video element starts playing, since
    // real-time playback is the source of truth, not a seek.
    const videoCache = new Map<string, HTMLVideoElement>();
    let activeVideo: HTMLVideoElement | null = null;

    // Preload every distinct video-background source BEFORE the
    // recorder starts. Found via real export testing that this alone
    // (just waiting for "loadeddata") was NOT enough — the very first
    // captured frame was still blank. The reason: readyState>=2 only
    // means a frame COULD be decoded, not that the browser's decode/
    // paint pipeline has actually presented one yet; that pipeline only
    // really spins up once .play() is called. So beyond preloading,
    // the first scene's video is also given a brief real "pre-roll"
    // play/pause cycle below, priming the decoder before recording
    // starts, confirmed by inspecting the exported file frame-by-frame
    // with ffprobe/ffmpeg (not just trusting that MediaRecorder
    // finished without error). Preloading every source, not just the
    // first scene's, still reduces (though doesn't fully eliminate) the
    // blank-frame risk at a cut between two different video scenes
    // later in the timeline — pre-rolling every one of them as well
    // would make the export noticeably slower to start, which isn't
    // worth it for that secondary case.
    const videoSources = Array.from(new Set(scenes.map((scene) => (scene.background.kind === "video" ? scene.background.src : null)).filter((src): src is string => Boolean(src))));
    await Promise.all(
      videoSources.map(
        (src) =>
          new Promise<void>((resolveLoad) => {
            const video = document.createElement("video");
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = "anonymous";
            const onReady = () => resolveLoad();
            video.addEventListener("loadeddata", onReady, { once: true });
            video.addEventListener("error", onReady, { once: true }); // never let one bad video hang the whole export
            video.src = src;
            videoCache.set(src, video);
          }),
      ),
    );

    const nextRaf = () => new Promise<number>((resolveFrame) => requestAnimationFrame(resolveFrame));
    const firstSceneBackground = scenes[0]?.background;
    if (firstSceneBackground?.kind === "video") {
      const primer = videoCache.get(firstSceneBackground.src);
      if (primer) {
        try {
          await primer.play();
          await nextRaf();
          await nextRaf(); // a second real paint, not just one — one alone still sometimes drew blank in testing
        } catch {
          // Autoplay can be blocked in some contexts — the tick loop's
          // own .play() call below is the real fallback; this is only
          // a best-effort warm-up.
        } finally {
          primer.pause();
          primer.currentTime = 0;
        }
      }
    }

    return new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Recording failed."));
      recorder.onstop = () => {
        activeVideo?.pause();
        resolve(new Blob(chunks, { type: "video/webm" }));
      };

      seek(0);
      setRecordProgress(0);
      recorder.start();

      const totalMs = totalSeconds * 1000;
      let last = performance.now();
      let elapsedMs = 0;

      const tick = (now: number) => {
        elapsedMs += now - last;
        last = now;
        const elapsedSeconds = Math.min(elapsedMs / 1000, totalSeconds);
        seek(elapsedSeconds);
        setRecordProgress(Math.min(1, elapsedMs / totalMs));

        const located = locateScene(scenes, elapsedSeconds);
        ctx.clearRect(0, 0, captureCanvas.width, captureCanvas.height);

        if (located?.scene.background.kind === "video") {
          const src = located.scene.background.src;
          let video = videoCache.get(src);
          if (!video) {
            video = document.createElement("video");
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = "anonymous";
            video.src = src;
            videoCache.set(src, video);
          }
          if (activeVideo !== video) {
            activeVideo?.pause();
            // Only seek if it isn't already essentially at 0 — an
            // explicit currentTime assignment triggers a "seeking"
            // state that can itself transiently blank the next
            // drawImage() even when the video was already there (this
            // mattered for the pre-rolled first scene specifically).
            if (video.currentTime > 0.03) video.currentTime = 0;
            void video.play().catch(() => undefined);
            activeVideo = video;
          }
          if (video.readyState >= 2) ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        } else if (activeVideo) {
          activeVideo.pause();
          activeVideo = null;
        }

        const frame = stage.toCanvas({ pixelRatio: 1 });
        ctx.drawImage(frame, 0, 0, captureCanvas.width, captureCanvas.height);

        if (elapsedMs < totalMs) {
          requestAnimationFrame(tick);
        } else {
          recorder.stop();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  async function record(mode: "publish" | "download") {
    if (publishingRef.current) return;
    if (scenes.length === 0) {
      setError("Add at least one scene first.");
      return;
    }
    publishingRef.current = true;
    setRecordMode(mode);
    setRecording(true);
    setPlaying(false);
    setError(null);
    try {
      if (mode === "publish") await save();

      const blob = await runRecording();

      if (mode === "download") {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${title || "video"}.webm`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const asset = await uploadMediaAssetApi(blob, "video.webm");
        onCreateWithAsset(caption, asset);
      }
    } catch (caught) {
      setError(caught instanceof AiApiError ? caught.message : caught instanceof Error ? caught.message : "Couldn't record the video.");
    } finally {
      setRecording(false);
      setRecordProgress(0);
      seek(settledTimeForScene(scenes, 0));
      publishingRef.current = false;
    }
  }

  const requestClose = () => {
    if (dirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  };

  // Keyboard shortcuts — never intercepted while typing in a field, so
  // native text editing/undo/cursor movement always works normally.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (recording) return;

      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
        return;
      }
      if (event.key === "Escape") {
        if (imageConfirm) setImageConfirm(null);
        else if (videoJobConfirm) setVideoJobConfirm(null);
        else if (confirmDiscardOpen) setConfirmDiscardOpen(false);
        else setPlaying(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, imageConfirm, confirmDiscardOpen, undo, redo, save, playing, totalSeconds, scenes]);

  const sceneCountLabel = `${scenes.length} of ${MAX_SCENES}`;
  const activeSection = SECTIONS.find((item) => item.id === section)!;
  const selectedIndex = selectedScene ? scenes.findIndex((scene) => scene.id === selectedScene.id) : -1;

  /* ------------------------------------------------------------- *
   * Panel bodies
   * ------------------------------------------------------------- */

  const createBody = (
    <div className="space-y-4">
      <div>
        <FieldLabel>Generation type</FieldLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            aria-pressed={videoMode === "standard"}
            onClick={() => setVideoMode("standard")}
            className={cx(
              "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition duration-150",
              videoMode === "standard" ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line-strong)]",
              FOCUS,
            )}
          >
            <Sparkles size={13} />
            Standard Video
          </button>
          <button
            type="button"
            aria-pressed={videoMode === "ai"}
            onClick={() => setVideoMode("ai")}
            className={cx(
              "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition duration-150",
              videoMode === "ai" ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line-strong)]",
              FOCUS,
            )}
          >
            <VideoIcon size={13} />
            AI Video
          </button>
        </div>
        <p className="mt-1.5 text-[10px] leading-4 text-[var(--text-subtle)]">
          {videoMode === "ai"
            ? "Real moving footage, generated per scene by Luma AI — paid, and confirmed before every clip."
            : "Animated text and motion graphics on your own backgrounds — free and instant."}
        </p>
      </div>

      {videoMode === "ai" && (
        <div>
          <FieldLabel>Generation method</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              aria-pressed={aiGenerationMethod === "text"}
              onClick={() => setAiGenerationMethod("text")}
              className={cx(
                "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10.5px] font-medium transition duration-150",
                aiGenerationMethod === "text" ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line-strong)]",
                FOCUS,
              )}
            >
              Text to Video
            </button>
            <button
              type="button"
              aria-pressed={aiGenerationMethod === "image"}
              onClick={() => setAiGenerationMethod("image")}
              className={cx(
                "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10.5px] font-medium transition duration-150",
                aiGenerationMethod === "image" ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line-strong)]",
                FOCUS,
              )}
            >
              Image to Video
            </button>
          </div>
        </div>
      )}

      {!(videoMode === "ai" && aiGenerationMethod === "image") && (
        <div>
          <FieldLabel>What is this video about?</FieldLabel>
          <textarea
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            rows={4}
            placeholder="For example: why we build custom admin dashboards instead of forcing clients into generic SaaS"
            className={cx(INPUT, "resize-none p-2.5 text-[12px] leading-5")}
          />
        </div>
      )}

      <div>
        <FieldLabel>Platform</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((item) => (
            <Chip
              key={item.id}
              active={platform === item.id}
              disabled={scenes.length > 0}
              onClick={() => {
                setPlatform(item.id);
                const size = canvasSizeForPlatform(item.id);
                setCanvasData((current) => ({ ...current, width: size.width, height: size.height }));
              }}
            >
              {item.name}
            </Chip>
          ))}
        </div>
        {scenes.length > 0 && (
          <p className="mt-1.5 text-[10.5px] leading-4 text-[var(--text-subtle)]">
            Locked while scenes exist, because changing it would resize every scene. Start a new video to pick a different one.
          </p>
        )}
      </div>

      {videoMode === "standard" ? (
        <>
          {conceptStatus === "not-configured" && (
            <div className="rounded-xl border border-dashed border-[var(--line-strong)] p-2.5 text-[11px] leading-5 text-[var(--text-muted)]">
              <p className="font-semibold text-[var(--text)]">AI generation isn&apos;t configured yet.</p>
              {conceptMissingEnvVars.length > 0 && <p className="mt-1">Missing environment variable{conceptMissingEnvVars.length > 1 ? "s" : ""}: {conceptMissingEnvVars.join(", ")}.</p>}
            </div>
          )}
          {conceptStatus === "error" && conceptError && (
            <p className="vw-fade rounded-lg bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-2.5 py-2 text-[11px] leading-5 text-[var(--danger)]">{conceptError}</p>
          )}

          {concepts && concepts.length > 0 && (
            <div className="vw-rise">
              <FieldLabel>Storyboards</FieldLabel>
              <VideoConceptSwiper concepts={concepts} onSelect={selectConcept} onExhausted={() => setConcepts(null)} />
            </div>
          )}
        </>
      ) : aiGenerationMethod === "text" ? (
        <>
          {aiConceptStatus === "not-configured" && (
            <div className="rounded-xl border border-dashed border-[var(--line-strong)] p-2.5 text-[11px] leading-5 text-[var(--text-muted)]">
              <p className="font-semibold text-[var(--text)]">AI generation isn&apos;t configured yet.</p>
              {aiConceptMissingEnvVars.length > 0 && <p className="mt-1">Missing environment variable{aiConceptMissingEnvVars.length > 1 ? "s" : ""}: {aiConceptMissingEnvVars.join(", ")}.</p>}
            </div>
          )}
          {aiConceptStatus === "error" && aiConceptError && (
            <p className="vw-fade rounded-lg bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-2.5 py-2 text-[11px] leading-5 text-[var(--danger)]">{aiConceptError}</p>
          )}

          {aiConcepts && aiConcepts.length > 0 && (
            <div className="vw-rise space-y-2">
              <FieldLabel>Storyboards — real AI footage</FieldLabel>
              {aiConcepts.map((concept) => (
                <button
                  key={concept.title}
                  type="button"
                  onClick={() => selectAiConcept(concept)}
                  className={cx("w-full rounded-xl border border-[var(--line)] p-2.5 text-left transition duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent-tint)]", FOCUS)}
                >
                  <p className="text-[12px] font-semibold text-[var(--text)]">{concept.title}</p>
                  <p className="mt-1 text-[10.5px] leading-4 text-[var(--text-muted)]">{concept.creativeDirection}</p>
                  <p className="mt-1.5 text-[10px] text-[var(--text-subtle)]">
                    {concept.scenes.length} scene{concept.scenes.length === 1 ? "" : "s"} · each scene is one paid Luma generation, confirmed individually
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {startFrameImage ? (
            <div>
              <FieldLabel>Image to animate</FieldLabel>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={startFrameImage.url} alt="Starting frame" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <button type="button" onClick={() => imageAttachFileInputRef.current?.click()} className={cx(BTN_SECONDARY, "h-7 w-full text-[10.5px]")}>
                    Replace
                  </button>
                  <button type="button" onClick={() => setMediaPickerOpen(true)} className={cx(BTN_SECONDARY, "h-7 w-full text-[10.5px]")}>
                    From library
                  </button>
                </div>
                <button type="button" onClick={removeStartFrameImage} aria-label="Remove image" className={cx("shrink-0 rounded text-[var(--text-subtle)] transition hover:text-[var(--text)]", FOCUS)}>
                  <X size={13} />
                </button>
              </div>
            </div>
          ) : (
            <div>
              <FieldLabel>Image to animate</FieldLabel>
              <div className="flex gap-1.5">
                <button type="button" disabled={imageAttachUploading} onClick={() => imageAttachFileInputRef.current?.click()} className={cx(BTN_SECONDARY, "h-9 flex-1 text-[11px]")}>
                  {imageAttachUploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                  Upload
                </button>
                <button type="button" onClick={() => setMediaPickerOpen(true)} className={cx(BTN_SECONDARY, "h-9 flex-1 text-[11px]")}>
                  From library
                </button>
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-[var(--text-subtle)]">A newly generated or saved Graphic Studio image, an upload, or a media-library pick.</p>
            </div>
          )}

          {startFrameImage && (
            <>
              <div>
                <FieldLabel>Motion</FieldLabel>
                <textarea
                  value={motionPrompt}
                  onChange={(event) => setMotionPrompt(event.target.value)}
                  rows={3}
                  placeholder="Describe how the scene should move — camera push-in, parallax, lighting shifts — not the image's content again"
                  className={cx(INPUT, "resize-none p-2.5 text-[12px] leading-5")}
                />
                <button
                  type="button"
                  onClick={suggestMotion}
                  disabled={motionSuggestStatus === "loading"}
                  className={cx("mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent)] hover:underline disabled:opacity-50", FOCUS)}
                >
                  {motionSuggestStatus === "loading" ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  Suggest motion
                </button>
                {motionSuggestStatus === "not-configured" && <p className="mt-1 text-[10.5px] text-[var(--text-subtle)]">AI generation isn&apos;t configured yet.</p>}
                {motionSuggestStatus === "error" && motionSuggestError && <p className="mt-1 text-[10.5px] text-[var(--danger)]">{motionSuggestError}</p>}
              </div>

              {motionSuggestions && (
                <div className="space-y-1.5">
                  {motionSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      onClick={() => {
                        setMotionPrompt(suggestion.motionPrompt);
                        setMotionSuggestions(null);
                      }}
                      className={cx("w-full rounded-xl border border-[var(--line)] p-2.5 text-left transition duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent-tint)]", FOCUS)}
                    >
                      <p className="text-[11.5px] font-semibold text-[var(--text)]">{suggestion.label}</p>
                      <p className="mt-0.5 text-[10.5px] leading-4 text-[var(--text-muted)]">{suggestion.description}</p>
                    </button>
                  ))}
                </div>
              )}

              <div>
                <FieldLabel>Resolution</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {AI_VIDEO_RESOLUTIONS.map((resolution) => (
                    <Chip key={resolution} active={videoResolution === resolution} onClick={() => setVideoResolution(resolution)}>
                      {resolution}
                    </Chip>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] leading-4 text-[var(--text-subtle)]">Image-to-video is 5 seconds only (Luma&apos;s own limit) — duration isn&apos;t selectable here.</p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

  const createFooter =
    videoMode === "ai" && aiGenerationMethod === "image" ? (
      <div className="space-y-2">
        <button
          type="button"
          onClick={startImageToVideoGeneration}
          disabled={!startFrameImage || !motionPrompt.trim() || Boolean(generatingVideoSceneId)}
          className={cx(BTN_PRIMARY, "h-10 w-full text-[12.5px]", "disabled:border disabled:border-[var(--line)] disabled:bg-transparent disabled:text-[var(--text-subtle)] disabled:opacity-100")}
        >
          <VideoIcon size={15} />
          Generate
        </button>
        {!startFrameImage && <p className="text-center text-[10px] text-[var(--text-subtle)]">Attach an image above to begin</p>}
      </div>
    ) : (
      <div className="space-y-2">
        <button
          type="button"
          onClick={videoMode === "ai" ? generateAiConcepts : generateConcepts}
          disabled={!brief.trim() || (videoMode === "ai" ? aiConceptStatus === "loading" : conceptStatus === "loading")}
          className={cx(BTN_PRIMARY, "h-10 w-full text-[12.5px]", "disabled:border disabled:border-[var(--line)] disabled:bg-transparent disabled:text-[var(--text-subtle)] disabled:opacity-100")}
        >
          {(videoMode === "ai" ? aiConceptStatus : conceptStatus) === "loading" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {(videoMode === "ai" ? aiConceptStatus : conceptStatus) === "loading" ? "Storyboarding" : (videoMode === "ai" ? aiConcepts : concepts) ? "Three more concepts" : "Storyboard it"}
        </button>
        {!brief.trim() ? (
          <p className="text-center text-[10px] text-[var(--text-subtle)]">Write a brief above to begin</p>
        ) : (
          <button type="button" onClick={addScene} disabled={scenes.length >= MAX_SCENES} className={cx("w-full rounded text-center text-[10.5px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text)] disabled:opacity-40", FOCUS)}>
            Or build the scenes yourself
          </button>
        )}
      </div>
    );

  const sceneBody = !selectedScene ? (
    <div className="space-y-3">
      <p className="text-[11.5px] leading-5 text-[var(--text-muted)]">No scenes yet.</p>
      <p className="text-[10.5px] leading-4 text-[var(--text-subtle)]">Storyboard one with AI in Create, or add an empty scene and write it yourself.</p>
      <button type="button" onClick={addScene} className={cx(BTN_SECONDARY, "h-9 w-full text-[11.5px]")}>
        <Plus size={13} />
        Add a scene
      </button>
    </div>
  ) : (
    <div key={selectedScene.id} className="vw-fade space-y-4">
      <div className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-tint)] text-[10px] font-semibold text-[var(--accent)]">{selectedIndex + 1}</span>
        <p className="text-[12.5px] font-semibold text-[var(--text)]">Scene {selectedIndex + 1}</p>
        <span className="ml-auto text-[10.5px] text-[var(--text-subtle)] tabular-nums">{selectedScene.durationSeconds}s</span>
      </div>

      <div>
        <FieldLabel>On screen text</FieldLabel>
        <textarea
          value={textLayerOf(selectedScene)?.text ?? ""}
          onChange={(event) =>
            updateScene(
              selectedScene.id,
              (current) => withSceneText(current, event.target.value, canvasData.width, canvasData.height),
              false,
            )
          }
          onBlur={commitCurrent}
          rows={3}
          placeholder="What this scene says"
          className={cx(INPUT, "resize-none p-2.5 text-[12px] leading-5")}
        />
      </div>

      <div>
        <FieldLabel>Text style</FieldLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {VIDEO_TEMPLATE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => updateScene(selectedScene.id, (current) => applyVideoTemplate(current, id, { width: canvasData.width, height: canvasData.height }))}
              className={cx(
                "rounded-lg border border-[var(--line)] px-2 py-2 text-left text-[11px] font-medium text-[var(--text)] transition duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent-tint)]",
                FOCUS,
              )}
            >
              {VIDEO_TEMPLATE_LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Duration</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {DURATION_PRESETS.map((value) => (
            <Chip
              key={value}
              active={selectedScene.durationSeconds === value}
              onClick={() => updateScene(selectedScene.id, (current) => ({ ...current, durationSeconds: value }))}
            >
              {value}s
            </Chip>
          ))}
          <input
            type="number"
            min={MIN_SCENE_SECONDS}
            max={MAX_SCENE_SECONDS}
            aria-label="Scene duration in seconds"
            value={selectedScene.durationSeconds}
            onChange={(event) =>
              updateScene(selectedScene.id, (current) => ({
                ...current,
                durationSeconds: Math.min(MAX_SCENE_SECONDS, Math.max(MIN_SCENE_SECONDS, Number(event.target.value) || MIN_SCENE_SECONDS)),
              }))
            }
            className={cx(INPUT, "h-7 w-14 px-1.5 text-[11px]")}
          />
        </div>
      </div>

      <div>
        <FieldLabel>Scene transition</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {TRANSITIONS.map((option) => (
            <Chip
              key={option.id}
              active={selectedScene.transition === option.id}
              onClick={() => {
                updateScene(selectedScene.id, (current) => ({ ...current, transition: option.id }));
                if (selectedIndex >= 0) seek(sceneStartSeconds(scenes, selectedIndex));
              }}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Text entrance</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {TEXT_ENTRANCES.map((option) => (
            <Chip
              key={option.id}
              active={selectedScene.textEntrance === option.id}
              onClick={() => {
                updateScene(selectedScene.id, (current) => ({ ...current, textEntrance: option.id }));
                if (selectedIndex >= 0) seek(sceneStartSeconds(scenes, selectedIndex));
              }}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Background</FieldLabel>
        <div className="flex flex-wrap items-center gap-1.5">
          {swatches.map((swatch) => {
            const active = selectedScene.background.kind === "color" && selectedScene.background.value === swatch;
            return (
              <button
                key={swatch}
                type="button"
                aria-pressed={active}
                aria-label={`Use background ${swatch}`}
                onClick={() => updateScene(selectedScene.id, (current) => ({ ...current, background: { kind: "color", value: swatch }, pendingImagePrompt: undefined }))}
                className={cx("h-8 w-8 rounded-full border-2 transition duration-150", active ? "border-[var(--accent)]" : "border-[var(--line-strong)] hover:border-[var(--text-subtle)]", FOCUS)}
                style={{ background: swatch }}
              />
            );
          })}
        </div>

        {selectedScene.background.kind === "image" && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--line)] p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedScene.background.src} alt="Scene background" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
            <p className="min-w-0 flex-1 text-[10.5px] leading-4 text-[var(--text-subtle)]">Image background, with a slow pan across the scene.</p>
            <button
              type="button"
              aria-label="Remove background image"
              onClick={() => updateScene(selectedScene.id, (current) => ({ ...current, background: { kind: "color", value: swatches[0] } }))}
              className={cx("shrink-0 rounded text-[var(--text-subtle)] transition hover:text-[var(--text)]", FOCUS)}
            >
              <X size={13} />
            </button>
          </div>
        )}

        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            disabled={uploadingBackground}
            onClick={() => {
              backgroundTargetRef.current = selectedScene.id;
              fileInputRef.current?.click();
            }}
            className={cx(BTN_SECONDARY, "h-9 flex-1 text-[11px]")}
          >
            {uploadingBackground ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            Upload
          </button>
          {selectedScene.pendingImagePrompt && (
            <button
              type="button"
              onClick={() => openSceneImageConfirm(selectedScene)}
              disabled={generatingSceneId === selectedScene.id}
              className={cx(BTN_SECONDARY, "h-9 flex-1 text-[11px]")}
            >
              {generatingSceneId === selectedScene.id ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              Generate
            </button>
          )}
        </div>
        {selectedScene.pendingImagePrompt && (
          <p className="mt-1.5 text-[10px] leading-4 text-[var(--text-subtle)]">
            AI suggested a background for this scene: &ldquo;{selectedScene.pendingImagePrompt}&rdquo;. Generating it is a paid call and asks first.
          </p>
        )}

        {selectedScene.background.kind === "video" && (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--line)] p-1.5">
            <video src={selectedScene.background.src} muted className="h-11 w-11 shrink-0 rounded-lg object-cover" />
            <p className="min-w-0 flex-1 text-[10.5px] leading-4 text-[var(--text-subtle)]">Real AI-generated footage (Luma).</p>
            <button
              type="button"
              aria-label="Remove video background"
              onClick={() => updateScene(selectedScene.id, (current) => ({ ...current, background: { kind: "color", value: swatches[0] } }))}
              className={cx("shrink-0 rounded text-[var(--text-subtle)] transition hover:text-[var(--text)]", FOCUS)}
            >
              <X size={13} />
            </button>
          </div>
        )}

        <div className="mt-3 border-t border-[var(--line)] pt-3">
          <FieldLabel>{selectedScene.startFrameImageUrl ? "Image to Video (Luma) — real footage, paid" : "AI Video (Luma) — real footage, paid"}</FieldLabel>

          {selectedScene.startFrameImageUrl && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-[var(--line)] p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedScene.startFrameImageUrl} alt="Starting frame" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
              <p className="min-w-0 flex-1 text-[10.5px] leading-4 text-[var(--text-subtle)]">Starting frame — this scene animates this exact image.</p>
              <button
                type="button"
                aria-label="Remove starting frame"
                onClick={() => updateScene(selectedScene.id, (current) => ({ ...current, startFrameImageUrl: undefined }))}
                className={cx("shrink-0 rounded text-[var(--text-subtle)] transition hover:text-[var(--text)]", FOCUS)}
              >
                <X size={13} />
              </button>
            </div>
          )}

          <textarea
            value={selectedScene.aiVideoPrompt ?? ""}
            onChange={(event) => updateScene(selectedScene.id, (current) => ({ ...current, aiVideoPrompt: event.target.value }), false)}
            onBlur={commitCurrent}
            rows={3}
            placeholder={
              selectedScene.startFrameImageUrl
                ? "Describe how the scene should move — camera push-in, parallax, lighting shifts."
                : "Describe the real footage this scene should show — environment, people, camera movement, lighting. No on-screen text or logos (those are added as overlays)."
            }
            className={cx(INPUT, "resize-none p-2.5 text-[11px] leading-5")}
          />
          <p className="mt-1.5 text-[10px] leading-4 text-[var(--text-subtle)]">{selectedScene.startFrameImageUrl ? "Resolution (duration is locked to 5s — Luma's own image-to-video limit)" : "Resolution and duration"}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {AI_VIDEO_RESOLUTIONS.map((resolution) => (
              <Chip key={resolution} active={videoResolution === resolution} onClick={() => setVideoResolution(resolution)}>
                {resolution}
              </Chip>
            ))}
          </div>
          {!selectedScene.startFrameImageUrl && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {AI_VIDEO_DURATIONS.map((duration) => (
                <Chip key={duration} active={videoDuration === duration} onClick={() => setVideoDuration(duration)}>
                  {duration}s
                </Chip>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => openVideoJobConfirm(selectedScene)}
            disabled={!selectedScene.aiVideoPrompt?.trim() || Boolean(selectedScene.pendingVideoJobId) || generatingVideoSceneId === selectedScene.id}
            className={cx(BTN_SECONDARY, "mt-2 h-9 w-full text-[11px]")}
          >
            {selectedScene.pendingVideoJobId || generatingVideoSceneId === selectedScene.id ? <Loader2 size={13} className="animate-spin" /> : <VideoIcon size={13} />}
            {selectedScene.pendingVideoJobId ? "Generating… (leave this page if you like)" : "Generate AI video"}
          </button>
          {videoJobError && <p className="mt-1.5 text-[10px] leading-4 text-[var(--danger)]">{videoJobError}</p>}
        </div>
      </div>
    </div>
  );

  const sceneFooter = selectedScene ? (
    <div className="flex gap-1.5">
      <button type="button" onClick={() => duplicateScene(selectedScene.id)} disabled={scenes.length >= MAX_SCENES} className={cx(BTN_SECONDARY, "h-9 flex-1 text-[11px]")}>
        <Copy size={13} />
        Duplicate
      </button>
      <button type="button" onClick={() => removeScene(selectedScene.id)} className={cx(BTN_SECONDARY, "h-9 flex-1 text-[11px]")}>
        <Trash2 size={13} />
        Delete
      </button>
    </div>
  ) : null;

  const videoBody = (
    <div className="space-y-4">
      <div>
        <FieldLabel>Caption</FieldLabel>
        <textarea
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          rows={4}
          placeholder="The caption that goes with the post"
          className={cx(INPUT, "resize-none p-2.5 text-[12px] leading-5")}
        />
        <p className="mt-1.5 text-[10.5px] leading-4 text-[var(--text-subtle)]">Carried into the composer with the recorded video. You can still edit it there.</p>
      </div>

      <div className="border-t border-[var(--line)] pt-3.5">
        <FieldLabel>Branding</FieldLabel>
        {brandKit?.logoUrl ? (
          <label className="flex items-start gap-2 rounded-lg bg-[var(--surface-muted)] p-2 text-[11px] leading-4 text-[var(--text-muted)]">
            <input type="checkbox" checked={logoEnabled} onChange={(event) => toggleLogo(event.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
            <span>
              Show the business logo on every scene.
            </span>
          </label>
        ) : (
          <p className="text-[10.5px] leading-4 text-[var(--text-subtle)]">No logo in the Brand Kit yet. Add one there and it appears on every scene automatically.</p>
        )}
        <p className="mt-2.5 text-[10px] font-semibold tracking-[0.07em] text-[var(--text-subtle)] uppercase">Palette</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {swatches.map((swatch) => (
            <span key={swatch} className="h-7 w-7 rounded-full border border-[var(--line-strong)]" style={{ background: swatch }} />
          ))}
        </div>
        <p className="mt-1.5 text-[10px] leading-4 text-[var(--text-subtle)]">
          {brandKit?.primaryColors?.length ? "From your Brand Kit." : "Default palette, because the Brand Kit has no colours yet."}
        </p>
      </div>

      <div className="border-t border-[var(--line)] pt-3.5">
        <FieldLabel>Format</FieldLabel>
        <dl className="space-y-1 text-[11px]">
          {[
            ["Platform", PLATFORMS.find((item) => item.id === platform)?.name ?? platform],
            ["Frame", `${canvasData.width} × ${canvasData.height}`],
            ["Frame rate", `${canvasData.fps} fps`],
            ["Scenes", sceneCountLabel],
            ["Length", `${formatClock(totalSeconds)}`],
          ].map(([what, value]) => (
            <div key={what} className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-subtle)]">{what}</dt>
              <dd className="font-medium text-[var(--text)] tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[10px] leading-4 text-[var(--text-subtle)]">Recorded silent. Add sound when you post it.</p>
      </div>

      <div className="border-t border-[var(--line)] pt-3.5">
        <FieldLabel>Shortcuts</FieldLabel>
        <dl className="space-y-1 text-[10.5px] text-[var(--text-subtle)]">
          {[
            ["Play / pause", "Space"],
            ["Undo / redo", "Cmd Z / Shift Z"],
            ["Save", "Cmd S"],
            ["Stop playback", "Esc"],
          ].map(([what, keys]) => (
            <div key={what} className="flex items-center justify-between gap-2">
              <dt className="truncate">{what}</dt>
              <dd className="shrink-0 font-medium text-[var(--text-muted)]">{keys}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );

  const sectionBody = section === "create" ? createBody : section === "scene" ? sceneBody : videoBody;
  const sectionFooter = section === "create" ? createFooter : section === "scene" ? sceneFooter : null;

  /* ------------------------------------------------------------- *
   * Render
   * ------------------------------------------------------------- */

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--shell)]">
      <style>{WORKSPACE_CSS}</style>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void uploadSceneBackground(file);
        }}
      />
      <input
        ref={imageAttachFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void attachImageFile(file);
        }}
      />
      {mediaPickerOpen && <MediaLibraryPicker type="IMAGE" onSelect={selectLibraryImage} onClose={() => setMediaPickerOpen(false)} />}

      {/* ---------------------------- toolbar ---------------------------- */}
      <header className="flex h-13 shrink-0 items-center gap-2 border-b border-[var(--line)] px-2.5 sm:px-3.5">
        <ToolButton label="Back to Content Studio" onClick={requestClose}>
          <ArrowLeft size={15} />
        </ToolButton>

        <VideoIcon size={14} className="shrink-0 text-[var(--text-subtle)]" />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => setDirty(true)}
          className={cx(INPUT, "h-8 max-w-[220px] min-w-0 px-2 text-[13px] font-semibold")}
          placeholder="Untitled video"
        />
        {dirty && !saving && <span title="Unsaved changes" className="vw-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--warning)]" />}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div className="flex items-center gap-0.5 rounded-lg bg-[color-mix(in_srgb,var(--surface-muted)_55%,transparent)] p-0.5">
            <ToolButton label="Undo" onClick={undo} disabled={!canUndo || recording}>
              <Undo2 size={14} />
            </ToolButton>
            <ToolButton label="Redo" onClick={redo} disabled={!canRedo || recording}>
              <Redo2 size={14} />
            </ToolButton>
          </div>

          <span aria-hidden className="mx-1 hidden h-5 w-px bg-[var(--line)] sm:block" />

          <button type="button" onClick={() => void save()} disabled={saving || recording} className={cx(BTN_SECONDARY, "h-8 px-2.5 text-[11.5px]")}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} className="text-[var(--success)]" /> : <Save size={13} />}
            <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
          </button>
          <button type="button" onClick={() => void record("download")} disabled={recording || scenes.length === 0} className={cx(BTN_SECONDARY, "h-8 px-2.5 text-[11.5px]")}>
            <Download size={13} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button type="button" onClick={() => void record("publish")} disabled={recording || scenes.length === 0} className={cx(BTN_PRIMARY, "h-8 px-3 text-[11.5px] whitespace-nowrap")}>
            {recording ? <Loader2 size={13} className="animate-spin" /> : <Film size={13} />}
            {recording ? "Recording" : "Record and continue"}
            {!recording && <ChevronRight size={13} className="-mr-0.5" />}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* ----------------------------- rail ----------------------------- */}
        <nav
          role="tablist"
          aria-label="Workspace sections"
          aria-orientation="vertical"
          className="vw-norail flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_55%,transparent)] p-1.5 lg:h-full lg:w-[72px] lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r"
        >
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            const flagged = item.id === "scene" && scenes.length === 0;
            return (
              <button
                key={item.id}
                role="tab"
                type="button"
                aria-selected={active}
                title={item.hint}
                onClick={() => {
                  if (active) setPanelOpen((value) => !value);
                  else {
                    setSection(item.id);
                    setPanelOpen(true);
                  }
                }}
                className={cx(
                  "relative flex shrink-0 flex-row items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-medium transition duration-150 lg:w-full lg:flex-col lg:gap-1 lg:px-1 lg:py-2.5 lg:text-[10px]",
                  active ? "bg-[var(--accent-tint)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]",
                  FOCUS,
                )}
              >
                <Icon size={17} />
                {item.label}
                {flagged && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[var(--warning)] lg:top-2 lg:right-3" />}
              </button>
            );
          })}
        </nav>

        {/* ----------------------------- panel ---------------------------- */}
        {panelOpen && (
          <aside className="flex shrink-0 flex-col border-b border-[var(--line)] lg:h-full lg:w-[286px] lg:border-b-0 lg:border-r">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] px-3">
              <p className="truncate text-[12.5px] font-semibold text-[var(--text)]">{activeSection.label}</p>
              <button
                type="button"
                aria-label="Collapse panel"
                title="Collapse panel"
                onClick={() => setPanelOpen(false)}
                className={cx("ml-auto hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)] lg:flex", FOCUS)}
              >
                <ChevronLeft size={14} />
              </button>
            </div>

            <div key={section} className="vw-rise vw-scroll min-h-0 flex-1 overflow-y-auto p-3">
              {sectionBody}
            </div>

            {sectionFooter && <div className="shrink-0 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_55%,transparent)] p-3">{sectionFooter}</div>}
          </aside>
        )}

        {/* --------------------- preview, transport, timeline -------------- */}
        <div className="relative flex min-h-[420px] min-w-0 flex-1 flex-col lg:min-h-0">
          <div ref={containerRef} className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-[var(--surface-muted)] p-5">
            {scenes.length === 0 ? (
              <div className="max-w-[260px] text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-subtle)]">
                  <Film size={18} />
                </span>
                <p className="mt-2.5 text-[12.5px] font-semibold text-[var(--text)]">Nothing to play yet</p>
                <p className="mt-1 text-[11px] leading-4 text-[var(--text-subtle)]">Storyboard it with AI, or add a scene and write it yourself.</p>
              </div>
            ) : (
              <div className="relative ring-1 ring-[var(--line-strong)] shadow-[0_18px_50px_-12px_rgba(15,23,42,0.28)]" style={{ width: canvasData.width * scale, height: canvasData.height * scale }}>
                {/* Real AI video (Luma) background — an actual <video>
                    element behind the Stage, since Konva has no native
                    video node. The Stage above it draws no opaque fill
                    for a "video" background (see the Rect below), so
                    only its text/logo layers composite visibly on top. */}
                {displayScene?.background.kind === "video" && (
                  <video ref={previewVideoRef} src={displayScene.background.src} muted playsInline loop className="absolute inset-0 h-full w-full object-cover" />
                )}
                <div className="absolute inset-0">
                {/* scaleX/scaleY shrink the Stage to fit the editor's
                    preview pane — but Konva's scaleX/scaleY is a real
                    transform on the node, and stage.toCanvas() (used
                    by runRecording() below) captures it scaled down
                    exactly like this, not at the canvas's native pixel
                    size. Found by inspecting an exported file frame-by-
                    frame: the directly-drawImage'd video background
                    filled the frame correctly, but Konva-rendered text/
                    logo layers were shrunk into the top-left corner —
                    stage.toCanvas() was capturing the SAME preview-
                    scaled transform used on screen. While recording,
                    render at true 1:1 scale instead; the "Recording…"
                    overlay (see below) already covers the whole
                    preview, so this is never visible to the admin. */}
                <Stage ref={stageRef} width={canvasData.width} height={canvasData.height} scaleX={recording ? 1 : scale} scaleY={recording ? 1 : scale}>
                  <Layer>
                    {displayScene?.background.kind !== "video" && <Rect width={canvasData.width} height={canvasData.height} fill="#000000" />}
                    {displayScene && (
                      <Group
                        x={canvasData.width / 2 + groupTransform.x}
                        y={canvasData.height / 2}
                        offsetX={canvasData.width / 2}
                        offsetY={canvasData.height / 2}
                        scaleX={groupTransform.scaleX}
                        scaleY={groupTransform.scaleY}
                        opacity={groupTransform.opacity}
                      >
                        {displayScene.background.kind === "color" ? (
                          <Rect width={canvasData.width} height={canvasData.height} fill={displayScene.background.value} />
                        ) : displayScene.background.kind === "image" ? (
                          <SceneBackgroundImage
                            src={displayScene.background.src}
                            width={canvasData.width}
                            height={canvasData.height}
                            progress={kenBurnsProgress}
                            zoomOut={displaySceneIndex % 2 === 1}
                          />
                        ) : null}
                        {displayScene.layers.map((layer) =>
                          layer.type === "text" ? (
                            <KonvaText
                              key={layer.id}
                              x={layer.x}
                              y={layer.y + textTransform.yOffset}
                              width={layer.width}
                              text={layer.text}
                              fontSize={layer.fontSize}
                              fill={layer.color}
                              align={layer.align}
                              fontStyle={layer.bold ? "bold" : "normal"}
                              opacity={textTransform.opacity}
                            />
                          ) : layer.type === "image" ? (
                            <SceneLogoImage key={layer.id} layer={layer} />
                          ) : null,
                        )}
                      </Group>
                    )}
                  </Layer>
                </Stage>
                </div>
              </div>
            )}
          </div>

          {/* transport + timeline */}
          <div className="shrink-0 border-t border-[var(--line)] bg-[var(--shell)]">
            <div className="flex h-11 items-center gap-2 px-3">
              <ToolButton label={playing ? "Pause" : "Play"} onClick={togglePlay} disabled={scenes.length === 0 || recording}>
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </ToolButton>
              <ToolButton label="Play from the start" onClick={restart} disabled={scenes.length === 0 || recording}>
                <RotateCcw size={14} />
              </ToolButton>
              <span className="text-[11.5px] font-medium text-[var(--text)] tabular-nums">
                {formatClock(currentTime)}
                <span className="text-[var(--text-subtle)]"> / {formatClock(totalSeconds)}</span>
              </span>

              <div className="ml-auto flex items-center gap-2">
                <span className="hidden text-[10.5px] text-[var(--text-subtle)] sm:inline">{sceneCountLabel} scenes</span>
                <button type="button" onClick={addScene} disabled={scenes.length >= MAX_SCENES || recording} className={cx(BTN_SECONDARY, "h-7 px-2 text-[10.5px]")}>
                  <Plus size={12} />
                  Scene
                </button>
              </div>
            </div>

            {/* scrub track — a real range input, so dragging, clicking and
                arrow keys all work without hand-rolled pointer maths */}
            <div className="relative h-5 px-3">
              <div className="pointer-events-none absolute inset-x-3 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div className="h-full bg-[var(--accent)]" style={{ width: `${totalSeconds > 0 ? Math.min(100, (currentTime / totalSeconds) * 100) : 0}%` }} />
              </div>
              {/* scene boundaries, so the track reads as cuts not just time */}
              <div aria-hidden className="pointer-events-none absolute inset-x-3 top-1/2 h-2.5 -translate-y-1/2">
                {scenes.slice(0, -1).map((scene, index) => (
                  <span
                    key={scene.id}
                    className="absolute top-0 h-full w-0.5 -translate-x-1/2 rounded-full bg-[var(--shell)]"
                    style={{ left: `${totalSeconds > 0 ? (sceneStartSeconds(scenes, index + 1) / totalSeconds) * 100 : 0}%` }}
                  />
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(totalSeconds, 0.1)}
                step={0.01}
                value={Math.min(currentTime, totalSeconds)}
                disabled={scenes.length === 0 || recording}
                aria-label="Playhead"
                onChange={(event) => {
                  setPlaying(false);
                  seek(Number(event.target.value));
                }}
                className={cx("vw-scrub absolute inset-x-3 top-0 h-5 w-[calc(100%-1.5rem)] cursor-ew-resize disabled:cursor-not-allowed", FOCUS)}
              />
            </div>

            {/* filmstrip — tile width tracks scene length, so the timeline
                reads as time rather than as a list */}
            <div className="vw-norail flex gap-1 overflow-x-auto px-3 pt-1 pb-3">
              {scenes.map((scene, index) => {
                const active = scene.id === selectedSceneId;
                const playingThis = index === displaySceneIndex;
                const text = textLayerOf(scene)?.text ?? "";
                return (
                  <div
                    key={scene.id}
                    className="group/tile relative min-w-[88px] shrink-0"
                    style={{ flex: `${scene.durationSeconds} 1 0%`, maxWidth: "260px" }}
                  >
                    <button
                      type="button"
                      onClick={() => selectScene(scene.id)}
                      aria-pressed={active}
                      className={cx(
                        "block h-[70px] w-full overflow-hidden rounded-lg border-2 text-left transition duration-150",
                        active ? "border-[var(--accent)]" : "border-transparent hover:border-[var(--line-strong)]",
                        FOCUS,
                      )}
                    >
                      <span
                        className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-md p-1.5"
                        style={
                          scene.background.kind === "color"
                            ? { background: scene.background.value }
                            : scene.background.kind === "image"
                              ? { backgroundImage: `url(${scene.background.src})`, backgroundSize: "cover", backgroundPosition: "center" }
                              : { background: "#111827" }
                        }
                      >
                        <span className="absolute inset-0 bg-black/25" />
                        <span className="relative flex items-center gap-1">
                          <span className="flex h-4 w-4 items-center justify-center rounded bg-black/45 text-[9px] font-semibold text-white tabular-nums">{index + 1}</span>
                          {playingThis && <span className="h-1.5 w-1.5 rounded-full bg-white/90" />}
                        </span>
                        <span className="relative line-clamp-2 text-[9.5px] leading-[12px] font-medium text-white/95">{text || "Empty scene"}</span>
                        <span className="relative text-[9px] font-semibold text-white/70 tabular-nums">{scene.durationSeconds}s</span>
                      </span>
                    </button>

                    {/* reorder, revealed on hover or when selected */}
                    <div
                      className={cx(
                        "absolute top-1 right-1 flex items-center gap-0.5 rounded-md bg-black/55 p-0.5 transition-opacity duration-150",
                        active ? "opacity-100" : "opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100",
                      )}
                    >
                      <button
                        type="button"
                        aria-label="Move scene earlier"
                        disabled={index === 0}
                        onClick={() => moveScene(scene.id, -1)}
                        className={cx("flex h-4 w-4 items-center justify-center rounded text-white/90 transition hover:bg-white/20 disabled:opacity-30", FOCUS)}
                      >
                        <ChevronLeft size={11} />
                      </button>
                      <button
                        type="button"
                        aria-label="Move scene later"
                        disabled={index === scenes.length - 1}
                        onClick={() => moveScene(scene.id, 1)}
                        className={cx("flex h-4 w-4 items-center justify-center rounded text-white/90 transition hover:bg-white/20 disabled:opacity-30", FOCUS)}
                      >
                        <ChevronRight size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {scenes.length < MAX_SCENES && (
                <button
                  type="button"
                  onClick={addScene}
                  disabled={recording}
                  className={cx(
                    "flex h-[70px] w-[64px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--line-strong)] text-[var(--text-subtle)] transition duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)]",
                    FOCUS,
                  )}
                >
                  <Plus size={15} />
                  <span className="text-[9.5px] font-medium">Scene</span>
                </button>
              )}

              {scenes.length === 0 && (
                <p className="flex h-[70px] items-center text-[11px] text-[var(--text-subtle)]">Your scenes will line up here, each as wide as it is long.</p>
              )}
            </div>
          </div>

          {/* floating notices — never reflow the preview mid playback */}
          <div className="pointer-events-none absolute top-3 right-3 z-30 flex w-[min(360px,calc(100%-1.5rem))] flex-col gap-2">
            {error && (
              <div className="vw-notice pointer-events-auto flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--danger)_40%,var(--line))] bg-[var(--surface)] p-2.5 shadow-[var(--shadow-popover)]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--danger)]" />
                <p className="min-w-0 flex-1 text-[11.5px] leading-5 text-[var(--text)]">{error}</p>
                <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className={cx("shrink-0 rounded text-[var(--text-subtle)] transition hover:text-[var(--text)]", FOCUS)}>
                  <X size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden capture target — never shown, only recorded from. */}
      <canvas ref={recordCanvasRef} className="hidden" aria-hidden />

      {/* --------------------------- recording ---------------------------- */}
      {recording && (
        <div role="status" aria-live="polite" className="vw-fade absolute inset-0 z-[180] flex items-end justify-center bg-black/35 p-5">
          <div className="w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-popover)]">
            <div className="flex items-center gap-2">
              <span className="vw-rec h-2 w-2 shrink-0 rounded-full bg-[var(--danger)]" />
              <p className="text-[12px] font-semibold text-[var(--text)]">
                {recordMode === "download" ? "Recording for download" : "Recording"}
              </p>
              <span className="ml-auto text-[11px] font-medium text-[var(--text-muted)] tabular-nums">{Math.round(recordProgress * 100)}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-100" style={{ width: `${recordProgress * 100}%` }} />
            </div>
            <p className="mt-2 text-[10.5px] leading-4 text-[var(--text-subtle)]">
              It records in real time, so this takes as long as the video. Keep this tab in front until it finishes.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------ cost confirmation ----------------------- */}
      {imageConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="vw-fade fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setImageConfirm(null);
          }}
        >
          <div className="vw-rise w-full max-w-[400px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)]">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-tint)]">
                <Wand2 size={15} className="text-[var(--accent)]" />
              </span>
              <p className="text-[13px] font-semibold text-[var(--text)]">Generate this background?</p>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-5 text-[var(--text-muted)]">
              This calls the paid image API. Estimated cost <strong className="font-semibold text-[var(--text)]">${imageConfirm.estimatedCostUsd.toFixed(3)}</strong>, and it counts toward
              today&apos;s limit.
            </p>
            {imageUsage && (
              <p className="mt-1.5 text-[10.5px] text-[var(--text-subtle)]">
                Used so far today: {imageUsage.generations}/{imageUsage.maxGenerations} generations, ${imageUsage.spentUsd.toFixed(2)} of ${imageUsage.capUsd.toFixed(2)}.
              </p>
            )}
            <div className="mt-3.5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setImageConfirm(null)} className={cx("h-9 rounded-lg px-3 text-[11.5px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]", FOCUS)}>
                Cancel
              </button>
              <button type="button" autoFocus onClick={() => generateSceneImage(imageConfirm.sceneId)} className={cx(BTN_PRIMARY, "h-9 px-3.5 text-[11.5px]")}>
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------- AI video cost confirmation ------------------ */}
      {videoJobConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="vw-fade fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setVideoJobConfirm(null);
          }}
        >
          <div className="vw-rise w-full max-w-[400px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)]">
            <div className="flex items-center gap-2">
              {scenes.find((scene) => scene.id === videoJobConfirm.sceneId)?.startFrameImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={scenes.find((scene) => scene.id === videoJobConfirm.sceneId)?.startFrameImageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-tint)]">
                  <VideoIcon size={15} className="text-[var(--accent)]" />
                </span>
              )}
              <p className="text-[13px] font-semibold text-[var(--text)]">Generate real AI video?</p>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-5 text-[var(--text-muted)]">
              This calls the paid Luma video API — provider Luma, model ray-3.2, generation method{" "}
              <strong className="font-semibold text-[var(--text)]">{scenes.find((scene) => scene.id === videoJobConfirm.sceneId)?.startFrameImageUrl ? "Image to Video" : "Text to Video"}</strong>,{" "}
              {videoDuration}s at {videoResolution}. Estimated cost <strong className="font-semibold text-[var(--text)]">${videoJobConfirm.estimatedCostUsd.toFixed(2)}</strong>. Generation
              usually takes a minute or two — you can leave this page and come back.
            </p>
            <div className="mt-3.5 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setVideoJobConfirm(null)} className={cx("h-9 rounded-lg px-3 text-[11.5px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]", FOCUS)}>
                Cancel
              </button>
              <button type="button" autoFocus onClick={() => generateSceneVideo(videoJobConfirm.sceneId)} className={cx(BTN_PRIMARY, "h-9 px-3.5 text-[11.5px]")}>
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------- discard dialog ----------------------- */}
      {confirmDiscardOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="vw-fade fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmDiscardOpen(false);
          }}
        >
          <div className="vw-rise w-full max-w-[400px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)]">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]">
                <AlertTriangle size={15} className="text-[var(--danger)]" />
              </span>
              <p className="text-[13px] font-semibold text-[var(--text)]">Discard unsaved changes?</p>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-5 text-[var(--text-muted)]">This video has not been saved. Leaving now will lose your scenes.</p>
            <div className="mt-3.5 flex items-center justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmDiscardOpen(false)}
                className={cx("h-9 rounded-lg px-3 text-[11.5px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]", FOCUS)}
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDiscardOpen(false);
                  onClose();
                }}
                className={cx("h-9 rounded-lg bg-[var(--danger)] px-3.5 text-[11.5px] font-semibold text-white transition hover:opacity-90", FOCUS)}
              >
                Discard and leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}