/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// Full-workspace Graphic Studio — the ONLY surface for creating or
// editing a graphic. There is no separate modal wizard: SocialMediaTab
// renders this directly, full-bleed, the instant "Generate a Graphic"
// (or "Open" on a saved project) is clicked.
//
// Layout, top to bottom / left to right:
//
//   toolbar      back · title · history · save · export · publish
//   rail         four sections, never more: Create / Layouts /
//                Elements / Brand. Collapsible down to the icons so
//                the canvas can take the whole width.
//   panel        one section at a time, each with its own header and a
//                pinned action footer, so the verb is always reachable
//                without scrolling the panel.
//   stage        the artboard on a flat field, chrome floating over it
//                rather than stealing a row beneath it.
//   inspector    properties for the selection AND the layer stack,
//                together — they are the two things you alternate
//                between constantly, so neither is behind a tab.
//
// Everything that used to be a layout-shifting banner (save errors,
// overflow warnings) is now a floating notice, so the canvas never
// reflows underneath the pointer mid-drag.
//
// The Stage's internal width/height always stay at the true export
// resolution; zoom/fit-to-screen only ever change display scaleX/scaleY
// — stage.toDataURL() is unaffected by the current zoom.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Circle as KonvaCircle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text as KonvaText, Transformer } from "react-konva";
import type Konva from "konva";
import {
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Crop,
  Download,
  Gem,
  Image as ImageIcon,
  ImagePlus,
  Layers as LayersIcon,
  LayoutTemplate,
  Loader2,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Redo2,
  Save,
  Shapes,
  Sparkles,
  SquareDashed,
  Trash2,
  Type,
  Undo2,
  Video,
  X,
} from "lucide-react";

import {
  AiApiError,
  createContentProjectApi,
  generateCreativeDirectionApi,
  generateGraphicContentApi,
  generateGraphicDesignApi,
  generateGraphicImageApi,
  getBrandKitApi,
  getImageUsageApi,
  reviseGraphicImageApi,
  updateContentProjectApi,
  uploadMediaAssetApi,
  type CompanyBrandKit,
  type ImageUsageSnapshot,
  type UploadedAsset,
} from "../api";
import type { GraphicCreativeConcept } from "@/lib/ai/types";
import type { AiImageQuality, AiImageSize } from "@/lib/ai/imageTypes";
import { BTN_PRIMARY, BTN_SECONDARY, cx, FOCUS, INPUT } from "../../shared/styles";
import { IconButton, PlatformMark } from "../../shared/primitives";
import { PLATFORMS } from "../../shared/constants";
import type { SocialPlatform } from "../../shared/types";
import { BrandKitPanel } from "../panels/BrandKitPanel";
import { SAFE_MARGIN_PERCENT, newLayerId, textLayer, imageLayer, type CanvasData, type CanvasLayer, type ImageLayer, type ShapeLayer, type TextLayer } from "./canvas";
import { buildInitialCanvasData, buildTemplateLayers, TEMPLATE_IDS, TEMPLATE_LABELS, type GraphicTemplateId } from "./templates";
import { designSpecToCanvasData, withBrandLogo } from "./designSpec";
import type { GraphicContent, GraphicDesignSpec } from "@/lib/ai/types";

const BACKGROUND_SWATCHES = ["#FFFFFF", "#F5F5F2", "#111827", "#0A2540", "#FDE68A", "#D6246E", "#059669"];
const MAX_HISTORY = 50;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

export type GraphicStyle = "BOLD" | "MINIMAL" | "PLAYFUL" | "CORPORATE";

const STYLE_OPTIONS: { id: GraphicStyle; label: string; description: string }[] = [
  { id: "BOLD", label: "Bold", description: "High contrast, large type" },
  { id: "MINIMAL", label: "Minimal", description: "Clean, lots of space" },
  { id: "PLAYFUL", label: "Playful", description: "Friendly, approachable" },
  { id: "CORPORATE", label: "Corporate", description: "Formal, structured" },
];

const SIZE_OPTIONS: { id: AiImageSize; label: string }[] = [
  { id: "1024x1024", label: "Square" },
  { id: "1536x1024", label: "Landscape" },
  { id: "1024x1536", label: "Portrait" },
];

/** The prop type callers already pass ("ai" for a new graphic, "layers"
 *  when reopening a saved project — see openGraphicProject in
 *  SocialMediaTab.tsx). Kept as-is so no call site changes; mapped once
 *  on mount onto the four sections the rail actually has. */
export type LeftPanelTab = "ai" | "templates" | "text" | "images" | "backgrounds" | "brandkit" | "layers";

type Section = "create" | "layouts" | "elements" | "brand";

const SECTION_FOR_TAB: Record<LeftPanelTab, Section> = {
  ai: "create",
  templates: "layouts",
  backgrounds: "layouts",
  text: "elements",
  images: "elements",
  brandkit: "brand",
  // A reopened saved project has nothing left to generate — it opens on
  // the editing tools, with its layer stack already visible on the right.
  layers: "elements",
};

const SECTIONS: { id: Section; label: string; icon: typeof Type; hint: string }[] = [
  { id: "create", label: "Create", icon: Sparkles, hint: "Describe it, let AI build it" },
  { id: "layouts", label: "Layouts", icon: LayoutTemplate, hint: "Starter layouts and canvas background" },
  { id: "elements", label: "Elements", icon: Plus, hint: "Add text and images" },
  { id: "brand", label: "Brand", icon: Gem, hint: "Your colours, type and logo" },
];

type AiStatus = "idle" | "loading" | "ready" | "error" | "not-configured";

/** The three AI calls each used to carry their own status + error +
 *  missing-env-var trio of useState hooks — nine hooks describing the
 *  same three-field shape. One shape, three instances. */
type AiJob = { status: AiStatus; error: string | null; missingEnvVars: string[] };
const IDLE_JOB: AiJob = { status: "idle", error: null, missingEnvVars: [] };

/** Sample copy used only to draw the template thumbnails before any real
 *  content exists, so the layouts can be compared by eye instead of by
 *  reading five near-identical labels. Never reaches the canvas. */
const THUMBNAIL_CONTENT: GraphicContent = {
  headline: "Your headline goes here",
  subheadline: "A supporting line underneath",
  description: "A sentence of body copy, to show where the text block sits.",
  callToAction: "Learn more",
};

