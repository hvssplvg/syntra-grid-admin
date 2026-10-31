import { describe, expect, it } from "vitest";
import { generateGraphicImage } from "@/lib/ai/generateGraphicImage";

describe("generateGraphicImage referenceImageUrl validation", () => {
  it("rejects a non-https referenceImageUrl", async () => {
    const result = await generateGraphicImage("admin1", { brief: "A promo", size: "1024x1024", quality: "medium", referenceImageUrl: "http://example.com/x.png" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a malformed referenceImageUrl", async () => {
    const result = await generateGraphicImage("admin1", { brief: "A promo", size: "1024x1024", quality: "medium", referenceImageUrl: "not a url" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});

describe("generateGraphicImage promptOverride validation", () => {
  it("rejects an empty promptOverride", async () => {
    const result = await generateGraphicImage("admin1", { brief: "A promo", size: "1024x1024", quality: "medium", promptOverride: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects a non-string promptOverride", async () => {
    const result = await generateGraphicImage("admin1", { brief: "A promo", size: "1024x1024", quality: "medium", promptOverride: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});
