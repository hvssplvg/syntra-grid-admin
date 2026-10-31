import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_LINKEDIN_KEY = process.env.LINKEDIN_CLIENT_ID;

describe("hasLinkedInScopes", () => {
  it("returns true when every required scope is present", async () => {
    const { hasLinkedInScopes } = await import("@/lib/social-media/accounts");
    expect(hasLinkedInScopes("openid profile w_member_social rw_organization_admin", ["rw_organization_admin"])).toBe(true);
  });

  it("returns false when a required scope is missing", async () => {
    const { hasLinkedInScopes } = await import("@/lib/social-media/accounts");
    expect(hasLinkedInScopes("openid profile w_member_social", ["rw_organization_admin"])).toBe(false);
  });

  it("returns false for a null scopes string — never assumes a token has a scope it was never granted", async () => {
    const { hasLinkedInScopes } = await import("@/lib/social-media/accounts");
    expect(hasLinkedInScopes(null, ["w_organization_social"])).toBe(false);
  });

  it("requires every scope in the list, not just one", async () => {
    const { hasLinkedInScopes } = await import("@/lib/social-media/accounts");
    expect(hasLinkedInScopes("w_organization_social", ["w_organization_social", "rw_organization_admin"])).toBe(false);
  });

  it("handles a comma-separated scope string — confirmed against this app's actual stored LinkedIn token data, not the space-separated OAuth2-spec default", async () => {
    const { hasLinkedInScopes } = await import("@/lib/social-media/accounts");
    expect(hasLinkedInScopes("openid,profile,w_member_social", ["w_member_social"])).toBe(true);
    expect(hasLinkedInScopes("openid,profile,w_member_social", ["rw_organization_admin"])).toBe(false);
  });
});

describe("fetchLinkedInOrganizations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reads organizationTarget when present (current docs example)", async () => {
    const { fetchLinkedInOrganizations } = await import("@/lib/social-media/accounts");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elements: [{ role: "ADMINISTRATOR", organizationTarget: "urn:li:organization:135933943", state: "APPROVED" }], paging: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchLinkedInOrganizations("test-token");
    expect(result).toEqual([{ id: "135933943", urn: "urn:li:organization:135933943" }]);
  });

  it("falls back to the older organization field name (LinkedIn's own docs are inconsistent between examples)", async () => {
    const { fetchLinkedInOrganizations } = await import("@/lib/social-media/accounts");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ elements: [{ role: "ADMINISTRATOR", organization: "urn:li:organization:999", state: "APPROVED" }], paging: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchLinkedInOrganizations("test-token");
    expect(result).toEqual([{ id: "999", urn: "urn:li:organization:999" }]);
  });

  it("follows pagination via paging.links[rel=next]", async () => {
    const { fetchLinkedInOrganizations } = await import("@/lib/social-media/accounts");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          elements: [{ organizationTarget: "urn:li:organization:1" }],
          paging: { links: [{ rel: "next", href: "/rest/organizationAcls?count=50&start=50" }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ elements: [{ organizationTarget: "urn:li:organization:2" }], paging: {} }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchLinkedInOrganizations("test-token");
    expect(result).toEqual([
      { id: "1", urn: "urn:li:organization:1" },
      { id: "2", urn: "urn:li:organization:2" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws LinkedInOrganizationApiError on a 403 (missing rw_organization_admin)", async () => {
    const { fetchLinkedInOrganizations, LinkedInOrganizationApiError } = await import("@/lib/social-media/accounts");
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => JSON.stringify({ message: "Not enough permissions" }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLinkedInOrganizations("test-token")).rejects.toBeInstanceOf(LinkedInOrganizationApiError);
  });

  it("sends the required LinkedIn-Version and X-Restli-Protocol-Version headers", async () => {
    const { fetchLinkedInOrganizations } = await import("@/lib/social-media/accounts");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [], paging: {} }) });
    vi.stubGlobal("fetch", fetchMock);

    await fetchLinkedInOrganizations("test-token");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED");
    expect(init.headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
    expect(init.headers["LinkedIn-Version"]).toMatch(/^\d{6}$/);
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });
});

describe("getValidSocialAccessToken — sharesAuthWithId redirect", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.LINKEDIN_CLIENT_ID = "test-client-id";
  });

  afterEach(() => {
    process.env.LINKEDIN_CLIENT_ID = ORIGINAL_LINKEDIN_KEY;
  });

  it("resolves an organisation account's token from its linked personal account", async () => {
    const findUnique = vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => {
      if (id === "org-account") {
        return Promise.resolve({
          id: "org-account",
          status: "CONNECTED",
          sharesAuthWithId: "personal-account",
          encryptedAccessToken: null,
          platform: "LINKEDIN",
        });
      }
      if (id === "personal-account") {
        return Promise.resolve({
          id: "personal-account",
          status: "CONNECTED",
          sharesAuthWithId: null,
          encryptedAccessToken: "encrypted:personal-token",
          tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
          platform: "LINKEDIN",
        });
      }
      return Promise.resolve(null);
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: { socialAccount: { findUnique } } }));
    vi.doMock("@/lib/encryption", () => ({
      encryptSecret: (value: string) => `encrypted:${value}`,
      decryptSecret: (value: string) => value.replace(/^encrypted:/, ""),
    }));

    const { getValidSocialAccessToken } = await import("@/lib/social-media/accounts");
    const token = await getValidSocialAccessToken("org-account");

    expect(token).toBe("personal-token");
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "org-account" } });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "personal-account" } });
  });

  it("throws SocialAccountNotConnectedError when the shared-auth source itself isn't connected", async () => {
    const findUnique = vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => {
      if (id === "org-account") {
        return Promise.resolve({ id: "org-account", status: "CONNECTED", sharesAuthWithId: "personal-account", encryptedAccessToken: null, platform: "LINKEDIN" });
      }
      if (id === "personal-account") {
        return Promise.resolve({ id: "personal-account", status: "DISCONNECTED", sharesAuthWithId: null, encryptedAccessToken: null, platform: "LINKEDIN" });
      }
      return Promise.resolve(null);
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: { socialAccount: { findUnique } } }));
    vi.doMock("@/lib/encryption", () => ({ encryptSecret: (v: string) => v, decryptSecret: (v: string) => v }));

    const { getValidSocialAccessToken, SocialAccountNotConnectedError } = await import("@/lib/social-media/accounts");
    await expect(getValidSocialAccessToken("org-account")).rejects.toBeInstanceOf(SocialAccountNotConnectedError);
  });
});
