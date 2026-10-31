// Real, editable starter templates (Part 3), rewritten (Content Studio
// manual-test fixes) to build from interpreted GraphicContent — never
// the raw brief — and to position text by actually measuring how many
// lines it wraps to (textMeasure.ts), so two briefs of very different
// length never overlap. Text-only by design: none of these pre-fill a
// stock photo (no real asset to use honestly) — "replaceable images"
// is satisfied via the editor's own "Add image"/"Replace image" tools.
//
// Fields the admin/AI hasn't supplied are literal bracketed
// placeholders ("[Client name]") — never invented testimonials, names,
// or stats. The Testimonial template in particular never maps any
// GraphicContent field into the quote/name/role — a generated field
// presented as if it were a real client's words would itself be a
// fabrication, so that template stays 100% placeholder-driven.

import { measureWrappedTextHeight } from "./textMeasure";
import { BACKGROUND_BY_STYLE, SAFE_MARGIN_PERCENT, TEXT_COLOR_BY_STYLE, canvasSizeForPlatform, textLayer, type CanvasData, type CanvasLayer, type CanvasSize } from "./canvas";
import type { GraphicContent } from "@/lib/ai/types";

export type GraphicTemplateId =
  | "product-announcement"
  | "project-showcase"
  | "feature-highlight"
  | "business-tip"
  | "before-after"
  | "service-promotion"
  | "testimonial"
  | "minimal-announcement";

export const TEMPLATE_LABELS: Record<GraphicTemplateId, string> = {
  "product-announcement": "Product Announcement",
  "project-showcase": "Project Showcase",
  "feature-highlight": "Feature Highlight",
  "business-tip": "Business Tip",
  "before-after": "Before & After",
  "service-promotion": "Service Promotion",
  testimonial: "Testimonial Layout",
  "minimal-announcement": "Minimal Announcement",
};

export const TEMPLATE_IDS = Object.keys(TEMPLATE_LABELS) as GraphicTemplateId[];

/* ============================================================================
   CONTENT-AWARE STACKING ENGINE

   A template is an ordered list of text Blocks sharing one content box
   (width + horizontal position). Each block's real wrapped height is
   measured before any y position is decided, so the stack is placed
   sequentially with real gaps — never a fixed fraction blind to length.
============================================================================ */

type Block = {
  text: string;
  fontSizeFraction: number; // of canvas height
  bold: boolean;
  align: "left" | "center" | "right";
  /** Extra breathing room after this block, as a fraction of canvas
   *  height, on top of the standard gap. */
  extraGapFraction?: number;
};

const STANDARD_GAP_FRACTION = 0.03;
const CONTENT_WIDTH_FRACTION = 0.84;

type LayoutResult = { layers: CanvasLayer[]; overflow: boolean };

function layoutBlocks(size: CanvasSize, blocks: Block[], color: string): LayoutResult {
  const boxWidth = size.width * CONTENT_WIDTH_FRACTION;
  const boxX = (size.width - boxWidth) / 2;
  const marginY = size.height * SAFE_MARGIN_PERCENT;
  const regionHeight = size.height - marginY * 2;
  const standardGap = size.height * STANDARD_GAP_FRACTION;

  const measured = blocks.map((block) => {
    const fontSize = size.height * block.fontSizeFraction;
    const height = measureWrappedTextHeight(block.text, fontSize, boxWidth, block.bold);
    const gapAfter = standardGap + size.height * (block.extraGapFraction ?? 0);
    return { ...block, fontSize, height, gapAfter };
  });

  const totalStackHeight =
    measured.reduce((sum, block) => sum + block.height, 0) + measured.slice(0, -1).reduce((sum, block) => sum + block.gapAfter, 0);

  const overflow = totalStackHeight > regionHeight;
  const startY = overflow ? marginY : marginY + Math.max(0, (regionHeight - totalStackHeight) / 2);

  let runningY = startY;
  const layers: CanvasLayer[] = measured.map((block) => {
    const layer = textLayer({
      x: boxX,
      y: runningY,
      width: boxWidth,
      text: block.text,
      fontSize: block.fontSize,
      color,
      align: block.align,
      bold: block.bold,
    });
    runningY += block.height + block.gapAfter;
    return layer;
  });

  return { layers, overflow };
}

/* ============================================================================
   TEMPLATES — each maps GraphicContent fields to a distinct composition
============================================================================ */

type Builder = (size: CanvasSize, content: GraphicContent, color: string) => LayoutResult;

