// lib/ai/aiVideoConcepts.ts
//
// Prompt builder for the AI Video concept/storyboard step — same
// brand-rules/JSON-shape idiom as videoConcepts.ts (Standard Video) and
// creativeDirection.ts (Graphic Studio's 3-concepts step), reusing the
// exact same AiTextProvider interface. Text-only: generating 3 concepts
// costs nothing beyond one cheap text call, regardless of how many real
// paid Luma generations the admin eventually confirms from the result.

import { platformGuidance } from "./platforms";
import { IMAGE_QUALITY_STANDARDS } from "./imageQualityStandards";
import type { BrandContext } from "./brand";
import type { AiVideoConceptRequest } from "./aiVideoTypes";
import type { BuiltPrompt } from "./types";

function brandRules(brand: BrandContext): string[] {
  const lines = [
    `You are writing real AI-generated video concepts (original moving footage, not animated text/motion-graphics) for ${brand.company}.`,
    `Positioning: ${brand.positioning}`,
    `Services: ${brand.services.join(", ")}`,
  ];
  if (brand.industry) lines.push(`Industry: ${brand.industry}`);
  if (brand.targetAudience) lines.push(`Target audience: ${brand.targetAudience}`);
  if (brand.personality) lines.push(`Brand personality: ${brand.personality}`);
  lines.push(`Avoid: ${brand.avoid.join("; ")}.`);
  if (brand.bannedPhrases.length > 0) {
    lines.push(`Never use these exact phrases or close paraphrases of them: ${brand.bannedPhrases.map((phrase) => `"${phrase}"`).join(", ")}.`);
  }
  if (brand.primaryColors.length > 0 || brand.secondaryColors.length > 0) {
    lines.push(`Brand colours (applied afterwards as editable overlays, not rendered into the footage itself): ${[...brand.primaryColors, ...brand.secondaryColors].join(", ")}.`);
  }
  lines.push(`Write all text in ${brand.preferredLanguage}.`);
  return lines;
}

const DIRECTION_RULES = `
Each concept is a genuinely different storytelling approach to the same brief — not a reskin of the same idea with different words. Think cinematic business transformation vs. a humorous problem/solution vs. a premium product showcase as illustrative examples of how different 3 concepts should feel — do NOT literally reuse these 3 categories for every brief; invent whichever 3 approaches actually fit THIS brief and business best.

Each concept breaks down into 1-3 scenes. Each scene becomes exactly one real AI video-generation call (Luma Ray3.2), so:
- "durationSeconds" must be exactly 5 or 10 (Luma's only supported values) — never anything else.
- "suggestedVisual" must describe ONLY the actual visual content of that scene — real environments, realistic human movement, camera framing, lighting, mood. Describe it as a director would brief a cinematographer, not as marketing copy.
- Any screen/device/interface visible in a shot must be described as a stylised, abstract UI (icons, generic charts, soft colour blocks) — never as an authentic, readable product screenshot, and never with invented real data, numbers, or client names.
- Do NOT ask for on-screen text, captions, logos, or marketing copy to be rendered INTO the footage itself — "voiceoverText" captures spoken narration only; any headline/CTA/logo is added afterwards as a separate, editable overlay, never baked into generated pixels.
- "cameraMovement" is a short, concrete direction (e.g. "slow push-in", "handheld tracking shot", "static wide shot") — never vague ("dynamic camera").
${IMAGE_QUALITY_STANDARDS}

If a visual reference's analysis is given below, let it inform (not dictate) all 3 concepts' sense of environment/composition/mood — still 3 different storytelling approaches, not 3 copies of the reference. That analysis describes a single still image, never the motion, camera work, or editing of a video — do not imply any of this concept's camera/motion direction was derived from watching footage unless the brief explicitly says so.`.trim();

const JSON_SHAPE_INSTRUCTION = `
Return ONLY a single JSON object (no markdown fences, no preamble, no explanation) with this exact shape:
{
  "concepts": [
    {
      "title": string,
      "creativeDirection": string,
      "hook": string,
      "storyline": string,
      "scenes": [
        { "sceneNumber": number, "description": string, "suggestedVisual": string, "durationSeconds": 5 | 10, "cameraMovement": string, "voiceoverText": string?, "brandElements": string? }
      ],
      "suggestedVoiceover": string,
      "suggestedCaption": string,
      "callToAction": string
    }
  ]
}
Return EXACTLY 3 concepts.`.trim();

export function buildAiVideoConceptPrompt(request: AiVideoConceptRequest, brand: BrandContext): BuiltPrompt {
  const system = [...brandRules(brand), DIRECTION_RULES, JSON_SHAPE_INSTRUCTION].join("\n");

  const parts: string[] = [`Brief: ${request.brief}`];
  const platform = request.platform ?? "TIKTOK";
  parts.push(`Platform (${platform}): ${platformGuidance(platform)}`);
  if (request.aspectRatio) parts.push(`Target aspect ratio: ${request.aspectRatio}`);
  if (request.referenceAnalysis) parts.push(`--- Visual reference (uploaded, analysed still image) ---\n${request.referenceAnalysis}`);

  return { system, user: parts.join("\n\n") };
}
