import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/current-admin";

function fakeRequest() {
  return {} as never;
}

describe("POST /accounts/[id]/disconnect — cascade to dependent shared-auth accounts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue({
      admin: { id: "admin-1" },
      isFullAccess: true,
      permissions: new Map(),
      assignedClientIds: [],
    } as never);
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("disconnecting a PERSONAL LinkedIn account also disconnects its dependent ORGANIZATION account", async () => {
    const update = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUnique = vi.fn().mockResolvedValue({ id: "personal-account", accountType: "PERSONAL" });
    const findMany = vi.fn().mockResolvedValue([{ id: "org-account" }]);

    vi.doMock("@/lib/prisma", () => ({
      prisma: { socialAccount: { findUnique, update, findMany, updateMany } },
    }));

    const { POST } = await import("@/app/api/admin/social-media/accounts/[id]/disconnect/route");
    const response = await POST(fakeRequest(), { params: Promise.resolve({ id: "personal-account" }) });
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.disconnectedDependentIds).toEqual(["org-account"]);
    expect(findMany).toHaveBeenCalledWith({ where: { sharesAuthWithId: "personal-account", status: "CONNECTED" }, select: { id: true } });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["org-account"] } },
      data: expect.objectContaining({ status: "DISCONNECTED" }),
    });
  });

  it("disconnecting an account with no dependents never calls updateMany", async () => {
    const update = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUnique = vi.fn().mockResolvedValue({ id: "x-account", accountType: "PERSONAL" });
    const findMany = vi.fn().mockResolvedValue([]);

    vi.doMock("@/lib/prisma", () => ({
      prisma: { socialAccount: { findUnique, update, findMany, updateMany } },
    }));

    const { POST } = await import("@/app/api/admin/social-media/accounts/[id]/disconnect/route");
    const response = await POST(fakeRequest(), { params: Promise.resolve({ id: "x-account" }) });
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.disconnectedDependentIds).toEqual([]);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("disconnecting an ORGANIZATION account (which never held its own token) still succeeds", async () => {
    const update = vi.fn().mockResolvedValue({});
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUnique = vi.fn().mockResolvedValue({ id: "org-account", accountType: "ORGANIZATION", sharesAuthWithId: "personal-account" });
    const findMany = vi.fn().mockResolvedValue([]);

    vi.doMock("@/lib/prisma", () => ({
      prisma: { socialAccount: { findUnique, update, findMany, updateMany } },
    }));

    const { POST } = await import("@/app/api/admin/social-media/accounts/[id]/disconnect/route");
    const response = await POST(fakeRequest(), { params: Promise.resolve({ id: "org-account" }) });
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "org-account" } }));
  });
});
