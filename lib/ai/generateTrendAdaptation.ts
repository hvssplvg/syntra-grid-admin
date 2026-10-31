// lib/ai/generateTrendAdaptation.ts
//
// Orchestration for the Trend Adaptation Engine — same shape as every
// other AI feature in this app (validate → load trend → configured
// check → rate-limit → brand-aware prompt → provider call →
// parse+clamp → return). Requires the trend to already have an
// AI analysis (Trend.aiAnalysis/relevanceScore) — this module reuses
// that understanding rather than re-deriving it, so there is only one
// "understand the trend" code path, not two. The caller (the trend
// intelligence UI) runs analyzeTrend first if it's missing.
//
// Not cached and not persisted onto the Trend row — unlike analysis,
// an adaptation is business-specific and already cheap (one more
// text-only call), so it's fine to regenerate per click.

import { PLATFORMS } from "@/app/components/admin/tabs/social-media/shared/constants";
import { prisma } from "@/lib/prisma";
import { buildTrendAdaptationPrompt, type TrendForAdaptation } from "./trendAdaptation";
import { getBrandContext } from "./brand";
import "./providers/openai"; // registers the provider as a side effect — see registry.ts
import { checkRateLimit } from "./rateLimit";
import { getAiTextProvider, isAiTextConfigured, requiredAiTextEnvVars } from "./registry";
import { AiProviderError, type TrendAdaptationBrief, type TrendAdaptationMode, type TrendAdaptationRequest, type TrendAnalysisResult } from "./types";

const MAX_CONTEXT_LENGTH = 1000;
const MAX_TEXT_LENGTH = 800;
const MAX_LIST_ITEMS = 8;
const MAX_LIST_ITEM_LENGTH = 200;
const MAX_BRIEF_LENGTH = 3000;

const PLATFORM_IDS = new Set(PLATFORMS.map((platform) => platform.id));
const ADAPTATION_MODES: TrendAdaptationMode[] = ["meme", "before_after", "storytelling", "educational", "transition", "professional", "other"];

export type GenerateTrendAdaptationResult =
  | { ok: true; adaptation: TrendAdaptationBrief }
  | { ok: false; status: 400 | 404 | 409 | 429 | 502 | 503; error: string; missingEnvVars?: string[] };

function validate(body: unknown): { request: TrendAdaptationRequest } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const input = body as Record<string, unknown>;
  if (typeof input.trendId !== "string" || !input.trendId.trim()) return { error: "trendId is required." };
  if (input.additionalContext !== undefined && typeof input.additionalContext !== "string") return { error: "additionalContext must be text." };
  if (typeof input.additionalContext === "string" && input.additionalContext.length > MAX_CONTEXT_LENGTH) {
    return { error: `Keep the additional context under ${MAX_CONTEXT_LENGTH} characters.` };
  }

  let referenceImage: TrendAdaptationRequest["referenceImage"];
  if (input.referenceImage !== undefined) {
    const ref = input.referenceImage as Record<string, unknown>;
    if (!ref || typeof ref !== "object" || typeof ref.url !== "string" || typeof ref.analysis !== "string" || !ref.url.trim() || !ref.analysis.trim()) {
      return { error: "referenceImage must include a url and an analysis." };
    }
    try {
      if (new URL(ref.url).protocol !== "https:") return { error: "referenceImage.url must be an https URL." };
    } catch {
      return { error: "referenceImage.url must be a valid URL." };
    }
    referenceImage = { url: ref.url.trim(), analysis: ref.analysis.trim().slice(0, 1500) };
  }

  return {
    request: {
      trendId: input.trendId.trim(),
      additionalContext: typeof input.additionalContext === "string" ? input.additionalContext.trim() || undefined : undefined,
      referenceImage,
    },
  };
}

function clampText(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

function clampList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, MAX_LIST_ITEM_LENGTH))
    .slice(0, MAX_LIST_ITEMS);
}

/** Reconstructs a TrendAnalysisResult from a Trend row — the JSON blob
 *  (Trend.aiAnalysis) and the top-level columns together hold the full
 *  shape (see generateTrendAnalysis.ts's own persistence split). */
function analysisFromTrend(trend: {
  aiAnalysis: unknown;
  relevanceScore: number | null;
  suitableIndustries: string[];
  suitableAudiences: string[];
  recommendedFormats: string[];
  suggestedCaptions: string[];
  hashtags: string[];
}): TrendAnalysisResult | null {
  const blob = trend.aiAnalysis as Record<string, unknown> | null;
  if (!blob || trend.relevanceScore === null) return null;
  const whyInteresting = clampText(blob.whyInteresting);
  const hookEffectiveness = clampText(blob.hookEffectiveness);
  const storytellingStructure = clampText(blob.storytellingStructure);
  const emotionalAppeal = clampText(blob.emotionalAppeal);
  const adaptationIdea = clampText(blob.adaptationIdea);
  const relevanceExplanation = clampText(blob.relevanceExplanation);
  if (!whyInteresting || !hookEffectiveness || !storytellingStructure || !emotionalAppeal || !adaptationIdea || !relevanceExplanation) return null;

  return {
    whyInteresting,
    hookEffectiveness,
    storytellingStructure,
    emotionalAppeal,
    adaptationIdea,
    relevanceExplanation,
    relevanceScore: trend.relevanceScore,
    suitableIndustries: trend.suitableIndustries,
    suitableAudiences: trend.suitableAudiences,
    suitablePlatforms: clampList(blob.suitablePlatforms).filter((platform) => PLATFORM_IDS.has(platform as never)) as TrendAnalysisResult["suitablePlatforms"],
    recommendedFormats: trend.recommendedFormats,
    suggestedCaptions: trend.suggestedCaptions,
    hashtags: trend.hashtags,
  };
}

