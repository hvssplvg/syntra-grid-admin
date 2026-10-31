// Trend Intelligence's own fetch helper — same self-contained idiom as
// content-studio/api.ts (no import of SocialMediaTab.tsx's private
// apiRequest(), keeps the one-directional dependency graph).

import { AiApiError } from "../content-studio/api";

export type TrendPlatform = "TIKTOK" | "INSTAGRAM" | "YOUTUBE" | "LINKEDIN" | "REDDIT" | "X" | "OTHER";
export type TrendType = "AUDIO" | "MEME" | "VIDEO_FORMAT" | "HOOK" | "GENERAL";
export type TrendSource = "AUTOMATED" | "MANUAL";
export type TrendLicensingStatus = "ORIGINAL_SAFE_TO_ADAPT" | "REQUIRES_LICENSE" | "RESTRICTED" | "UNKNOWN";
export type TrendStatus = "NEW" | "SAVED" | "DISMISSED" | "USED" | "ARCHIVED";

export type TrendAiAnalysis = {
  whyInteresting: string;
  hookEffectiveness: string;
  storytellingStructure: string;
  emotionalAppeal: string;
  adaptationIdea: string;
  relevanceExplanation: string;
  suitablePlatforms: string[];
};

export type TrendRecord = {
  id: string;
  title: string;
  platform: TrendPlatform;
  type: TrendType;
  category: string | null;
  description: string;
  sourceUrl: string | null;
  source: TrendSource;
  discoveredAt: string;
  lastVerifiedAt: string | null;
  popularityIndicators: Record<string, unknown> | null;
  audioInfo: Record<string, unknown> | null;
  licensingStatus: TrendLicensingStatus;
  status: TrendStatus;
  suitableIndustries: string[];
  suitableAudiences: string[];
  recommendedFormats: string[];
  suggestedCaptions: string[];
  hashtags: string[];
  relevanceScore: number | null;
  aiAnalysis: TrendAiAnalysis | null;
  aiAnalyzedAt: string | null;
  contentProjectId: string | null;
};

export type TrendListFilters = { platform?: TrendPlatform; type?: TrendType; status?: TrendStatus; industry?: string; since?: string };

export async function listTrendsApi(filters: TrendListFilters = {}): Promise<TrendRecord[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const response = await fetch(`/api/admin/social-media/trends?${params.toString()}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) return [];
  return payload.trends as TrendRecord[];
}

export type CreateTrendInput = {
  title: string;
  platform: TrendPlatform;
  type?: TrendType;
  category?: string;
  description: string;
  sourceUrl?: string;
  popularityIndicators?: Record<string, unknown>;
  audioInfo?: Record<string, unknown>;
  licensingStatus?: TrendLicensingStatus;
  hashtags?: string[];
};

export async function createTrendApi(input: CreateTrendInput): Promise<TrendRecord> {
  const response = await fetch("/api/admin/social-media/trends", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Request failed (${response.status}).`);
  return payload.trend as TrendRecord;
}

export async function updateTrendStatusApi(id: string, status: "NEW" | "SAVED" | "DISMISSED" | "ARCHIVED" | "USED"): Promise<TrendRecord> {
  const response = await fetch(`/api/admin/social-media/trends/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Request failed (${response.status}).`);
  return payload.trend as TrendRecord;
}

export async function promoteTrendApi(id: string, contentProjectId: string): Promise<TrendRecord> {
  const response = await fetch(`/api/admin/social-media/trends/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentProjectId }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Request failed (${response.status}).`);
  return payload.trend as TrendRecord;
}

export async function deleteTrendApi(id: string): Promise<void> {
  const response = await fetch(`/api/admin/social-media/trends/${id}`, { method: "DELETE", credentials: "include" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Delete failed (${response.status}).`);
}

/** Cache-and-skip server-side: a trend already analyzed returns its
 *  stored analysis without spending another AI request unless
 *  force:true. See lib/ai/generateTrendAnalysis.ts. */
export async function analyzeTrendApi(trendId: string, force = false): Promise<TrendRecord> {
  const response = await fetch("/api/admin/social-media/ai/analyze-trend", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trendId, force }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `AI request failed (${response.status}).`, payload?.missingEnvVars);
  return payload.trend as TrendRecord;
}

export type DiscoverYoutubeResult = { discovered: number; created: number; updated: number };

export type TrendAdaptationMode = "meme" | "before_after" | "storytelling" | "educational" | "transition" | "professional" | "other";

export type TrendAdaptation = {
  adaptationMode: TrendAdaptationMode;
  coreCreativeConcept: string;
  hook: string;
  humorOrEmotionalAppeal: string;
  storytellingStructure: string;
  visualFormat: string;
  pacing: string;
  intendedAudience: string;
  suitablePlatforms: string[];
  businessAdaptationOpportunities: string[];
  suitable: boolean;
  suitabilityReason: string;
  alternativeSuggestion?: string;
  adaptedBrief: string;
  basis: "metadata_and_analysis" | "metadata_analysis_and_admin_context" | "metadata_analysis_and_visual_reference";
};

/** The Trend Adaptation Engine — requires the trend to already be
 *  analysed (409 otherwise, see lib/ai/generateTrendAdaptation.ts).
 *  Not cached: cheap, business-specific, regenerated per click. */
export async function adaptTrendApi(
  trendId: string,
  additionalContext?: string,
  referenceImage?: { url: string; analysis: string },
): Promise<TrendAdaptation> {
  const response = await fetch("/api/admin/social-media/ai/adapt-trend", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trendId, additionalContext, referenceImage }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Request failed (${response.status}).`, payload?.missingEnvVars);
  return payload.adaptation as TrendAdaptation;
}

/** YouTube Data API v3 is the only automated-discovery source in v1 —
 *  see lib/trends/youtubeDiscovery.ts's header comment for why every
 *  other platform goes through manual import instead. */
export async function discoverYoutubeTrendsApi(regionCode?: string, videoCategoryId?: string): Promise<DiscoverYoutubeResult> {
  const response = await fetch("/api/admin/social-media/trends/discover", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ regionCode, videoCategoryId }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Request failed (${response.status}).`, payload?.missingEnvVars);
  return { discovered: payload.discovered as number, created: payload.created as number, updated: payload.updated as number };
}

export type YoutubeOembedResult =
  | { embeddable: true; title: string | null; authorName: string | null; thumbnailUrl: string | null }
  | { embeddable: false };

/** Checks embeddability + backfills title/channel/thumbnail via
 *  YouTube's free oEmbed endpoint (proxied server-side — see
 *  app/api/admin/social-media/trends/youtube-oembed/route.ts). Throws
 *  only on a real network/server failure, never for "not embeddable",
 *  which is a normal, expected result. */
export async function checkYoutubeEmbedApi(videoId: string): Promise<YoutubeOembedResult> {
  const response = await fetch(`/api/admin/social-media/trends/youtube-oembed?videoId=${encodeURIComponent(videoId)}`, {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Request failed (${response.status}).`);
  if (!payload.embeddable) return { embeddable: false };
  return { embeddable: true, title: payload.title ?? null, authorName: payload.authorName ?? null, thumbnailUrl: payload.thumbnailUrl ?? null };
}
