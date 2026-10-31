import { describe, expect, it } from "vitest";
import { generateMotionSuggestions, parseMotionSuggestions } from "@/lib/ai/generateMotionSuggestions";
import { buildMotionSuggestionsPrompt } from "@/lib/ai/motionSuggestions";
import { DEFAULT_BRAND_CONTEXT } from "@/lib/ai/brand";

const BRAND = { ...DEFAULT_BRAND_CONTEXT, industry: "SaaS", personality: "Confident and modern" };

const SUGGESTION = {
  label: "Cinematic Reveal",
  description: "A slow push toward the product that builds anticipation.",
  motionPrompt: "Slow cinematic push-in toward the laptop, soft ambient lighting shifts, realistic reflections, no camera shake.",
};

const VALID = {
  suggestions: [
    SUGGESTION,
    { ...SUGGESTION, label: "Gentle Parallax" },
    { ...SUGGESTION, label: "Dynamic Showcase" },
  ],
};

describe("parseMotionSuggestions", () => {
  it("parses a well-formed response with exactly 3 suggestions", () => {
    const result = parseMotionSuggestions(JSON.stringify(VALID));
    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);
    expect(result![0].label).toBe("Cinematic Reveal");
  });

  it("strips markdown fences", () => {
    expect(parseMotionSuggestions("```json\n" + JSON.stringify(VALID) + "\n```")).not.toBeNull();
  });

  it("rejects a response with only 2 suggestions", () => {
    expect(parseMotionSuggestions(JSON.stringify({ suggestions: VALID.suggestions.slice(0, 2) }))).toBeNull();
  });

  it("rejects a response with 4 suggestions", () => {
    expect(parseMotionSuggestions(JSON.stringify({ suggestions: [...VALID.suggestions, SUGGESTION] }))).toBeNull();
  });

  it("drops a malformed suggestion, failing the exactly-3 requirement", () => {
    const broken = { label: "Missing Prompt", description: "No motionPrompt field" };
    expect(parseMotionSuggestions(JSON.stringify({ suggestions: [broken, SUGGESTION, SUGGESTION] }))).toBeNull();
  });

  it("rejects unparseable JSON", () => {
    expect(parseMotionSuggestions("not json")).toBeNull();
  });

  it("rejects a JSON array instead of an object", () => {
    expect(parseMotionSuggestions("[]")).toBeNull();
  });

  it("clamps an overlong label/description/motionPrompt rather than rejecting", () => {
    const longSuggestion = { label: "x".repeat(200), description: "y".repeat(500), motionPrompt: "z".repeat(3000) };
    const result = parseMotionSuggestions(JSON.stringify({ suggestions: [longSuggestion, SUGGESTION, SUGGESTION] }));
    expect(result).not.toBeNull();
    expect(result![0].label.length).toBeLessThanOrEqual(60);
    expect(result![0].description.length).toBeLessThanOrEqual(300);
    expect(result![0].motionPrompt.length).toBeLessThanOrEqual(1500);
  });
});

describe("buildMotionSuggestionsPrompt", () => {
  it("grounds the instructions in the actual image description, not a generic template", () => {
    const prompt = buildMotionSuggestionsPrompt({ imageAnalysis: "A plated pasta dish on a rustic wooden table, warm restaurant lighting." }, BRAND);
    expect(prompt.user).toContain("A plated pasta dish on a rustic wooden table");
    expect(prompt.system).toMatch(/adapt to what the image actually shows/i);
  });

  it("instructs the model never to re-describe the image's content as a motion prompt", () => {
    const prompt = buildMotionSuggestionsPrompt({ imageAnalysis: "A software dashboard screenshot with charts and a sidebar." }, BRAND);
    expect(prompt.system).toMatch(/never a re-description of the whole image's content/i);
  });

  it("instructs the model to protect legible text/logos/interface elements from distortion", () => {
    const prompt = buildMotionSuggestionsPrompt({ imageAnalysis: "A dashboard with readable text and a logo in the corner." }, BRAND);
    expect(prompt.system).toMatch(/never suggest motion that would distort any readable text, logos, or interface elements/i);
  });

  it("includes optional admin userContext in the user message when supplied", () => {
    const prompt = buildMotionSuggestionsPrompt({ imageAnalysis: "A product photo.", userContext: "Make it feel luxurious." }, BRAND);
    expect(prompt.user).toContain("Make it feel luxurious.");
  });

  it("requires exactly 3 suggestions in the JSON-shape instruction", () => {
    const prompt = buildMotionSuggestionsPrompt({ imageAnalysis: "A product photo." }, BRAND);
    expect(prompt.system).toMatch(/Return EXACTLY 3 suggestions/);
  });
});

describe("generateMotionSuggestions validation", () => {
  it("rejects a missing imageUrl", async () => {
    const result = await generateMotionSuggestions("admin1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a non-https imageUrl", async () => {
    const result = await generateMotionSuggestions("admin1", { imageUrl: "http://example.com/a.png" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a malformed imageUrl", async () => {
    const result = await generateMotionSuggestions("admin1", { imageUrl: "not-a-url" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a non-string userContext", async () => {
    const result = await generateMotionSuggestions("admin1", { imageUrl: "https://example.com/a.png", userContext: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});
