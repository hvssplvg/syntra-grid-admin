import { describe, expect, it } from "vitest";
import { parseTrendAdaptation } from "@/lib/ai/generateTrendAdaptation";

const VALID = {
  adaptationMode: "storytelling",
  coreCreativeConcept: "A relatable struggle resolved by a clean system",
  hook: "Everything is chaos until it isn't",
  humorOrEmotionalAppeal: "Relief",
  storytellingStructure: "Setup, chaos, resolution",
  visualFormat: "Quick cuts",
  pacing: "Fast, then calm",
  intendedAudience: "Small business owners",
  suitablePlatforms: ["TIKTOK", "INSTAGRAM", "NOT_A_PLATFORM"],
  businessAdaptationOpportunities: ["Custom dashboards replace spreadsheets"],
  suitable: true,
  suitabilityReason: "Fits the business well",
  adaptedBrief: "An original piece about replacing chaos with a custom system.",
  basis: "metadata_and_analysis", // deliberately wrong — server should override this
};

describe("parseTrendAdaptation", () => {
  it("parses a well-formed response", () => {
    const result = parseTrendAdaptation(JSON.stringify(VALID), "metadata_and_analysis");
    expect(result).not.toBeNull();
    expect(result!.adaptationMode).toBe("storytelling");
    expect(result!.suitable).toBe(true);
  });

  it("strips markdown fences", () => {
    const result = parseTrendAdaptation("```json\n" + JSON.stringify(VALID) + "\n```", "metadata_and_analysis");
    expect(result).not.toBeNull();
  });

  it("drops an unknown suitablePlatforms entry rather than passing it through", () => {
    const result = parseTrendAdaptation(JSON.stringify(VALID), "metadata_and_analysis");
    expect(result!.suitablePlatforms).toEqual(["TIKTOK", "INSTAGRAM"]);
  });

  it("defaults an invalid adaptationMode to 'other' rather than rejecting the whole response", () => {
    const result = parseTrendAdaptation(JSON.stringify({ ...VALID, adaptationMode: "something-invented" }), "metadata_and_analysis");
    expect(result!.adaptationMode).toBe("other");
  });

  it("never trusts the model's own 'basis' claim — the caller computes it from what was actually supplied", () => {
    const withoutContext = parseTrendAdaptation(JSON.stringify({ ...VALID, basis: "metadata_analysis_and_admin_context" }), "metadata_and_analysis");
    expect(withoutContext!.basis).toBe("metadata_and_analysis");

    const withContext = parseTrendAdaptation(JSON.stringify({ ...VALID, basis: "metadata_and_analysis" }), "metadata_analysis_and_admin_context");
    expect(withContext!.basis).toBe("metadata_analysis_and_admin_context");

    const withReference = parseTrendAdaptation(JSON.stringify({ ...VALID, basis: "metadata_and_analysis" }), "metadata_analysis_and_visual_reference");
    expect(withReference!.basis).toBe("metadata_analysis_and_visual_reference");
  });

  it("passes through alternativeSuggestion when the model is not confident this trend fits", () => {
    const result = parseTrendAdaptation(JSON.stringify({ ...VALID, suitable: false, alternativeSuggestion: "Try a before/after format instead" }), "metadata_and_analysis");
    expect(result!.suitable).toBe(false);
    expect(result!.alternativeSuggestion).toBe("Try a before/after format instead");
  });

  it("rejects a response missing a required field", () => {
    const incomplete: Partial<typeof VALID> = { ...VALID };
    delete incomplete.adaptedBrief;
    expect(parseTrendAdaptation(JSON.stringify(incomplete), "metadata_and_analysis")).toBeNull();
  });

  it("rejects unparseable JSON", () => {
    expect(parseTrendAdaptation("not json at all", "metadata_and_analysis")).toBeNull();
  });

  it("rejects a JSON array instead of an object", () => {
    expect(parseTrendAdaptation("[]", "metadata_and_analysis")).toBeNull();
  });
});
