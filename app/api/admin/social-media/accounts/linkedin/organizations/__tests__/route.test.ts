import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/current-admin";

const PENDING = {
  encryptedAccessToken: "encrypted:org-app-token",
  encryptedRefreshToken: null,
  tokenExpiresAt: null,
  scopes: "w_organization_social r_organization_social rw_organization_admin",
  organizations: [{ id: "135933943", urn: "urn:li:organization:135933943", name: "Syntra Grid" }],
};

function postRequest(body: unknown, cookieValue?: string) {
  return {
    json: async () => body,
    cookies: { get: (name: string) => (name === "social_oauth_org_pending" && cookieValue ? { value: cookieValue } : undefined) },
  } as never;
}

describe("POST /accounts/linkedin/organizations — reads the pending-connection cookie, never a client-supplied org", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue({ admin: { id: "admin-1" } } as never);
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("rejects an organizationId that isn't in the pending cookie's discovery result, even though the cookie is otherwise valid", async () => {
    const upsert = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { socialAccount: { upsert } } }));

    const { POST } = await import("@/app/api/admin/social-media/accounts/linkedin/organizations/route");
    const response = await POST(postRequest({ organizationId: "999999999" }, JSON.stringify(PENDING)));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns 409 with no pending cookie at all (expired or never started)", async () => {
    const upsert = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { socialAccount: { upsert } } }));

    const { POST } = await import("@/app/api/admin/social-media/accounts/linkedin/organizations/route");
    const response = await POST(postRequest({ organizationId: "135933943" }));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("accepts an organizationId present in the pending cookie, storing its OWN token (not borrowed from any personal account)", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "org-account", accountType: "ORGANIZATION" });
    vi.doMock("@/lib/prisma", () => ({ prisma: { socialAccount: { upsert } } }));

    const { POST } = await import("@/app/api/admin/social-media/accounts/linkedin/organizations/route");
    const response = await POST(postRequest({ organizationId: "135933943" }, JSON.stringify(PENDING)));
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = upsert.mock.calls[0][0];
    expect(upsertArgs.where.platform_platformAccountId).toEqual({ platform: "LINKEDIN", platformAccountId: "135933943" });
    expect(upsertArgs.create.accountType).toBe("ORGANIZATION");
    expect(upsertArgs.create.sharesAuthWithId).toBeNull();
    expect(upsertArgs.create.encryptedAccessToken).toBe(PENDING.encryptedAccessToken);
  });

  it("connecting the same organisation twice upserts the same row rather than creating a duplicate", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "org-account", accountType: "ORGANIZATION" });
    vi.doMock("@/lib/prisma", () => ({ prisma: { socialAccount: { upsert } } }));

    const { POST } = await import("@/app/api/admin/social-media/accounts/linkedin/organizations/route");
    await POST(postRequest({ organizationId: "135933943" }, JSON.stringify(PENDING)));
    await POST(postRequest({ organizationId: "135933943" }, JSON.stringify(PENDING)));

    expect(upsert).toHaveBeenCalledTimes(2);
    const [first, second] = upsert.mock.calls;
    expect(first[0].where).toEqual(second[0].where);
  });
});

describe("GET /accounts/linkedin/organizations/pending", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue({ admin: { id: "admin-1" } } as never);
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  function getRequest(cookieValue?: string) {
    return {
      cookies: { get: (name: string) => (name === "social_oauth_org_pending" && cookieValue ? { value: cookieValue } : undefined) },
    } as never;
  }

  it("returns the pending cookie's organisation list", async () => {
    const { GET } = await import("@/app/api/admin/social-media/accounts/linkedin/organizations/pending/route");
    const response = await GET(getRequest(JSON.stringify(PENDING)));
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.organizations).toEqual(PENDING.organizations);
  });

  it("404s cleanly when there's no pending connection", async () => {
    const { GET } = await import("@/app/api/admin/social-media/accounts/linkedin/organizations/pending/route");
    const response = await GET(getRequest());
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.ok).toBe(false);
  });
});
