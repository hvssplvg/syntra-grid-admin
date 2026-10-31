// lib/trends/youtubeDiscovery.ts
//
// Official, free, commercial-use-safe automated trend discovery:
// YouTube Data API v3 — no OAuth, just a server API key,
// YOUTUBE_API_KEY. This is deliberately the ONLY automated-discovery
// source in Trend Intelligence v1: TikTok's Research API is
// academic/non-commercial only, Instagram hashtag search needs Meta
// App Review + is capped at 30 queries/week, Reddit's free tier is
// non-commercial-only, and LinkedIn has no trending-content API at
// all. Those platforms go through the manual-import workflow instead
// (see trends/route.ts).
//
// There is no dedicated "trending Shorts" endpoint. videos.list with
// chart=mostPopular (the overall trending chart) is almost entirely
// long-form content — verified against the live API: of 25 mostPopular
// items, 0 were <=60s. The documented proxy used here instead:
// search.list with videoDuration=short (YouTube's own "under 4
// minutes" bucket), order=viewCount, and a recent publishedAfter
// window, which surfaces real short-form videos ranked by popularity.
// A second videos.list call then fetches the real duration/stats for
// those candidates, and only items that are actually <=60s survive —
// "short" from search.list is a looser bucket than a true Short, so
// this final check is still required, it's just no longer filtering
// away everything.
//
// Quota: search.list costs 100 units, videos.list ~1 — one admin
// click costs ~101 of the default 10,000 units/day free quota.

const YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
const YOUTUBE_CATEGORIES_ENDPOINT = "https://www.googleapis.com/youtube/v3/videoCategories";
const MAX_RESULTS = 25;
const SHORTS_MAX_SECONDS = 60;
const RECENCY_WINDOW_DAYS = 7;

export type YoutubeTrendCandidate = {
  title: string;
  description: string;
  sourceUrl: string;
  category: string | null;
  popularityIndicators: {
    views: number;
    likes: number | null;
    comments: number | null;
    channelTitle: string | null;
    publishedAt: string | null;
  };
};

export class YoutubeDiscoveryError extends Error {}

export function isYoutubeDiscoveryConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

export function requiredYoutubeDiscoveryEnvVars(): string[] {
  return ["YOUTUBE_API_KEY"];
}

/** Parses an ISO-8601 duration (e.g. "PT47S", "PT1M3S") into seconds. */
function parseIsoDurationSeconds(duration: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) return Number.POSITIVE_INFINITY;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

type YoutubeApiItem = {
  id?: string;
  snippet?: { title?: string; description?: string; categoryId?: string; channelTitle?: string; publishedAt?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
};

/** categoryId -> human name (e.g. "24" -> "Entertainment"), scoped to a
 *  single discovery call — not a persistent cache, this is cheap (1
 *  quota unit) and category names can drift per region over time.
 *  Never blocks discovery: callers fall back to the raw numeric id. */
async function fetchYoutubeCategoryNames(regionCode: string, apiKey: string): Promise<Map<string, string>> {
  try {
    const url = new URL(YOUTUBE_CATEGORIES_ENDPOINT);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("regionCode", regionCode);
    url.searchParams.set("key", apiKey);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return new Map();
    const data: { items?: { id?: string; snippet?: { title?: string } }[] } = await response.json();
    const map = new Map<string, string>();
    for (const item of data.items ?? []) {
      if (item.id && item.snippet?.title) map.set(item.id, item.snippet.title);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function fetchYoutubeTrendingShorts(regionCode = "GB", videoCategoryId?: string): Promise<YoutubeTrendCandidate[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new YoutubeDiscoveryError("YOUTUBE_API_KEY is not configured.");

  const publishedAfter = new Date(Date.now() - RECENCY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const searchUrl = new URL(YOUTUBE_SEARCH_ENDPOINT);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("videoDuration", "short");
  searchUrl.searchParams.set("order", "viewCount");
  searchUrl.searchParams.set("publishedAfter", publishedAfter);
  searchUrl.searchParams.set("regionCode", regionCode);
  searchUrl.searchParams.set("maxResults", String(MAX_RESULTS));
  searchUrl.searchParams.set("key", apiKey);
  if (videoCategoryId) searchUrl.searchParams.set("videoCategoryId", videoCategoryId);

  const searchResponse = await fetch(searchUrl, { cache: "no-store" });
  if (!searchResponse.ok) {
    const errorBody = await searchResponse.text().catch(() => "");
    throw new YoutubeDiscoveryError(`YouTube search request failed (${searchResponse.status}): ${errorBody.slice(0, 300)}`);
  }

  const searchData: { items?: { id?: { videoId?: string } }[] } = await searchResponse.json();
  const videoIds = (searchData.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));
  if (videoIds.length === 0) return [];

  const videosUrl = new URL(YOUTUBE_VIDEOS_ENDPOINT);
  videosUrl.searchParams.set("part", "snippet,statistics,contentDetails");
  videosUrl.searchParams.set("id", videoIds.join(","));
  videosUrl.searchParams.set("key", apiKey);

  const response = await fetch(videosUrl, { cache: "no-store" });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new YoutubeDiscoveryError(`YouTube videos request failed (${response.status}): ${errorBody.slice(0, 300)}`);
  }

  const data: { items?: YoutubeApiItem[] } = await response.json();
  if (!Array.isArray(data.items)) return [];

  const categoryNames = await fetchYoutubeCategoryNames(regionCode, apiKey);

  const candidates: YoutubeTrendCandidate[] = [];
  for (const item of data.items) {
    const durationSeconds = parseIsoDurationSeconds(item.contentDetails?.duration ?? "");
    if (durationSeconds > SHORTS_MAX_SECONDS) continue; // only keep short-form candidates — this is a Shorts proxy, not an official filter

    const videoId = item.id;
    const title = item.snippet?.title;
    if (!videoId || !title) continue;

    const categoryId = item.snippet?.categoryId ?? null;

    candidates.push({
      title,
      description: (item.snippet?.description ?? "").slice(0, 2000),
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      category: categoryId ? categoryNames.get(categoryId) ?? categoryId : null,
      popularityIndicators: {
        views: Number(item.statistics?.viewCount ?? 0),
        likes: item.statistics?.likeCount != null ? Number(item.statistics.likeCount) : null,
        comments: item.statistics?.commentCount != null ? Number(item.statistics.commentCount) : null,
        channelTitle: item.snippet?.channelTitle ?? null,
        publishedAt: item.snippet?.publishedAt ?? null,
      },
    });
  }

  return candidates;
}