const BUILDERS: Record<GraphicTemplateId, Builder> = {
  "product-announcement": (size, content, color) =>
    layoutBlocks(size, [
      { text: "NEW", fontSizeFraction: 0.032, bold: true, align: "left" },
      { text: content.headline, fontSizeFraction: 0.08, bold: true, align: "center", extraGapFraction: 0.01 },
      { text: content.subheadline ?? content.description ?? "[Add a short supporting line]", fontSizeFraction: 0.034, bold: false, align: "center" },
    ], color),

  "project-showcase": (size, content, color) =>
    layoutBlocks(size, [
      { text: content.brandName ?? "[Project name]", fontSizeFraction: 0.04, bold: true, align: "center" },
      { text: content.headline, fontSizeFraction: 0.07, bold: true, align: "center", extraGapFraction: 0.01 },
      { text: content.description ?? content.subheadline ?? "[What this project does]", fontSizeFraction: 0.032, bold: false, align: "center", extraGapFraction: 0.02 },
      { text: content.callToAction ?? "syntragrid.com", fontSizeFraction: 0.028, bold: false, align: "center" },
    ], color),

  "feature-highlight": (size, content, color) => {
    const features = content.features?.length ? content.features : ["[Add up to three features]"];
    return layoutBlocks(size, [
      { text: "★", fontSizeFraction: 0.05, bold: false, align: "left" },
      { text: content.headline, fontSizeFraction: 0.065, bold: true, align: "left", extraGapFraction: 0.008 },
      { text: content.description ?? content.subheadline ?? "[Describe the benefit in one sentence]", fontSizeFraction: 0.03, bold: false, align: "left", extraGapFraction: 0.015 },
      ...features.slice(0, 3).map((feature): Block => ({ text: `— ${feature}`, fontSizeFraction: 0.028, bold: false, align: "left" })),
    ], color);
  },

  "business-tip": (size, content, color) =>
    layoutBlocks(size, [
      { text: "TIP", fontSizeFraction: 0.032, bold: true, align: "center" },
      { text: content.headline, fontSizeFraction: 0.062, bold: true, align: "center", extraGapFraction: 0.01 },
      { text: content.description ?? content.subheadline ?? "[Why this matters for your business]", fontSizeFraction: 0.03, bold: false, align: "center" },
    ], color),

  "before-after": (size, content, color) => {
    // A genuinely different (2-column) composition, not the generic
    // vertical stacker — the headline is still measured so the
    // BEFORE/AFTER row is placed below it dynamically, never a fixed
    // fraction blind to the headline's actual length.
    const boxWidth = size.width * CONTENT_WIDTH_FRACTION;
    const boxX = (size.width - boxWidth) / 2;
    const marginY = size.height * SAFE_MARGIN_PERCENT;
    const headlineFontSize = size.height * 0.04;
    const headlineHeight = measureWrappedTextHeight(content.headline, headlineFontSize, boxWidth, true);
    const headline = textLayer({ x: boxX, y: marginY, width: boxWidth, text: content.headline, fontSize: headlineFontSize, color, align: "center", bold: true });

    const rowY = marginY + headlineHeight + size.height * 0.08;
    const rowFontSize = size.height * 0.04;
    const columnWidth = size.width * 0.42;
    const before = textLayer({ x: size.width * 0.06, y: rowY, width: columnWidth, text: "BEFORE", fontSize: rowFontSize, color, align: "center", bold: true });
    const after = textLayer({ x: size.width * 0.52, y: rowY, width: columnWidth, text: "AFTER", fontSize: rowFontSize, color, align: "center", bold: true });

    const overflow = rowY + rowFontSize * 1.25 > size.height - marginY;
    return { layers: [headline, before, after], overflow };
  },

  "service-promotion": (size, content, color) =>
    layoutBlocks(size, [
      { text: content.headline, fontSizeFraction: 0.075, bold: true, align: "center", extraGapFraction: 0.01 },
      { text: content.callToAction ?? "[Get in touch to learn more]", fontSizeFraction: 0.034, bold: false, align: "center", extraGapFraction: 0.02 },
      { text: content.brandName ?? "Syntra Grid", fontSizeFraction: 0.028, bold: true, align: "center" },
    ], color),

  // Deliberately ignores every GraphicContent field — presenting
  // AI-written text as if it were a real client's words would itself
  // be a fabrication. Stays 100% bracketed placeholders.
  testimonial: (size, _content, color) =>
    layoutBlocks(size, [
      { text: "“", fontSizeFraction: 0.1, bold: true, align: "center" },
      { text: "[Quote from a client]", fontSizeFraction: 0.045, bold: false, align: "center", extraGapFraction: 0.015 },
      { text: "[Client name]", fontSizeFraction: 0.03, bold: true, align: "center" },
      { text: "[Role, Company]", fontSizeFraction: 0.026, bold: false, align: "center" },
    ], color),

  "minimal-announcement": (size, content, color) =>
    layoutBlocks(size, [{ text: content.headline, fontSizeFraction: 0.068, bold: true, align: "center" }], color),
};

export function buildTemplateLayers(templateId: GraphicTemplateId | null, size: CanvasSize, content: GraphicContent, textColor: string): LayoutResult {
  if (!templateId) {
    // No template chosen — a single headline, same as before templates existed.
    return layoutBlocks(size, [{ text: content.headline, fontSizeFraction: 0.07, bold: true, align: "center" }], textColor);
  }
  return BUILDERS[templateId](size, content, textColor);
}

/** Builds the starting canvas from the approved, interpreted content —
 *  never raw brief text, never an AI-generated image (none exists).
 *  `overflow` is true when the content is longer than this template's
 *  layout comfortably fits — callers show a warning, they never
 *  auto-shrink text to hide it. */
export function buildInitialCanvasData(params: { content: GraphicContent; platform: string | null; style: string | null; templateId: string | null }): { canvasData: CanvasData; overflow: boolean } {
  const style = params.style ?? "MINIMAL";
  const background = BACKGROUND_BY_STYLE[style] ?? "#FFFFFF";
  const textColor = TEXT_COLOR_BY_STYLE[style] ?? "#111827";
  const size = canvasSizeForPlatform(params.platform);
  const templateId = (params.templateId as GraphicTemplateId | null) ?? null;

  const { layers, overflow } = buildTemplateLayers(templateId, size, params.content, textColor);
  return { canvasData: { width: size.width, height: size.height, background, layers }, overflow };
}
