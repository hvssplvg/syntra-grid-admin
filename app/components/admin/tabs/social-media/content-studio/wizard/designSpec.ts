// designSpec.ts — converts a validated GraphicDesignSpec (AI-composed
// layout, "Mode B — AI-designed editable graphic") into real Konva
// layers.
//
// The AI proposes positions, but this file is what actually decides
// where things land. The server (lib/ai/generateGraphicDesign.ts)
// already clamps every value into canvas bounds and validates every
// colour/type — this is a second, independent pass that treats the
// AI's coordinates as a draft, not a guarantee:
//
//   1. Every text element's REAL rendered size is measured (wrapping +
//      line height, via textMeasure.ts) — never trusted from the AI's
//      width/height guess.
//   2. Every box is clamped inside the platform's safe margins.
//   3. Decorative elements (shapes/image-placeholders) that collide
//      with a text box — and aren't deliberately acting as a full
//      background panel behind it — are repositioned, shrunk, or (as
//      a last resort, since they're decoration, never content) simply
//      dropped. Text/feature/branding content is never dropped.
//   4. Text boxes that collide with each other are repaired by
//      deterministic sequential stacking, exactly like templates.ts's
//      layoutBlocks — but applied as a *repair* over the AI's chosen
//      order/grouping, so side-by-side compositions (non-overlapping
//      x-ranges, e.g. feature cards in a row) are left alone.
//   5. If content still doesn't fit the safe area after repair, it's
//      never clipped or removed — the layer stays, slightly extending
//      past the safe guide, and the caller is told via `overflow` so
//      it can show a warning and offer regeneration.

import type { GraphicDesignSpec } from "@/lib/ai/types";
import { measureWrappedTextHeight } from "./textMeasure";
import { imageLayer, shapeLayer, textLayer, SAFE_MARGIN_PERCENT, type CanvasData, type CanvasLayer, type CanvasSize } from "./canvas";

const MIN_GAP = 14; // px — enforced breathing room between repaired elements
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function safeColor(value: string, fallback: string): string {
  return HEX_COLOR.test(value) ? value : fallback;
}

/** Clamps `value` into [min, max] — tolerant of a caller passing
 *  min > max (e.g. when an element's own size already exceeds the
 *  available space), in which case it normalises rather than throws. */
function clampNum(value: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (!Number.isFinite(value)) return lo;
  return Math.min(hi, Math.max(lo, value));
}

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** True when `outer` fully contains `inner` (with a little tolerance) —
 *  the signature of a deliberate background panel, not a collision. */
function contains(outer: Box, inner: Box, tolerance = 6): boolean {
  return (
    outer.x - tolerance <= inner.x &&
    outer.y - tolerance <= inner.y &&
    outer.x + outer.width + tolerance >= inner.x + inner.width &&
    outer.y + outer.height + tolerance >= inner.y + inner.height
  );
}

function xRangesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x;
}

type TextBox = Box & { kind: "text"; index: number; fontSize: number; text: string; color: string; align: "left" | "center" | "right"; bold: boolean; rotation: number };
type ShapeBox = Box & { kind: "shape"; index: number; shape: "rect" | "circle"; fill: string; rotation: number; cornerRadius?: number };
type PlaceholderBox = Box & { kind: "placeholder"; index: number; rotation: number; label?: string };
type DecorativeBox = ShapeBox | PlaceholderBox;

/** Builds the starting canvas from an AI-designed layout, running every
 *  element through the collision-repair pipeline described above.
 *  Every text element becomes a fully editable TextLayer, every shape
 *  a ShapeLayer, and every "image-placeholder" an ImageLayer with an
 *  empty src — the admin fills it in via the existing image-upload
 *  flow. Nothing here is flattened or non-editable. */
