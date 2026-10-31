import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

function requestWithCookies(cookies: Record<string, string>, query: Record<string, string> = { code: "auth-code", state: "state-abc" }) {
  const url = new URL("http://localhost:3000/api/admin/social-media/accounts/callback");
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const cookieHeader = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
  return new NextRequest(url, { headers: { cookie: cookieHeader } });
}

const BASE_COOKIES = {
  social_oauth_state: "state-abc",
  social_oauth_admin: "admin-1",
  social_oauth_platform: "LINKEDIN",
};

describe("GET /accounts/callback — LinkedIn Company Manager (organization) OAuth variant", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never calls fetchAccountProfile for the org app (no openid/profile scope) and sets the pending cookie on success, without touching the database", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "admin-1", active: true });
    const upsert = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { adminUser: { findUnique }, socialAccount: { upsert } } }));
    vi.doMock("@/lib/encryption", () => ({ encryptSecret: (value: string) => `encrypted:${value}` }));

    const fetchAccountProfile = vi.fn();
    vi.doMock("@/lib/social-media/accounts", async () => {
      const actual = await vi.importActual<typeof import("@/lib/social-media/accounts")>("@/lib/social-media/accounts");
      return {
        ...actual,
        exchangeAuthorisationCode: vi.fn().mockResolvedValue({
          access_token: "org-app-token",
          scope: "w_organization_social r_organization_social rw_organization_admin",
        }),
        fetchAccountProfile,
        fetchLinkedInOrganizations: vi.fn().mockResolvedValue([{ id: "135933943", urn: "urn:li:organization:135933943" }]),
        fetchLinkedInOrganizationDetails: vi.fn().mockResolvedValue({ name: "Syntra Grid" }),
      };
    });

    const { GET } = await import("@/app/api/admin/social-media/accounts/callback/route");
    const request = requestWithCookies({ ...BASE_COOKIES, social_oauth_linkedin_app: "organization" });
    const response = await GET(request);

    expect(fetchAccountProfile).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();

    const location = response.headers.get("location") ?? "";
    expect(new URL(location).searchParams.get("social")).toBe("select_organization");

    const pendingCookie = response.cookies.get("social_oauth_org_pending")?.value;
    expect(pendingCookie).toBeTruthy();
    const pending = JSON.parse(decodeURIComponent(pendingCookie!));
    expect(pending.organizations).toEqual([{ id: "135933943", urn: "urn:li:organization:135933943", name: "Syntra Grid" }]);
    expect(pending.encryptedAccessToken).toBe("encrypted:org-app-token");
  });

  it("redirects with linkedin_org_scope_missing and never calls LinkedIn's discovery endpoint when rw_organization_admin wasn't granted", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "admin-1", active: true });
    vi.doMock("@/lib/prisma", () => ({ prisma: { adminUser: { findUnique }, socialAccount: { upsert: vi.fn() } } }));
    vi.doMock("@/lib/encryption", () => ({ encryptSecret: (value: string) => `encrypted:${value}` }));

    const fetchLinkedInOrganizations = vi.fn();
    vi.doMock("@/lib/social-media/accounts", async () => {
      const actual = await vi.importActual<typeof import("@/lib/social-media/accounts")>("@/lib/social-media/accounts");
      return {
        ...actual,
        exchangeAuthorisationCode: vi.fn().mockResolvedValue({ access_token: "org-app-token", scope: "w_organization_social" }),
        fetchLinkedInOrganizations,
      };
    });

    const { GET } = await import("@/app/api/admin/social-media/accounts/callback/route");
    const request = requestWithCookies({ ...BASE_COOKIES, social_oauth_linkedin_app: "organization" });
    const response = await GET(request);

    expect(fetchLinkedInOrganizations).not.toHaveBeenCalled();
    const location = response.headers.get("location") ?? "";
    expect(new URL(location).searchParams.get("social")).toBe("linkedin_org_scope_missing");
    expect(response.cookies.get("social_oauth_org_pending")?.value).toBeFalsy();
  });

  it("a plain LinkedIn personal connection (no app-variant cookie) still calls fetchAccountProfile and upserts as before — unaffected", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "admin-1", active: true });
    const upsert = vi.fn().mockResolvedValue({});
    vi.doMock("@/lib/prisma", () => ({ prisma: { adminUser: { findUnique }, socialAccount: { upsert } } }));
    vi.doMock("@/lib/encryption", () => ({ encryptSecret: (value: string) => `encrypted:${value}` }));

    const fetchAccountProfile = vi.fn().mockResolvedValue({
      platformAccountId: "member-sub-123",
      accountName: "Jane Doe",
      username: null,
      profileImageUrl: null,
    });
    vi.doMock("@/lib/social-media/accounts", async () => {
      const actual = await vi.importActual<typeof import("@/lib/social-media/accounts")>("@/lib/social-media/accounts");
      return {
        ...actual,
        exchangeAuthorisationCode: vi.fn().mockResolvedValue({ access_token: "personal-token", scope: "openid profile w_member_social" }),
        fetchAccountProfile,
      };
    });

    const { GET } = await import("@/app/api/admin/social-media/accounts/callback/route");
    const request = requestWithCookies(BASE_COOKIES);
    const response = await GET(request);

    expect(fetchAccountProfile).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    const location = response.headers.get("location") ?? "";
    expect(new URL(location).searchParams.get("social")).toBe("connected");
  });
});
