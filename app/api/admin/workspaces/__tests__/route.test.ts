import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdmin } from "@/lib/auth/current-admin";

describe("GET /api/admin/workspaces", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.mocked(requireAdmin).mockReset();
  });

  it("returns the seeded workspace list for a full-access admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-1" } as never);
    const workspaces = [{ id: "w1", key: "executive", name: "Executive", description: null, icon: null, colour: null, sectionKeys: [] }];
    vi.doMock("@/lib/workspaces/server", () => ({ listWorkspaces: vi.fn().mockResolvedValue(workspaces) }));

    const { GET } = await import("@/app/api/admin/workspaces/route");
    const response = await GET();
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.workspaces).toEqual(workspaces);
  });

  it("403s a non-full-access caller — requireAdmin() rejects restricted accounts", async () => {
    const { AuthorisationError } = await import("@/lib/auth/current-admin");
    vi.mocked(requireAdmin).mockRejectedValue(new AuthorisationError("Your account does not have access to this area."));
    const listWorkspaces = vi.fn();
    vi.doMock("@/lib/workspaces/server", () => ({ listWorkspaces }));

    const { GET } = await import("@/app/api/admin/workspaces/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.ok).toBe(false);
    expect(listWorkspaces).not.toHaveBeenCalled();
  });
});
