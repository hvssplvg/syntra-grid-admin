// Video canvas data shape — the editable scene timeline stored in
// ContentProject.canvasData for type VIDEO. Modeled directly on
// canvas.ts (same TextLayer type, same id-generation convention)
// rather than inventing a parallel one. Pure types/constants/factories
// only, same one-directional convention as canvas.ts.

import { CANVAS_SIZE_BY_PLATFORM, canvasSizeForPlatform, imageLayer, newLayerId, textLayer, type CanvasLayer, type ImageLayer, type TextLayer } from "./canvas";

export type VideoSceneBackground = { kind: "color"; value: string } | { kind: "image"; src: string } | { kind: "video"; src: string };

export type VideoScene = {
  id: string;
  durationSeconds: number;
  background: VideoSceneBackground;
  /** Usually one TextLayer; optionally a second ImageLayer for the
   *  business logo (see withLogo/withoutLogo below). CanvasLayer is
   *  canvas.ts's existing union — reused as-is, no new type. */
  layers: CanvasLayer[];
  /** "cut"/"fade" kept from v1; "slide"/"zoom" are additive whole-
   *  scene transitions, still a pure function of time — see
   *  VideoWorkspace.tsx's sceneGroupTransform(). */
  transition: "cut" | "fade" | "slide" | "zoom";
  /** How the on-screen text itself enters, independent of the scene
   *  transition — a pure function of time, see textEntranceTransform()
   *  in VideoWorkspace.tsx. Optional/additive: older saved scenes
   *  simply have no entrance animation. */
  textEntrance?: "none" | "slide-up-fade" | "pop";
  /** Set when this scene came from a concept's "ai-image" background
   *  that hasn't been generated yet — background stays a plain color
   *  placeholder until the admin actually generates it (real spend),
   *  or clears this and keeps the color for free. Additive-only field
   *  on a Json column, same convention as ImageLayer.generatedByAi in
   *  canvas.ts — no migration needed, older saved scenes simply lack it. */
  pendingImagePrompt?: string;
  /** Set while a real AI Video (Luma) generation for this scene is in
   *  flight — points at the AiVideoJob row, so the polling effect in
   *  VideoWorkspace.tsx knows which job to check. Cleared (and
   *  background set to {kind:"video", src}) once that job completes;
   *  cleared with no background change if it fails, so the admin can
   *  see the error and try again. Additive-only field, same convention
   *  as pendingImagePrompt — older saved scenes simply lack it. */
  pendingVideoJobId?: string;
  /** The editable AI Video generation prompt for this scene — present
   *  only on scenes that came from (or were deliberately turned into)
   *  an AI Video storyboard scene. The admin can edit this text before
   *  generating; it is sent verbatim as the Luma prompt. Distinct from
   *  pendingImagePrompt, which is a still-image background suggestion,
   *  not a video-generation prompt. */
  aiVideoPrompt?: string;
  /** When set, this scene's Luma generation is image-to-video: the URL
   *  is sent as the job's starting frame (never trusted directly —
   *  re-validated server-side in resolveTrustedStartFrame before ever
   *  reaching Luma). Always a URL this app itself produced — an
   *  uploaded image, a media-library pick, or Graphic Studio's own
   *  generated/flattened artwork — never an arbitrary external image.
   *  Luma only supports image-to-video at 5s, enforced wherever this
   *  field is read (the duration picker is locked to 5s whenever it's
   *  set). */
  startFrameImageUrl?: string;
};

/** Sets this scene's on-screen text, updating its existing TextLayer if
 *  one exists or creating one if it doesn't — a scene that started with
 *  no text (every AI Video scene does, see conceptToAiVideoCanvasData
 *  below, and so does any manually-added blank scene, see newScene)
 *  has zero layers, and a naive "find the text layer and update it"
 *  would silently do nothing the first time the admin types. Found via
 *  real browser export testing: the exported video had no text overlay
 *  at all, because VideoWorkspace.tsx's "On screen text" field used to
 *  do exactly that naive update-only logic. Empty text on a scene with
 *  no layer yet is a true no-op (nothing to create or clear). */
export function withSceneText(scene: VideoScene, text: string, width: number, height: number): VideoScene {
  const existing = textLayerOf(scene);
  if (existing) {
    return { ...scene, layers: scene.layers.map((layer) => (layer.id === existing.id ? { ...existing, text } : layer)) };
  }
  if (!text) return scene;
  return { ...scene, layers: [...scene.layers, sceneTextLayer(text, width, height)] };
}

const LOGO_LAYER_MARKER = "__trend_intelligence_logo__";

/** The scene's single text layer — scenes only ever hold at most one
 *  TextLayer (plus optionally one logo ImageLayer), so index lookups
 *  like layers[0] silently broke once a logo layer could exist first.
 *  This is the one safe way to find it regardless of layer order. */
export function textLayerOf(scene: VideoScene): TextLayer | undefined {
  return scene.layers.find((layer): layer is TextLayer => layer.type === "text");
}

function logoLayerOf(scene: VideoScene): ImageLayer | undefined {
  return scene.layers.find((layer): layer is ImageLayer => layer.type === "image" && layer.placeholderLabel === LOGO_LAYER_MARKER);
}

/** Adds (or replaces) a small logo image layer in one corner — toggled
 *  per-project from VideoWorkspace once a CompanyBrandKit.logoUrl
 *  exists. placeholderLabel doubles as a marker so withoutLogo() can
 *  find and strip exactly this layer, never a different image a
 *  future feature might add. */
