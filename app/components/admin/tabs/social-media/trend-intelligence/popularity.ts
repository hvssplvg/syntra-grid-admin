// Defensive reader for the YouTube-sourced fields tucked inside
// Trend.popularityIndicators (a loosely-typed Json column — see
// lib/trends/youtubeDiscovery.ts). Trends discovered before
// channelTitle/publishedAt were captured simply lack them; this
// degrades to null instead of throwing, so no backfill is required.

import type { TrendRecord } from "./api";

export type YoutubePopularity = {
  views: number | null;
  likes: number | null;
  comments: number | null;
  channelTitle: string | null;
  publishedAt: string | null;
};

export function readYoutubePopularity(trend: TrendRecord): YoutubePopularity {
  const raw = (trend.popularityIndicators ?? {}) as Record<string, unknown>;
  return {
    views: typeof raw.views === "number" ? raw.views : null,
    likes: typeof raw.likes === "number" ? raw.likes : null,
    comments: typeof raw.comments === "number" ? raw.comments : null,
    channelTitle: typeof raw.channelTitle === "string" ? raw.channelTitle : null,
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : null,
  };
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