/** Parses the provider's response. "basis" is never trusted from the
 *  model — it's computed server-side from what was actually supplied
 *  (a real reference image outranks admin-typed context, which
 *  outranks plain metadata), the same "parser is the real safety
 *  boundary" posture used by every other AI feature here. */
export function parseTrendAdaptation(raw: string, basis: TrendAdaptationBrief["basis"]): TrendAdaptationBrief | null {
  let parsed: unknown;
  try {
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const data = parsed as Record<string, unknown>;

  const coreCreativeConcept = clampText(data.coreCreativeConcept);
  const hook = clampText(data.hook);
  const humorOrEmotionalAppeal = clampText(data.humorOrEmotionalAppeal);
  const storytellingStructure = clampText(data.storytellingStructure);
  const visualFormat = clampText(data.visualFormat);
  const pacing = clampText(data.pacing);
  const intendedAudience = clampText(data.intendedAudience);
  const suitabilityReason = clampText(data.suitabilityReason);
  const adaptedBrief = typeof data.adaptedBrief === "string" && data.adaptedBrief.trim() ? data.adaptedBrief.trim().slice(0, MAX_BRIEF_LENGTH) : null;

  if (!coreCreativeConcept || !hook || !humorOrEmotionalAppeal || !storytellingStructure || !visualFormat || !pacing || !intendedAudience || !suitabilityReason || !adaptedBrief) {
    return null;
  }

  const adaptationMode = ADAPTATION_MODES.includes(data.adaptationMode as TrendAdaptationMode) ? (data.adaptationMode as TrendAdaptationMode) : "other";
  const suitablePlatforms = clampList(data.suitablePlatforms).filter((platform) => PLATFORM_IDS.has(platform as never)) as TrendAdaptationBrief["suitablePlatforms"];
  const alternativeSuggestion = clampText(data.alternativeSuggestion) ?? undefined;

  return {
    adaptationMode,
    coreCreativeConcept,
    hook,
    humorOrEmotionalAppeal,
    storytellingStructure,
    visualFormat,
    pacing,
    intendedAudience,
    suitablePlatforms,
    businessAdaptationOpportunities: clampList(data.businessAdaptationOpportunities),
    suitable: Boolean(data.suitable),
    suitabilityReason,
    alternativeSuggestion,
    adaptedBrief,
    basis,
  };
}

export async function generateTrendAdaptation(adminUserId: string, body: unknown): Promise<GenerateTrendAdaptationResult> {
  const validated = validate(body);
  if ("error" in validated) return { ok: false, status: 400, error: validated.error };

  const trend = await prisma.trend.findUnique({ where: { id: validated.request.trendId } });
  if (!trend) return { ok: false, status: 404, error: "Trend not found." };

  const analysis = analysisFromTrend(trend);
  if (!analysis) {
    return { ok: false, status: 409, error: "Analyse this trend before adapting it." };
  }

  if (!isAiTextConfigured()) {
    return { ok: false, status: 503, error: "AI generation isn't configured yet.", missingEnvVars: requiredAiTextEnvVars() };
  }

  const rateLimit = checkRateLimit(adminUserId);
  if (!rateLimit.allowed) {
    return { ok: false, status: 429, error: "Too many AI requests — wait a few minutes and try again." };
  }

  const provider = getAiTextProvider();
  if (!provider) {
    return { ok: false, status: 503, error: "No AI provider is registered.", missingEnvVars: requiredAiTextEnvVars() };
  }

  const started = Date.now();
  try {
    const brand = await getBrandContext();
    const trendForAdaptation: TrendForAdaptation = {
      title: trend.title,
      platform: trend.platform,
      type: trend.type,
      category: trend.category,
      description: trend.description,
      channelTitle: typeof (trend.popularityIndicators as Record<string, unknown> | null)?.channelTitle === "string" ? ((trend.popularityIndicators as Record<string, unknown>).channelTitle as string) : null,
      views: typeof (trend.popularityIndicators as Record<string, unknown> | null)?.views === "number" ? ((trend.popularityIndicators as Record<string, unknown>).views as number) : null,
      publishedAt: typeof (trend.popularityIndicators as Record<string, unknown> | null)?.publishedAt === "string" ? ((trend.popularityIndicators as Record<string, unknown>).publishedAt as string) : null,
      licensingStatus: trend.licensingStatus,
      analysis,
      additionalContext: validated.request.additionalContext,
      referenceImageAnalysis: validated.request.referenceImage?.analysis,
    };
    const basis: TrendAdaptationBrief["basis"] = validated.request.referenceImage
      ? "metadata_analysis_and_visual_reference"
      : validated.request.additionalContext
        ? "metadata_analysis_and_admin_context"
        : "metadata_and_analysis";
    const prompt = buildTrendAdaptationPrompt(trendForAdaptation, brand);
    const raw = await provider.generate(prompt);
    const adaptation = parseTrendAdaptation(raw, basis);

    console.log(
      JSON.stringify({
        scope: "ai_trend_adaptation",
        adminUserId,
        trendId: trend.id,
        latencyMs: Date.now() - started,
        ok: Boolean(adaptation),
      }),
    );

    if (!adaptation) {
      return { ok: false, status: 502, error: "The AI provider didn't return a usable adaptation. Try again." };
    }

    return { ok: true, adaptation };
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "ai_trend_adaptation",
        adminUserId,
        trendId: trend.id,
        latencyMs: Date.now() - started,
        ok: false,
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      }),
    );

    if (error instanceof AiProviderError) {
      return { ok: false, status: 502, error: error.message };
    }
    return { ok: false, status: 502, error: "AI adaptation failed. Try again." };
  }
}