export function designSpecToCanvasData(spec: GraphicDesignSpec, size: CanvasSize): { canvasData: CanvasData; overflow: boolean } {
  const marginX = (size.width * SAFE_MARGIN_PERCENT) / 2;
  const marginY = (size.height * SAFE_MARGIN_PERCENT) / 2;
  const safeLeft = marginX;
  const safeRight = size.width - marginX;
  const safeTop = marginY;
  const safeBottom = size.height - marginY;
  const safeWidth = Math.max(40, safeRight - safeLeft);
  const safeHeight = Math.max(40, safeBottom - safeTop);

  // --- Pass 1: resolve every element into a box with its REAL size ---
  const textBoxes: TextBox[] = [];
  const decorativeBoxes: DecorativeBox[] = [];

  spec.elements.forEach((element, index) => {
    const rawWidth = clampNum(element.width, 20, safeWidth);
    const x = clampNum(element.x, safeLeft, safeRight - rawWidth);
    const width = clampNum(rawWidth, 20, safeRight - x);

    if (element.type === "text") {
      const fontSize = clampNum(element.fontSize, 8, size.height * 0.25);
      const height = measureWrappedTextHeight(element.text, fontSize, width, element.bold);
      const y = clampNum(element.y, safeTop, Math.max(safeTop, safeBottom - height));
      textBoxes.push({
        kind: "text",
        index,
        x,
        y,
        width,
        height,
        fontSize,
        text: element.text,
        color: safeColor(element.color, "#111827"),
        align: element.align,
        bold: element.bold,
        rotation: element.rotation ?? 0,
      });
      return;
    }

    const rawHeight = clampNum(element.height, 20, safeHeight);
    const y = clampNum(element.y, safeTop, safeBottom - rawHeight);
    const height = clampNum(rawHeight, 20, safeBottom - y);

    if (element.type === "shape") {
      decorativeBoxes.push({
        kind: "shape",
        index,
        x,
        y,
        width,
        height,
        shape: element.shape,
        fill: safeColor(element.fill, "#E5E7EB"),
        rotation: element.rotation ?? 0,
        cornerRadius: element.cornerRadius,
      });
      return;
    }

    decorativeBoxes.push({ kind: "placeholder", index, x, y, width, height, rotation: element.rotation ?? 0, label: element.label });
  });

  // --- Pass 2: repair text-vs-text collisions by deterministic
  // sequential stacking, grouped by overlapping x-range so side-by-
  // side compositions (feature cards in a row) are left untouched. ---
  const orderedText = [...textBoxes].sort((a, b) => a.y - b.y);
  const placedText: TextBox[] = [];
  for (const box of orderedText) {
    let y = box.y;
    for (const placed of placedText) {
      if (!xRangesOverlap(box, placed)) continue;
      const placedBottom = placed.y + placed.height;
      if (y < placedBottom + MIN_GAP && y + box.height > placed.y) {
        y = placedBottom + MIN_GAP;
      }
    }
    placedText.push({ ...box, y });
  }

  // --- Pass 3: repair decorative-vs-text collisions. A decorative
  // element that fully contains a text box is a deliberate background
  // panel, not a collision, and is left alone. Anything else that
  // overlaps text gets pushed clear above/below the colliding text's
  // union, or shrunk/dropped if neither direction fits — decorative
  // elements are expendable, text/feature/branding content never is. ---
  const repairedDecorative: DecorativeBox[] = [];
  for (const box of decorativeBoxes) {
    const colliding = placedText.filter((text) => overlaps(box, text) && !contains(box, text));

    if (colliding.length === 0) {
      repairedDecorative.push(box);
      continue;
    }

    const unionTop = Math.min(...colliding.map((t) => t.y));
    const unionBottom = Math.max(...colliding.map((t) => t.y + t.height));
    const center = box.y + box.height / 2;
    const preferAbove = center < (unionTop + unionBottom) / 2;

    const aboveY = unionTop - box.height - MIN_GAP;
    const belowY = unionBottom + MIN_GAP;
    const aboveFits = aboveY >= safeTop;
    const belowFits = belowY + box.height <= safeBottom;

    if (preferAbove && aboveFits) {
      repairedDecorative.push({ ...box, y: aboveY });
    } else if (belowFits) {
      repairedDecorative.push({ ...box, y: belowY });
    } else if (aboveFits) {
      repairedDecorative.push({ ...box, y: aboveY });
    } else {
      // Neither direction clears the collision within the safe area.
      // Shapes/placeholders are purely decorative — shrink to a thin
      // accent pinned at the nearest free edge rather than cover real
      // content; if there's no free edge at all, drop it.
      const topGap = unionTop - safeTop;
      const bottomGap = safeBottom - unionBottom;
      if (topGap > 24) {
        repairedDecorative.push({ ...box, y: safeTop, height: Math.min(box.height, topGap - MIN_GAP) });
      } else if (bottomGap > 24) {
        repairedDecorative.push({ ...box, y: safeBottom - Math.min(box.height, bottomGap - MIN_GAP), height: Math.min(box.height, bottomGap - MIN_GAP) });
      }
      // else: dropped — no safe placement exists for this decoration.
    }
  }

  // --- Pass 4: final safety clamp. Decorative boxes are hard-clamped
  // into the safe area (they're expendable, a minor nudge is fine).
  // Text boxes are only *checked* here — if content is genuinely
  // taller than the canvas, it's left in place (never clipped/dropped)
  // and surfaced as `overflow` instead. ---
  const finalDecorative = repairedDecorative.map((box) => ({
    ...box,
    x: clampNum(box.x, safeLeft, safeRight - box.width),
    y: clampNum(box.y, safeTop, Math.max(safeTop, safeBottom - box.height)),
  }));

  const overflow = placedText.some((box) => box.y + box.height > safeBottom + 1 || box.y < safeTop - 1);

  // --- Build layers, preserving the AI's original front-to-back order ---
  const byIndex = new Map<number, CanvasLayer>();
  for (const box of placedText) {
    byIndex.set(
      box.index,
      textLayer({ x: box.x, y: box.y, width: box.width, text: box.text, fontSize: box.fontSize, color: box.color, align: box.align, bold: box.bold, rotation: box.rotation }),
    );
  }
  for (const box of finalDecorative) {
    if (box.kind === "shape") {
      byIndex.set(box.index, shapeLayer({ shape: box.shape, x: box.x, y: box.y, width: box.width, height: box.height, fill: box.fill, rotation: box.rotation, cornerRadius: box.cornerRadius }));
    } else {
      byIndex.set(box.index, imageLayer({ x: box.x, y: box.y, width: box.width, height: box.height, src: "", placeholderLabel: box.label, rotation: box.rotation }));
    }
  }

  const layers = spec.elements.map((_, index) => byIndex.get(index)).filter((layer): layer is CanvasLayer => Boolean(layer));

  return { canvasData: { width: size.width, height: size.height, background: safeColor(spec.background, "#FFFFFF"), layers }, overflow };
}

