import { describe, expect, it } from "vitest";
import { generateCreativeDirection, parseCreativeDirection } from "@/lib/ai/generateCreativeDirection";

const CONCEPT = {
  label: "Premium 3D Product Showcase",
  description: "A clean studio composition with a floating device.",
  imagePrompt: "A photorealistic studio shot of a laptop displaying a stylised dashboard, soft directional lighting, shallow depth of field.",
  headline: "Smarter Systems. Stronger Businesses.",
  supportingText: "Built around how you actually work.",
  callToAction: "See it in action",
};

const VALID = { concepts: [CONCEPT, { ...CONCEPT, label: "Cinematic Lifestyle Advertisement" }, { ...CONCEPT, label: "Modern Editorial Technology Campaign" }] };

describe("parseCreativeDirection", () => {
  it("parses a well-formed response with exactly 3 concepts", () => {
    const result = parseCreativeDirection(JSON.stringify(VALID));
    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);
    expect(result![0].headline).toBe("Smarter Systems. Stronger Businesses.");
  });

  it("strips markdown fences", () => {
    expect(parseCreativeDirection("```json\n" + JSON.stringify(VALID) + "\n```")).not.toBeNull();
  });

  it("rejects a response with only 2 concepts", () => {
    expect(parseCreativeDirection(JSON.stringify({ concepts: VALID.concepts.slice(0, 2) }))).toBeNull();
  });

  it("rejects a response with 4 concepts", () => {
    expect(parseCreativeDirection(JSON.stringify({ concepts: [...VALID.concepts, CONCEPT] }))).toBeNull();
  });

  it("drops a malformed concept (missing imagePrompt) rather than passing it through, failing the exactly-3 requirement", () => {
    const broken: Partial<typeof CONCEPT> = { ...CONCEPT };
    delete broken.imagePrompt;
    const result = parseCreativeDirection(JSON.stringify({ concepts: [broken, CONCEPT, CONCEPT] }));
    expect(result).toBeNull();
  });

  it("keeps optional supportingText/callToAction optional", () => {
    const minimal = { label: CONCEPT.label, description: CONCEPT.description, imagePrompt: CONCEPT.imagePrompt, headline: CONCEPT.headline };
    const result = parseCreativeDirection(JSON.stringify({ concepts: [minimal, minimal, minimal] }));
    expect(result).not.toBeNull();
    expect(result![0].supportingText).toBeUndefined();
    expect(result![0].callToAction).toBeUndefined();
  });

  it("rejects unparseable JSON", () => {
    expect(parseCreativeDirection("not json")).toBeNull();
  });

  it("rejects a JSON array instead of an object", () => {
    expect(parseCreativeDirection("[]")).toBeNull();
  });
});

describe("generateCreativeDirection validation", () => {
  it("rejects a missing brief", async () => {
    const result = await generateCreativeDirection("admin1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects an unknown platform", async () => {
    const result = await generateCreativeDirection("admin1", { brief: "Anything", platform: "NOT_A_PLATFORM" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});
