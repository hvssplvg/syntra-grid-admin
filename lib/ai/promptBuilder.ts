// lib/ai/promptBuilder.ts
//
// Single place that turns (brand context + platform guidance + action +
// user input) into the system/user prompt pair sent to the provider.
// Both entry points (Content Home's Generate and the in-composer
// writing assistant) call this exact function — never two copies of
// the same prompt logic.

import { platformGuidance } from "./platforms";
import type { AiTextRequest, BuiltPrompt } from "./types";
import type { BrandContext } from "./brand";

const ACTION_INSTRUCTION: Record<AiTextRequest["action"], string> = {
  GENERATE: "Write a brand-new social media post caption from the brief below.",
  REGENERATE: "Write a fresh alternative take on the following caption — a different angle or opening line than before, keeping the same core message.",
  IMPROVE: "Improve the clarity, flow and impact of the following caption without changing its core message.",
  SHORTEN: "Make the following caption noticeably shorter while keeping its core message.",
  LENGTHEN: "Expand the following caption with more useful detail while keeping it tight and on-topic.",
  MORE_PROFESSIONAL: "Rewrite the following caption in a more professional, polished register.",
  MORE_ENGAGING: "Rewrite the following caption to be more engaging and attention-grabbing, without exaggerating.",
  CHANGE_TONE: "Rewrite the following caption in the requested tone.",
  GENERATE_HASHTAGS: "Suggest a short set of relevant, non-repetitive hashtags for the following caption. Return only the hashtags, space-separated.",
  ADAPT_PLATFORM: "Rewrite the following caption so it fits the requested target platform's conventions and constraints.",
};

const TONE_INSTRUCTION: Record<NonNullable<AiTextRequest["tone"]>, string> = {
  PROFESSIONAL: "professional and polished",
  FRIENDLY: "warm and friendly",
  CONFIDENT: "confident and assertive",
  EDUCATIONAL: "educational and explanatory",
  CONVERSATIONAL: "conversational and relaxed",
  PROMOTIONAL: "promotional, while staying credible and not exaggerated",
};

function brandSystemPrompt(brand: BrandContext): string {
  const lines = [
    `You are a social media copywriter for ${brand.company}.`,
    `Positioning: ${brand.positioning}`,
    `Core value: ${brand.coreValue}`,
    `Services: ${brand.services.join(", ")}.`,
    `Preferred writing style: ${brand.preferredStyle}`,
  ];
  if (brand.toneOfVoice) lines.push(`Brand tone of voice: ${brand.toneOfVoice}`);
  if (brand.personality) lines.push(`Brand personality: ${brand.personality}`);
  if (brand.socialMediaGuidelines) lines.push(`Social media guidelines: ${brand.socialMediaGuidelines}`);
  lines.push(`Avoid: ${brand.avoid.join("; ")}.`);
  if (brand.bannedPhrases.length > 0) {
    lines.push(`Never use these exact phrases or close paraphrases of them: ${brand.bannedPhrases.map((phrase) => `"${phrase}"`).join(", ")}.`);
  }
  lines.push(
    "Never invent or imply a specific client, testimonial, project outcome, statistic, or achievement that wasn't given to you — write generally and credibly about capability instead of fabricating proof.",
  );
  lines.push("This is marketing copy for an internal team to review and publish manually — never claim it has already been published or that you performed an action.");
  lines.push("Output only the caption text itself — no preamble, no explanation, no surrounding quotation marks.");
  return lines.join("\n");
}

export function buildPrompt(request: AiTextRequest, brand: BrandContext): BuiltPrompt {
  const system = brandSystemPrompt(brand);

  const parts: string[] = [ACTION_INSTRUCTION[request.action]];

  const platform = request.action === "ADAPT_PLATFORM" ? request.targetPlatform : request.platform;
  if (platform) parts.push(`Target platform (${platform}): ${platformGuidance(platform)}`);

  if (request.action === "CHANGE_TONE" && request.tone) {
    parts.push(`Tone: ${TONE_INSTRUCTION[request.tone]}.`);
  }

  if (request.brief) parts.push(`Brief: ${request.brief}`);
  if (request.currentText) parts.push(`Current caption:\n${request.currentText}`);
  if (request.feedback) parts.push(`Additional instruction from the admin: ${request.feedback}`);

  return { system, user: parts.join("\n\n") };
}
