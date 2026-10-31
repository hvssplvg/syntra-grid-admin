import { describe, expect, it } from "vitest";
import { buildCreativeDirectionPrompt } from "@/lib/ai/creativeDirection";
import { DEFAULT_BRAND_CONTEXT } from "@/lib/ai/brand";

describe("buildCreativeDirectionPrompt", () => {
  it("asks for exactly 3 genuinely different concepts", () => {
    const prompt = buildCreativeDirectionPrompt({ brief: "A new school management system" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/EXACTLY 3 genuinely different compositions/i);
    expect(prompt.system).toContain('"concepts"');
  });

  it("requires each concept to carry a complete, self-contained imagePrompt", () => {
    const prompt = buildCreativeDirectionPrompt({ brief: "A restaurant QR ordering platform" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/COMPLETE prompt you would send to an image generator/i);
  });

  it("includes the premium-quality standards", () => {
    const prompt = buildCreativeDirectionPrompt({ brief: "Anything" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/photorealistic commercial rendering/i);
  });

  it("instructs minimal in-image copy, real text added as overlays afterwards", () => {
    const prompt = buildCreativeDirectionPrompt({ brief: "Anything" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/little to no marketing copy\/headline text be rendered IN the image itself/i);
  });

  it("includes the brief and platform guidance in the user message", () => {
    const prompt = buildCreativeDirectionPrompt({ brief: "A ride-hailing app", platform: "INSTAGRAM" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.user).toContain("A ride-hailing app");
    expect(prompt.user).toContain("Platform (INSTAGRAM)");
  });

  it("includes an analysed visual reference when given, without forcing all 3 concepts to copy it", () => {
    const prompt = buildCreativeDirectionPrompt({ brief: "Anything", referenceAnalysis: "A cinematic low-angle shot with warm lighting" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.user).toContain("A cinematic low-angle shot with warm lighting");
    expect(prompt.system).toMatch(/still 3 different directions, not 3 copies of the reference/i);
  });

  it("writes copy in the brand's preferred language", () => {
    const prompt = buildCreativeDirectionPrompt({ brief: "Anything" }, { ...DEFAULT_BRAND_CONTEXT, preferredLanguage: "German" });
    expect(prompt.system).toMatch(/Write all copy in German\./);
  });
});
