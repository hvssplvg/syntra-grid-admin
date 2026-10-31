import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchYoutubeTrendingShorts } from "@/lib/trends/youtubeDiscovery";

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe("fetchYoutubeTrendingShorts", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.YOUTUBE_API_KEY;

  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.YOUTUBE_API_KEY = originalKey;
  });

  it("captures channelTitle, publishedAt, and a human-readable category name, keeping only <=60s videos", async () => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/search")) {
        return Promise.resolve(jsonResponse({ items: [{ id: { videoId: "shortVid1" } }, { id: { videoId: "longVid2" } }] }));
      }
      if (url.includes("/videoCategories")) {
        return Promise.resolve(jsonResponse({ items: [{ id: "24", snippet: { title: "Entertainment" } }] }));
      }
      if (url.includes("/videos")) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: "shortVid1",
                snippet: { title: "A short", description: "desc", categoryId: "24", channelTitle: "Some Channel", publishedAt: "2026-01-02T00:00:00Z" },
                statistics: { viewCount: "1000", likeCount: "50", commentCount: "5" },
                contentDetails: { duration: "PT45S" },
              },
              {
                id: "longVid2",
                snippet: { title: "A long one", description: "desc2", categoryId: "24", channelTitle: "Other Channel", publishedAt: "2026-01-03T00:00:00Z" },
                statistics: { viewCount: "2000" },
                contentDetails: { duration: "PT5M0S" },
              },
            ],
          }),
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const candidates = await fetchYoutubeTrendingShorts("GB");

    expect(candidates).toHaveLength(1);
    expect(candidates[0].title).toBe("A short");
    expect(candidates[0].category).toBe("Entertainment");
    expect(candidates[0].popularityIndicators).toEqual({
      views: 1000,
      likes: 50,
      comments: 5,
      channelTitle: "Some Channel",
      publishedAt: "2026-01-02T00:00:00Z",
    });
  });

  it("falls back to the raw numeric category id when the categories call fails", async () => {
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/search")) return Promise.resolve(jsonResponse({ items: [{ id: { videoId: "vidA" } }] }));
      if (url.includes("/videoCategories")) return Promise.resolve(jsonResponse({}, false));
      if (url.includes("/videos")) {
        return Promise.resolve(
          jsonResponse({
            items: [{ id: "vidA", snippet: { title: "T", categoryId: "10" }, statistics: {}, contentDetails: { duration: "PT10S" } }],
          }),
        );
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const candidates = await fetchYoutubeTrendingShorts("GB");
    expect(candidates[0].category).toBe("10");
  });

  it("returns an empty list when the search call has no results", async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ items: [] })) as unknown as typeof fetch;
    const candidates = await fetchYoutubeTrendingShorts("GB");
    expect(candidates).toEqual([]);
  });

  it("throws when YOUTUBE_API_KEY is missing", async () => {
    delete process.env.YOUTUBE_API_KEY;
    await expect(fetchYoutubeTrendingShorts("GB")).rejects.toThrow();
  });
});
