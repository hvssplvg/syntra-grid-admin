// lib/ai/graphicDesign.ts
//
// Turns a Graphic Studio brief into a full AI-COMPOSED design
// specification — "Mode B — AI-designed editable graphic" (Content
// Studio round 3). Unlike graphicContent.ts (text fields a fixed
// template then lays out), the AI itself chooses positions, sizes,
// colours and decorative shapes here; generateGraphicDesign.ts
// validates and clamps every value strictly before any of it becomes a
// real Konva layer. Same AiTextProvider.generate(prompt): Promise<string>
// interface as every other text feature — no new provider type.

import { platformGuidance } from "./platforms";
import type { BrandContext } from "./brand";
import type { BuiltPrompt, GraphicDesignRequest } from "./types";

/** Deliberately not importing wizard/canvas.ts's CanvasSize — lib/ai
 *  stays independent of the component tree; the orchestration layer
 *  (generateGraphicDesign.ts) resolves the real pixel size and passes
 *  it in as a plain object. */
type CanvasSize = { width: number; height: number };

/** Matches wizard/canvas.ts's SAFE_MARGIN_PERCENT value — a conservative
 *  visual guide only, not a platform-certified safe zone (same caveat
 *  as the canvas module's own comment). Duplicated as a literal rather
 *  than imported to avoid lib/ai depending on the component tree; if
 *  that value ever changes, update both. */
const SAFE_MARGIN_PERCENT = 0.1;

function brandRules(brand: BrandContext): string[] {
  const lines = [
    `You are the senior graphic designer for ${brand.company}.`,
    `Positioning: ${brand.positioning}`,
    `Preferred writing style for any text you place: ${brand.preferredStyle}`,
  ];
  if (brand.toneOfVoice) lines.push(`Brand tone of voice: ${brand.toneOfVoice}`);
  lines.push(`Avoid: ${brand.avoid.join("; ")}.`);
  if (brand.bannedPhrases.length > 0) {
    lines.push(`Never use these exact phrases or close paraphrases of them: ${brand.bannedPhrases.map((phrase) => `"${phrase}"`).join(", ")}.`);
  }
  if (brand.primaryColors.length > 0 || brand.secondaryColors.length > 0) {
    lines.push(`Brand colours — prefer these real hex values for background/accent/text choices where appropriate, rather than inventing an unrelated palette: ${[...brand.primaryColors, ...brand.secondaryColors].join(", ")}.`);
  }
  lines.push(`Write all text in ${brand.preferredLanguage}.`);
  return lines;
}

const MAX_ELEMENTS = 14;

