// lib/ai/graphicContent.ts
//
// Turns a Graphic Studio brief into structured graphic copy — the
// interpretation step that was missing (Content Studio manual-test
// Part 2). Reuses the exact same brand rules already enforced for
// caption writing (see promptBuilder.ts's brandSystemPrompt) and the
// exact same AiTextProvider.generate(prompt): Promise<string>
// interface — no new provider type, no second AI integration.

import { platformGuidance } from "./platforms";
import type { BrandContext } from "./brand";
import type { BuiltPrompt, GraphicContentRequest } from "./types";

function brandRules(brand: BrandContext): string[] {
  const lines = [
    `You are writing graphic/poster copy for ${brand.company}.`,
    `Positioning: ${brand.positioning}`,
    `Preferred writing style: ${brand.preferredStyle}`,
  ];
  if (brand.toneOfVoice) lines.push(`Brand tone of voice: ${brand.toneOfVoice}`);
  lines.push(`Avoid: ${brand.avoid.join("; ")}.`);
  if (brand.bannedPhrases.length > 0) {
    lines.push(`Never use these exact phrases or close paraphrases of them: ${brand.bannedPhrases.map((phrase) => `"${phrase}"`).join(", ")}.`);
  }
  lines.push(`Write all text in ${brand.preferredLanguage}.`);
  return lines;
}

const JSON_SHAPE_INSTRUCTION = `
Return ONLY a single JSON object (no markdown fences, no preamble, no explanation) with this shape:
{
  "headline": string,          // required — the main large text on the graphic
  "subheadline": string?,       // optional — a short supporting line
  "description": string?,       // optional — one short sentence, only if genuinely useful
  "features": string[]?,        // optional — up to 4 short feature/benefit lines, only if the brief actually lists features
  "callToAction": string?,      // optional — a short call to action, only if one makes sense
  "brandName": string?          // optional — only if the brief explicitly names a brand/project to display
}
Omit any field you have nothing truthful and specific to put there — an omitted field is correct, a fabricated one is not.`.trim();

const INTERPRETATION_RULES = `
This is a CREATIVE BRIEF, not display text — interpret it, don't copy it verbatim into a field.
Rules:
- Follow explicit headline/wording instructions in the brief exactly if the admin gave one.
- Preserve every specific fact, name, feature, or number the admin actually wrote — never drop or alter them.
- Respect any features/bullet points the brief lists — put them in "features", each short enough to read as graphic text (not a sentence).
- Never invent a statistic, testimonial, client name, or performance claim that isn't in the brief.
- Keep every field short: headline under ~8 words, subheadline/description under ~16 words, each feature under ~6 words.
- Avoid generic marketing clichés — write something specific to what the brief actually says.`.trim();

export function buildGraphicContentPrompt(request: GraphicContentRequest, brand: BrandContext): BuiltPrompt {
  const system = [...brandRules(brand), INTERPRETATION_RULES, JSON_SHAPE_INSTRUCTION].join("\n");

  const parts: string[] = [`Brief: ${request.brief}`];
  if (request.platform) parts.push(`Platform (${request.platform}): ${platformGuidance(request.platform)}`);
  if (request.style) parts.push(`Visual style: ${request.style}`);
  if (request.feedback) parts.push(`Additional instruction from the admin: ${request.feedback}`);

  return { system, user: parts.join("\n\n") };
}
