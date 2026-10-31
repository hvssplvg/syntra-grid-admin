// lib/ai/trendAdaptation.ts
//
// The Trend Adaptation Engine's prompt builder. Reuses a trend's
// EXISTING TrendAnalysisResult (lib/ai/trendAnalysis.ts's output,
// already stored on Trend.aiAnalysis) as its primary input rather than
// re-deriving "why does this work" from scratch — this module's own
// job is strictly the layer analysis doesn't do: turning that
// understanding into a business-specific, platform-aware, ready-to-
// generate creative brief, with an honest judgment of whether the
// trend even suits this business.
//
// Same brandRules/JSON-shape idiom as every other prompt builder in
// this app. Never asks the model to claim it watched the source video
// — metadata + prior analysis + any admin-typed context is the honest
// ceiling (YouTube's caption/transcript access is gated to the video
// owner's authorization, confirmed before building this).

import type { BrandContext } from "./brand";
import type { BuiltPrompt, TrendAnalysisResult } from "./types";

export type TrendForAdaptation = {
  title: string;
  platform: string;
  type: string;
  category: string | null;
  description: string;
  channelTitle: string | null;
  views: number | null;
  publishedAt: string | null;
  licensingStatus: string;
  analysis: TrendAnalysisResult;
  additionalContext?: string;
  /** An admin-uploaded, authorised reference image's vision-provider
   *  description (see analyzeReferenceImageApi) — when present, the
   *  visual-format fields below should be grounded in THIS, not
   *  inferred from title/description alone. */
  referenceImageAnalysis?: string;
};

function brandRules(brand: BrandContext): string[] {
  const lines = [
    `You are a senior creative strategist adapting a trend into an original piece of content for ${brand.company}.`,
    `Positioning: ${brand.positioning}`,
    `Services: ${brand.services.join(", ")}.`,
  ];
  if (brand.industry) lines.push(`Industry: ${brand.industry}`);
  if (brand.targetAudience) lines.push(`Target audience: ${brand.targetAudience}`);
  if (brand.toneOfVoice) lines.push(`Brand tone of voice: ${brand.toneOfVoice}`);
  lines.push(`Avoid: ${brand.avoid.join("; ")}.`);
  if (brand.bannedPhrases.length > 0) {
    lines.push(`Never use these exact phrases or close paraphrases of them: ${brand.bannedPhrases.map((phrase) => `"${phrase}"`).join(", ")}.`);
  }
  if (brand.primaryColors.length > 0 || brand.secondaryColors.length > 0) {
    lines.push(`Brand colours: ${[...brand.primaryColors, ...brand.secondaryColors].join(", ")}.`);
  }
  lines.push(`Write all text in ${brand.preferredLanguage}.`);
  return lines;
}

const ADAPTATION_RULES = `
You have NOT watched the source video — you only have its metadata (title, description, category, channel, view count, publish date) and a prior AI analysis of why it works. Never write as though you observed footage, audio, or visuals directly; reason only from what's given, and if the admin supplied additional context, you may treat that as a real (though still not "watched") observation. If a visual reference image analysis is given below, that IS a real, examined image — ground your visual-format description in it.

Your job:
1. Identify the trend's core creative concept, hook, humour/emotional appeal, storytelling structure, visual format, pacing, and intended audience — mostly carried over from the prior analysis given below, refined only where the brief/context adds something.
2. Classify "adaptationMode" as whichever ONE of these best matches this trend's actual nature: "meme" (a reaction/joke format), "before_after" (a transformation/comparison), "storytelling" (a narrative arc), "educational" (an explainer), "transition" (a visual-transition-driven format), "professional" (a polished, business-toned format), or "other". Let this classification genuinely drive your adaptation below — do not force every trend into the same generic advertisement shape.
3. Judge whether this trend's format genuinely suits this specific business. Set "suitable" accordingly. If not, explain why in "suitabilityReason" and propose a better-fitting alternative angle in "alternativeSuggestion" — but still fill out the rest of the brief as best as reasonably possible (the admin decides whether to proceed).
4. List concrete "businessAdaptationOpportunities" — specific ways this business's real services could stand in for the trend's original subject.
5. Write "adaptedBrief" — ONE paragraph, ready to hand directly to a video/graphic generator as its creative brief. It must describe an ORIGINAL piece inspired only by the trend's hook/pacing/structure/format — never reusing, quoting, or closely describing the source's specific content, dialogue, or imagery. Ground it in this business's real services; never invent a statistic, testimonial, client name, or product claim that isn't already known. If a real analysed visual reference is given below, base "visualFormat" and the visual description inside "adaptedBrief" on THAT, not on guesswork from the title alone.
6. The "basis" value will be set by the server, not you — you may still fill the field in, it will be overridden.`.trim();

const JSON_SHAPE_INSTRUCTION = `
Return ONLY a single JSON object (no markdown fences, no preamble, no explanation) with this exact shape:
{
  "adaptationMode": "meme" | "before_after" | "storytelling" | "educational" | "transition" | "professional" | "other",
  "coreCreativeConcept": string,
  "hook": string,
  "humorOrEmotionalAppeal": string,
  "storytellingStructure": string,
  "visualFormat": string,
  "pacing": string,
  "intendedAudience": string,
  "suitablePlatforms": string[],
  "businessAdaptationOpportunities": string[],
  "suitable": boolean,
  "suitabilityReason": string,
  "alternativeSuggestion": string?,
  "adaptedBrief": string,
  "basis": "metadata_and_analysis" | "metadata_analysis_and_admin_context" | "metadata_analysis_and_visual_reference"
}`.trim();

export function buildTrendAdaptationPrompt(trend: TrendForAdaptation, brand: BrandContext): BuiltPrompt {
  const system = [...brandRules(brand), ADAPTATION_RULES, JSON_SHAPE_INSTRUCTION].join("\n");

  const parts = [
    `Trend title: ${trend.title}`,
    `Platform: ${trend.platform}`,
    `Trend type: ${trend.type}`,
    trend.category ? `Category: ${trend.category}` : undefined,
    `Description: ${trend.description}`,
    trend.channelTitle ? `Channel: ${trend.channelTitle}` : undefined,
    trend.views !== null ? `Views: ${trend.views}` : undefined,
    trend.publishedAt ? `Published: ${trend.publishedAt}` : undefined,
    `Licensing status: ${trend.licensingStatus}`,
    `--- Prior AI analysis of why this trend works ---`,
    `Why it's interesting: ${trend.analysis.whyInteresting}`,
    `Hook effectiveness: ${trend.analysis.hookEffectiveness}`,
    `Storytelling structure: ${trend.analysis.storytellingStructure}`,
    `Emotional appeal: ${trend.analysis.emotionalAppeal}`,
    `Previously suggested adaptation idea: ${trend.analysis.adaptationIdea}`,
    trend.additionalContext ? `--- Additional context the admin provided ---\n${trend.additionalContext}` : undefined,
    trend.referenceImageAnalysis ? `--- Visual reference image (uploaded by the admin, analysed) ---\n${trend.referenceImageAnalysis}` : undefined,
  ].filter((part): part is string => Boolean(part));

  return { system, user: parts.join("\n\n") };
}
