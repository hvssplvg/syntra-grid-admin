import { describe, expect, it } from "vitest";
import { buildBackgroundPrompt, buildImagePrompt } from "@/lib/ai/imagePrompt";
import { DEFAULT_BRAND_CONTEXT } from "@/lib/ai/brand";

describe("buildImagePrompt", () => {
  it("instructs an original adaptation, never a copy, when a reference analysis is given", () => {
    const prompt = buildImagePrompt({ brief: "A promo for our software", referenceAnalysis: "A split-screen before/after with a frustrated person on the left" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.prompt).toContain("split-screen before/after");
    expect(prompt.prompt).toMatch(/ORIGINAL image only inspired by/i);
    expect(prompt.prompt).toMatch(/never reproduce the reference's specific people, logos, text, brands, or copyrighted content/i);
  });

  it("omits the reference rules entirely when no reference analysis is given", () => {
    const prompt = buildImagePrompt({ brief: "A promo for our software" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.prompt).not.toMatch(/reference image/i);
  });

  it("still includes the standard no-fabricated-interface rule regardless", () => {
    const prompt = buildImagePrompt({ brief: "Anything", referenceAnalysis: "A product shot" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.prompt).toMatch(/never render a fabricated software interface/i);
  });

  it("includes the premium-quality standards", () => {
    const prompt = buildImagePrompt({ brief: "Anything" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.prompt).toMatch(/photorealistic commercial rendering/i);
    expect(prompt.prompt).toMatch(/avoid entirely: generic gradient-background posters/i);
  });

  it("grounds the prompt in real brand details when the brand kit has them", () => {
    const prompt = buildImagePrompt(
      { brief: "Anything" },
      { ...DEFAULT_BRAND_CONTEXT, industry: "Education technology", targetAudience: "School administrators", personality: "Warm and trustworthy", primaryColors: ["#112233"], secondaryColors: ["#AABBCC"] },
    );
    expect(prompt.prompt).toContain("Education technology");
    expect(prompt.prompt).toContain("School administrators");
    expect(prompt.prompt).toContain("Warm and trustworthy");
    expect(prompt.prompt).toContain("#112233");
    expect(prompt.prompt).toContain("#AABBCC");
  });

  it("prefers no embedded marketing copy, leaving real text to editable overlays", () => {
    const prompt = buildImagePrompt({ brief: "Anything" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.prompt).toMatch(/added afterwards as separate, editable, reliably-rendered text layers/i);
  });
});

describe("buildBackgroundPrompt", () => {
  it("also carries the reference rules for the hybrid background path", () => {
    const prompt = buildBackgroundPrompt({ brief: "A background", referenceAnalysis: "Warm, muted colours with a centred subject" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.prompt).toContain("Warm, muted colours");
    expect(prompt.prompt).toMatch(/ORIGINAL image only inspired by/i);
  });

  it("still forbids rendering any text, reference or not", () => {
    const prompt = buildBackgroundPrompt({ brief: "A background", referenceAnalysis: "Bold typography overlay" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.prompt).toMatch(/do not render any words, letters, numbers, or typography/i);
  });
});
