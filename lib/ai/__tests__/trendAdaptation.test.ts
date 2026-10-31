import { describe, expect, it } from "vitest";
import { buildTrendAdaptationPrompt, type TrendForAdaptation } from "@/lib/ai/trendAdaptation";
import { DEFAULT_BRAND_CONTEXT } from "@/lib/ai/brand";

const trend: TrendForAdaptation = {
  title: "A funny everyday struggle",
  platform: "YOUTUBE",
  type: "VIDEO_FORMAT",
  category: "Comedy",
  description: "Someone struggles with a chaotic task",
  channelTitle: "Some Channel",
  views: 1_000_000,
  publishedAt: "2026-01-01T00:00:00Z",
  licensingStatus: "UNKNOWN",
  analysis: {
    whyInteresting: "Relatable chaos",
    hookEffectiveness: "Immediate visual chaos",
    storytellingStructure: "Setup/chaos/relief",
    emotionalAppeal: "Relief",
    adaptationIdea: "Replace spreadsheets with a dashboard",
    suitableIndustries: [],
    suitableAudiences: [],
    suitablePlatforms: ["TIKTOK"],
    recommendedFormats: [],
    suggestedCaptions: [],
    hashtags: [],
    relevanceScore: 80,
    relevanceExplanation: "Fits well",
  },
};

describe("buildTrendAdaptationPrompt", () => {
  it("instructs the model that it has not watched the video", () => {
    const prompt = buildTrendAdaptationPrompt(trend, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/have NOT watched the source video/i);
  });

  it("includes the language instruction, defaulting to English", () => {
    const prompt = buildTrendAdaptationPrompt(trend, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/Write all text in English\./);
  });

  it("includes a real preferred language when the brand sets one", () => {
    const prompt = buildTrendAdaptationPrompt(trend, { ...DEFAULT_BRAND_CONTEXT, preferredLanguage: "French" });
    expect(prompt.system).toMatch(/Write all text in French\./);
  });

  it("includes the prior analysis so it isn't re-derived from scratch", () => {
    const prompt = buildTrendAdaptationPrompt(trend, DEFAULT_BRAND_CONTEXT);
    expect(prompt.user).toContain("Replace spreadsheets with a dashboard");
  });

  it("includes admin-provided additional context when present", () => {
    const prompt = buildTrendAdaptationPrompt({ ...trend, additionalContext: "It uses a specific meme sound" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.user).toContain("It uses a specific meme sound");
  });

  it("omits the additional-context section when none was given", () => {
    const prompt = buildTrendAdaptationPrompt(trend, DEFAULT_BRAND_CONTEXT);
    expect(prompt.user).not.toContain("Additional context the admin provided");
  });

  it("includes the analysed visual reference when one was uploaded, and instructs grounding visual format in it", () => {
    const prompt = buildTrendAdaptationPrompt({ ...trend, referenceImageAnalysis: "A split-screen before/after layout with bold red text" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.user).toContain("A split-screen before/after layout with bold red text");
    expect(prompt.system).toMatch(/ground your visual-format description in it/i);
  });

  it("omits the visual-reference section when none was uploaded", () => {
    const prompt = buildTrendAdaptationPrompt(trend, DEFAULT_BRAND_CONTEXT);
    expect(prompt.user).not.toContain("Visual reference image");
  });

  it("requires the JSON shape to include adaptationMode and suitability fields", () => {
    const prompt = buildTrendAdaptationPrompt(trend, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toContain('"adaptationMode"');
    expect(prompt.system).toContain('"suitable"');
    expect(prompt.system).toContain('"adaptedBrief"');
  });
});