const WORKSPACE_CSS = `
.gw-rise { animation: gw-rise 220ms cubic-bezier(0.22,1,0.36,1) both; }
@keyframes gw-rise { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
.gw-fade { animation: gw-fade 180ms ease-out both; }
@keyframes gw-fade { from { opacity: 0; } to { opacity: 1; } }
.gw-notice { animation: gw-notice 260ms cubic-bezier(0.22,1,0.36,1) both; }
@keyframes gw-notice { from { opacity: 0; transform: translateY(-8px) scale(0.985); } to { opacity: 1; transform: none; } }
.gw-pulse { animation: gw-pulse 1.8s ease-in-out infinite; }
@keyframes gw-pulse { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }
.gw-scroll { scrollbar-width: thin; scrollbar-color: var(--line-strong) transparent; }
.gw-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
.gw-scroll::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 99px; border: 3px solid transparent; background-clip: content-box; }
.gw-scroll::-webkit-scrollbar-track { background: transparent; }
.gw-norail { scrollbar-width: none; }
.gw-norail::-webkit-scrollbar { display: none; }
.gw-thumb { container-type: inline-size; }
@media (prefers-reduced-motion: reduce) {
  .gw-rise, .gw-fade, .gw-notice, .gw-pulse { animation: none !important; }
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

/** Reads the live theme tokens Konva can't resolve itself — the stage is
 *  a canvas, so selection handles, snap guides and the safe-margin frame
 *  have to be passed real colour values. Re-reads when the dashboard
 *  flips between light and dark. */
function useThemeInk() {
  const [ink, setInk] = useState({ accent: "#2563EB", danger: "#EF4444" });

  useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement);
      const accent = styles.getPropertyValue("--accent").trim();
      const danger = styles.getPropertyValue("--danger").trim();
      setInk({ accent: accent || "#2563EB", danger: danger || "#EF4444" });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    return () => observer.disconnect();
  }, []);

  return ink;
}

/** Renders a dashed placeholder box (never a real image) for an
 *  image layer with no src yet — from an AI-designed layout's
 *  "image-placeholder" element. Selectable/draggable/resizable like any
 *  other layer; filling it in uses the exact same "Add image"/"Replace
 *  image" upload flow as a regular image layer. */
function ImagePlaceholderNode({ layer, ...rest }: { layer: ImageLayer } & Record<string, unknown>) {
  return (
    <Group x={layer.x} y={layer.y} rotation={layer.rotation} {...rest}>
      <Rect width={layer.width} height={layer.height} fill="#F3F4F6" stroke="#9CA3AF" strokeWidth={1.5} dash={[6, 5]} cornerRadius={4} />
      <KonvaText
        width={layer.width}
        height={layer.height}
        text={`+ ${layer.placeholderLabel || "Add image"}`}
        fontSize={Math.max(11, Math.min(16, layer.width * 0.05))}
        fill="#6B7280"
        align="center"
        verticalAlign="middle"
        listening={false}
      />
    </Group>
  );
}

function ImageLayerNode({ layer, ...rest }: { layer: ImageLayer } & Record<string, unknown>) {
  const image = useKonvaImage(layer.src || null);
  if (!layer.src) return <ImagePlaceholderNode layer={layer} {...rest} />;
  if (!image) return null;
  return <KonvaImage image={image} x={layer.x} y={layer.y} width={layer.width} height={layer.height} rotation={layer.rotation} {...rest} />;
}

function ShapeLayerNode({ layer, ...rest }: { layer: ShapeLayer } & Record<string, unknown>) {
  if (layer.shape === "circle") {
    // Wrapped in a Group so the Group's own x/y (where every drag/
    // transform handler reads and writes) stays the layer's top-left
    // corner, same convention as every other layer — Konva's Circle
    // itself is centre-anchored, so it's offset to the middle of the
    // Group's local width/height instead of carrying x/y directly.
    return (
      <Group x={layer.x} y={layer.y} rotation={layer.rotation} {...rest}>
        <KonvaCircle x={layer.width / 2} y={layer.height / 2} radius={Math.min(layer.width, layer.height) / 2} fill={layer.fill} />
      </Group>
    );
  }
  return (
    <Rect
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      rotation={layer.rotation}
      fill={layer.fill}
      cornerRadius={layer.cornerRadius}
      {...rest}
    />
  );
}

/* ---------------------------------------------------------------- *
 * Small presentational pieces, local so the toolbar and the canvas
 * chrome can have disabled and pressed states without changing the
 * shared IconButton every other admin tab relies on.
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
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition duration-150",
        active
          ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]"
          : "border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]",
        FOCUS,
      )}
    >
      {children}
    </button>
  );
}

function NotConfigured({ missing }: { missing: string[] }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line-strong)] p-2.5 text-[11px] leading-5 text-[var(--text-muted)]">
      <p className="font-semibold text-[var(--text)]">AI generation isn&apos;t configured yet.</p>
      <p className="mt-1">
        Missing environment variable{missing.length > 1 ? "s" : ""}: {missing.join(", ") || "unknown"}.
      </p>
    </div>
  );
}

function JobError({ message }: { message: string }) {
  return (
    <p className="gw-fade rounded-lg bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-2.5 py-2 text-[11px] leading-5 text-[var(--danger)]">
      {message}
    </p>
  );
}

function layerLabel(layer: CanvasLayer) {
  if (layer.type === "text") return layer.text || "Empty text";
  if (layer.type === "shape") return layer.shape === "circle" ? "Circle" : "Shape";
  return layer.src ? "Image" : "Image placeholder";
}

function LayerIcon({ layer }: { layer: CanvasLayer }) {
  if (layer.type === "text") return <Type size={11} className="shrink-0" />;
  if (layer.type === "shape") return layer.shape === "circle" ? <Circle size={11} className="shrink-0" /> : <Shapes size={11} className="shrink-0" />;
  return layer.src ? <ImageIcon size={11} className="shrink-0" /> : <SquareDashed size={11} className="shrink-0" />;
}

/** A real, scaled rendering of what a starter layout produces — built by
 *  calling the same buildTemplateLayers the canvas uses, so the tile can
 *  never drift out of sync with the layout it previews. Sized in cqw so
 *  the type scales with the tile instead of needing a pixel measurement. */
function TemplateThumbnail({
  layers,
  width,
  height,
  background,
}: {
  layers: CanvasLayer[];
  width: number;
  height: number;
  background: string;
}) {
  // A text block is clipped at whatever sits below it, so a headline
  // that wraps further here than it will on the canvas can never bleed
  // over the next element and make the tile look broken.
  const ceilingBelow = (layer: CanvasLayer) => {
    const tops = layers.filter((other) => other.id !== layer.id && other.y > layer.y).map((other) => other.y);
    return (tops.length ? Math.min(...tops) : height) - layer.y;
  };

  return (
    <div className="gw-thumb relative w-full overflow-hidden rounded-md" style={{ aspectRatio: `${width} / ${height}`, background }}>
      {layers.map((layer) => {
        const box = {
          position: "absolute" as const,
          left: `${(layer.x / width) * 100}%`,
          top: `${(layer.y / height) * 100}%`,
          width: `${(layer.width / width) * 100}%`,
        };
        if (layer.type === "text") {
          return (
            <span
              key={layer.id}
              style={{
                ...box,
                color: layer.color,
                fontSize: `${(layer.fontSize / width) * 100}cqw`,
                fontWeight: layer.bold ? 700 : 400,
                textAlign: layer.align,
                lineHeight: 1.15,
                maxHeight: `${(Math.max(0, ceilingBelow(layer)) / height) * 100}%`,
                overflow: "hidden",
                display: "block",
              }}
            >
              {layer.text}
            </span>
          );
        }
        if (layer.type === "shape") {
          return (
            <span
              key={layer.id}
              style={{
                ...box,
                height: `${(layer.height / height) * 100}%`,
                background: layer.fill,
                borderRadius: layer.shape === "circle" ? "50%" : `${((layer.cornerRadius ?? 0) / width) * 100}cqw`,
              }}
            />
          );
        }
        return (
          <span
            key={layer.id}
            style={{
              ...box,
              height: `${(layer.height / height) * 100}%`,
              background: "rgba(156,163,175,0.18)",
              outline: "1px dashed rgba(107,114,128,0.55)",
              outlineOffset: "-1px",
            }}
          />
        );
      })}
    </div>
  );
}

export function GraphicWorkspace({
  title: initialTitle,
  initialCanvasData,
  projectId: initialProjectId,
  initialPanel = "ai",
  initialBrief = "",
  initialReferenceImage = null,
  autoGenerateDesign = false,
  animateIntent = false,
  trendId,
  onClose,
  onCreateWithAsset,
  onAnimateWithAi,
}: {
  title: string;
  initialCanvasData: CanvasData;
  projectId: string | null;
  /** "ai" for a brand-new graphic, "layers" when reopening a saved
   *  project (nothing to generate — see openGraphicProject in
   *  SocialMediaTab.tsx). */
  initialPanel?: LeftPanelTab;
  /** Pre-fills the brief — used by Trend Intelligence's "Generate
   *  content" action. The admin can still edit it before generating. */
  initialBrief?: string;
  /** An admin-uploaded, authorised reference image + its vision
   *  analysis (see TrendDetailModal). When present, the auto-fire
   *  effect below routes to the real-image path instead of the default
   *  free editable-design path — but still stops at the existing
   *  mandatory cost-confirmation dialog, never spending silently. */
  initialReferenceImage?: { url: string; analysis: string } | null;
  /** Fires runAiDesign() once on mount when true and a brief is
   *  present — used only by the Trend Intelligence hand-off so one
   *  click lands on an already-populated, editable design. Default
   *  false preserves every other entry point's manual-click behaviour. */
  autoGenerateDesign?: boolean;
  /** Set only by Trend Intelligence's "Generate Graphic → Animate" —
   *  never changes what gets generated or how (ordinary "Generate
   *  Graphic" never sets this). Once an image exists on the canvas, it
   *  shows a dismissible contextual nudge toward the existing "Animate
   *  with AI" action below, preserving the admin's stated intent to
   *  animate without ever auto-firing a paid generation itself. */
  animateIntent?: boolean;
  /** The trend this graphic came from, present only alongside
   *  animateIntent — carried through to onAnimateWithAi below so the
   *  eventual video can stay linked back to it (see
   *  animateImageFromGraphic in SocialMediaTab.tsx). */
  trendId?: string;
  onClose: () => void;
  /** Opens the existing composer with the flattened graphic already
   *  attached and the brief as caption — the composer remains the sole
   *  authoritative publishing surface; this only ever calls its
   *  existing create-post path with two preset fields. */
  onCreateWithAsset: (brief: string, asset: UploadedAsset) => void;
  /** "Animate with AI" — opens Video Studio with this image pre-
   *  attached as an image-to-video starting frame. Optional: omitted
   *  anywhere Graphic Studio is embedded without a Video Studio hand-
   *  off available. headline/supportingText/callToAction carry over as
   *  a suggested caption only — never auto-added as video overlays,
   *  so the admin never sees text silently duplicated from the source
   *  image. trendId is only ever set when animateIntent brought us
   *  here. */
  onAnimateWithAi?: (source: { url: string; assetId?: string; headline?: string; supportingText?: string; callToAction?: string; trendId?: string }) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [editingTitle, setEditingTitle] = useState(false);
  const [canvasData, setCanvasData] = useState<CanvasData>(initialCanvasData);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 760, height: 560 });
  const [showSafeMargin, setShowSafeMargin] = useState(false);
  const [guide, setGuide] = useState<{ x?: number; y?: number }>({});
  const [overflowWarning, setOverflowWarning] = useState(false);

  const [section, setSection] = useState<Section>(SECTION_FOR_TAB[initialPanel]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);

  // History flags, mirrored into state so Undo/Redo can be visibly
  // disabled at the ends of the stack instead of silently doing nothing.
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const ink = useThemeInk();

  // Shared brief/targeting — read by every generation path.
  const [brief, setBrief] = useState(initialBrief);
  const [platform, setPlatform] = useState<SocialPlatform | null>(null);
  const [style, setStyle] = useState<GraphicStyle | null>(null);
  const [templateId, setTemplateId] = useState<GraphicTemplateId | null>(null);

  // Real brand logo for the auto-fire flow's post-generation apply —
  // same single fetch VideoWorkspace already added for the same reason.
  const [brandKit, setBrandKit] = useState<CompanyBrandKit | null>(null);
  useEffect(() => {
    void getBrandKitApi().then(setBrandKit);
  }, []);

  // Which of the two outputs the Create panel will produce. "design" is
  // the free, fully editable default; "image" calls the paid provider.
  const [aiMode, setAiMode] = useState<"image" | "design">("design");

  // Structured copy (the text-only path) and its job.
  const [content, setContent] = useState<GraphicContent | null>(null);
  const [textJob, setTextJob] = useState<AiJob>(IDLE_JOB);
  const [textFeedbackOpen, setTextFeedbackOpen] = useState(false);
  const [textFeedback, setTextFeedback] = useState("");

  // The AI-composed editable layout and its job.
  const [designJob, setDesignJob] = useState<AiJob>(IDLE_JOB);
  const [designFeedbackOpen, setDesignFeedbackOpen] = useState(false);
  const [designFeedback, setDesignFeedback] = useState("");
  const [lastDesign, setLastDesign] = useState<GraphicDesignSpec | null>(null);

  // The paid, photoreal image path and its job.
  const [imageJob, setImageJob] = useState<AiJob>(IDLE_JOB);
  const [imageSize, setImageSize] = useState<AiImageSize>("1024x1024");
  const [imageQuality, setImageQuality] = useState<AiImageQuality>("medium");
  const [imageBackground, setImageBackground] = useState(false);
  const [imagePreviewBase64, setImagePreviewBase64] = useState<string | null>(null);
  const [imageReference, setImageReference] = useState(initialReferenceImage);
  const [imageUsage, setImageUsage] = useState<ImageUsageSnapshot | null>(null);
  const [imageEstimate, setImageEstimate] = useState<number | null>(null);
  const [imageFeedback, setImageFeedback] = useState("");
  const [imageConfirm, setImageConfirm] = useState<{ kind: "generate" | "revision"; estimatedCostUsd: number } | null>(null);
  const [addingImageToCanvas, setAddingImageToCanvas] = useState(false);
  const imageRequestRef = useRef(false); // synchronous duplicate-request guard — same pattern as publishingRef

  // The "3 creative directions" planning step — text-only, no image
  // spend. Skipped entirely when a reference image is attached (the
  // reference itself is already strong creative direction).
  const [creativeStatus, setCreativeStatus] = useState<AiStatus>("idle");
  const [creativeConcepts, setCreativeConcepts] = useState<GraphicCreativeConcept[] | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<GraphicCreativeConcept | null>(null);

  // "Animate with AI" — hands an image off to Video Studio's
  // image-to-video mode. animatingDesign is only true while flattening
  // + uploading "Animate the Finished Design" (Option B); "Animate
  // Artwork Only" (Option A) needs no upload at all, it reuses the
  // existing generatedByAi layer's URL directly.
  const [animateChooserOpen, setAnimateChooserOpen] = useState(false);
  const [animatingDesign, setAnimatingDesign] = useState(false);
  // Dismissible contextual nudge shown only when animateIntent is true
  // (Trend Intelligence's "Generate Graphic → Animate") and an image
  // now exists on the canvas — points at the same "Animate with AI"
  // action as the toolbar button, never a second path. Dismissing it
  // just hides the nudge; it never affects the toolbar button itself.
  const [animateNudgeDismissed, setAnimateNudgeDismissed] = useState(false);

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const safeMarginLayerRef = useRef<Konva.Layer>(null);
  const shapeRefs = useRef<Record<string, Konva.Node | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetId = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageAreaRef = useRef<HTMLDivElement>(null);
  const publishingRef = useRef(false);

  const historyRef = useRef<CanvasData[]>([initialCanvasData]);
  const historyIndexRef = useRef(0);

  // Responsive display size — measures the actual rendered centre
  // column (both dimensions, so a tall portrait canvas also fits
  // vertically, not just horizontally) instead of a fixed pixel size.
  // The chrome now floats over this box, so the padding below reserves
  // its space without the canvas losing a whole row to it.
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setContainerSize({ width: rect.width, height: rect.height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const fitScale = Math.min(1, containerSize.width / canvasData.width, containerSize.height / canvasData.height);
  const scale = fitScale * zoom;
  const selectedLayer = canvasData.layers.find((layer) => layer.id === selectedId) ?? null;

  const pushHistory = (next: CanvasData) => {
    const truncated = historyRef.current.slice(0, historyIndexRef.current + 1);
    truncated.push(next);
    while (truncated.length > MAX_HISTORY) truncated.shift();
    historyRef.current = truncated;
    historyIndexRef.current = truncated.length - 1;
  };

  /** Live update — no history entry (typing, color dragging). */
  const setLive = (updater: (current: CanvasData) => CanvasData) => setCanvasData(updater);

  /** Committed update — pushes a history entry and marks the project
   *  dirty (the admin's intent is finished: drag end, resize end,
   *  add/remove/duplicate, blur, applying AI content/a template). */
  const commit = (updater: (current: CanvasData) => CanvasData) => {
    setCanvasData((current) => {
      const next = updater(current);
      pushHistory(next);
      return next;
    });
    setDirty(true);
    setCanUndo(true);
    setCanRedo(false);
  };

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    setCanvasData(historyRef.current[historyIndexRef.current]);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setCanvasData(historyRef.current[historyIndexRef.current]);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const updateLayer = (id: string, patch: Partial<TextLayer> & Partial<ImageLayer> & Partial<ShapeLayer>, shouldCommit: boolean) => {
    const apply = (current: CanvasData): CanvasData => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === id ? ({ ...layer, ...patch } as CanvasLayer) : layer)),
    });
    if (shouldCommit) commit(apply);
    else setLive(apply);
  };

  const removeLayer = (id: string) => {
    commit((current) => ({ ...current, layers: current.layers.filter((layer) => layer.id !== id) }));
    setSelectedId(null);
  };

  const duplicateLayer = (id: string) => {
    const layer = canvasData.layers.find((item) => item.id === id);
    if (!layer) return;
    const copy: CanvasLayer = { ...layer, id: newLayerId(), x: layer.x + 20, y: layer.y + 20 };
    commit((current) => ({ ...current, layers: [...current.layers, copy] }));
    setSelectedId(copy.id);
  };

  const moveLayer = (id: string, direction: -1 | 1) => {
    commit((current) => {
      const index = current.layers.findIndex((layer) => layer.id === id);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.layers.length) return current;
      const layers = [...current.layers];
      [layers[index], layers[target]] = [layers[target], layers[index]];
      return { ...current, layers };
    });
  };

  const addTextLayer = () => {
    const layer = textLayer({
      x: canvasData.width / 2 - 150,
      y: canvasData.height / 2,
      width: 300,
      text: "New text",
      fontSize: 36,
      color: "#111827",
      align: "left",
      bold: false,
    });
    commit((current) => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedId(layer.id);
  };

  const addImageLayer = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const asset = await uploadMediaAssetApi(file, file.name);
      const size = Math.min(canvasData.width, canvasData.height) * 0.5;
      const layer = imageLayer({
        x: canvasData.width / 2 - size / 2,
        y: canvasData.height / 2 - size / 2,
        width: size,
        height: size,
        src: asset.url,
      });
      commit((current) => ({ ...current, layers: [...current.layers, layer] }));
      setSelectedId(layer.id);
    } catch (caught) {
      setError(caught instanceof AiApiError ? caught.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const replaceImageLayer = async (file: File) => {
    const id = replaceTargetId.current;
    if (!id) return;
    setReplacing(true);
    setError(null);
    try {
      const asset = await uploadMediaAssetApi(file, file.name);
      // A manual upload replaces the pixels with a real file — the
      // "AI-generated" badge/disclosure would be dishonest afterwards.
      updateLayer(id, { src: asset.url, generatedByAi: false }, true);
    } catch (caught) {
      setError(caught instanceof AiApiError ? caught.message : "Image upload failed.");
    } finally {
      setReplacing(false);
    }
  };

  const pickImageFile = (targetId: string | null) => {
    replaceTargetId.current = targetId;
    fileInputRef.current?.click();
  };

  /** Interprets the brief into structured copy (never pastes it
   *  verbatim). Honest "not configured" state, never a silent fallback
   *  to the raw brief. */
  const runAiGenerate = async (feedback?: string) => {
    setTextJob({ status: "loading", error: null, missingEnvVars: [] });
    try {
      const result = await generateGraphicContentApi({ brief, platform: platform ?? undefined, style: style ?? undefined, templateId: templateId ?? undefined, feedback });
      setContent(result);
      setTextJob({ status: "ready", error: null, missingEnvVars: [] });
      setTextFeedbackOpen(false);
      setTextFeedback("");
    } catch (caught) {
      if (caught instanceof AiApiError && caught.missingEnvVars?.length) {
        setTextJob({ status: "not-configured", error: null, missingEnvVars: caught.missingEnvVars });
        return;
      }
      setTextJob({ status: "error", error: caught instanceof Error ? caught.message : "Couldn't generate content.", missingEnvVars: [] });
    }
  };

  const skipAiWriteManually = () => {
    setContent({ headline: "" });
    setTextJob({ status: "ready", error: null, missingEnvVars: [] });
  };

  /** Asks the AI to compose a full layout (text + decorative shapes +
   *  image placeholders) directly, rather than text that then gets
   *  dropped into a fixed template. Replaces the current canvas
   *  outright, same as applying a template. Every resulting layer is
   *  immediately, independently editable on the canvas — nothing here
   *  is a flattened image. */
  const runAiDesign = async (feedback?: string) => {
    setDesignJob({ status: "loading", error: null, missingEnvVars: [] });
    try {
      const design = await generateGraphicDesignApi({
        brief,
        platform: platform ?? undefined,
        style: style ?? undefined,
        feedback,
        canvasSize: { width: canvasData.width, height: canvasData.height },
      });
      const { canvasData: next, overflow } = designSpecToCanvasData(design, { width: canvasData.width, height: canvasData.height });
      const withLogo = brandKit?.logoUrl ? withBrandLogo(next, brandKit.logoUrl) : next;
      commit(() => withLogo);
      setLastDesign(design);
      setOverflowWarning(overflow);
      setDesignJob({ status: "ready", error: null, missingEnvVars: [] });
      setDesignFeedbackOpen(false);
      setDesignFeedback("");
      setSelectedId(null);
    } catch (caught) {
      if (caught instanceof AiApiError && caught.missingEnvVars?.length) {
        setDesignJob({ status: "not-configured", error: null, missingEnvVars: caught.missingEnvVars });
        return;
      }
      setDesignJob({ status: "error", error: caught instanceof Error ? caught.message : "Couldn't generate a design.", missingEnvVars: [] });
    }
  };

  const autoGenerateFiredRef = useRef(false);

  // Refresh the usage/limit snapshot and the price estimate whenever the
  // image path is in view or the size/quality selection changes — a
  // cheap, read-only call (never the paid provider), so the real cost
  // and today's remaining allowance are on screen before committing.
  useEffect(() => {
    if (aiMode !== "image") return;
    let cancelled = false;
    getImageUsageApi(imageSize, imageQuality, "generate")
      .then(({ usage, estimatedCostUsd }) => {
        if (cancelled) return;
        setImageUsage(usage);
        setImageEstimate(estimatedCostUsd);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [aiMode, imageSize, imageQuality]);

  /** The image path's main entry point — a cheap, text-only step BEFORE
   *  any paid call. Never generates an image itself; picking a concept
   *  (or skipping) is what leads into openImageConfirm below. */
  const openCreativeDirection = async () => {
    setCreativeStatus("loading");
    setSelectedConcept(null);
    try {
      const concepts = await generateCreativeDirectionApi({ brief, platform: platform ?? undefined, style: style ?? undefined, referenceAnalysis: imageReference?.analysis });
      setCreativeConcepts(concepts);
      setCreativeStatus("ready");
    } catch {
      // A failed planning step must never block generation outright —
      // fall through to the direct path (same posture as the Trend
      // Adaptation Engine's analysis-failure fallback).
      setCreativeStatus("idle");
      void openImageConfirm("generate");
    }
  };

  const chooseConcept = (concept: GraphicCreativeConcept) => {
    setSelectedConcept(concept);
    void openImageConfirm("generate");
  };

  const skipConcepts = () => {
    setCreativeConcepts(null);
    setCreativeStatus("idle");
    setSelectedConcept(null);
    void openImageConfirm("generate");
  };

  /** Opens the mandatory pre-generation confirmation — every paid call
   *  goes through this, never straight from a button click. Re-checks
   *  the live usage snapshot each time so the numbers shown are never
   *  stale (e.g. after generating in a prior session today). */
  const openImageConfirm = async (kind: "generate" | "revision") => {
    try {
      const { usage, estimatedCostUsd } = await getImageUsageApi(imageSize, imageQuality, kind);
      setImageUsage(usage);
      setImageEstimate(estimatedCostUsd);
      setImageConfirm({ kind, estimatedCostUsd });
    } catch (caught) {
      setImageJob({ status: "error", error: caught instanceof Error ? caught.message : "Couldn't check today's usage.", missingEnvVars: [] });
    }
  };

  // Trend Intelligence hand-off only — fires exactly once, never on a
  // brief/platform/style edit after mount. With a reference image,
  // this routes to the real-image path and stops at the existing
  // mandatory cost-confirmation dialog (never auto-spends); without
  // one, it keeps the free editable-design path exactly as before.
  useEffect(() => {
    if (!autoGenerateDesign || autoGenerateFiredRef.current || !initialBrief.trim()) return;
    autoGenerateFiredRef.current = true;
    setSection("create");
    if (initialReferenceImage) {
      setAiMode("image");
      void openImageConfirm("generate");
    } else {
      void runAiDesign();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A complete AI-generated image. The result is a PREVIEW only (not
   *  yet saved/added) until the admin explicitly chooses "Add to
   *  canvas" — regenerating or discarding a preview costs nothing extra
   *  beyond the generation call itself. */
  const runGenerateImage = async () => {
    if (imageRequestRef.current) return;
    imageRequestRef.current = true;
    setImageConfirm(null);
    setImageJob({ status: "loading", error: null, missingEnvVars: [] });
    try {
      const result = await generateGraphicImageApi({
        brief,
        platform: platform ?? undefined,
        style: style ?? undefined,
        size: imageSize,
        quality: imageQuality,
        background: imageBackground,
        referenceImageUrl: imageReference?.url,
        referenceAnalysis: imageReference?.analysis,
        promptOverride: selectedConcept?.imagePrompt,
      });
      setImagePreviewBase64(result.base64);
      setImageUsage(result.usage);
      setImageJob({ status: "ready", error: null, missingEnvVars: [] });
    } catch (caught) {
      if (caught instanceof AiApiError && caught.missingEnvVars?.length) {
        setImageJob({ status: "not-configured", error: null, missingEnvVars: caught.missingEnvVars });
      } else {
        setImageJob({ status: "error", error: caught instanceof Error ? caught.message : "Couldn't generate the image.", missingEnvVars: [] });
      }
    } finally {
      imageRequestRef.current = false;
    }
  };

  /** "Request a revision" — edits the CURRENT in-memory preview (never
   *  re-fetched from a saved URL), via OpenAI's /v1/images/edits. */
  const runReviseImage = async () => {
    if (imageRequestRef.current || !imagePreviewBase64 || !imageFeedback.trim()) return;
    imageRequestRef.current = true;
    setImageConfirm(null);
    setImageJob({ status: "loading", error: null, missingEnvVars: [] });
    try {
      const result = await reviseGraphicImageApi({
        feedback: imageFeedback.trim(),
        currentImageBase64: imagePreviewBase64,
        size: imageSize,
        quality: imageQuality,
        background: imageBackground,
      });
      setImagePreviewBase64(result.base64);
      setImageUsage(result.usage);
      setImageJob({ status: "ready", error: null, missingEnvVars: [] });
      setImageFeedback("");
    } catch (caught) {
      if (caught instanceof AiApiError && caught.missingEnvVars?.length) {
        setImageJob({ status: "not-configured", error: null, missingEnvVars: caught.missingEnvVars });
      } else {
        setImageJob({ status: "error", error: caught instanceof Error ? caught.message : "Couldn't revise the image.", missingEnvVars: [] });
      }
    } finally {
      imageRequestRef.current = false;
    }
  };

  /** Saves the current preview to the existing Media Library (same
   *  upload call every other image path already uses) and adds it as
   *  one flattened ImageLayer — full-bleed, behind every existing
   *  layer so editable text/shapes/logos on top are never disturbed.
   *  Regenerating an already-added background REPLACES that one
   *  layer in place rather than stacking duplicates. */
  const addGeneratedImageToCanvas = async () => {
    if (!imagePreviewBase64) return;
    setAddingImageToCanvas(true);
    setError(null);
    try {
      const blob = dataUrlToBlob(`data:image/png;base64,${imagePreviewBase64}`);
      const asset = await uploadMediaAssetApi(blob, "ai-generated.png");
      const existingBackground = canvasData.layers.find((layer) => layer.type === "image" && layer.generatedByAi);
      const fresh = imageLayer({ x: 0, y: 0, width: canvasData.width, height: canvasData.height, src: asset.url, generatedByAi: true });

      commit((current) => {
        let next: CanvasData = {
          ...current,
          layers: existingBackground
            ? current.layers.map((layer) => (layer.id === existingBackground.id ? { ...fresh, id: existingBackground.id } : layer))
            : [fresh, ...current.layers],
        };

        // The real headline/supporting text/CTA are never baked into
        // the raster image (see imagePrompt.ts/creativeDirection.ts) —
        // they land here as separate, independently editable layers.
        if (selectedConcept) {
          const { width, height } = next;
          const copyLayers: TextLayer[] = [
            textLayer({ x: Math.round(width * 0.1), y: Math.round(height * 0.72), width: Math.round(width * 0.8), text: selectedConcept.headline, fontSize: Math.round(width * 0.065), color: "#FFFFFF", align: "center", bold: true }),
          ];
          if (selectedConcept.supportingText) {
            copyLayers.push(
              textLayer({ x: Math.round(width * 0.12), y: Math.round(height * 0.84), width: Math.round(width * 0.76), text: selectedConcept.supportingText, fontSize: Math.round(width * 0.035), color: "#FFFFFF", align: "center", bold: false }),
            );
          }
          if (selectedConcept.callToAction) {
            copyLayers.push(
              textLayer({ x: Math.round(width * 0.12), y: Math.round(height * 0.92), width: Math.round(width * 0.76), text: selectedConcept.callToAction, fontSize: Math.round(width * 0.03), color: "#FFFFFF", align: "center", bold: true }),
            );
          }
          next = { ...next, layers: [...next.layers, ...copyLayers] };
        }

        // Logo overlay — applies whenever a real Brand Kit logo
        // exists, not only on the reference path.
        return brandKit?.logoUrl ? withBrandLogo(next, brandKit.logoUrl) : next;
      });

      setImagePreviewBase64(null);
      setImageJob(IDLE_JOB);
      setSelectedId(existingBackground ? existingBackground.id : fresh.id);
      setSelectedConcept(null);
      setCreativeConcepts(null);
    } catch (caught) {
      setError(caught instanceof AiApiError ? caught.message : "Couldn't add the image to the canvas.");
    } finally {
      setAddingImageToCanvas(false);
    }
  };

  /** Applies the approved copy to a fresh canvas (new size/background
   *  from the current platform/style) — the first time content is
   *  placed. Mirrors the old wizard's "Approve and continue" exactly. */
  const applyGeneratedContent = () => {
    if (!content) return;
    const { canvasData: next, overflow } = buildInitialCanvasData({ content, platform, style, templateId });
    commit(() => next);
    setOverflowWarning(overflow);
    setLastDesign(null); // switching to the template path — the overflow notice's "Regenerate" no longer applies
    setSelectedId(null);
    setSection("layouts");
  };

  /** Re-applies a different starter layout to the *existing* content,
   *  keeping the current canvas size/background — only available once
   *  content exists (fresh generation or "write it myself" this session;
   *  a reopened saved project never had GraphicContent stored). */
  const applyTemplate = (id: GraphicTemplateId) => {
    if (!content) return;
    setTemplateId(id);
    const textColor = selectedLayer?.type === "text" ? selectedLayer.color : canvasData.layers.find((layer) => layer.type === "text")?.color ?? "#111827";
    const { layers, overflow } = buildTemplateLayers(id, { width: canvasData.width, height: canvasData.height }, content, textColor);
    commit((current) => ({ ...current, layers }));
    setOverflowWarning(overflow);
    setLastDesign(null);
    setSelectedId(null);
  };

  // Transformer follows the selected node.
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node = selectedId ? shapeRefs.current[selectedId] : null;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, canvasData.layers]);

  const handleTransformEnd = (id: string, node: Konva.Node) => {
    const layer = canvasData.layers.find((item) => item.id === id);
    if (!layer) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    if (layer.type === "text") {
      updateLayer(id, { x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.max(40, layer.width * scaleX), fontSize: Math.max(8, Math.round(layer.fontSize * scaleY)) }, true);
    } else {
      updateLayer(id, { x: node.x(), y: node.y(), rotation: node.rotation(), width: Math.max(20, layer.width * scaleX), height: Math.max(20, layer.height * scaleY) }, true);
    }
  };

  const layerBoxHeight = (layer: CanvasLayer) => (layer.type === "text" ? layer.fontSize * 1.3 : layer.height);

  const handleDragMove = (layer: CanvasLayer, node: Konva.Node) => {
    const width = layer.width;
    const height = layerBoxHeight(layer);
    const centerX = node.x() + width / 2;
    const centerY = node.y() + height / 2;
    const canvasCenterX = canvasData.width / 2;
    const canvasCenterY = canvasData.height / 2;
    const threshold = 12 / scale;

    let gx: number | undefined;
    let gy: number | undefined;
    if (Math.abs(centerX - canvasCenterX) < threshold) {
      node.x(canvasCenterX - width / 2);
      gx = canvasCenterX;
    }
    if (Math.abs(centerY - canvasCenterY) < threshold) {
      node.y(canvasCenterY - height / 2);
      gy = canvasCenterY;
    }
    setGuide({ x: gx, y: gy });
  };

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      if (projectId) {
        await updateContentProjectApi(projectId, { title, canvasData });
      } else {
        const project = await createContentProjectApi(title, canvasData);
        setProjectId(project.id);
      }
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 1600);
    } catch (caught) {
      setError(caught instanceof AiApiError ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [projectId, title, canvasData]);

  /** Hides the safe-margin guide for exactly one synchronous export
   *  call, then restores it — the guide is a visual aid only and must
   *  never appear in the exported PNG. */
  const flattenToDataUrl = (): string | null => {
    safeMarginLayerRef.current?.visible(false);
    stageRef.current?.batchDraw();
    const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 1 }) ?? null;
    safeMarginLayerRef.current?.visible(showSafeMargin);
    stageRef.current?.batchDraw();
    return dataUrl;
  };

  const exportPng = () => {
    setSelectedId(null);
    const dataUrl = flattenToDataUrl();
    if (!dataUrl) {
      setError("Couldn't export the canvas.");
      return;
    }
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${title || "graphic"}.png`;
    link.click();
  };

  function dataUrlToBlob(dataUrl: string): Blob {
    const [header, base64] = dataUrl.split(",");
    const mime = header.match(/data:(.*);base64/)?.[1] ?? "image/png";
    const bytes = atob(base64);
    const array = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
    return new Blob([array], { type: mime });
  }

  const continueToPublishing = async () => {
    if (publishingRef.current) return; // synchronous guard — a second rapid click is a no-op
    publishingRef.current = true;
    setPublishing(true);
    setError(null);
    try {
      setSelectedId(null);
      await save();

      const dataUrl = flattenToDataUrl();
      if (!dataUrl) throw new Error("Couldn't export the canvas.");
      const asset = await uploadMediaAssetApi(dataUrlToBlob(dataUrl), "graphic.png");
      onCreateWithAsset(brief, asset);
    } catch (caught) {
      setError(caught instanceof AiApiError ? caught.message : caught instanceof Error ? caught.message : "Couldn't continue to publishing.");
    } finally {
      setPublishing(false);
      publishingRef.current = false;
    }
  };

  /** Option A — "Animate Artwork Only": reuses the existing flattened
   *  AI-generated background layer's URL directly, no re-upload (it's
   *  already a real asset). Never bakes text/logo overlays into what
   *  gets animated — those stay exactly where they are on this canvas. */
  function animateArtworkOnly() {
    const backgroundLayer = canvasData.layers.find((layer): layer is ImageLayer => layer.type === "image" && Boolean(layer.generatedByAi) && Boolean(layer.src));
    const fallbackLayer = canvasData.layers.find((layer): layer is ImageLayer => layer.type === "image" && Boolean(layer.src));
    const source = backgroundLayer ?? fallbackLayer;
    if (!source || !onAnimateWithAi) return;
    setAnimateChooserOpen(false);
    onAnimateWithAi({ url: source.src, headline: selectedConcept?.headline, supportingText: selectedConcept?.supportingText, callToAction: selectedConcept?.callToAction, trendId });
  }

  /** Option B — "Animate the Finished Design": flattens the whole
   *  Stage (text/logo/shapes included) and uploads it as a genuinely
   *  new asset — never re-uploads an image that already exists as one. */
  async function animateFinishedDesign() {
    if (!onAnimateWithAi) return;
    setAnimatingDesign(true);
    setError(null);
    try {
      const dataUrl = flattenToDataUrl();
      if (!dataUrl) throw new Error("Couldn't export the canvas.");
      const asset = await uploadMediaAssetApi(dataUrlToBlob(dataUrl), "graphic-flattened.png");
      setAnimateChooserOpen(false);
      onAnimateWithAi({ url: asset.url, assetId: asset.id, headline: selectedConcept?.headline, supportingText: selectedConcept?.supportingText, callToAction: selectedConcept?.callToAction, trendId });
    } catch (caught) {
      setError(caught instanceof AiApiError ? caught.message : "Couldn't prepare the design for animation.");
    } finally {
      setAnimatingDesign(false);
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
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
        return;
      }
      if (meta && event.key.toLowerCase() === "d" && selectedId) {
        event.preventDefault();
        duplicateLayer(selectedId);
        return;
      }
      if (meta && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        setZoom((z) => Math.min(MAX_ZOOM, z + 0.1));
        return;
      }
      if (meta && event.key === "-") {
        event.preventDefault();
        setZoom((z) => Math.max(MIN_ZOOM, z - 0.1));
        return;
      }
      if (meta && event.key === "0") {
        event.preventDefault();
        setZoom(1);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        removeLayer(selectedId);
        return;
      }
      if (event.key === "Escape") {
        if (imageConfirm) {
          setImageConfirm(null);
          return;
        }
        if (confirmDiscardOpen) {
          setConfirmDiscardOpen(false);
          return;
        }
        setSelectedId(null);
        return;
      }
      if (selectedLayer && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        updateLayer(selectedLayer.id, { x: selectedLayer.x + dx, y: selectedLayer.y + dy }, true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedLayer, imageConfirm, confirmDiscardOpen, undo, redo, save]);

  // Pinch / ctrl-wheel zoom over the stage, the way every other design
  // tool behaves. Registered non-passively so the page itself never
  // scrolls or browser-zooms underneath the gesture.
  useEffect(() => {
    const node = stageAreaRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - event.deltaY * 0.0022)));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  const safeMarginX = (canvasData.width * SAFE_MARGIN_PERCENT) / 2;
  const safeMarginY = (canvasData.height * SAFE_MARGIN_PERCENT) / 2;
  const hasAiContent = textJob.status === "ready" && Boolean(content);
  const busy = textJob.status === "loading" || designJob.status === "loading" || imageJob.status === "loading" || creativeStatus === "loading";

  const platformName = platform ? PLATFORMS.find((item) => item.id === platform)?.name ?? "General" : "General";
  const optionsSummary = [platformName, style ? STYLE_OPTIONS.find((option) => option.id === style)?.label : null, aiMode === "image" ? SIZE_OPTIONS.find((option) => option.id === imageSize)?.label : null, aiMode === "image" ? imageQuality : null]
    .filter(Boolean)
    .join(" · ");

  // Thumbnails are built from the same layout function the canvas uses,
  // so a tile can never show a layout the canvas won't produce.
  const templatePreviews = useMemo(() => {
    const source = content && content.headline.trim() ? content : THUMBNAIL_CONTENT;
    const size = { width: canvasData.width, height: canvasData.height };
    const background = canvasData.background;
    const dark = /^#(0|1|2)/i.test(background.trim());
    const textColor = dark ? "#FFFFFF" : "#111827";
    return TEMPLATE_IDS.map((id) => {
      try {
        const { layers } = buildTemplateLayers(id, size, source, textColor);
        return { id, layers };
      } catch {
        return { id, layers: null };
      }
    });
  }, [content, canvasData.width, canvasData.height, canvasData.background]);

  const activeSection = SECTIONS.find((item) => item.id === section)!;

  /* ------------------------------------------------------------- *
   * Panel bodies
   * ------------------------------------------------------------- */

  const createBody = (
    <div className="space-y-4">
      <div>
        <FieldLabel>Brief</FieldLabel>
        <textarea
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          placeholder={
            aiMode === "image"
              ? "Describe the picture. For example: a premium technology themed background for a LinkedIn post"
              : "Describe what this graphic is about. For example: announcing our new school admissions system"
          }
          rows={4}
          className={cx(INPUT, "resize-none p-2.5 text-[12px] leading-5")}
        />
      </div>

      <div>
        <FieldLabel>What should it produce?</FieldLabel>
        <div className="space-y-1.5">
          <button
            type="button"
            aria-pressed={aiMode === "design"}
            onClick={() => setAiMode("design")}
            className={cx(
              "flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition duration-150",
              aiMode === "design" ? "border-[var(--accent)] bg-[var(--accent-tint)]" : "border-[var(--line)] hover:border-[var(--line-strong)]",
              FOCUS,
            )}
          >
            <Shapes size={15} className={cx("mt-0.5 shrink-0", aiMode === "design" ? "text-[var(--accent)]" : "text-[var(--text-subtle)]")} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--text)]">Editable design</span>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--success)_14%,transparent)] px-1.5 py-px text-[9px] font-semibold text-[var(--success)]">Free</span>
              </span>
              <span className="mt-0.5 block text-[10.5px] leading-4 text-[var(--text-subtle)]">A full layout of text and shapes, every piece still editable on the canvas.</span>
            </span>
          </button>

          <button
            type="button"
            aria-pressed={aiMode === "image"}
            onClick={() => setAiMode("image")}
            className={cx(
              "flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition duration-150",
              aiMode === "image" ? "border-[var(--accent)] bg-[var(--accent-tint)]" : "border-[var(--line)] hover:border-[var(--line-strong)]",
              FOCUS,
            )}
          >
            <ImagePlus size={15} className={cx("mt-0.5 shrink-0", aiMode === "image" ? "text-[var(--accent)]" : "text-[var(--text-subtle)]")} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--text)]">Photoreal image</span>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] px-1.5 py-px text-[9px] font-semibold text-[var(--warning)]">
                  {imageEstimate === null ? "Paid" : `≈ $${imageEstimate.toFixed(3)}`}
                </span>
              </span>
              <span className="mt-0.5 block text-[10.5px] leading-4 text-[var(--text-subtle)]">One generated picture, flattened. Add your own editable text over it.</span>
            </span>
          </button>
        </div>
      </div>

      {/* Targeting and image settings, folded away by default — the brief
          and the action are what matter, and these keep their current
          values visible in the summary without occupying the panel. */}
      <div className="rounded-xl border border-[var(--line)]">
        <button
          type="button"
          aria-expanded={optionsOpen}
          onClick={() => setOptionsOpen((value) => !value)}
          className={cx("flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--surface-muted)]", FOCUS)}
        >
          <ChevronDown size={13} className={cx("shrink-0 text-[var(--text-subtle)] transition-transform duration-200", !optionsOpen && "-rotate-90")} />
          <span className="text-[11.5px] font-medium text-[var(--text)]">Options</span>
          <span className="ml-auto truncate text-[10.5px] text-[var(--text-subtle)]">{optionsSummary}</span>
        </button>

        {optionsOpen && (
          <div className="gw-fade space-y-3.5 border-t border-[var(--line)] p-2.5">
            <div>
              <FieldLabel>Platform</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                <Chip active={platform === null} onClick={() => setPlatform(null)}>
                  General
                </Chip>
                {PLATFORMS.map((item) => (
                  <Chip key={item.id} active={platform === item.id} onClick={() => setPlatform(item.id)}>
                    <PlatformMark platform={item.id} size="sm" />
                    {item.name}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>Style</FieldLabel>
              <div className="grid grid-cols-2 gap-1.5">
                {STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={style === option.id}
                    onClick={() => setStyle(option.id)}
                    className={cx(
                      "rounded-lg border p-2 text-left transition duration-150",
                      style === option.id ? "border-[var(--accent)] bg-[var(--accent-tint)]" : "border-[var(--line)] hover:border-[var(--line-strong)]",
                      FOCUS,
                    )}
                  >
                    <p className="text-[11.5px] font-semibold text-[var(--text)]">{option.label}</p>
                    <p className="text-[9.5px] leading-[14px] text-[var(--text-subtle)]">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {aiMode === "image" && (
              <>
                <div>
                  <FieldLabel>Aspect ratio</FieldLabel>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SIZE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={imageSize === option.id}
                        onClick={() => setImageSize(option.id)}
                        className={cx(
                          "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition duration-150",
                          imageSize === option.id ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line-strong)]",
                          FOCUS,
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel>Quality</FieldLabel>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["medium", "high"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={imageQuality === value}
                        onClick={() => setImageQuality(value)}
                        className={cx(
                          "rounded-lg border px-2 py-1.5 text-[11px] font-medium capitalize transition duration-150",
                          imageQuality === value ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--text-muted)] hover:border-[var(--line-strong)]",
                          FOCUS,
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-2 rounded-lg bg-[var(--surface-muted)] p-2 text-[10.5px] leading-4 text-[var(--text-muted)]">
                  <input type="checkbox" checked={imageBackground} onChange={(event) => setImageBackground(event.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
                  <span>
                    Generate a <strong className="text-[var(--text)]">background only</strong>, with no text rendered, then add your own editable headline on top. Recommended, because AI rendered
                    text is not always accurate.
                  </span>
                </label>
              </>
            )}
          </div>
        )}
      </div>

      {aiMode === "image" && imageReference && (
        <div className="flex items-start gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent-tint)] p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageReference.url} alt="Reference" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
          <p className="min-w-0 flex-1 text-[10.5px] leading-4 text-[var(--text-muted)]">Taking inspiration from this reference&apos;s composition, not copying it.</p>
          <button
            type="button"
            onClick={() => setImageReference(null)}
            aria-label="Remove reference image"
            className={cx("shrink-0 rounded text-[var(--text-subtle)] transition hover:text-[var(--text)]", FOCUS)}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {aiMode === "image" && imageUsage && (
        <p className="text-[10px] leading-4 text-[var(--text-subtle)]">
          Today: {imageUsage.generations}/{imageUsage.maxGenerations} generations, {imageUsage.revisions}/{imageUsage.maxRevisions} revisions, ${imageUsage.spentUsd.toFixed(2)} of $
          {imageUsage.capUsd.toFixed(2)} spent.
        </p>
      )}

      {/* ---- results: concepts, then preview, then the copy editor ---- */}

      {aiMode === "image" && !imagePreviewBase64 && creativeConcepts && creativeStatus === "ready" && (
        <div className="gw-rise space-y-2">
          <FieldLabel>Choose a creative direction</FieldLabel>
          {creativeConcepts.map((concept) => (
            <button
              key={concept.label}
              type="button"
              onClick={() => chooseConcept(concept)}
              className={cx(
                "block w-full rounded-xl border border-[var(--line)] p-2.5 text-left transition duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent-tint)]",
                FOCUS,
              )}
            >
              <p className="text-[12px] font-semibold text-[var(--text)]">{concept.label}</p>
              <p className="mt-0.5 text-[10.5px] leading-4 text-[var(--text-subtle)]">{concept.description}</p>
            </button>
          ))}
        </div>
      )}

      {aiMode === "image" && imagePreviewBase64 && (
        <div className="gw-rise space-y-2">
          <div className="overflow-hidden rounded-xl border border-[var(--line)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/png;base64,${imagePreviewBase64}`} alt="Generated preview" className="block w-full" />
          </div>
          <p className="text-[10.5px] leading-4 text-[var(--text-subtle)]">
            Preview only, not yet saved. Adding it puts one flattened image layer on the canvas, so its contents are not independently editable.
          </p>
          {/* Regenerate and "Add to canvas" live in the pinned footer, so
              the decision is reachable without scrolling this panel. */}
          <div className="space-y-1.5 rounded-xl bg-[var(--surface-muted)] p-2">
            <input
              value={imageFeedback}
              onChange={(event) => setImageFeedback(event.target.value)}
              placeholder="Ask for a change, for example make the background darker"
              className={cx(INPUT, "h-8 px-2 text-[11px]")}
            />
            <button
              type="button"
              disabled={!imageFeedback.trim() || imageJob.status === "loading"}
              onClick={() => openImageConfirm("revision")}
              className={cx(BTN_SECONDARY, "h-8 w-full px-2 text-[11px]")}
            >
              Request a revision
            </button>
          </div>
        </div>
      )}

      {aiMode === "design" && designJob.status === "ready" && lastDesign && (
        <div className="gw-rise space-y-1.5 rounded-xl bg-[var(--surface-muted)] p-2.5">
          <p className="text-[11px] leading-4 text-[var(--text-muted)]">
            {lastDesign.elements.length} element{lastDesign.elements.length === 1 ? "" : "s"} are on the canvas. Click any of them to edit, or ask for another pass.
          </p>
          {designFeedbackOpen ? (
            <div className="flex flex-col gap-1.5">
              <input
                autoFocus
                value={designFeedback}
                onChange={(event) => setDesignFeedback(event.target.value)}
                placeholder="For example: fewer elements, more whitespace"
                className={cx(INPUT, "h-8 px-2 text-[11px]")}
              />
              <button type="button" disabled={!designFeedback.trim()} onClick={() => runAiDesign(designFeedback.trim())} className={cx(BTN_SECONDARY, "h-8 px-2 text-[11px]")}>
                <RefreshCw size={12} />
                Regenerate with this note
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => runAiDesign()} className={cx("rounded text-[10.5px] font-medium text-[var(--accent)] hover:underline", FOCUS)}>
                Regenerate
              </button>
              <button type="button" onClick={() => setDesignFeedbackOpen(true)} className={cx("rounded text-[10.5px] font-medium text-[var(--accent)] hover:underline", FOCUS)}>
                Regenerate with a note
              </button>
            </div>
          )}
        </div>
      )}

      {content && (
        <div className="gw-rise space-y-2 border-t border-[var(--line)] pt-3.5">
          <FieldLabel>Copy, edit anything before applying</FieldLabel>
          <input
            value={content.headline}
            onChange={(event) => setContent((current) => (current ? { ...current, headline: event.target.value } : current))}
            placeholder="Headline"
            className={cx(INPUT, "h-8 px-2 text-[12px] font-semibold")}
          />
          <input
            value={content.subheadline ?? ""}
            onChange={(event) => setContent((current) => (current ? { ...current, subheadline: event.target.value || undefined } : current))}
            placeholder="Subheadline, optional"
            className={cx(INPUT, "h-8 px-2 text-[11.5px]")}
          />
          <textarea
            value={content.description ?? ""}
            onChange={(event) => setContent((current) => (current ? { ...current, description: event.target.value || undefined } : current))}
            placeholder="Description, optional"
            rows={2}
            className={cx(INPUT, "resize-none p-2 text-[11.5px] leading-5")}
          />
          <input
            value={content.callToAction ?? ""}
            onChange={(event) => setContent((current) => (current ? { ...current, callToAction: event.target.value || undefined } : current))}
            placeholder="Call to action, optional"
            className={cx(INPUT, "h-8 px-2 text-[11.5px]")}
          />

          {textJob.status === "ready" && brief.trim() && (
            <div>
              {textFeedbackOpen ? (
                <div className="flex flex-col gap-1.5">
                  <input
                    autoFocus
                    value={textFeedback}
                    onChange={(event) => setTextFeedback(event.target.value)}
                    placeholder="For example: make the headline shorter"
                    className={cx(INPUT, "h-8 px-2 text-[11px]")}
                  />
                  <button type="button" disabled={!textFeedback.trim()} onClick={() => runAiGenerate(textFeedback.trim())} className={cx(BTN_SECONDARY, "h-8 px-2 text-[11px]")}>
                    <RefreshCw size={12} />
                    Rewrite with this note
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setTextFeedbackOpen(true)} className={cx("rounded text-[10.5px] font-medium text-[var(--accent)] hover:underline", FOCUS)}>
                  Rewrite with a note
                </button>
              )}
            </div>
          )}

          <button type="button" disabled={!content.headline.trim()} onClick={applyGeneratedContent} className={cx(BTN_PRIMARY, "h-9 w-full px-2.5 text-[12px]")}>
            Place this on the canvas
          </button>
        </div>
      )}

      {textJob.status === "not-configured" && <NotConfigured missing={textJob.missingEnvVars} />}
      {designJob.status === "not-configured" && <NotConfigured missing={designJob.missingEnvVars} />}
      {imageJob.status === "not-configured" && <NotConfigured missing={imageJob.missingEnvVars} />}
      {textJob.error && <JobError message={textJob.error} />}
      {designJob.error && <JobError message={designJob.error} />}
      {imageJob.error && <JobError message={imageJob.error} />}
    </div>
  );

  const showingConcepts = aiMode === "image" && !imagePreviewBase64 && Boolean(creativeConcepts) && creativeStatus === "ready";
  const showingPreview = aiMode === "image" && Boolean(imagePreviewBase64);

  // The footer is always "what do I do next", so it changes with the
  // stage of the flow rather than leaving the real decision buried in
  // the scrolling body above it.
  const createFooter = showingPreview ? (
    <div className="flex gap-1.5">
      <button type="button" disabled={imageJob.status === "loading"} onClick={() => openImageConfirm("generate")} className={cx(BTN_SECONDARY, "h-10 flex-1 text-[11.5px] whitespace-nowrap")}>
        <RefreshCw size={13} />
        Regenerate
      </button>
      <button type="button" disabled={addingImageToCanvas} onClick={() => void addGeneratedImageToCanvas()} className={cx(BTN_PRIMARY, "h-10 flex-[1.25] text-[11.5px] whitespace-nowrap")}>
        {addingImageToCanvas ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        Add to canvas
      </button>
    </div>
  ) : showingConcepts ? (
    <div className="space-y-2">
      <p className="text-center text-[10.5px] text-[var(--text-subtle)]">Pick a direction above, or</p>
      <div className="flex gap-1.5">
        <button type="button" disabled={busy} onClick={() => void openCreativeDirection()} className={cx(BTN_SECONDARY, "h-9 flex-1 px-2 text-[11.5px]")}>
          <RefreshCw size={13} />
          New concepts
        </button>
        <button type="button" onClick={skipConcepts} className={cx(BTN_SECONDARY, "h-9 flex-1 px-2 text-[11.5px]")}>
          Use my brief
        </button>
      </div>
    </div>
  ) : (
    <div className="space-y-2">
      <button
        type="button"
        disabled={!brief.trim() || busy}
        onClick={() => {
          if (aiMode === "design") void runAiDesign();
          else if (imageReference) void openImageConfirm("generate");
          else void openCreativeDirection();
        }}
        className={cx(
          BTN_PRIMARY,
          "h-10 w-full px-3 text-[12.5px]",
          // An inert slab of the primary colour reads as the loudest
          // thing on screen while doing nothing — step it back instead.
          "disabled:border disabled:border-[var(--line)] disabled:bg-transparent disabled:text-[var(--text-subtle)] disabled:opacity-100",
        )}
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : aiMode === "design" ? <Shapes size={15} /> : <Sparkles size={15} />}
        {busy ? "Working" : aiMode === "design" ? "Generate design" : "Generate image"}
      </button>
      {!brief.trim() && <p className="text-center text-[10px] text-[var(--text-subtle)]">Write a brief above to begin</p>}
      {brief.trim() && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={textJob.status === "loading"}
            onClick={() => runAiGenerate()}
            className={cx("rounded text-[10.5px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]", FOCUS)}
          >
            Write the copy only
          </button>
          <span aria-hidden className="h-2.5 w-px bg-[var(--line-strong)]" />
          <button type="button" onClick={skipAiWriteManually} className={cx("rounded text-[10.5px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]", FOCUS)}>
            Write it myself
          </button>
        </div>
      )}
    </div>
  );

  const layoutsBody = (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <FieldLabel>Starter layouts</FieldLabel>
          {!content && <span className="mb-1.5 text-[10px] text-[var(--text-subtle)]">Needs copy first</span>}
        </div>
        {!content && (
          <p className="mb-2 text-[10.5px] leading-4 text-[var(--text-subtle)]">
            These previews use sample copy. Generate or write your copy in Create, then a layout can be applied to it.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {templatePreviews.map(({ id, layers }) => {
            const active = Boolean(content) && templateId === id;
            return (
              <button
                key={id}
                type="button"
                disabled={!content}
                onClick={() => applyTemplate(id)}
                className={cx(
                  "group overflow-hidden rounded-xl border p-1.5 text-left transition duration-150 disabled:cursor-not-allowed",
                  active ? "border-[var(--accent)] bg-[var(--accent-tint)]" : "border-[var(--line)] enabled:hover:border-[var(--accent)]",
                  FOCUS,
                )}
              >
                <div className="overflow-hidden rounded-md border border-[var(--line)]">
                  {layers ? (
                    <TemplateThumbnail layers={layers} width={canvasData.width} height={canvasData.height} background={canvasData.background} />
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-[var(--surface-muted)]">
                      <LayoutTemplate size={16} className="text-[var(--text-subtle)]" />
                    </div>
                  )}
                </div>
                <p className={cx("mt-1.5 truncate px-0.5 text-[11px] font-medium", active ? "text-[var(--accent)]" : content ? "text-[var(--text)]" : "text-[var(--text-subtle)]")}>
                  {TEMPLATE_LABELS[id]}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--line)] pt-3.5">
        <FieldLabel>Canvas background</FieldLabel>
        <div className="flex flex-wrap items-center gap-1.5">
          {BACKGROUND_SWATCHES.map((color) => {
            const active = canvasData.background.toUpperCase() === color.toUpperCase();
            return (
              <button
                key={color}
                type="button"
                title={color}
                aria-label={`Background ${color}`}
                aria-pressed={active}
                onClick={() => commit((current) => ({ ...current, background: color }))}
                className={cx(
                  "h-8 w-8 rounded-full border-2 transition duration-150",
                  active ? "border-[var(--accent)]" : "border-[var(--line-strong)] hover:border-[var(--text-subtle)]",
                  FOCUS,
                )}
                style={{ background: color }}
              />
            );
          })}
          <label
            className={cx(
              "flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--line-strong)] px-2.5 text-[10.5px] font-medium text-[var(--text-muted)] transition hover:border-[var(--text-subtle)] hover:text-[var(--text)]",
            )}
          >
            Custom
            <input
              type="color"
              value={canvasData.background}
              onChange={(event) => setLive((current) => ({ ...current, background: event.target.value }))}
              onBlur={() => commit((current) => current)}
              className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0"
            />
          </label>
        </div>
      </div>

      <div className="border-t border-[var(--line)] pt-3.5">
        <FieldLabel>Canvas</FieldLabel>
        <p className="text-[11.5px] text-[var(--text)]">
          {Math.round(canvasData.width)} × {Math.round(canvasData.height)} px
        </p>
        <p className="mt-0.5 text-[10.5px] text-[var(--text-subtle)]">Set by the platform you pick in Create, before placing copy.</p>
      </div>
    </div>
  );

  const elementsBody = (
    <div className="space-y-4">
      <div>
        <FieldLabel>Add to the canvas</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={addTextLayer}
            className={cx(
              "flex flex-col items-center gap-1.5 rounded-xl border border-[var(--line)] px-2 py-3.5 transition duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent-tint)]",
              FOCUS,
            )}
          >
            <Type size={18} className="text-[var(--text-muted)]" />
            <span className="text-[11.5px] font-medium text-[var(--text)]">Text</span>
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => pickImageFile(null)}
            className={cx(
              "flex flex-col items-center gap-1.5 rounded-xl border border-[var(--line)] px-2 py-3.5 transition duration-150 enabled:hover:border-[var(--accent)] enabled:hover:bg-[var(--accent-tint)] disabled:opacity-50",
              FOCUS,
            )}
          >
            {uploading ? <Loader2 size={18} className="animate-spin text-[var(--text-muted)]" /> : <ImageIcon size={18} className="text-[var(--text-muted)]" />}
            <span className="text-[11.5px] font-medium text-[var(--text)]">Image</span>
          </button>
        </div>
      </div>

      <div className="border-t border-[var(--line)] pt-3.5">
        <FieldLabel>Selected</FieldLabel>
        {!selectedLayer && <p className="text-[10.5px] leading-4 text-[var(--text-subtle)]">Click something on the canvas, or a row in the layer list, to act on it here.</p>}
        {selectedLayer?.type === "image" && (
          <button type="button" disabled={replacing} onClick={() => pickImageFile(selectedLayer.id)} className={cx(BTN_SECONDARY, "h-9 w-full px-2.5 text-[11.5px]")}>
            {replacing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {selectedLayer.src ? "Replace this image" : "Fill this placeholder"}
          </button>
        )}
        {selectedLayer && selectedLayer.type !== "image" && (
          <div className="flex gap-1.5">
            <button type="button" onClick={() => duplicateLayer(selectedLayer.id)} className={cx(BTN_SECONDARY, "h-9 flex-1 px-2 text-[11.5px]")}>
              <Copy size={13} />
              Duplicate
            </button>
            <button type="button" onClick={() => removeLayer(selectedLayer.id)} className={cx(BTN_SECONDARY, "h-9 flex-1 px-2 text-[11.5px]")}>
              <Trash2 size={13} />
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--line)] pt-3.5">
        <FieldLabel>Shortcuts</FieldLabel>
        <dl className="space-y-1 text-[10.5px] text-[var(--text-subtle)]">
          {[
            ["Nudge / big nudge", "Arrows / Shift"],
            ["Undo / redo", "Cmd Z / Shift Z"],
            ["Duplicate", "Cmd D"],
            ["Save", "Cmd S"],
            ["Zoom / fit", "Cmd ± / Cmd 0"],
            ["Deselect", "Esc"],
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

  const sectionBody = section === "create" ? createBody : section === "layouts" ? layoutsBody : section === "elements" ? elementsBody : <BrandKitPanel />;
  const sectionFooter = section === "create" ? createFooter : null;

  /* ------------------------------------------------------------- *
   * Inspector
   * ------------------------------------------------------------- */

  const positionRow = selectedLayer && (
    <div className="grid grid-cols-2 gap-1.5">
      <label className="flex items-center gap-1.5">
        <span className="w-3 text-[10px] font-medium text-[var(--text-subtle)]">X</span>
        <input
          type="number"
          value={Math.round(selectedLayer.x)}
          onChange={(event) => updateLayer(selectedLayer.id, { x: Number(event.target.value) || 0 }, true)}
          className={cx(INPUT, "h-7 min-w-0 px-1.5 text-[11px]")}
        />
      </label>
      <label className="flex items-center gap-1.5">
        <span className="w-3 text-[10px] font-medium text-[var(--text-subtle)]">Y</span>
        <input
          type="number"
          value={Math.round(selectedLayer.y)}
          onChange={(event) => updateLayer(selectedLayer.id, { y: Number(event.target.value) || 0 }, true)}
          className={cx(INPUT, "h-7 min-w-0 px-1.5 text-[11px]")}
        />
      </label>
    </div>
  );

  const inspectorProperties = (
    <>
      {!selectedLayer && (
        <div className="space-y-2.5">
          <div>
            <FieldLabel>Canvas</FieldLabel>
            <p className="text-[12px] font-medium text-[var(--text)]">
              {Math.round(canvasData.width)} × {Math.round(canvasData.height)} px
            </p>
            <p className="mt-0.5 text-[10.5px] text-[var(--text-subtle)]">
              {platformName}
              {style ? ` · ${STYLE_OPTIONS.find((option) => option.id === style)?.label}` : ""} · {Math.round(scale * 100)}% on screen
            </p>
          </div>
          {hasAiContent && (
            <p className="rounded-lg bg-[var(--accent-tint)] px-2.5 py-2 text-[10.5px] leading-4 text-[var(--accent)]">
              Copy is ready. Use &ldquo;Place this on the canvas&rdquo; in Create.
            </p>
          )}
          <p className="text-[10.5px] leading-4 text-[var(--text-subtle)]">Select a layer to edit it. Hold Cmd and scroll over the canvas to zoom.</p>
        </div>
      )}

      {selectedLayer?.type === "text" && (
        <div className="gw-fade space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Type size={13} className="text-[var(--text-subtle)]" />
            <p className="text-[12px] font-semibold text-[var(--text)]">Text</p>
          </div>
          <textarea
            value={selectedLayer.text}
            onChange={(event) => updateLayer(selectedLayer.id, { text: event.target.value }, false)}
            onBlur={() => commit((current) => current)}
            rows={3}
            className={cx(INPUT, "resize-none p-2 text-[11.5px] leading-5")}
          />
          <div className="flex items-center gap-1.5">
            <label className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="text-[10px] font-medium text-[var(--text-subtle)]">Size</span>
              <input
                type="number"
                min={8}
                max={300}
                value={Math.round(selectedLayer.fontSize)}
                onChange={(event) => updateLayer(selectedLayer.id, { fontSize: Number(event.target.value) || 12 }, true)}
                className={cx(INPUT, "h-7 min-w-0 px-1.5 text-[11px]")}
              />
            </label>
            <input
              type="color"
              aria-label="Text colour"
              value={selectedLayer.color}
              onChange={(event) => updateLayer(selectedLayer.id, { color: event.target.value }, false)}
              onBlur={() => commit((current) => current)}
              className={cx("h-7 w-8 shrink-0 cursor-pointer rounded-md border border-[var(--line-strong)] bg-transparent p-0.5", FOCUS)}
            />
            <button
              type="button"
              aria-pressed={selectedLayer.bold}
              onClick={() => updateLayer(selectedLayer.id, { bold: !selectedLayer.bold }, true)}
              className={cx(
                "h-7 w-8 shrink-0 rounded-md border text-[11.5px] font-bold transition duration-150",
                selectedLayer.bold ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]" : "border-[var(--line-strong)] text-[var(--text-muted)] hover:text-[var(--text)]",
                FOCUS,
              )}
            >
              B
            </button>
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--line)] p-0.5">
            {(["left", "center", "right"] as const).map((align) => {
              const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
              const active = selectedLayer.align === align;
              return (
                <button
                  key={align}
                  type="button"
                  aria-label={`Align ${align}`}
                  aria-pressed={active}
                  onClick={() => updateLayer(selectedLayer.id, { align }, true)}
                  className={cx(
                    "flex h-6 flex-1 items-center justify-center rounded-md transition duration-150",
                    active ? "bg-[var(--accent-tint)] text-[var(--accent)]" : "text-[var(--text-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]",
                    FOCUS,
                  )}
                >
                  <Icon size={13} />
                </button>
              );
            })}
          </div>
          {positionRow}
        </div>
      )}

      {selectedLayer?.type === "image" && (
        <div className="gw-fade space-y-2.5">
          <div className="flex items-center gap-1.5">
            <ImageIcon size={13} className="text-[var(--text-subtle)]" />
            <p className="text-[12px] font-semibold text-[var(--text)]">{selectedLayer.generatedByAi ? "Generated image" : selectedLayer.src ? "Image" : "Image placeholder"}</p>
          </div>
          {!selectedLayer.src && (
            <p className="text-[10.5px] leading-4 text-[var(--text-subtle)]">Part of an AI composed layout. Put a real image here, or delete it if you do not need one.</p>
          )}
          {selectedLayer.generatedByAi && (
            <p className="rounded-lg bg-[var(--surface-muted)] p-2 text-[10.5px] leading-4 text-[var(--text-subtle)]">
              A flattened, AI generated image. Its contents are not independently editable text or shapes. Regenerate it from Create, in the photoreal image mode. Editable layers sitting on top of
              it, such as a headline or logo, are unaffected.
            </p>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <label className="flex items-center gap-1.5">
              <span className="w-3 text-[10px] font-medium text-[var(--text-subtle)]">W</span>
              <input
                type="number"
                value={Math.round(selectedLayer.width)}
                onChange={(event) => updateLayer(selectedLayer.id, { width: Number(event.target.value) || 1 }, true)}
                className={cx(INPUT, "h-7 min-w-0 px-1.5 text-[11px]")}
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="w-3 text-[10px] font-medium text-[var(--text-subtle)]">H</span>
              <input
                type="number"
                value={Math.round(selectedLayer.height)}
                onChange={(event) => updateLayer(selectedLayer.id, { height: Number(event.target.value) || 1 }, true)}
                className={cx(INPUT, "h-7 min-w-0 px-1.5 text-[11px]")}
              />
            </label>
          </div>
          {positionRow}
          <button type="button" disabled={replacing} onClick={() => pickImageFile(selectedLayer.id)} className={cx(BTN_SECONDARY, "h-8 w-full px-2 text-[11px]")}>
            {replacing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {selectedLayer.src ? "Replace image" : "Add image"}
          </button>
        </div>
      )}

      {selectedLayer?.type === "shape" && (
        <div className="gw-fade space-y-2.5">
          <div className="flex items-center gap-1.5">
            {selectedLayer.shape === "circle" ? <Circle size={13} className="text-[var(--text-subtle)]" /> : <Shapes size={13} className="text-[var(--text-subtle)]" />}
            <p className="text-[12px] font-semibold text-[var(--text)]">{selectedLayer.shape === "circle" ? "Circle" : "Shape"}</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="flex items-center gap-1.5">
              <span className="w-3 text-[10px] font-medium text-[var(--text-subtle)]">W</span>
              <input
                type="number"
                value={Math.round(selectedLayer.width)}
                onChange={(event) => updateLayer(selectedLayer.id, { width: Number(event.target.value) || 1 }, true)}
                className={cx(INPUT, "h-7 min-w-0 px-1.5 text-[11px]")}
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="w-3 text-[10px] font-medium text-[var(--text-subtle)]">H</span>
              <input
                type="number"
                value={Math.round(selectedLayer.height)}
                onChange={(event) => updateLayer(selectedLayer.id, { height: Number(event.target.value) || 1 }, true)}
                className={cx(INPUT, "h-7 min-w-0 px-1.5 text-[11px]")}
              />
            </label>
          </div>
          {positionRow}
          <label className="flex items-center justify-between gap-2 text-[10.5px] text-[var(--text-muted)]">
            Fill
            <input
              type="color"
              value={selectedLayer.fill}
              onChange={(event) => updateLayer(selectedLayer.id, { fill: event.target.value }, false)}
              onBlur={() => commit((current) => current)}
              className={cx("h-7 w-10 cursor-pointer rounded-md border border-[var(--line-strong)] bg-transparent p-0.5", FOCUS)}
            />
          </label>
        </div>
      )}
    </>
  );

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
          if (!file) return;
          if (replaceTargetId.current) void replaceImageLayer(file);
          else void addImageLayer(file);
        }}
      />

      {/* ---------------------------- toolbar ---------------------------- */}
      <header className="flex h-13 shrink-0 items-center gap-2 border-b border-[var(--line)] px-2.5 sm:px-3.5">
        <IconButton label="Back to Content Studio" onClick={requestClose} size="sm">
          <ArrowLeft size={15} />
        </IconButton>

        <div className="flex min-w-0 items-center gap-1.5">
          {editingTitle ? (
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(event) => event.key === "Enter" && setEditingTitle(false)}
              className={cx(INPUT, "h-8 max-w-[240px] px-2 text-[13px] font-semibold")}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className={cx("flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-[13.5px] font-semibold text-[var(--text)] transition hover:text-[var(--accent)]", FOCUS)}
            >
              <span className="truncate">{title || "Untitled graphic"}</span>
              <Pencil size={11} className="shrink-0 text-[var(--text-subtle)]" />
            </button>
          )}
          {dirty && !saving && (
            <span title="Unsaved changes" className="gw-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--warning)]" />
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <div className="flex items-center gap-0.5 rounded-lg bg-[var(--surface-muted)] p-0.5">
            <ToolButton label="Undo" onClick={undo} disabled={!canUndo}>
              <Undo2 size={14} />
            </ToolButton>
            <ToolButton label="Redo" onClick={redo} disabled={!canRedo}>
              <Redo2 size={14} />
            </ToolButton>
          </div>

          <span aria-hidden className="mx-1 hidden h-5 w-px bg-[var(--line)] sm:block" />

          <button type="button" disabled={saving} onClick={() => void save()} className={cx(BTN_SECONDARY, "h-8 px-2.5 text-[11.5px]")}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} className="text-[var(--success)]" /> : <Save size={13} />}
            <span className="hidden sm:inline">{saved ? "Saved" : "Save"}</span>
          </button>
          {onAnimateWithAi && canvasData.layers.some((layer) => layer.type === "image" && layer.src) && (
            <button type="button" onClick={() => setAnimateChooserOpen(true)} className={cx(BTN_SECONDARY, "h-8 px-2.5 text-[11.5px]")}>
              <Video size={13} />
              <span className="hidden sm:inline">Animate with AI</span>
            </button>
          )}
          <button type="button" onClick={exportPng} className={cx(BTN_SECONDARY, "h-8 px-2.5 text-[11.5px]")}>
            <Download size={13} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button type="button" disabled={publishing} onClick={() => void continueToPublishing()} className={cx(BTN_PRIMARY, "h-8 px-3 text-[11.5px]")}>
            {publishing ? <Loader2 size={13} className="animate-spin" /> : null}
            Continue to publishing
            <ChevronRight size={13} className="-mr-0.5" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* ----------------------------- rail ----------------------------- */}
        <nav
          role="tablist"
          aria-label="Workspace sections"
          aria-orientation="vertical"
          className="gw-norail flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_55%,transparent)] p-1.5 lg:h-full lg:w-[72px] lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r"
        >
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            const flagged = item.id === "create" && hasAiContent;
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
                {flagged && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[var(--accent)] lg:top-2 lg:right-3" />}
              </button>
            );
          })}
        </nav>

        {/* ----------------------------- panel ---------------------------- */}
        {panelOpen && (
          <aside className="flex shrink-0 flex-col border-b border-[var(--line)] lg:h-full lg:w-[286px] lg:border-b-0 lg:border-r">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] px-3">
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-semibold text-[var(--text)]">{activeSection.label}</p>
              </div>
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

            <div key={section} className="gw-rise gw-scroll min-h-0 flex-1 overflow-y-auto p-3">
              {sectionBody}
            </div>

            {sectionFooter && <div className="shrink-0 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-muted)_55%,transparent)] p-3">{sectionFooter}</div>}
          </aside>
        )}

        {/* ----------------------------- stage ---------------------------- */}
        {/* min-w-0 matters: without it this column's min size is its
            content, so a large artboard pushes the inspector off the
            right edge instead of the artboard scaling down to fit. */}
        <div ref={stageAreaRef} className="relative flex min-h-[340px] min-w-0 flex-1 flex-col lg:min-h-0">
          {animateIntent && !animateNudgeDismissed && onAnimateWithAi && canvasData.layers.some((layer) => layer.type === "image" && layer.src) && (
            <div
              role="status"
              className="gw-rise absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--surface)] py-2 pl-3 pr-2 shadow-[var(--shadow-popover)]"
            >
              <Sparkles size={13} className="shrink-0 text-[var(--accent)]" />
              <p className="text-[11.5px] font-medium text-[var(--text)]">Ready to animate this image?</p>
              <button
                type="button"
                onClick={() => {
                  setAnimateNudgeDismissed(true);
                  setAnimateChooserOpen(true);
                }}
                className={cx(BTN_PRIMARY, "h-7 px-2.5 text-[11px]")}
              >
                <Video size={12} />
                Animate with AI
              </button>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setAnimateNudgeDismissed(true)}
                className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-subtle)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)]", FOCUS)}
              >
                <X size={12} />
              </button>
            </div>
          )}
          <div
            ref={containerRef}
            className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-[var(--surface-muted)] p-5 pb-16"
          >
            <div
              className="ring-1 ring-[var(--line-strong)] shadow-[0_18px_50px_-12px_rgba(15,23,42,0.28)]"
              style={{ width: canvasData.width * scale, height: canvasData.height * scale }}
            >
              <Stage
                ref={stageRef}
                width={canvasData.width}
                height={canvasData.height}
                scaleX={scale}
                scaleY={scale}
                onMouseDown={(event) => {
                  if (event.target === event.target.getStage()) setSelectedId(null);
                }}
              >
                <Layer>
                  <Rect x={0} y={0} width={canvasData.width} height={canvasData.height} fill={canvasData.background} />
                  {canvasData.layers.map((layer) => {
                    const common = {
                      ref: (node: Konva.Node | null) => {
                        shapeRefs.current[layer.id] = node;
                      },
                      draggable: true,
                      onClick: () => setSelectedId(layer.id),
                      onTap: () => setSelectedId(layer.id),
                      onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => handleDragMove(layer, event.target),
                      onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
                        setGuide({});
                        updateLayer(layer.id, { x: event.target.x(), y: event.target.y() }, true);
                      },
                      onTransformEnd: (event: Konva.KonvaEventObject<Event>) => handleTransformEnd(layer.id, event.target),
                    };

                    if (layer.type === "text") {
                      return (
                        <KonvaText
                          key={layer.id}
                          {...common}
                          x={layer.x}
                          y={layer.y}
                          width={layer.width}
                          rotation={layer.rotation}
                          text={layer.text}
                          fontSize={layer.fontSize}
                          fill={layer.color}
                          align={layer.align}
                          fontStyle={layer.bold ? "bold" : "normal"}
                        />
                      );
                    }
                    if (layer.type === "shape") {
                      return <ShapeLayerNode key={layer.id} {...common} layer={layer} />;
                    }
                    return <ImageLayerNode key={layer.id} {...common} layer={layer} />;
                  })}

                  {guide.x !== undefined && <Line points={[guide.x, 0, guide.x, canvasData.height]} stroke={ink.accent} strokeWidth={1 / scale} dash={[5 / scale, 5 / scale]} listening={false} />}
                  {guide.y !== undefined && <Line points={[0, guide.y, canvasData.width, guide.y]} stroke={ink.accent} strokeWidth={1 / scale} dash={[5 / scale, 5 / scale]} listening={false} />}

                  <Transformer
                    ref={transformerRef}
                    rotateEnabled
                    flipEnabled={false}
                    ignoreStroke
                    padding={2}
                    anchorSize={9 / scale}
                    anchorCornerRadius={2 / scale}
                    anchorStroke={ink.accent}
                    anchorFill="#FFFFFF"
                    anchorStrokeWidth={1.5 / scale}
                    borderStroke={ink.accent}
                    borderStrokeWidth={1.5 / scale}
                    rotateAnchorOffset={28 / scale}
                  />
                </Layer>

                <Layer ref={safeMarginLayerRef} visible={showSafeMargin} listening={false}>
                  <Rect
                    x={safeMarginX}
                    y={safeMarginY}
                    width={canvasData.width - safeMarginX * 2}
                    height={canvasData.height - safeMarginY * 2}
                    stroke={ink.danger}
                    dash={[8 / scale, 6 / scale]}
                    strokeWidth={1.5 / scale}
                  />
                </Layer>
              </Stage>
            </div>
          </div>

          {/* floating chrome — the canvas keeps its full height */}
          <div className="pointer-events-none absolute bottom-3.5 left-0 flex w-full justify-center px-3">
            <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-[var(--shadow-popover)]">
              <ToolButton label="Zoom out" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 0.1))} disabled={zoom <= MIN_ZOOM}>
                <Minus size={14} />
              </ToolButton>
              <button
                type="button"
                onClick={() => setZoom(1)}
                title="Reset to fit"
                className={cx("h-8 min-w-[52px] rounded-lg px-1 text-[11.5px] font-semibold tabular-nums text-[var(--text)] transition hover:bg-[var(--surface-hover)]", FOCUS)}
              >
                {Math.round(scale * 100)}%
              </button>
              <ToolButton label="Zoom in" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 0.1))} disabled={zoom >= MAX_ZOOM}>
                <Plus size={14} />
              </ToolButton>

              <span aria-hidden className="mx-1 h-5 w-px bg-[var(--line)]" />

              <ToolButton label="Fit to screen" onClick={() => setZoom(1)}>
                <Maximize2 size={14} />
              </ToolButton>
              <ToolButton label="Safe margins" onClick={() => setShowSafeMargin((value) => !value)} pressed={showSafeMargin}>
                <Crop size={14} />
              </ToolButton>
            </div>
          </div>

          {/* floating notices — never reflow the canvas mid-drag */}
          <div className="pointer-events-none absolute top-3 right-3 z-30 flex w-[min(360px,calc(100%-1.5rem))] flex-col gap-2">
            {error && (
              <div className="gw-notice pointer-events-auto flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--danger)_40%,var(--line))] bg-[var(--surface)] p-2.5 shadow-[var(--shadow-popover)]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--danger)]" />
                <p className="min-w-0 flex-1 text-[11.5px] leading-5 text-[var(--text)]">{error}</p>
                <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className={cx("shrink-0 rounded text-[var(--text-subtle)] transition hover:text-[var(--text)]", FOCUS)}>
                  <X size={13} />
                </button>
              </div>
            )}
            {overflowWarning && (
              <div className="gw-notice pointer-events-auto flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--warning)_40%,var(--line))] bg-[var(--surface)] p-2.5 shadow-[var(--shadow-popover)]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--warning)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] leading-5 text-[var(--text)]">
                    {lastDesign
                      ? "This content does not comfortably fit the canvas even after repositioning. Nothing was removed, but some text may sit close to the edge."
                      : "Your text is longer than this layout is designed for. Shorten it, or switch layouts."}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3">
                    {lastDesign && (
                      <button
                        type="button"
                        disabled={designJob.status === "loading"}
                        onClick={() => runAiDesign()}
                        className={cx("rounded text-[10.5px] font-semibold text-[var(--accent)] hover:underline", FOCUS)}
                      >
                        Regenerate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setOverflowWarning(false)}
                      className={cx("rounded text-[10.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text)]", FOCUS)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --------------------------- inspector -------------------------- */}
        <aside className="flex shrink-0 flex-col border-t border-[var(--line)] lg:h-full lg:w-[272px] lg:border-t-0 lg:border-l">
          {/* Properties take only the height they need; the layer stack
              gets the rest, so the column never ends in a dead gap. */}
          <div className="gw-scroll shrink-0 overflow-y-auto p-3 lg:max-h-[58%]">{inspectorProperties}</div>

          <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--line)]">
            <div className="flex h-9 shrink-0 items-center gap-1.5 px-3">
              <LayersIcon size={12} className="text-[var(--text-subtle)]" />
              <p className="text-[10px] font-semibold tracking-[0.07em] text-[var(--text-subtle)] uppercase">Layers</p>
              <span className="ml-auto text-[10px] font-medium text-[var(--text-subtle)] tabular-nums">{canvasData.layers.length}</span>
            </div>
            <div className="gw-scroll min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
              {canvasData.layers.length === 0 && <p className="px-1.5 py-1 text-[10.5px] text-[var(--text-subtle)]">Nothing on the canvas yet.</p>}
              <div className="space-y-px">
                {/* Topmost first, matching what you see on the canvas. */}
                {[...canvasData.layers].reverse().map((layer) => {
                  const active = selectedId === layer.id;
                  return (
                    <div
                      key={layer.id}
                      className={cx(
                        "group flex items-center gap-1 rounded-lg pr-0.5 pl-2 transition duration-150",
                        active ? "bg-[var(--accent-tint)]" : "hover:bg-[var(--surface-muted)]",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(layer.id)}
                        className={cx(
                          "flex min-w-0 flex-1 items-center gap-1.5 rounded py-1.5 text-left text-[11px]",
                          active ? "text-[var(--accent)]" : "text-[var(--text-muted)]",
                          FOCUS,
                        )}
                      >
                        <LayerIcon layer={layer} />
                        <span className="truncate">{layerLabel(layer)}</span>
                        {layer.type === "image" && layer.generatedByAi && (
                          <span className="shrink-0 rounded-full bg-[var(--accent-tint)] px-1.5 py-px text-[8.5px] font-semibold text-[var(--accent)]">AI</span>
                        )}
                      </button>
                      <div
                        className={cx(
                          "flex shrink-0 items-center transition-opacity duration-150",
                          active ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                        )}
                      >
                        <IconButton label="Bring forward" onClick={() => moveLayer(layer.id, 1)} size="sm">
                          <ArrowUp size={11} />
                        </IconButton>
                        <IconButton label="Send backward" onClick={() => moveLayer(layer.id, -1)} size="sm">
                          <ArrowDown size={11} />
                        </IconButton>
                        <IconButton label="Duplicate layer" onClick={() => duplicateLayer(layer.id)} size="sm">
                          <Copy size={11} />
                        </IconButton>
                        <IconButton label="Delete layer" onClick={() => removeLayer(layer.id)} size="sm">
                          <Trash2 size={11} />
                        </IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ------------------------- cost confirmation ------------------------ */}
      {imageConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="gw-fade fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setImageConfirm(null);
          }}
        >
          <div className="gw-rise w-full max-w-[400px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)]">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-tint)]">
                <Sparkles size={15} className="text-[var(--accent)]" />
              </span>
              <p className="text-[13px] font-semibold text-[var(--text)]">
                {imageConfirm.kind === "generate" ? "Generate this image?" : "Revise this image?"}
              </p>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-5 text-[var(--text-muted)]">
              This calls the paid image API. Estimated cost{" "}
              <strong className="font-semibold text-[var(--text)]">${imageConfirm.estimatedCostUsd.toFixed(3)}</strong>, and it counts toward today&apos;s limit.
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
              <button
                type="button"
                autoFocus
                onClick={() => void (imageConfirm.kind === "generate" ? runGenerateImage() : runReviseImage())}
                className={cx(BTN_PRIMARY, "h-9 px-3.5 text-[11.5px]")}
              >
                {imageConfirm.kind === "generate" ? "Generate" : "Revise"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------- animate chooser -------------------------- */}
      {animateChooserOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="gw-fade fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAnimateChooserOpen(false);
          }}
        >
          <div className="gw-rise w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)]">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-tint)]">
                <Video size={15} className="text-[var(--accent)]" />
              </span>
              <p className="text-[13px] font-semibold text-[var(--text)]">Animate with AI</p>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-5 text-[var(--text-muted)]">Opens Video Studio with this image ready to turn into real AI video footage (Luma) — nothing is generated yet.</p>

            <div className="mt-3.5 space-y-2">
              <button
                type="button"
                onClick={animateArtworkOnly}
                disabled={!canvasData.layers.some((layer) => layer.type === "image" && layer.generatedByAi)}
                className={cx("w-full rounded-xl border border-[var(--line)] p-3 text-left transition duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent-tint)] disabled:opacity-40 disabled:hover:border-[var(--line)] disabled:hover:bg-transparent", FOCUS)}
              >
                <p className="text-[12px] font-semibold text-[var(--text)]">Animate Artwork Only</p>
                <p className="mt-1 text-[10.5px] leading-4 text-[var(--text-muted)]">
                  Uses the original AI-generated image, without your text/logo overlays — recommended, since AI video models can distort embedded text and logos. Reapply your real logo and text as
                  editable video overlays afterward.
                </p>
              </button>
              <button
                type="button"
                onClick={() => void animateFinishedDesign()}
                disabled={animatingDesign}
                className={cx("w-full rounded-xl border border-[var(--line)] p-3 text-left transition duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent-tint)]", FOCUS)}
              >
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text)]">
                  {animatingDesign && <Loader2 size={12} className="animate-spin" />}
                  Animate the Finished Design
                </p>
                <p className="mt-1 text-[10.5px] leading-4 text-[var(--text-muted)]">Uses a flattened export of the complete image, including your text and branding. The video model may distort that embedded text or logo.</p>
              </button>
            </div>

            <div className="mt-3.5 flex items-center justify-end">
              <button type="button" onClick={() => setAnimateChooserOpen(false)} className={cx("h-9 rounded-lg px-3 text-[11.5px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]", FOCUS)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------- discard dialog -------------------------- */}
      {confirmDiscardOpen && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="gw-fade fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirmDiscardOpen(false);
          }}
        >
          <div className="gw-rise w-full max-w-[400px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-popover)]">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]">
                <AlertTriangle size={15} className="text-[var(--danger)]" />
              </span>
              <p className="text-[13px] font-semibold text-[var(--text)]">Discard unsaved changes?</p>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-5 text-[var(--text-muted)]">This graphic has not been saved. Leaving now will lose your changes.</p>
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