import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/current-admin";

function postRequest(body: unknown) {
  return { json: async () => body } as never;
}

/** Regression coverage for a real bug: the campaign editor only ever
 *  sends name/description/status/startDate/endDate (see CampaignsTab.tsx —
 *  "The API accepts exactly five fields"), so clientId/projectId/
 *  departmentId/ownerId/managerId are always absent from the body. The
 *  route's validation wrongly treated "absent" the same as "present but
 *  invalid," so every real campaign creation/edit 400'd unconditionally. */
describe("POST /api/admin/campaigns — related-id validation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue({ admin: { id: "admin-1" } } as never);
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("creates a campaign when the related-record fields are simply absent — the bug this fixes", async () => {
    const createCampaign = vi.fn().mockResolvedValue({ id: "campaign-1", name: "Autumn launch" });
    vi.doMock("@/lib/campaigns/server", () => ({ createCampaign, listCampaigns: vi.fn() }));

    const { POST } = await import("@/app/api/admin/campaigns/route");
    const response = await POST(postRequest({ name: "Autumn launch", description: null, startDate: null, endDate: null }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(createCampaign).toHaveBeenCalledTimes(1);
  });

  it("still rejects a related-record field that IS present but malformed", async () => {
    const createCampaign = vi.fn();
    vi.doMock("@/lib/campaigns/server", () => ({ createCampaign, listCampaigns: vi.fn() }));

    const { POST } = await import("@/app/api/admin/campaigns/route");
    // clientId present but not a non-empty string — parseOptionalId
    // genuinely returns undefined for this, and it should still 400.
    const response = await POST(postRequest({ name: "Autumn launch", clientId: 12345 }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(createCampaign).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/campaigns/:id — related-id validation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue({ admin: { id: "admin-1" } } as never);
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  function patchRequest(body: unknown) {
    return { json: async () => body } as never;
  }

  it("updates a campaign when the related-record fields are simply absent — a normal partial edit", async () => {
    const getCampaignOrThrow = vi.fn().mockResolvedValue({ id: "campaign-1", createdById: "admin-1", departmentId: null, startDate: null, endDate: null });
    const updateCampaign = vi.fn().mockResolvedValue({ id: "campaign-1", name: "Autumn launch (updated)" });
    vi.doMock("@/lib/campaigns/server", () => ({ getCampaignOrThrow, updateCampaign }));
    vi.doMock("@/lib/campaigns/permissions", async () => {
      const actual = await vi.importActual<typeof import("@/lib/campaigns/permissions")>("@/lib/campaigns/permissions");
      return { ...actual, assertCampaignRowAccess: vi.fn() };
    });

    const { PATCH } = await import("@/app/api/admin/campaigns/[id]/route");
    const response = await PATCH(patchRequest({ name: "Autumn launch (updated)" }), { params: Promise.resolve({ id: "campaign-1" }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(updateCampaign).toHaveBeenCalledTimes(1);
  });
});
