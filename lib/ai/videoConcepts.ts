// lib/ai/videoConcepts.ts
//
// Turns a Video Studio brief into 3 candidate short-video concepts —
// same brand-rules/JSON-shape idiom as graphicContent.ts (this file is
// modeled on it directly), reusing the exact same AiTextProvider
// interface. No trending-sound matching (no public API for it) and no
// image generation here — concepts are text/structure only, so
// generating 3 of them costs nothing beyond one cheap text call.

import { platformGuidance } from "./platforms";
import type { BrandContext } from "./brand";
import type { BuiltPrompt, VideoConceptRequest } from "./types";

function brandRules(brand: BrandContext): string[] {
  const lines = [
    `You are writing short-form vertical video concepts (TikTok/Reels/Shorts style) for ${brand.company}.`,
    `Positioning: ${brand.positioning}`,
    `Preferred writing style: ${brand.preferredStyle}`,
  ];
  if (brand.toneOfVoice) lines.push(`Brand tone of voice: ${brand.toneOfVoice}`);
  lines.push(`Avoid: ${brand.avoid.join("; ")}.`);
  if (brand.bannedPhrases.length > 0) {
    lines.push(`Never use these exact phrases or close paraphrases of them: ${brand.bannedPhrases.map((phrase) => `"${phrase}"`).join(", ")}.`);
  }
  if (brand.primaryColors.length > 0 || brand.secondaryColors.length > 0) {
    lines.push(`Brand colours — use these where appropriate: ${[...brand.primaryColors, ...brand.secondaryColors].join(", ")}.`);
  }
  lines.push(`Write all text in ${brand.preferredLanguage}.`);
  return lines;
}

const STRUCTURE_RULES = `
Each concept is a short sequence of scenes read aloud/on-screen in order — think of it as a storyboard, not a caption.
Rules:
- 3 to 6 scenes per concept. Each scene's "text" is the on-screen text for that scene only — short enough to read in the scene's duration (roughly 3 words per second, never a full paragraph).
- The first scene is the hook — it must earn attention in under 3 seconds; put it in "hook" as well as scene 1's text.
- durationSeconds per scene: 2 to 6. Total video length should land around 15-30 seconds.
- "backgroundStyle" is either "color" (a flat brand-colour background — free, instant) or "ai-image" (a generated photo/illustration background — costs money and takes longer). Use "ai-image" only where a real visual genuinely adds value; "color" is a perfectly good default for text-driven scenes.
- When backgroundStyle is "ai-image", "imagePrompt" must describe ONLY the background image itself (no on-screen text, no logos, no invented people/clients) — the scene's own on-screen text is added separately, never baked into the image prompt.
- Never invent a statistic, testimonial, client name, or performance claim that isn't in the brief.
- If the brief describes an existing trending video or post as inspiration, treat it strictly as inspiration for structure, pacing and tone only — invent entirely new on-screen text, scenes and visual descriptions. Never reproduce, quote, or closely describe the original's specific content, dialogue, or imagery.
- "caption" is the social caption that goes with the finished video when posted — short, platform-appropriate, written the same way the regular caption generator would write one.`.trim();

const JSON_SHAPE_INSTRUCTION = `
Return ONLY a single JSON object (no markdown fences, no preamble, no explanation) with this exact shape:
{
  "concepts": [
    {
      "hook": string,
      "caption": string,
      "scenes": [
        { "text": string, "durationSeconds": number, "backgroundStyle": "color" | "ai-image", "imagePrompt": string? }
      ]
    }
  ]
}
Return EXACTLY 3 concepts. At least one of the 3 concepts must use "backgroundStyle": "color" for every single one of its scenes (a genuinely free, text-only option) — not as a last resort, as a real, well-written alternative.`.trim();

export function buildVideoConceptPrompt(request: VideoConceptRequest, brand: BrandContext): BuiltPrompt {
  const system = [...brandRules(brand), STRUCTURE_RULES, JSON_SHAPE_INSTRUCTION].join("\n");

  const parts: string[] = [`Brief: ${request.brief}`];
  const platform = request.platform ?? "TIKTOK";
  parts.push(`Platform (${platform}): ${platformGuidance(platform)}`);
  if (request.feedback) parts.push(`Additional instruction from the admin: ${request.feedback}`);

  return { system, user: parts.join("\n\n") };
}
