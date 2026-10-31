// Canvas data shape — the editable layer document stored in
// ContentProject.canvasData. Deliberately generic (a typed layer array)
// so Carousel (multiple of these) and other future content types are
// additive extensions later, not a rewrite — per the Content Studio
// plan's "adaptive editor" architecture.
//
// Pure types/constants/id-generation only — template layer *content* is
// built in ./templates.ts, which imports from here (not the reverse),
// to keep the dependency graph one-directional.

export type TextLayer = {
  id: string;
  type: "text";
  x: number;
  y: number;
  width: number;
  rotation: number;
  text: string;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  bold: boolean;
};

export type ImageLayer = {
  id: string;
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Empty string means this is an unfilled placeholder (from an
   *  AI-designed layout's "image-placeholder" element, see
   *  designSpec.ts) — rendered as a dashed box the admin fills via the
   *  existing "Add image"/"Replace image" upload flow. Never treated
   *  as a real image until it has a real src. */
  src: string;
  /** Shown inside the placeholder box while src is empty — purely
   *  descriptive, never a URL. */
  placeholderLabel?: string;
  /** True only for a flattened image produced by Mode A ("Generate
   *  Image") — additive to this TS type only (canvasData is a Prisma
   *  Json column, so this needs no migration; existing saved projects
   *  simply have no layer with this set). The Layers panel shows a
   *  badge and the right panel disables any "this is editable text"
   *  framing — the pixels are real, but nothing inside them is an
   *  independently editable element. */
  generatedByAi?: boolean;
};

/** A decorative, non-photographic element (colour block, accent bar) —
 *  the AI-designed layout mode's way of building visual hierarchy
 *  without needing a real image. Fully editable like any other layer. */
export type ShapeLayer = {
  id: string;
  type: "shape";
  shape: "rect" | "circle";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  cornerRadius?: number;
};

export type CanvasLayer = TextLayer | ImageLayer | ShapeLayer;

export type CanvasData = {
  width: number;
  height: number;
  background: string;
  layers: CanvasLayer[];
};

export type CanvasSize = { width: number; height: number };

/** Not exact per-platform safe-zone specs (none verified from an
 *  official source) — a single conservative inset used as a visual
 *  guide only, never claimed as platform-certified. */
export const SAFE_MARGIN_PERCENT = 0.1;

/** Real, commonly-used dimensions per platform — General defaults to a
 *  square, the safest cross-platform shape. */
export const CANVAS_SIZE_BY_PLATFORM: Record<string, CanvasSize> = {
  GENERAL: { width: 1080, height: 1080 },
  INSTAGRAM: { width: 1080, height: 1080 },
  TIKTOK: { width: 1080, height: 1920 },
  LINKEDIN: { width: 1200, height: 630 },
  FACEBOOK: { width: 1200, height: 630 },
  X: { width: 1200, height: 675 },
  YOUTUBE: { width: 1280, height: 720 },
};

export function canvasSizeForPlatform(platform: string | null): CanvasSize {
  return CANVAS_SIZE_BY_PLATFORM[platform ?? "GENERAL"] ?? CANVAS_SIZE_BY_PLATFORM.GENERAL;
}

/** The Graphic Studio's starting point — opened immediately, full-
 *  screen, with nothing generated or chosen yet (see GraphicWorkspace's
 *  "Create with AI" panel). */
export const BLANK_CANVAS_DATA: CanvasData = { width: 1080, height: 1080, background: "#FFFFFF", layers: [] };

export const BACKGROUND_BY_STYLE: Record<string, string> = {
  BOLD: "#111827",
  MINIMAL: "#FFFFFF",
  PLAYFUL: "#FDE68A",
  CORPORATE: "#0A2540",
};

export const TEXT_COLOR_BY_STYLE: Record<string, string> = {
  BOLD: "#FFFFFF",
  MINIMAL: "#111827",
  PLAYFUL: "#111827",
  CORPORATE: "#FFFFFF",
};

let layerCounter = 0;
export function newLayerId(): string {
  layerCounter += 1;
  return `layer-${Date.now()}-${layerCounter}`;
}

export function textLayer(partial: Omit<TextLayer, "id" | "type" | "rotation"> & { rotation?: number }): TextLayer {
  return { id: newLayerId(), type: "text", rotation: 0, ...partial };
}

export function imageLayer(partial: Omit<ImageLayer, "id" | "type" | "rotation"> & { rotation?: number }): ImageLayer {
  return { id: newLayerId(), type: "image", rotation: 0, ...partial };
}

export function shapeLayer(partial: Omit<ShapeLayer, "id" | "type" | "rotation"> & { rotation?: number }): ShapeLayer {
  return { id: newLayerId(), type: "shape", rotation: 0, ...partial };
}
