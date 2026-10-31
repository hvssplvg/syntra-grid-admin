import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_LINKEDIN_KEY = process.env.LINKEDIN_CLIENT_ID;
const ORIGINAL_LINKEDIN_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const ORIGINAL_LINKEDIN_REDIRECT = process.env.LINKEDIN_REDIRECT_URI;
const ORIGINAL_LINKEDIN_ORG_KEY = process.env.LINKEDIN_ORG_CLIENT_ID;
const ORIGINAL_LINKEDIN_ORG_SECRET = process.env.LINKEDIN_ORG_CLIENT_SECRET;
const ORIGINAL_LINKEDIN_ORG_REDIRECT = process.env.LINKEDIN_ORG_REDIRECT_URI;

const PERSONAL_ACCOUNT = {
  id: "personal-account",
  platform: "LINKEDIN",
  accountType: "PERSONAL",
  platformAccountId: "member-sub-123",
  status: "CONNECTED",
  sharesAuthWithId: null,
  scopes: "openid profile w_member_social w_organization_social r_organization_social rw_organization_admin",
};

// The normal case: a company page holding ITS OWN token from the
// separate Company Manager app (sharesAuthWithId null).
const ORG_ACCOUNT_PRIMARY = {
  id: "org-account",
  platform: "LINKEDIN",
  accountType: "ORGANIZATION",
  platformAccountId: "135933943",
  status: "CONNECTED",
  sharesAuthWithId: null,
  scopes: "w_organization_social r_organization_social rw_organization_admin",
};

// The shared-grant case: a second page connected under the same
// Company Manager authorisation, borrowing the first page's row.
const ORG_ACCOUNT_SHARED = {
  id: "org-account",
  platform: "LINKEDIN",
  accountType: "ORGANIZATION",
  platformAccountId: "135933943",
  status: "CONNECTED",
  sharesAuthWithId: "personal-account",
  scopes: null,
};

const PARAMS_BASE = { caption: "Hello from Syntra Grid", assets: [], placement: "FEED" as const, metadata: null };

function mockSuccessfulLinkedInFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ "x-restli-id": "urn:li:share:abc123" }),
    text: async () => "",
  });
}

