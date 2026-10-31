import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_CLOUD = process.env.CLOUDINARY_CLOUD_NAME;

// isOwnSocialMediaDeliveryUrl is the real fix for a pre-existing
// security gap: the AI video job-creation route used to accept any
// client-supplied "startFrameUrl" as long as it started with
// "https://". This checks the URL actually matches our own
// Cloudinary cloud + the Social Media library's own upload folder,
// mirroring the existing isOwnWallpaperUrl pattern.
describe("isOwnSocialMediaDeliveryUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  });

  afterEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = ORIGINAL_CLOUD;
  });

  it("accepts our own Social Media library delivery URL", async () => {
    const { isOwnSocialMediaDeliveryUrl } = await import("@/lib/cloudinary-server");
    expect(
      isOwnSocialMediaDeliveryUrl(
        "https://res.cloudinary.com/test-cloud/image/upload/v123456/syntragrid/social-media/abc123.png",
      ),
    ).toBe(true);
  });

  it("rejects a different cloud name", async () => {
    const { isOwnSocialMediaDeliveryUrl } = await import("@/lib/cloudinary-server");
    expect(
      isOwnSocialMediaDeliveryUrl(
        "https://res.cloudinary.com/attacker-cloud/image/upload/v123456/syntragrid/social-media/abc123.png",
      ),
    ).toBe(false);
  });

  it("rejects a different folder on our own cloud", async () => {
    const { isOwnSocialMediaDeliveryUrl } = await import("@/lib/cloudinary-server");
    expect(
      isOwnSocialMediaDeliveryUrl(
        "https://res.cloudinary.com/test-cloud/image/upload/v123456/some/other/folder/abc123.png",
      ),
    ).toBe(false);
  });

  it("rejects an arbitrary external URL entirely", async () => {
    const { isOwnSocialMediaDeliveryUrl } = await import("@/lib/cloudinary-server");
    expect(isOwnSocialMediaDeliveryUrl("https://attacker.example.com/evil.png")).toBe(false);
  });

  it("rejects a video delivery URL (wrong resource type) even in the right folder", async () => {
    const { isOwnSocialMediaDeliveryUrl } = await import("@/lib/cloudinary-server");
    expect(
      isOwnSocialMediaDeliveryUrl(
        "https://res.cloudinary.com/test-cloud/video/upload/v123456/syntragrid/social-media/abc123.mp4",
      ),
    ).toBe(false);
  });
});
