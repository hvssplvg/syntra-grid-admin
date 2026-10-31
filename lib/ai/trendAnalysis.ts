// lib/ai/trendAnalysis.ts
//
// Prompt builder for Trend Intelligence's "Analyze trend" step. Same
// brand-rules/JSON-shape idiom as videoConcepts.ts (modeled on it
// directly). Takes an already-verified Trend row — title/platform/
// description/etc. are real data captured before this ever runs (see
// the Trend Intelligence plan) — and asks the AI only to REASON about
// it: why it works, how to adapt it without copying, and how relevant
// it is to this specific business. Never asked to invent the trend
// itself, and explicitly never allowed to present relevance as a
// guaranteed outcome.

import type { BrandContext } from "./brand";
import type { BuiltPrompt } from "./types";

export type TrendForAnalysis = {
  title: string;
  platform: string; // TrendPlatform enum member, as a string
  type: string; // TrendType enum member
  category: string | null;
  description: string;
  sourceUrl: string | null;
  hashtags: string[];
  audioInfo: unknown;
  licensingStatus: string;
};

function brandRules(brand: BrandContext): string[] {
  const lines = [
    `You are a social media strategist analysing a trend on behalf of ${brand.company}.`,
    `Positioning: ${brand.positioning}`,
  ];
  if (brand.industry) {
    lines.push(`Industry: ${brand.industry}`);
  } else {
    lines.push(`Industry: not specified by the admin — infer a reasonable one from these services: ${brand.services.join(", ")}.`);
  }
  if (brand.targetAudience) lines.push(`Target audience: ${brand.targetAudience}`);
  if (brand.toneOfVoice) lines.push(`Brand tone of voice: ${brand.toneOfVoice}`);
  lines.push(`Avoid: ${brand.avoid.join("; ")}.`);
  if (brand.bannedPhrases.length > 0) {
    lines.push(`Never use these exact phrases or close paraphrases of them: ${brand.bannedPhrases.map((phrase) => `"${phrase}"`).join(", ")}.`);
  }
  lines.push(`Write all text in ${brand.preferredLanguage}.`);
  return lines;
}

const ANALYSIS_RULES = `
You are analysing a trend that has ALREADY been verified/discovered — never question whether it exists or invent additional facts about it; reason about the data given.
Your job:
- Explain why this trend is interesting/working (the underlying mechanic, not just "it's popular").
- Assess what makes its hook effective in the first few seconds.
- Describe its storytelling structure (setup/twist/payoff, list format, before/after, etc. — whichever applies).
- Describe its humour or emotional appeal, if any.
- Suggest which industries and audiences could use a version of it, grounded in the brand context above — not a generic list.
- Suggest which social platforms suit an adaptation of it.
- Propose ONE concrete way THIS business could adapt the trend's mechanic/format WITHOUT copying the original creator's content, footage, audio, or specific wording — describe the adaptation in terms of this brand's own services/positioning.
- Give a relevance score from 0-100 for how well this trend fits this business, with a short, honest explanation. The score is an estimate of fit, NEVER a prediction or guarantee of views, engagement, or any other real-world outcome — phrase the explanation as fit ("fits because..."), never as a forecast ("will get...").
- Suggest 2-4 ready-to-use captions and a short list of relevant hashtags for the adapted version.
- Suggest 1-3 recommended content formats (e.g. "15s talking-head video", "carousel", "meme-style static image").
Never invent a statistic, testimonial, client name, or performance claim that isn't in the trend data or the brand context.`.trim();

const JSON_SHAPE_INSTRUCTION = `
Return ONLY a single JSON object (no markdown fences, no preamble, no explanation) with this exact shape:
{
  "whyInteresting": string,
  "hookEffectiveness": string,
  "storytellingStructure": string,
  "emotionalAppeal": string,
  "adaptationIdea": string,
  "suitableIndustries": string[],
  "suitableAudiences": string[],
  "suitablePlatforms": string[],
  "recommendedFormats": string[],
  "suggestedCaptions": string[],
  "hashtags": string[],
  "relevanceScore": number,
  "relevanceExplanation": string
}`.trim();

export function buildTrendAnalysisPrompt(trend: TrendForAnalysis, brand: BrandContext): BuiltPrompt {
  const system = [...brandRules(brand), ANALYSIS_RULES, JSON_SHAPE_INSTRUCTION].join("\n");

  const needsOriginalAdaptationNote = trend.licensingStatus === "REQUIRES_LICENSE" || trend.licensingStatus === "RESTRICTED";

  const parts = [
    `Trend title: ${trend.title}`,
    `Platform discovered on: ${trend.platform}`,
    `Trend type: ${trend.type}`,
    trend.category ? `Category: ${trend.category}` : undefined,
    `Description: ${trend.description}`,
    trend.hashtags.length > 0 ? `Hashtags already observed: ${trend.hashtags.join(", ")}` : undefined,
    trend.audioInfo ? `Audio info: ${JSON.stringify(trend.audioInfo)}` : undefined,
    `Licensing status: ${trend.licensingStatus}${needsOriginalAdaptationNote ? " — do not suggest reusing the original audio or footage; suggest a fully original adaptation instead." : ""}`,
  ].filter((part): part is string => Boolean(part));

  return { system, user: parts.join("\n\n") };
}