export function withLogo(scene: VideoScene, logoUrl: string, width: number, height: number, corner: "top-right" | "bottom-right" = "bottom-right"): VideoScene {
  const size = Math.round(width * 0.12);
  const margin = Math.round(width * 0.04);
  const y = corner === "top-right" ? margin : height - size - margin;
  const logo = imageLayer({ x: width - size - margin, y, width: size, height: size, src: logoUrl, placeholderLabel: LOGO_LAYER_MARKER });
  return { ...scene, layers: [...scene.layers.filter((layer) => !(layer.type === "image" && layer.placeholderLabel === LOGO_LAYER_MARKER)), logo] };
}

export function withoutLogo(scene: VideoScene): VideoScene {
  const logo = logoLayerOf(scene);
  if (!logo) return scene;
  return { ...scene, layers: scene.layers.filter((layer) => layer.id !== logo.id) };
}

export type VideoCanvasData = {
  width: number;
  height: number;
  fps: number;
  scenes: VideoScene[];
};

export const VIDEO_FPS = 30;
export const MIN_SCENE_SECONDS = 1;
export const MAX_SCENE_SECONDS = 12;
export const MAX_SCENES = 10;

export const VIDEO_BACKGROUND_SWATCHES = ["#0A2540", "#111827", "#D6246E", "#059669", "#1D4ED8", "#FDE68A"];

export function newSceneId(): string {
  return newLayerId();
}

/** One scene's worth of centred on-screen text — the only layer shape
 *  a new scene starts with. Admin/AI can add more TextLayers later the
 *  same way the Graphic Studio does. */
export function sceneTextLayer(text: string, width: number, height: number): TextLayer {
  return textLayer({
    x: Math.round(width * 0.1),
    y: Math.round(height * 0.42),
    width: Math.round(width * 0.8),
    fontSize: 64,
    color: "#FFFFFF",
    align: "center",
    bold: true,
    text,
  });
}

export function newScene(input: { text: string; durationSeconds: number; background?: VideoSceneBackground; width: number; height: number }): VideoScene {
  return {
    id: newSceneId(),
    durationSeconds: Math.min(MAX_SCENE_SECONDS, Math.max(MIN_SCENE_SECONDS, Math.round(input.durationSeconds))),
    background: input.background ?? { kind: "color", value: VIDEO_BACKGROUND_SWATCHES[0] },
    layers: input.text.trim() ? [sceneTextLayer(input.text.trim(), input.width, input.height)] : [],
    transition: "fade",
  };
}

/** The Video Studio's canvas size — always the vertical TikTok/Reels/
 *  Shorts shape (reuses canvas.ts's own TikTok dimensions rather than
 *  defining a second set of numbers for the same real-world size). */
export const BLANK_VIDEO_CANVAS_DATA: VideoCanvasData = {
  width: CANVAS_SIZE_BY_PLATFORM.TIKTOK.width,
  height: CANVAS_SIZE_BY_PLATFORM.TIKTOK.height,
  fps: VIDEO_FPS,
  scenes: [],
};

/** A blank canvas sized for a specific platform (reuses canvas.ts's
 *  existing canvasSizeForPlatform — Graphic Studio already relies on
 *  it, Video Studio just never called it before). */
export function blankVideoCanvasDataForPlatform(platform: string | null): VideoCanvasData {
  const size = canvasSizeForPlatform(platform);
  return { width: size.width, height: size.height, fps: VIDEO_FPS, scenes: [] };
}

export function totalDurationSeconds(data: VideoCanvasData): number {
  return data.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
}

/** Converts an AI-generated VideoConcept (lib/ai/types.ts) into a real,
 *  editable VideoCanvasData — every scene starts on a plain color
 *  background (free) even when the concept proposed "ai-image"; that
 *  prompt is kept on pendingImagePrompt so the editor can offer "Generate
 *  this background" per scene without ever spending money automatically. */
export function conceptToVideoCanvasData(
  concept: { scenes: { text: string; durationSeconds: number; backgroundStyle: "color" | "ai-image"; imagePrompt?: string }[] },
  width: number,
  height: number,
  fps: number,
  swatches: string[] = VIDEO_BACKGROUND_SWATCHES,
): VideoCanvasData {
  const palette = swatches.length > 0 ? swatches : VIDEO_BACKGROUND_SWATCHES;
  return {
    width,
    height,
    fps,
    scenes: concept.scenes.map((scene, index) => ({
      ...newScene({
        text: scene.text,
        durationSeconds: scene.durationSeconds,
        width,
        height,
        background: { kind: "color", value: palette[index % palette.length] },
      }),
      pendingImagePrompt: scene.backgroundStyle === "ai-image" ? scene.imagePrompt : undefined,
    })),
  };
}

/** Converts a selected AiVideoConcept (lib/ai/aiVideoTypes.ts) storyboard
 *  into real, editable VideoCanvasData — every scene starts on a plain
 *  color placeholder, same "never spend automatically" posture as
 *  conceptToVideoCanvasData above. Each scene's AI Video generation is
 *  a separate, explicit, cost-confirmed action the admin takes per
 *  scene from the storyboard editor; this function only lays out the
 *  editable shell. */
export function conceptToAiVideoCanvasData(
  concept: { scenes: { suggestedVisual: string; cameraMovement: string; durationSeconds: number }[] },
  width: number,
  height: number,
  fps: number,
  swatches: string[] = VIDEO_BACKGROUND_SWATCHES,
): VideoCanvasData {
  const palette = swatches.length > 0 ? swatches : VIDEO_BACKGROUND_SWATCHES;
  return {
    width,
    height,
    fps,
    scenes: concept.scenes.map((scene, index) => ({
      ...newScene({
        text: "",
        durationSeconds: scene.durationSeconds,
        width,
        height,
        background: { kind: "color", value: palette[index % palette.length] },
      }),
      aiVideoPrompt: `${scene.suggestedVisual} Camera: ${scene.cameraMovement}. No on-screen text, captions or logos.`,
    })),
  };
}
