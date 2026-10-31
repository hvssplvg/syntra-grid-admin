// lib/ai/creativeDirection.ts
//
// Turns a Mode A image brief into 3 genuinely different, art-directed
// creative concepts BEFORE any paid image call — text-only (the
// existing text provider, same as videoConcepts.ts/graphicDesign.ts),
// so exploring directions costs nothing beyond one cheap text call.
// Each concept's own imagePrompt is a complete, ready-to-send prompt
// (brand + IMAGE_QUALITY_STANDARDS already folded in) — selecting one
// sends it to the image provider verbatim, no second prompt-build pass.

import { platformGuidance } from "./platforms";
import type { BrandContext } from "./brand";
import { IMAGE_QUALITY_STANDARDS } from "./imageQualityStandards";
import type { BuiltPrompt, GraphicCreativeDirectionRequest } from "./types";

function brandRules(brand: BrandContext): string[] {
  const lines = [
    `You are the senior art director for ${brand.company}'s advertising campaigns.`,
    `Positioning: ${brand.positioning}`,
  ];
  if (brand.industry) lines.push(`Industry: ${brand.industry}`);
  if (brand.targetAudience) lines.push(`Target audience: ${brand.targetAudience}`);
  if (brand.personality) lines.push(`Brand personality: ${brand.personality}`);
  if (brand.services.length > 0) lines.push(`Services/products: ${brand.services.join(", ")}.`);
  if (brand.primaryColors.length > 0 || brand.secondaryColors.length > 0) {
    lines.push(`Brand colours: ${[...brand.primaryColors, ...brand.secondaryColors].join(", ")}.`);
  }
  lines.push(`Write all copy in ${brand.preferredLanguage}.`);
  return lines;
}

const DIRECTION_RULES = `
Before proposing anything, work out:
- What is actually being promoted (the specific product/service/topic in the brief, not a generic version of the business).
- Who the target audience is and what they should understand immediately on seeing the image.
- Which concrete visual elements best communicate that (specific devices, environments, interface motifs, people, objects — not abstract placeholders).
- What composition type suits this topic (product showcase, lifestyle/cinematic scene, editorial campaign, etc. — choose freely, these are examples, not a fixed list).
- What level of realism is appropriate (fully photorealistic, stylised 3D, illustrated — pick what fits the topic, not a default).

Then propose EXACTLY 3 genuinely different compositions for the SAME topic — different environments, different visual approaches, different levels of realism where that makes sense — never 3 minor variations of the same idea. For EACH concept:
- "label": a short name for the direction (e.g. "Premium 3D Product Showcase", "Cinematic Lifestyle Advertisement", "Modern Editorial Technology Campaign" — illustrative only, invent your own names that fit the topic).
- "description": one sentence explaining the visual approach, for a human choosing between the 3.
- "imagePrompt": the COMPLETE prompt you would send to an image generator for this exact concept — specific, detailed, and self-contained (do not just repeat the label). It must already incorporate the quality standards and brand grounding above as part of its own text, describe the actual scene/subjects/environment/lighting/composition concretely, and end with an explicit instruction that any interface/dashboard/screen content shown is a stylised design motif, never a claimed-authentic screenshot, and that no real statistics or data should be invented. It must also instruct that little to no marketing copy/headline text be rendered IN the image itself (real headline/body/CTA are added afterwards as separate editable layers) — small incidental UI-mockup labels are fine, large headline text is not.
- "headline": a short, professional marketing headline for this concept (a handful of words, in the style of "Smarter Systems. Stronger Businesses." — never generic AI-marketing cliché).
- "supportingText": optional, one short supporting line, only if it genuinely adds something.
- "callToAction": optional, a short call to action, only if one makes sense.

${IMAGE_QUALITY_STANDARDS}

If a visual reference's analysis is given below, let it inform (not dictate) all 3 concepts' sense of composition/realism — still 3 different directions, not 3 copies of the reference.`.trim();

const JSON_SHAPE_INSTRUCTION = `
Return ONLY a single JSON object (no markdown fences, no preamble, no explanation) with this exact shape:
{
  "concepts": [
    { "label": string, "description": string, "imagePrompt": string, "headline": string, "supportingText": string?, "callToAction": string? }
  ]
}
Return EXACTLY 3 concepts.`.trim();

export function buildCreativeDirectionPrompt(request: GraphicCreativeDirectionRequest, brand: BrandContext): BuiltPrompt {
  const system = [...brandRules(brand), DIRECTION_RULES, JSON_SHAPE_INSTRUCTION].join("\n\n");

  const parts = [`Brief: ${request.brief}`];
  if (request.platform) parts.push(`Platform (${request.platform}): ${platformGuidance(request.platform)}`);
  if (request.style) parts.push(`Requested visual style: ${request.style}.`);
  if (request.referenceAnalysis) parts.push(`--- Visual reference (uploaded, analysed) ---\n${request.referenceAnalysis}`);

  return { system, user: parts.join("\n\n") };
}
