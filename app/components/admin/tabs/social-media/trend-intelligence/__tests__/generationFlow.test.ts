import { describe, expect, it, vi } from "vitest";
import { resolveGenerationBrief, type GenerationFlowDeps } from "@/app/components/admin/tabs/social-media/trend-intelligence/generationFlow";
import type { TrendAdaptation, TrendRecord } from "@/app/components/admin/tabs/social-media/trend-intelligence/api";

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

function adaptation(overrides: Partial<TrendAdaptation> = {}): TrendAdaptation {
  return {
    adaptationMode: "storytelling",
    coreCreativeConcept: "x",
    hook: "x",
    humorOrEmotionalAppeal: "x",
    storytellingStructure: "x",
    visualFormat: "x",
    pacing: "x",
    intendedAudience: "x",
    suitablePlatforms: ["TIKTOK"],
    businessAdaptationOpportunities: [],
    suitable: true,
    suitabilityReason: "Fits well",
    adaptedBrief: "An adapted brief",
    basis: "metadata_and_analysis",
    ...overrides,
  };
}

function deps(overrides: Partial<GenerationFlowDeps> = {}): GenerationFlowDeps {
  return {
    analyzeTrend: vi.fn(async () => trend({ aiAnalysis: { whyInteresting: "x", hookEffectiveness: "x", storytellingStructure: "x", emotionalAppeal: "x", adaptationIdea: "x", relevanceExplanation: "x", suitablePlatforms: [] }, relevanceScore: 80 })),
    adaptTrend: vi.fn(async () => adaptation()),
    buildBrief: vi.fn((t: TrendRecord) => `metadata brief for ${t.title}`),
    notify: vi.fn(),
    ...overrides,
  };
}

describe("resolveGenerationBrief", () => {
  it("skips the analysis call when the trend already has cached analysis (reuse, not re-spend)", async () => {
    const d = deps();
    const already = trend({ aiAnalysis: { whyInteresting: "x", hookEffectiveness: "x", storytellingStructure: "x", emotionalAppeal: "x", adaptationIdea: "x", relevanceExplanation: "x", suitablePlatforms: [] }, relevanceScore: 70 });
    await resolveGenerationBrief(already, undefined, d);
    expect(d.analyzeTrend).not.toHaveBeenCalled();
  });

  it("analyzes first when no cached analysis exists, then adapts", async () => {
    const d = deps();
    const fresh = trend({ aiAnalysis: null });
    await resolveGenerationBrief(fresh, undefined, d);
    expect(d.analyzeTrend).toHaveBeenCalledWith("t1", false);
    expect(d.adaptTrend).toHaveBeenCalled();
  });

  it("returns the real adapted brief on the happy path", async () => {
    const d = deps();
    const result = await resolveGenerationBrief(trend({ aiAnalysis: { whyInteresting: "x", hookEffectiveness: "x", storytellingStructure: "x", emotionalAppeal: "x", adaptationIdea: "x", relevanceExplanation: "x", suitablePlatforms: [] }, relevanceScore: 80 }), undefined, d);
    expect(result.brief).toBe("An adapted brief");
    expect(result.suitablePlatforms).toEqual(["TIKTOK"]);
  });

  it("never crashes when analysis fails — falls back to a metadata brief instead", async () => {
    const d = deps({ analyzeTrend: vi.fn(async () => { throw new Error("AI provider down"); }) });
    const fresh = trend({ aiAnalysis: null });
    const result = await resolveGenerationBrief(fresh, undefined, d);
    expect(result.brief).toBe("metadata brief for Some trend");
    expect(result.suitablePlatforms).toEqual([]);
    expect(d.notify).toHaveBeenCalledWith(expect.stringContaining("Couldn't analyse"));
    expect(d.adaptTrend).not.toHaveBeenCalled(); // never attempts to adapt without analysis
  });

  it("never crashes when adaptation fails — falls back to a metadata brief instead", async () => {
    const d = deps({ adaptTrend: vi.fn(async () => { throw new Error("AI provider down"); }) });
    const already = trend({ aiAnalysis: { whyInteresting: "x", hookEffectiveness: "x", storytellingStructure: "x", emotionalAppeal: "x", adaptationIdea: "x", relevanceExplanation: "x", suitablePlatforms: [] }, relevanceScore: 80 });
    const result = await resolveGenerationBrief(already, undefined, d);
    expect(result.brief).toBe(`metadata brief for ${already.title}`);
    expect(d.notify).toHaveBeenCalledWith(expect.stringContaining("Couldn't tailor"));
  });

  it("surfaces a non-blocking notice when the trend is judged unsuitable, but still returns a usable brief", async () => {
    const d = deps({ adaptTrend: vi.fn(async () => adaptation({ suitable: false, suitabilityReason: "Doesn't fit", alternativeSuggestion: "Try X instead" })) });
    const already = trend({ aiAnalysis: { whyInteresting: "x", hookEffectiveness: "x", storytellingStructure: "x", emotionalAppeal: "x", adaptationIdea: "x", relevanceExplanation: "x", suitablePlatforms: [] }, relevanceScore: 80 });
    const result = await resolveGenerationBrief(already, undefined, d);
    expect(result.brief).toBe("An adapted brief"); // still proceeds — never a hard block
    expect(d.notify).toHaveBeenCalledWith(expect.stringContaining("Try X instead"));
  });

  it("passes additionalContext through to the adaptation call", async () => {
    const d = deps();
    const already = trend({ aiAnalysis: { whyInteresting: "x", hookEffectiveness: "x", storytellingStructure: "x", emotionalAppeal: "x", adaptationIdea: "x", relevanceExplanation: "x", suitablePlatforms: [] }, relevanceScore: 80 });
    await resolveGenerationBrief(already, "it uses a specific meme sound", d);
    expect(d.adaptTrend).toHaveBeenCalledWith("t1", "it uses a specific meme sound", undefined);
  });

  it("passes a reference image through to the adaptation call, and back out in the result", async () => {
    const d = deps();
    const already = trend({ aiAnalysis: { whyInteresting: "x", hookEffectiveness: "x", storytellingStructure: "x", emotionalAppeal: "x", adaptationIdea: "x", relevanceExplanation: "x", suitablePlatforms: [] }, relevanceScore: 80 });
    const referenceImage = { url: "https://example.com/ref.png", analysis: "A split-screen before/after" };
    const result = await resolveGenerationBrief(already, undefined, d, referenceImage);
    expect(d.adaptTrend).toHaveBeenCalledWith("t1", undefined, referenceImage);
    expect(result.referenceImage).toEqual(referenceImage);
  });
});
