import { describe, expect, it } from "vitest";
import { analyzeReferenceImage } from "@/lib/ai/analyzeReferenceImage";

describe("analyzeReferenceImage validation", () => {
  it("rejects a missing body", async () => {
    const result = await analyzeReferenceImage("admin1", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a missing imageUrl", async () => {
    const result = await analyzeReferenceImage("admin1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a non-https imageUrl", async () => {
    const result = await analyzeReferenceImage("admin1", { imageUrl: "http://example.com/x.png" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a malformed imageUrl", async () => {
    const result = await analyzeReferenceImage("admin1", { imageUrl: "not a url" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});