describe("LinkedInAdapter.publish — author URN selection", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.LINKEDIN_CLIENT_ID = "test-client-id";
    process.env.LINKEDIN_CLIENT_SECRET = "test-client-secret";
    process.env.LINKEDIN_REDIRECT_URI = "https://example.com/callback";
    // The Company Manager app — separate credentials, checked whenever
    // the account being published is accountType ORGANIZATION.
    process.env.LINKEDIN_ORG_CLIENT_ID = "test-org-client-id";
    process.env.LINKEDIN_ORG_CLIENT_SECRET = "test-org-client-secret";
    process.env.LINKEDIN_ORG_REDIRECT_URI = "https://example.com/callback";
  });

  afterEach(() => {
    process.env.LINKEDIN_CLIENT_ID = ORIGINAL_LINKEDIN_KEY;
    process.env.LINKEDIN_CLIENT_SECRET = ORIGINAL_LINKEDIN_SECRET;
    process.env.LINKEDIN_REDIRECT_URI = ORIGINAL_LINKEDIN_REDIRECT;
    process.env.LINKEDIN_ORG_CLIENT_ID = ORIGINAL_LINKEDIN_ORG_KEY;
    process.env.LINKEDIN_ORG_CLIENT_SECRET = ORIGINAL_LINKEDIN_ORG_SECRET;
    process.env.LINKEDIN_ORG_REDIRECT_URI = ORIGINAL_LINKEDIN_ORG_REDIRECT;
    vi.unstubAllGlobals();
  });

  it("publishes a personal-profile post with author urn:li:person:{member id} — existing behaviour, unchanged", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: { socialAccount: { findUnique: vi.fn().mockResolvedValue(PERSONAL_ACCOUNT) } },
    }));
    vi.doMock("@/lib/social-media/accounts", async () => {
      const actual = await vi.importActual<typeof import("@/lib/social-media/accounts")>("@/lib/social-media/accounts");
      return { ...actual, getValidSocialAccessToken: vi.fn().mockResolvedValue("member-token") };
    });

    const fetchMock = mockSuccessfulLinkedInFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { getPublishAdapter } = await import("@/lib/social-media/publishing");
    const { SocialPlatform } = await import("@/app/generated/prisma/enums");
    const result = await getPublishAdapter(SocialPlatform.LINKEDIN).publish({ ...PARAMS_BASE, accountId: "personal-account", platform: SocialPlatform.LINKEDIN });

    expect(result.ok).toBe(true);
    const postCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/rest/posts"));
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall![1].body);
    expect(body.author).toBe("urn:li:person:member-sub-123");
  });

  it("publishes an organisation post with author urn:li:organization:{org id}, reading the row's OWN token/scopes — the primary-holder case this task fixes", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        socialAccount: { findUnique: vi.fn().mockResolvedValue(ORG_ACCOUNT_PRIMARY) },
      },
    }));
    vi.doMock("@/lib/social-media/accounts", async () => {
      const actual = await vi.importActual<typeof import("@/lib/social-media/accounts")>("@/lib/social-media/accounts");
      return { ...actual, getValidSocialAccessToken: vi.fn().mockResolvedValue("org-app-token") };
    });

    const fetchMock = mockSuccessfulLinkedInFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { getPublishAdapter } = await import("@/lib/social-media/publishing");
    const { SocialPlatform } = await import("@/app/generated/prisma/enums");
    const result = await getPublishAdapter(SocialPlatform.LINKEDIN).publish({ ...PARAMS_BASE, accountId: "org-account", platform: SocialPlatform.LINKEDIN });

    expect(result.ok).toBe(true);
    const postCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/rest/posts"));
    const body = JSON.parse(postCall![1].body);
    expect(body.author).toBe("urn:li:organization:135933943");
  });

  it("publishes an organisation post sharing another row's grant (sharesAuthWithId set) with author urn:li:organization:{org id}", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        socialAccount: {
          findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) =>
            Promise.resolve(id === "org-account" ? ORG_ACCOUNT_SHARED : PERSONAL_ACCOUNT),
          ),
        },
      },
    }));
    vi.doMock("@/lib/social-media/accounts", async () => {
      const actual = await vi.importActual<typeof import("@/lib/social-media/accounts")>("@/lib/social-media/accounts");
      return { ...actual, getValidSocialAccessToken: vi.fn().mockResolvedValue("member-token") };
    });

    const fetchMock = mockSuccessfulLinkedInFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { getPublishAdapter } = await import("@/lib/social-media/publishing");
    const { SocialPlatform } = await import("@/app/generated/prisma/enums");
    const result = await getPublishAdapter(SocialPlatform.LINKEDIN).publish({ ...PARAMS_BASE, accountId: "org-account", platform: SocialPlatform.LINKEDIN });

    expect(result.ok).toBe(true);
    const postCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/rest/posts"));
    const body = JSON.parse(postCall![1].body);
    expect(body.author).toBe("urn:li:organization:135933943");
  });

  it("refuses to publish as an organisation when the row it depends on is disconnected — never falls back to the personal identity", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        socialAccount: {
          findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) =>
            Promise.resolve(id === "org-account" ? ORG_ACCOUNT_SHARED : { ...PERSONAL_ACCOUNT, status: "DISCONNECTED" }),
          ),
        },
      },
    }));
    vi.doMock("@/lib/social-media/accounts", async () => {
      const actual = await vi.importActual<typeof import("@/lib/social-media/accounts")>("@/lib/social-media/accounts");
      return { ...actual, getValidSocialAccessToken: vi.fn().mockResolvedValue("member-token") };
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getPublishAdapter } = await import("@/lib/social-media/publishing");
    const { SocialPlatform } = await import("@/app/generated/prisma/enums");
    const result = await getPublishAdapter(SocialPlatform.LINKEDIN).publish({ ...PARAMS_BASE, accountId: "org-account", platform: SocialPlatform.LINKEDIN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/needs reconnecting/i);
    // The real proof this never silently falls back to personal
    // publishing: no LinkedIn API call was ever attempted.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses to publish as an organisation when the row it depends on lacks w_organization_social", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        socialAccount: {
          findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) =>
            Promise.resolve(id === "org-account" ? ORG_ACCOUNT_SHARED : { ...PERSONAL_ACCOUNT, scopes: "openid profile w_member_social" }),
          ),
        },
      },
    }));
    vi.doMock("@/lib/social-media/accounts", async () => {
      const actual = await vi.importActual<typeof import("@/lib/social-media/accounts")>("@/lib/social-media/accounts");
      return { ...actual, getValidSocialAccessToken: vi.fn().mockResolvedValue("member-token") };
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getPublishAdapter } = await import("@/lib/social-media/publishing");
    const { SocialPlatform } = await import("@/app/generated/prisma/enums");
    const result = await getPublishAdapter(SocialPlatform.LINKEDIN).publish({ ...PARAMS_BASE, accountId: "org-account", platform: SocialPlatform.LINKEDIN });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/doesn't have permission/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
