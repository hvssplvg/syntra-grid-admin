// lib/ai/generateTrendAnalysis.ts
//
// Orchestration for Trend Intelligence's "Analyze trend" step — same
// shape as generateVideoConcepts.ts (validate → load trend → cache
// check → configured check → rate-limit → brand-aware prompt →
// provider call → parse+clamp → persist onto the Trend row → return).
//
// The cache IS the Trend row itself: once aiAnalyzedAt is set, a
// second call with the same trendId returns the stored analysis
// without spending another AI request, unless the caller explicitly
// passes force:true. No separate cache/TTL infrastructure needed.

import type { Trend } from "@/app/generated/prisma/client";
import { PLATFORMS } from "@/app/components/admin/tabs/social-media/shared/constants";
import { prisma } from "@/lib/prisma";
import { buildTrendAnalysisPrompt, type TrendForAnalysis } from "./trendAnalysis";
import { getBrandContext } from "./brand";
import "./providers/openai"; // registers the provider as a side effect — see registry.ts
import { checkRateLimit } from "./rateLimit";
import { getAiTextProvider, isAiTextConfigured, requiredAiTextEnvVars } from "./registry";
import { AiProviderError, type TrendAnalysisRequest, type TrendAnalysisResult } from "./types";

const MAX_TEXT_LENGTH = 800;
const MAX_LIST_ITEMS = 6;
const MAX_LIST_ITEM_LENGTH = 200;

const PLATFORM_IDS = new Set(PLATFORMS.map((platform) => platform.id));

export type GenerateTrendAnalysisResult = { ok: true; trend: Trend } | { ok: false; status: 400 | 404 | 429 | 502 | 503; error: string; missingEnvVars?: string[] };

function validate(body: unknown): { request: TrendAnalysisRequest } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const input = body as Record<string, unknown>;
  if (typeof input.trendId !== "string" || !input.trendId.trim()) return { error: "trendId is required." };
  return { request: { trendId: input.trendId.trim(), force: input.force === true } };
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

/** Parses the provider's response as a TrendAnalysisResult — rejects
 *  anything missing a required field rather than ever inventing one.
 *  relevanceScore is clamped 0-100 and rounded; never trusted beyond that. */
function parseTrendAnalysis(raw: string): TrendAnalysisResult | null {
  let parsed: unknown;
  try {
    const stripped = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "");
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const data = parsed as Record<string, unknown>;

  const whyInteresting = clampText(data.whyInteresting);
  const hookEffectiveness = clampText(data.hookEffectiveness);
  const storytellingStructure = clampText(data.storytellingStructure);
  const emotionalAppeal = clampText(data.emotionalAppeal);
  const adaptationIdea = clampText(data.adaptationIdea);
  const relevanceExplanation = clampText(data.relevanceExplanation);
  if (!whyInteresting || !hookEffectiveness || !storytellingStructure || !emotionalAppeal || !adaptationIdea || !relevanceExplanation) {
    return null;
  }

  const rawScore = typeof data.relevanceScore === "number" ? data.relevanceScore : Number(data.relevanceScore);
  if (!Number.isFinite(rawScore)) return null;
  const relevanceScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  const suitablePlatforms = clampList(data.suitablePlatforms).filter((platform) => PLATFORM_IDS.has(platform as never)) as TrendAnalysisResult["suitablePlatforms"];

  return {
    whyInteresting,
    hookEffectiveness,
    storytellingStructure,
    emotionalAppeal,
    adaptationIdea,
    relevanceExplanation,
    relevanceScore,
    suitableIndustries: clampList(data.suitableIndustries),
    suitableAudiences: clampList(data.suitableAudiences),
    suitablePlatforms,
    recommendedFormats: clampList(data.recommendedFormats),
    suggestedCaptions: clampList(data.suggestedCaptions),
    hashtags: clampList(data.hashtags),
  };
}

export async function generateTrendAnalysis(adminUserId: string, body: unknown): Promise<GenerateTrendAnalysisResult> {
  const validated = validate(body);
  if ("error" in validated) return { ok: false, status: 400, error: validated.error };

  const trend = await prisma.trend.findUnique({ where: { id: validated.request.trendId } });
  if (!trend) return { ok: false, status: 404, error: "Trend not found." };

  if (trend.aiAnalyzedAt && !validated.request.force) {
    return { ok: true, trend };
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
    const trendForAnalysis: TrendForAnalysis = {
      title: trend.title,
      platform: trend.platform,
      type: trend.type,
      category: trend.category,
      description: trend.description,
      sourceUrl: trend.sourceUrl,
      hashtags: trend.hashtags,
      audioInfo: trend.audioInfo,
      licensingStatus: trend.licensingStatus,
    };
    const prompt = buildTrendAnalysisPrompt(trendForAnalysis, brand);
    const raw = await provider.generate(prompt);
    const analysis = parseTrendAnalysis(raw);

    console.log(
      JSON.stringify({
        scope: "ai_trend_analysis",
        adminUserId,
        trendId: trend.id,
        latencyMs: Date.now() - started,
        ok: Boolean(analysis),
      }),
    );

    if (!analysis) {
      return { ok: false, status: 502, error: "The AI provider didn't return a usable analysis. Try again." };
    }

    const updated = await prisma.trend.update({
      where: { id: trend.id },
      data: {
        aiAnalysis: {
          whyInteresting: analysis.whyInteresting,
          hookEffectiveness: analysis.hookEffectiveness,
          storytellingStructure: analysis.storytellingStructure,
          emotionalAppeal: analysis.emotionalAppeal,
          adaptationIdea: analysis.adaptationIdea,
          relevanceExplanation: analysis.relevanceExplanation,
          suitablePlatforms: analysis.suitablePlatforms,
        },
        relevanceScore: analysis.relevanceScore,
        suitableIndustries: analysis.suitableIndustries,
        suitableAudiences: analysis.suitableAudiences,
        recommendedFormats: analysis.recommendedFormats,
        suggestedCaptions: analysis.suggestedCaptions,
        hashtags: analysis.hashtags,
        aiAnalyzedAt: new Date(),
      },
    });

    return { ok: true, trend: updated };
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "ai_trend_analysis",
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
    return { ok: false, status: 502, error: "AI analysis failed. Try again." };
  }
}
