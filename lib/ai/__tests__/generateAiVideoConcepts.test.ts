import { describe, expect, it } from "vitest";
import { generateAiVideoConcepts, parseAiVideoConcepts } from "@/lib/ai/generateAiVideoConcepts";

const SCENE = {
  sceneNumber: 1,
  description: "A teacher introduces the new dashboard to her class.",
  suggestedVisual: "A modern classroom, natural light, teacher pointing at a tablet.",
  durationSeconds: 5,
  cameraMovement: "slow push-in",
  voiceoverText: "Meet the system built for modern classrooms.",
};

const CONCEPT = {
  title: "Modern Classroom Integration",
  creativeDirection: "A warm, documentary-style look at the product in real use.",
  hook: "What if your school ran itself?",
  storyline: "Open on the classroom, reveal the dashboard, close on a smiling teacher.",
  scenes: [SCENE],
  suggestedVoiceover: "Meet the system built for modern classrooms.",
  suggestedCaption: "Built for how schools actually run.",
  callToAction: "See it in action",
};

const VALID = { concepts: [CONCEPT, { ...CONCEPT, title: "Executive Dashboard Showcase" }, { ...CONCEPT, title: "Student-Centric Mobile Experience" }] };

describe("parseAiVideoConcepts", () => {
  it("parses a well-formed response with exactly 3 concepts", () => {
    const result = parseAiVideoConcepts(JSON.stringify(VALID), "TIKTOK");
    expect(result).not.toBeNull();
    expect(result).toHaveLength(3);
    expect(result![0].title).toBe("Modern Classroom Integration");
    expect(result![0].scenes[0].durationSeconds).toBe(5);
  });

  it("strips markdown fences", () => {
    expect(parseAiVideoConcepts("```json\n" + JSON.stringify(VALID) + "\n```", "TIKTOK")).not.toBeNull();
  });

  it("clamps an out-of-range durationSeconds to the nearest valid Luma value", () => {
    const withBadDuration = { concepts: [{ ...CONCEPT, scenes: [{ ...SCENE, durationSeconds: 7 }] }, CONCEPT, CONCEPT] };
    const result = parseAiVideoConcepts(JSON.stringify(withBadDuration), "TIKTOK");
    expect(result).not.toBeNull();
    expect(result![0].scenes[0].durationSeconds).toBe(5);

    const withLongDuration = { concepts: [{ ...CONCEPT, scenes: [{ ...SCENE, durationSeconds: 9 }] }, CONCEPT, CONCEPT] };
    const result2 = parseAiVideoConcepts(JSON.stringify(withLongDuration), "TIKTOK");
    expect(result2![0].scenes[0].durationSeconds).toBe(10);
  });

  it("rejects a response with only 2 concepts", () => {
    expect(parseAiVideoConcepts(JSON.stringify({ concepts: VALID.concepts.slice(0, 2) }), "TIKTOK")).toBeNull();
  });

  it("rejects a response with 4 concepts", () => {
    expect(parseAiVideoConcepts(JSON.stringify({ concepts: [...VALID.concepts, CONCEPT] }), "TIKTOK")).toBeNull();
  });

  it("drops a concept with zero valid scenes, failing the exactly-3 requirement", () => {
    const broken = { ...CONCEPT, scenes: [{ ...SCENE, suggestedVisual: "" }] };
    const result = parseAiVideoConcepts(JSON.stringify({ concepts: [broken, CONCEPT, CONCEPT] }), "TIKTOK");
    expect(result).toBeNull();
  });

  it("rejects unparseable JSON", () => {
    expect(parseAiVideoConcepts("not json", "TIKTOK")).toBeNull();
  });

  it("rejects a JSON array instead of an object", () => {
    expect(parseAiVideoConcepts("[]", "TIKTOK")).toBeNull();
  });
});

describe("generateAiVideoConcepts validation", () => {
  it("rejects a missing brief", async () => {
    const result = await generateAiVideoConcepts("admin1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects an unknown platform", async () => {
    const result = await generateAiVideoConcepts("admin1", { brief: "Anything", platform: "NOT_A_PLATFORM" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a non-string referenceAnalysis", async () => {
    const result = await generateAiVideoConcepts("admin1", { brief: "Anything", referenceAnalysis: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});
