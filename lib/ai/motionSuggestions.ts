// lib/ai/motionSuggestions.ts
//
// Prompt builder for "Suggest Motion" (image-to-video's optional
// creative-direction step) — same brand-rules/JSON-shape idiom as
// aiVideoConcepts.ts/creativeDirection.ts. Text-only: the vision
// analysis of the attached image is already done by the time this
// prompt is built (see generateMotionSuggestions.ts, which reuses the
// existing analyzeReferenceImage orchestrator) — this file only turns
// that description into 3 genuinely different motion directions.

import type { BrandContext } from "./brand";
import { IMAGE_QUALITY_STANDARDS } from "./imageQualityStandards";
import type { BuiltPrompt } from "./types";

export type MotionSuggestionsRequest = {
  imageAnalysis: string;
  userContext?: string;
};

function brandRules(brand: BrandContext): string[] {
  const lines = [`You are a cinematographer proposing camera/motion direction for ${brand.company}'s premium advertising video.`];
  if (brand.industry) lines.push(`Industry: ${brand.industry}`);
  if (brand.personality) lines.push(`Brand personality: ${brand.personality}`);
  return lines;
}

const DIRECTION_RULES = `
You will be given a description of a single still image (already analysed by a vision model — you have NOT seen the image yourself, only this description). Propose EXACTLY 3 genuinely different ways to animate it into a short video, each a real director's motion brief — not 3 reskins of the same idea.

The 3 suggestions MUST adapt to what the image actually shows. A photo of food and a screenshot of a software dashboard should never receive similar-sounding suggestions — ground every suggestion in the SPECIFIC subject, environment, and composition described, not a generic template.

For EACH suggestion:
- "label": a short name for the direction (2-4 words, e.g. "Cinematic Reveal", "Dynamic Showcase" — illustrative only, invent names that fit THIS image).
- "description": one sentence explaining the approach, for a human choosing between the 3.
- "motionPrompt": the complete, ready-to-send motion description — describes ONLY how the camera and scene should move (push-in, orbit, parallax, drift, subtle environmental motion, lighting shifts), never a re-description of the whole image's content (the image itself is already the starting frame; re-describing it risks the video model trying to redraw it instead of animate it).

Prioritise restrained, purposeful, professional camera movement — slow push-ins, gentle parallax, subtle drift, natural lighting shifts, realistic reflections — over dramatic or chaotic motion, unless the image itself clearly calls for something more dynamic (e.g. an action/sports photo). Never suggest motion that would distort any readable text, logos, or interface elements visible in the image; if the description mentions such elements, explicitly instruct the camera to move in a way that keeps them legible and undistorted (e.g. "keep the screen content stable and in frame" rather than suggesting it rotate or warp).
${IMAGE_QUALITY_STANDARDS}`.trim();

const JSON_SHAPE_INSTRUCTION = `
Return ONLY a single JSON object (no markdown fences, no preamble, no explanation) with this exact shape:
{
  "suggestions": [
    { "label": string, "description": string, "motionPrompt": string }
  ]
}
Return EXACTLY 3 suggestions.`.trim();

export function buildMotionSuggestionsPrompt(request: MotionSuggestionsRequest, brand: BrandContext): BuiltPrompt {
  const system = [...brandRules(brand), DIRECTION_RULES, JSON_SHAPE_INSTRUCTION].join("\n\n");

  const parts = [`Image description (from vision analysis): ${request.imageAnalysis}`];
  if (request.userContext) parts.push(`Additional context from the admin: ${request.userContext}`);

  return { system, user: parts.join("\n\n") };
}
