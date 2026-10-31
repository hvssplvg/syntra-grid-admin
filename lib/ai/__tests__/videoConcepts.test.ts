import { describe, expect, it } from "vitest";
import { buildVideoConceptPrompt } from "@/lib/ai/videoConcepts";
import { DEFAULT_BRAND_CONTEXT } from "@/lib/ai/brand";

describe("buildVideoConceptPrompt", () => {
  it("instructs the model to treat a cited trend as inspiration only, never to copy it", () => {
    const prompt = buildVideoConceptPrompt({ brief: "Inspired by a trending video about X" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/never reproduce, quote, or closely describe the original/i);
  });

  it("still requires exactly 3 concepts in the JSON-shape instruction", () => {
    const prompt = buildVideoConceptPrompt({ brief: "Anything" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.system).toMatch(/Return EXACTLY 3 concepts/);
  });

  it("includes the brief and platform guidance in the user message", () => {
    const prompt = buildVideoConceptPrompt({ brief: "A great brief", platform: "LINKEDIN" }, DEFAULT_BRAND_CONTEXT);
    expect(prompt.user).toContain("A great brief");
    expect(prompt.user).toContain("Platform (LINKEDIN)");
  });
});
