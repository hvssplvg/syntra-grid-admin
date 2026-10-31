// The "ensure analysis → adapt → fall back to metadata" logic shared
// by Generate Video/Generate Graphic — pulled out of
// TrendIntelligenceHome.tsx so it can be unit-tested without a DOM
// (this project's vitest environment is Node, not jsdom) and without
// a live network/AI call. Every dependency is injected; the real
// callers pass the real API functions, tests pass mocks.
//
// Every step that can fail degrades to the next thing down, ending at
// a plain metadata brief — a temporary AI outage must never block
// generation outright, and the fallback is always flagged to the
// admin so it's never mistaken for a real adaptation.

import type { TrendAdaptation } from "./api";
import type { TrendRecord } from "./api";

export type ReferenceImage = { url: string; analysis: string };

export type GenerationFlowDeps = {
  analyzeTrend: (trendId: string, force: boolean) => Promise<TrendRecord>;
  adaptTrend: (trendId: string, additionalContext?: string, referenceImage?: ReferenceImage) => Promise<TrendAdaptation>;
  buildBrief: (trend: TrendRecord) => string;
  /** Surfaces a short, non-blocking status message to the admin. */
  notify: (message: string) => void;
};

export type GenerationBrief = {
  brief: string;
  suitablePlatforms: string[];
  trend: TrendRecord;
  /** Passed straight through — the admin's own reference image, if
   *  any, regardless of whether the adaptation call succeeded. */
  referenceImage?: ReferenceImage;
};

export async function resolveGenerationBrief(
  trend: TrendRecord,
  additionalContext: string | undefined,
  deps: GenerationFlowDeps,
  referenceImage?: ReferenceImage,
): Promise<GenerationBrief> {
  let current = trend;

  if (!current.aiAnalysis) {
    try {
      current = await deps.analyzeTrend(trend.id, false);
    } catch (err) {
      console.error("[TrendIntelligence] pre-generation analysis failed, falling back to metadata brief", err);
      deps.notify("Couldn't analyse this trend right now — generating from its details instead.");
      return { brief: deps.buildBrief(current), suitablePlatforms: [], trend: current, referenceImage };
    }
  }

  try {
    const adaptation = await deps.adaptTrend(current.id, additionalContext, referenceImage);
    if (!adaptation.suitable) {
      deps.notify(adaptation.alternativeSuggestion ? `${adaptation.suitabilityReason} Suggestion: ${adaptation.alternativeSuggestion}` : adaptation.suitabilityReason);
    }
    return { brief: adaptation.adaptedBrief, suitablePlatforms: adaptation.suitablePlatforms, trend: current, referenceImage };
  } catch (err) {
    console.error("[TrendIntelligence] adaptation failed, falling back to metadata brief", err);
    deps.notify("Couldn't tailor this to your brand right now — generating from its details instead.");
    return { brief: deps.buildBrief(current), suitablePlatforms: [], trend: current, referenceImage };
  }
}
