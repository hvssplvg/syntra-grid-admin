import { describe, expect, it } from "vitest";
import { defaultPlatformForTrend } from "@/app/components/admin/tabs/social-media/trend-intelligence/platformDefault";
import type { TrendRecord } from "@/app/components/admin/tabs/social-media/trend-intelligence/api";

function trend(overrides: Partial<TrendRecord> = {}): TrendRecord {
  return {
    id: "t1",
    title: "Some trend",
    platform: "YOUTUBE",
    type: "VIDEO_FORMAT",
    category: null,
    description: "A trend",
    sourceUrl: "https://www.youtube.com/watch?v=abc12345678",
    source: "AUTOMATED",
    discoveredAt: "2026-01-01T00:00:00.000Z",
    lastVerifiedAt: null,
    popularityIndicators: null,
    audioInfo: null,
    licensingStatus: "UNKNOWN",
    status: "NEW",
    suitableIndustries: [],
    suitableAudiences: [],
    recommendedFormats: [],
    suggestedCaptions: [],
    hashtags: [],
    relevanceScore: null,
    aiAnalysis: null,
    aiAnalyzedAt: null,
    contentProjectId: null,
    ...overrides,
  };
}

describe("defaultPlatformForTrend", () => {
  it("prefers the AI analysis's first suggested platform when present", () => {
    const t = trend({ platform: "YOUTUBE", aiAnalysis: { whyInteresting: "", hookEffectiveness: "", storytellingStructure: "", emotionalAppeal: "", adaptationIdea: "", relevanceExplanation: "", suitablePlatforms: ["LINKEDIN", "X"] } });
    expect(defaultPlatformForTrend(t)).toBe("LINKEDIN");
  });

  it("falls back to the trend's own platform when there's no AI analysis", () => {
    expect(defaultPlatformForTrend(trend({ platform: "YOUTUBE" }))).toBe("YOUTUBE");
    expect(defaultPlatformForTrend(trend({ platform: "TIKTOK" }))).toBe("TIKTOK");
    expect(defaultPlatformForTrend(trend({ platform: "INSTAGRAM" }))).toBe("INSTAGRAM");
    expect(defaultPlatformForTrend(trend({ platform: "LINKEDIN" }))).toBe("LINKEDIN");
    expect(defaultPlatformForTrend(trend({ platform: "X" }))).toBe("X");
  });

  it("falls back to TikTok for platforms with no SocialPlatform equivalent", () => {
    expect(defaultPlatformForTrend(trend({ platform: "REDDIT" }))).toBe("TIKTOK");
    expect(defaultPlatformForTrend(trend({ platform: "OTHER" }))).toBe("TIKTOK");
  });

  it("ignores a suggested platform that isn't a valid SocialPlatform", () => {
    const t = trend({ platform: "TIKTOK", aiAnalysis: { whyInteresting: "", hookEffectiveness: "", storytellingStructure: "", emotionalAppeal: "", adaptationIdea: "", relevanceExplanation: "", suitablePlatforms: ["REDDIT"] } });
    expect(defaultPlatformForTrend(t)).toBe("TIKTOK");
  });
});
