import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const ORIGINAL_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const ORIGINAL_REDIRECT = process.env.LINKEDIN_REDIRECT_URI;
const ORIGINAL_REDIRECT_DEV = process.env.LINKEDIN_REDIRECT_URI_DEV;

/** Regression coverage for the real LinkedIn OAuth failure root-caused in
 *  this task: .env.local's LINKEDIN_REDIRECT_URI held the production URL
 *  (the only one ever registered with LinkedIn), so running locally sent
 *  an authorize request whose redirect_uri pointed at a route that was
 *  never deployed there — LinkedIn rejected it before showing any
 *  consent screen. The fix is an optional *_DEV override, read only
 *  outside NODE_ENV=production. */
describe("createAuthorisationUrl — local-dev redirect URI override", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.LINKEDIN_CLIENT_ID = "test-client-id";
    process.env.LINKEDIN_CLIENT_SECRET = "test-client-secret";
    process.env.LINKEDIN_REDIRECT_URI = "https://admin.syntragrid.com/api/admin/social-media/accounts/callback";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env.LINKEDIN_CLIENT_ID = ORIGINAL_CLIENT_ID;
    process.env.LINKEDIN_CLIENT_SECRET = ORIGINAL_CLIENT_SECRET;
    process.env.LINKEDIN_REDIRECT_URI = ORIGINAL_REDIRECT;
    process.env.LINKEDIN_REDIRECT_URI_DEV = ORIGINAL_REDIRECT_DEV;
  });

  it("uses the production redirect_uri when no _DEV override is set, even outside production — unchanged default behaviour", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.LINKEDIN_REDIRECT_URI_DEV;
    const { createAuthorisationUrl } = await import("@/lib/social-media/accounts");
    const { SocialPlatform } = await import("@/app/generated/prisma/enums");
    const url = new URL(createAuthorisationUrl(SocialPlatform.LINKEDIN, "state123"));
    expect(url.searchParams.get("redirect_uri")).toBe("https://admin.syntragrid.com/api/admin/social-media/accounts/callback");
  });

  it("uses the _DEV override when set and NODE_ENV is not production — the actual fix", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.LINKEDIN_REDIRECT_URI_DEV = "http://localhost:3000/api/admin/social-media/accounts/callback";
    const { createAuthorisationUrl } = await import("@/lib/social-media/accounts");
    const { SocialPlatform } = await import("@/app/generated/prisma/enums");
    const url = new URL(createAuthorisationUrl(SocialPlatform.LINKEDIN, "state123"));
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/admin/social-media/accounts/callback");
  });

  it("ignores the _DEV override in production — the deployed app is never affected", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.LINKEDIN_REDIRECT_URI_DEV = "http://localhost:3000/api/admin/social-media/accounts/callback";
    const { createAuthorisationUrl } = await import("@/lib/social-media/accounts");
    const { SocialPlatform } = await import("@/app/generated/prisma/enums");
    const url = new URL(createAuthorisationUrl(SocialPlatform.LINKEDIN, "state123"));
    expect(url.searchParams.get("redirect_uri")).toBe("https://admin.syntragrid.com/api/admin/social-media/accounts/callback");
  });

  it("includes every configured scope, dropping none — the org scopes are never silently removed", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { createAuthorisationUrl } = await import("@/lib/social-media/accounts");
    const { SocialPlatform } = await import("@/app/generated/prisma/enums");
    const url = new URL(createAuthorisationUrl(SocialPlatform.LINKEDIN, "state123"));
    const scopes = (url.searchParams.get("scope") ?? "").split(" ");
    expect(scopes).toEqual(
      expect.arrayContaining(["openid", "profile", "w_member_social", "w_organization_social", "r_organization_social", "rw_organization_admin"]),
    );
  });

  it("isPlatformConfigured is still true with only the production redirect URI set (no _DEV override required)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.LINKEDIN_REDIRECT_URI_DEV;
    const { isPlatformConfigured } = await import("@/lib/social-media/accounts");
    const { SocialPlatform } = await import("@/app/generated/prisma/enums");
    expect(isPlatformConfigured(SocialPlatform.LINKEDIN)).toBe(true);
  });
});
