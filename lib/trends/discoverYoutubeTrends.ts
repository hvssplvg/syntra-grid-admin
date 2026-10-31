// lib/trends/discoverYoutubeTrends.ts
//
// Orchestration for the admin-triggered "Discover trends" (YouTube)
// action — no cron, no scheduled refresh (no scheduling infra exists
// in this app today, and adding one is out of scope for v1). Upserts
// on Trend.sourceUrl so repeat clicks refresh popularity numbers
// instead of duplicating rows. popularityIndicators now also carries
// channelTitle/publishedAt (see youtubeDiscovery.ts) — passed through
// verbatim here, no schema change needed since it's a Json column.

import { prisma } from "@/lib/prisma";
import { TrendPlatform, TrendSource, TrendType } from "@/app/generated/prisma/enums";
import { fetchYoutubeTrendingShorts, isYoutubeDiscoveryConfigured, requiredYoutubeDiscoveryEnvVars, YoutubeDiscoveryError } from "./youtubeDiscovery";

export type DiscoverYoutubeTrendsResult =
  | { ok: true; discovered: number; created: number; updated: number }
  | { ok: false; status: 400 | 502 | 503; error: string; missingEnvVars?: string[] };

function validate(body: unknown): { regionCode?: string; videoCategoryId?: string } {
  if (!body || typeof body !== "object") return {};
  const data = body as Record<string, unknown>;
  return {
    regionCode: typeof data.regionCode === "string" && /^[A-Z]{2}$/.test(data.regionCode) ? data.regionCode : undefined,
    videoCategoryId: typeof data.videoCategoryId === "string" && /^[0-9]{1,3}$/.test(data.videoCategoryId) ? data.videoCategoryId : undefined,
  };
}

export async function discoverYoutubeTrends(body: unknown): Promise<DiscoverYoutubeTrendsResult> {
  if (!isYoutubeDiscoveryConfigured()) {
    return { ok: false, status: 503, error: "YouTube trend discovery isn't configured yet.", missingEnvVars: requiredYoutubeDiscoveryEnvVars() };
  }

  const { regionCode, videoCategoryId } = validate(body);

  try {
    const candidates = await fetchYoutubeTrendingShorts(regionCode, videoCategoryId);

    let created = 0;
    let updated = 0;
    for (const candidate of candidates) {
      const existing = await prisma.trend.findUnique({ where: { sourceUrl: candidate.sourceUrl }, select: { id: true } });
      await prisma.trend.upsert({
        where: { sourceUrl: candidate.sourceUrl },
        create: {
          title: candidate.title,
          platform: TrendPlatform.YOUTUBE,
          type: TrendType.VIDEO_FORMAT,
          category: candidate.category,
          description: candidate.description || candidate.title,
          sourceUrl: candidate.sourceUrl,
          source: TrendSource.AUTOMATED,
          popularityIndicators: candidate.popularityIndicators,
          lastVerifiedAt: new Date(),
        },
        update: {
          category: candidate.category,
          popularityIndicators: candidate.popularityIndicators,
          lastVerifiedAt: new Date(),
        },
      });
      if (existing) updated += 1;
      else created += 1;
    }

    return { ok: true, discovered: candidates.length, created, updated };
  } catch (error) {
    console.error("[trends/discoverYoutubeTrends]", error);
    if (error instanceof YoutubeDiscoveryError) return { ok: false, status: 502, error: error.message };
    return { ok: false, status: 502, error: "YouTube trend discovery failed." };
  }
}
