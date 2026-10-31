import { describe, expect, it } from "vitest";
import { buildAiVideoConceptPrompt } from "@/lib/ai/aiVideoConcepts";
import { DEFAULT_BRAND_CONTEXT } from "@/lib/ai/brand";

describe("buildAiVideoConceptPrompt", () => {
  it("asks for exactly 3 genuinely different storytelling approaches", () => {
    const prompt = buildAiVideoConceptPrompt({ brief: "Our school management system" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/Return EXACTLY 3 concepts/);
    expect(prompt.system).toContain('"concepts"');
  });

  it("constrains scene durationSeconds to Luma's only supported values", () => {
    const prompt = buildAiVideoConceptPrompt({ brief: "Anything" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/exactly 5 or 10/);
  });

  it("instructs no on-screen text, captions, logos or marketing copy rendered into the footage", () => {
    const prompt = buildAiVideoConceptPrompt({ brief: "Anything" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/never baked into generated pixels/);
  });

  it("instructs any visible screen/interface to be stylised, never an authentic screenshot or invented data", () => {
    const prompt = buildAiVideoConceptPrompt({ brief: "Anything" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/stylised, abstract UI/);
    expect(prompt.system).toMatch(/never with invented real data/);
  });

  it("includes the brief and platform guidance in the user message", () => {
    const prompt = buildAiVideoConceptPrompt({ brief: "A ride-hailing app", platform: "INSTAGRAM" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.user).toContain("A ride-hailing app");
    expect(prompt.user).toContain("Platform (INSTAGRAM)");
  });

  it("writes copy in the brand's preferred language", () => {
    const prompt = buildAiVideoConceptPrompt({ brief: "Anything" }, { ...DEFAULT_BRAND_CONTEXT, preferredLanguage: "German" });
    expect(prompt.system).toMatch(/Write all text in German\./);
  });

  it("includes an analysed visual reference when given, without forcing all 3 concepts to copy it", () => {
    const prompt = buildAiVideoConceptPrompt({ brief: "Anything", referenceAnalysis: "A warm, low-angle shot of a desk" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.user).toContain("A warm, low-angle shot of a desk");
    expect(prompt.system).toMatch(/still 3 different storytelling approaches, not 3 copies of the reference/);
  });

  it("never implies the reference's motion or camera work was analysed — only a still image was", () => {
    const prompt = buildAiVideoConceptPrompt({ brief: "Anything", referenceAnalysis: "A warm, low-angle shot of a desk" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/never the motion, camera work, or editing of a video/);
  });

  it("omits any reference-image instruction when none is given", () => {
    const prompt = buildAiVideoConceptPrompt({ brief: "Anything" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.user).not.toMatch(/Visual reference/);
  });
});