function schemaInstruction(size: CanvasSize): string {
  const marginX = Math.round(size.width * SAFE_MARGIN_PERCENT) / 2;
  const marginY = Math.round(size.height * SAFE_MARGIN_PERCENT) / 2;

  return `
The canvas is exactly ${size.width}x${size.height} pixels. Keep every element's bounding box fully inside the safe area: x from ${marginX} to ${size.width - marginX}, y from ${marginY} to ${size.height - marginY}.

Return ONLY a single JSON object (no markdown fences, no preamble, no explanation) with this exact shape:
{
  "background": "#RRGGBB",
  "elements": [
    {
      "type": "text",
      "role": "headline" | "subheadline" | "body" | "feature" | "callToAction" | "brand",
      "text": string,
      "x": number, "y": number, "width": number,
      "fontSize": number,
      "color": "#RRGGBB",
      "align": "left" | "center" | "right",
      "bold": boolean
    },
    {
      "type": "shape",
      "shape": "rect" | "circle",
      "x": number, "y": number, "width": number, "height": number,
      "fill": "#RRGGBB"
    },
    {
      "type": "image-placeholder",
      "x": number, "y": number, "width": number, "height": number,
      "label": string
    }
  ]
}

Rules:
- At most ${MAX_ELEMENTS} elements total. Every element must earn its place — quality and purpose over quantity. A plain headline on a flat background is only acceptable if the brief is explicitly minimal; otherwise build a real composition.
- "elements" is back-to-front (first = furthest back). Put base/background shapes first, then content on top of them, in the order they should visually stack.
- NON-OVERLAP IS MANDATORY, with one deliberate exception: a shape may act as a background PANEL fully behind a text element (the shape's box fully contains the text's box, with visible padding on every side, text placed after it in the array) — that is a real composition technique, use it. Anything else — an accent bar, divider, or decorative shape that only partly overlaps a text box — is a layout error, not decoration. If a decorative element relates to a text block, place it fully beside, above, or below that block's bounding box instead, never crossing into it.
- Build genuinely sophisticated compositions where the content supports it: group a feature with its own small accent shape behind or beside it ("feature cards"), use a layered background (one full-bleed base shape plus one smaller accent shape, not just a flat canvas colour), vary horizontal alignment between elements for an asymmetric, editorial layout instead of centring everything, and give the headline real typographic weight (noticeably larger fontSize, generous width) relative to supporting text.
- Use "image-placeholder" only when a real photo/screenshot would genuinely belong there (e.g. a product shot). It is empty geometry only — never invent what the image shows, and never include any URL, path or image data anywhere in your response.
- Every colour must be a hex string ("#RRGGBB" or "#RGB"). No named colours, no rgba(), no gradients. Pick a small, deliberate palette (background + 1-2 accent colours + text colour with strong contrast against whatever is behind it) rather than a different colour per element.
- Give every text element a real, finished pixel position and size — you are placing it, not describing it. Larger fontSize for "headline" than any other role. Leave generous, visible spacing between every element.
- x/y/width/height/fontSize are all plain numbers in pixels, never percentages or strings.
- The application measures your text's real wrapped height and will reposition anything that still collides, so get positioning as close to correct as you can — but never let that possibility make you timid: still design a genuine composition, not a safe centred list.`.trim();
}

const INTERPRETATION_RULES = `
This is a CREATIVE BRIEF for a real promotional graphic, not a copy-paste target.
- Follow explicit wording instructions in the brief exactly if the admin gave one.
- Preserve every specific fact, name, feature, or number the admin actually wrote — never drop or alter them.
- Never invent a statistic, testimonial, client name, performance claim, screenshot, or interface detail that isn't in the brief.
- Keep text short and graphic-appropriate: headline under ~8 words, subheadline/body under ~16 words, each feature under ~6 words.
- Avoid generic marketing clichés — design something specific to what the brief actually says.
- Design a genuine composition appropriate to the content and platform: a feature list gets a real feature-card treatment (each feature with its own small supporting shape and breathing room, not just a bullet list); a simple announcement gets bold editorial typography with an asymmetric layout; a corporate/professional brief gets a structured, formal composition with a clear layered background rather than a flat colour. The composition must stay readable and professional throughout — sophistication never comes at the cost of clarity.`.trim();

export function buildGraphicDesignPrompt(request: GraphicDesignRequest, brand: BrandContext, size: CanvasSize): BuiltPrompt {
  const style = request.style ?? "MINIMAL";

  const system = [
    ...brandRules(brand),
    INTERPRETATION_RULES,
    `Visual style to design for: ${style} (BOLD = high contrast/large type, MINIMAL = clean/lots of space, PLAYFUL = friendly/approachable, CORPORATE = formal/structured).`,
    schemaInstruction(size),
  ].join("\n\n");

  const parts: string[] = [`Brief: ${request.brief}`];
  if (request.platform) parts.push(`Platform (${request.platform}): ${platformGuidance(request.platform)}`);
  if (request.feedback) parts.push(`Additional instruction from the admin: ${request.feedback}`);

  return { system, user: parts.join("\n\n") };
}

export const MAX_DESIGN_ELEMENTS = MAX_ELEMENTS;