/** Applies the real Brand Kit logo to a generated canvas — never
 *  trusted to the AI prompt (generateGraphicDesign.ts's parser never
 *  reads a url/src field at all, by design). If the AI proposed an
 *  "image-placeholder" clearly meant for the logo, fills that spot;
 *  otherwise appends one small corner logo layer, same idea as the
 *  Video Studio's withLogo() in videoCanvas.ts. */
export function withBrandLogo(canvasData: CanvasData, logoUrl: string): CanvasData {
  const logoPlaceholder = canvasData.layers.find(
    (layer): layer is CanvasLayer & { type: "image" } => layer.type === "image" && layer.src === "" && /logo/i.test(layer.placeholderLabel ?? ""),
  );

  if (logoPlaceholder) {
    return { ...canvasData, layers: canvasData.layers.map((layer) => (layer.id === logoPlaceholder.id ? { ...layer, src: logoUrl } : layer)) };
  }

  const size = Math.round(canvasData.width * 0.14);
  const margin = Math.round(canvasData.width * SAFE_MARGIN_PERCENT) / 2;
  const logo = imageLayer({ x: canvasData.width - size - margin, y: canvasData.height - size - margin, width: size, height: size, src: logoUrl });
  return { ...canvasData, layers: [...canvasData.layers, logo] };
}
