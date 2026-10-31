import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const ORIGINAL_LUMA_KEY = process.env.LUMA_API_KEY;

// Regression tests for a real, pre-existing security gap closed while
// wiring up image-to-video: the job-creation route used to validate a
// client-supplied startFrameUrl with nothing stronger than
// `startsWith("https://")` — any arbitrary external HTTPS URL would
// have been accepted and handed to Luma as if it were our own asset.
// resolveTrustedStartFrame (lib/ai/aiVideoJobs.ts) is the real fix:
// never trusts a raw URL, only a verified SocialMediaAsset lookup or a
// URL matching our own Cloudinary delivery shape.
describe("resolveTrustedStartFrame", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.LUMA_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = ORIGINAL_CLOUD;
    process.env.LUMA_API_KEY = ORIGINAL_LUMA_KEY;
  });

  // Every test re-registers its own @/lib/prisma mock explicitly (even
  // when the code path under test never touches the database) rather
  // than relying on vitest.setup.ts's global stub: vi.doMock
  // registrations leak across tests within a file once any test in the
  // file calls it, and vi.doUnmock reverts to the *real* lib/prisma.ts
  // (which throws without DATABASE_URL) rather than restoring the
  // global stub. Explicit beats implicit here.
  it("returns no source when neither sourceImageAssetId nor sourceImageUrl is given (plain text-to-video)", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: {} }));
    const { resolveTrustedStartFrame } = await import("@/lib/ai/aiVideoJobs");
    expect(await resolveTrustedStartFrame({})).toEqual({ ok: true, source: null });
  });

  it("accepts a sourceImageUrl that matches our own Cloudinary delivery URL shape", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: {} }));
    const { resolveTrustedStartFrame } = await import("@/lib/ai/aiVideoJobs");
    const url = "https://res.cloudinary.com/test-cloud/image/upload/v123456/syntragrid/social-media/abc123.png";
    expect(await resolveTrustedStartFrame({ sourceImageUrl: url })).toEqual({ ok: true, source: { url, assetId: null } });
  });

  it("rejects an arbitrary external URL — the actual security fix", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: {} }));
    const { resolveTrustedStartFrame } = await import("@/lib/ai/aiVideoJobs");
    const result = await resolveTrustedStartFrame({ sourceImageUrl: "https://attacker.example.com/evil.png" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/isn't one we can use/i);
  });

  it("rejects a URL on our own cloud but outside the Social Media library's own folder", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: {} }));
    const { resolveTrustedStartFrame } = await import("@/lib/ai/aiVideoJobs");
    const result = await resolveTrustedStartFrame({ sourceImageUrl: "https://res.cloudinary.com/test-cloud/image/upload/v1/some/other/folder/x.png" });
    expect(result.ok).toBe(false);
  });

  it("resolves a valid sourceImageAssetId through a real SocialMediaAsset lookup", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        socialMediaAsset: {
          findUnique: vi.fn().mockResolvedValue({ id: "asset-1", url: "https://res.cloudinary.com/test-cloud/image/upload/v1/syntragrid/social-media/x.png", type: "IMAGE" }),
        },
      },
    }));
    const { resolveTrustedStartFrame } = await import("@/lib/ai/aiVideoJobs");
    const result = await resolveTrustedStartFrame({ sourceImageAssetId: "asset-1" });
    expect(result).toEqual({ ok: true, source: { url: "https://res.cloudinary.com/test-cloud/image/upload/v1/syntragrid/social-media/x.png", assetId: "asset-1" } });
  });

  it("rejects a sourceImageAssetId that doesn't exist", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: { socialMediaAsset: { findUnique: vi.fn().mockResolvedValue(null) } } }));
    const { resolveTrustedStartFrame } = await import("@/lib/ai/aiVideoJobs");
    const result = await resolveTrustedStartFrame({ sourceImageAssetId: "missing" });
    expect(result.ok).toBe(false);
  });

  it("rejects a sourceImageAssetId that resolves to a VIDEO asset, not an image", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: { socialMediaAsset: { findUnique: vi.fn().mockResolvedValue({ id: "asset-2", url: "https://res.cloudinary.com/test-cloud/video/upload/v1/syntragrid/social-media/x.mp4", type: "VIDEO" }) } },
    }));
    const { resolveTrustedStartFrame } = await import("@/lib/ai/aiVideoJobs");
    const result = await resolveTrustedStartFrame({ sourceImageAssetId: "asset-2" });
    expect(result.ok).toBe(false);
  });
});

describe("createAndSubmitVideoJob — image-to-video duration enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.LUMA_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = ORIGINAL_CLOUD;
    process.env.LUMA_API_KEY = ORIGINAL_LUMA_KEY;
  });

  // Luma's own, verified constraint: start_frame/end_frame are
  // rejected with duration "10s" — image-to-video is 5s-only. This
  // rejection happens before any database call, so it's testable
  // without mocking Prisma (the global stub in vitest.setup.ts is
  // never actually invoked on this path).
  it("rejects a 10-second request that also supplies a source image", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: {} }));
    const { createAndSubmitVideoJob } = await import("@/lib/ai/aiVideoJobs");
    const result = await createAndSubmitVideoJob({
      adminUserId: "admin-1",
      prompt: "Slow push-in",
      aspectRatio: "9:16",
      resolution: "720p",
      durationSeconds: 10,
      sourceImageUrl: "https://res.cloudinary.com/test-cloud/image/upload/v1/syntragrid/social-media/x.png",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/only available at 5 seconds/i);
    }
  });

  it("rejects an untrusted source image URL before ever reaching the database", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: {} }));
    const { createAndSubmitVideoJob } = await import("@/lib/ai/aiVideoJobs");
    const result = await createAndSubmitVideoJob({
      adminUserId: "admin-1",
      prompt: "Slow push-in",
      aspectRatio: "9:16",
      resolution: "720p",
      durationSeconds: 5,
      sourceImageUrl: "https://attacker.example.com/evil.png",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });
});
