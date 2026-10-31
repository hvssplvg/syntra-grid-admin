import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("LINKEDIN_")) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

/** Regression coverage for supporting TWO separate LinkedIn developer
 *  apps: the existing personal-profile app (PLATFORM_CONFIG.LINKEDIN,
 *  unchanged) and the new Company Manager app
 *  (LINKEDIN_ORGANIZATION_OAUTH_CONFIG, selected via the "LINKEDIN_ORGANIZATION"
 *  OAuthAppKey). Everything here proves the two are never conflated. */
describe("the LinkedIn Company Manager OAuth app", () => {
  beforeEach(() => {
    vi.resetModules();
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  it("is configured independently of the personal app", async () => {
    const { isPlatformConfigured } = await import("@/lib/social-media/accounts");
    const { SocialPlatform } = await import("@/app/generated/prisma/enums");

    // Personal app configured, org app not — org app must read as unconfigured.
    process.env.LINKEDIN_CLIENT_ID = "personal-id";
    process.env.LINKEDIN_CLIENT_SECRET = "personal-secret";
    process.env.LINKEDIN_REDIRECT_URI = "https://example.com/callback";
    expect(isPlatformConfigured(SocialPlatform.LINKEDIN)).toBe(true);
    expect(isPlatformConfigured("LINKEDIN_ORGANIZATION")).toBe(false);

    // Now also configure the org app — both should read as configured,
    // independently.
    process.env.LINKEDIN_ORG_CLIENT_ID = "org-id";
    process.env.LINKEDIN_ORG_CLIENT_SECRET = "org-secret";
    process.env.LINKEDIN_ORG_REDIRECT_URI = "https://example.com/callback";
    expect(isPlatformConfigured(SocialPlatform.LINKEDIN)).toBe(true);
    expect(isPlatformConfigured("LINKEDIN_ORGANIZATION")).toBe(true);
  });

  it("requiredEnvVarsFor reports the org app's own env var names, not the personal app's", async () => {
    const { requiredEnvVarsFor } = await import("@/lib/social-media/accounts");
    expect(requiredEnvVarsFor("LINKEDIN_ORGANIZATION")).toEqual([
      "LINKEDIN_ORG_CLIENT_ID",
      "LINKEDIN_ORG_CLIENT_SECRET",
      "LINKEDIN_ORG_REDIRECT_URI",
    ]);
  });

  it("createAuthorisationUrl uses the org app's client_id and only the three organisation scopes — no openid/profile", async () => {
    process.env.LINKEDIN_ORG_CLIENT_ID = "org-client-id";
    process.env.LINKEDIN_ORG_CLIENT_SECRET = "org-client-secret";
    process.env.LINKEDIN_ORG_REDIRECT_URI = "https://example.com/callback";
    // A different value, proving the two apps are never conflated.
    process.env.LINKEDIN_CLIENT_ID = "personal-client-id";
    process.env.LINKEDIN_CLIENT_SECRET = "personal-client-secret";
    process.env.LINKEDIN_REDIRECT_URI = "https://example.com/callback";

    const { createAuthorisationUrl } = await import("@/lib/social-media/accounts");
    const url = new URL(createAuthorisationUrl("LINKEDIN_ORGANIZATION", "state123"));

    expect(url.searchParams.get("client_id")).toBe("org-client-id");
    const scopes = (url.searchParams.get("scope") ?? "").split(" ");
    expect(scopes).toEqual(expect.arrayContaining(["w_organization_social", "r_organization_social", "rw_organization_admin"]));
    expect(scopes).not.toContain("openid");
    expect(scopes).not.toContain("profile");
  });

  it("getValidSocialAccessToken refreshes an ORGANIZATION account's own token using the org app's client credentials, not the personal app's", async () => {
    process.env.LINKEDIN_CLIENT_ID = "personal-client-id";
    process.env.LINKEDIN_CLIENT_SECRET = "personal-client-secret";
    process.env.LINKEDIN_REDIRECT_URI = "https://example.com/callback";
    process.env.LINKEDIN_ORG_CLIENT_ID = "org-client-id";
    process.env.LINKEDIN_ORG_CLIENT_SECRET = "org-client-secret";
    process.env.LINKEDIN_ORG_REDIRECT_URI = "https://example.com/callback";

    const account = {
      id: "org-account",
      platform: "LINKEDIN",
      accountType: "ORGANIZATION",
      status: "CONNECTED",
      sharesAuthWithId: null,
      encryptedAccessToken: "encrypted:old-org-token",
      encryptedRefreshToken: "encrypted:org-refresh-token",
      tokenExpiresAt: new Date(Date.now() - 1000),
      scopes: "w_organization_social r_organization_social rw_organization_admin",
    };

    const findUnique = vi.fn().mockResolvedValue(account);
    const update = vi.fn().mockResolvedValue(account);
    vi.doMock("@/lib/prisma", () => ({ prisma: { socialAccount: { findUnique, update } } }));
    vi.doMock("@/lib/encryption", () => ({
      encryptSecret: (value: string) => `encrypted:${value}`,
      decryptSecret: (value: string) => value.replace(/^encrypted:/, ""),
    }));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-org-token", expires_in: 3600 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getValidSocialAccessToken } = await import("@/lib/social-media/accounts");
    const token = await getValidSocialAccessToken("org-account");

    expect(token).toBe("new-org-token");
    const [, init] = fetchMock.mock.calls[0];
    const body = new URLSearchParams(init.body as string);
    expect(body.get("client_id")).toBe("org-client-id");

    vi.unstubAllGlobals();
  });
});
