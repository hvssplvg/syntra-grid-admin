import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentIdentity, hasPermission } from "@/lib/auth/current-admin";

describe("GET /api/admin/workspaces", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.mocked(getCurrentIdentity).mockReset();
    vi.mocked(hasPermission).mockReset();
  });

  it("returns the full, unfiltered workspace list for a full-access admin", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({ isFullAccess: true } as never);
    const workspaces = [
      { id: "w1", key: "executive", name: "Executive", description: null, icon: null, colour: null, sectionKeys: [] },
      { id: "w2", key: "technology", name: "Technology", description: null, icon: null, colour: null, sectionKeys: ["engineering", "products"] },
    ];
    vi.doMock("@/lib/workspaces/server", () => ({ listWorkspaces: vi.fn().mockResolvedValue(workspaces) }));

    const { GET } = await import("@/app/api/admin/workspaces/route");
    const response = await GET();
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.workspaces).toEqual(workspaces);
  });

  it("narrows a restricted caller to workspaces whose sectionKeys they can actually reach", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({ isFullAccess: false } as never);
    // Only the "projects" module (Delivery section) is granted.
    vi.mocked(hasPermission).mockImplementation((_identity, module) => module === "projects");

    const workspaces = [
      { id: "w-exec", key: "executive", name: "Executive", description: null, icon: null, colour: null, sectionKeys: [] },
      { id: "w-proj", key: "projects_operations", name: "Projects / Operations", description: null, icon: null, colour: null, sectionKeys: ["delivery"] },
      { id: "w-tech", key: "technology", name: "Technology", description: null, icon: null, colour: null, sectionKeys: ["engineering", "products"] },
    ];
    vi.doMock("@/lib/workspaces/server", () => ({ listWorkspaces: vi.fn().mockResolvedValue(workspaces) }));

    const { GET } = await import("@/app/api/admin/workspaces/route");
    const response = await GET();
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.workspaces.map((w: { key: string }) => w.key)).toEqual(["projects_operations"]);
  });

  it("excludes the Executive workspace (empty sectionKeys) for every restricted caller, regardless of grants", async () => {
    vi.mocked(getCurrentIdentity).mockResolvedValue({ isFullAccess: false } as never);
    vi.mocked(hasPermission).mockReturnValue(true); // grant everything

    const workspaces = [
      { id: "w-exec", key: "executive", name: "Executive", description: null, icon: null, colour: null, sectionKeys: [] },
      { id: "w-tech", key: "technology", name: "Technology", description: null, icon: null, colour: null, sectionKeys: ["engineering", "products"] },
    ];
    vi.doMock("@/lib/workspaces/server", () => ({ listWorkspaces: vi.fn().mockResolvedValue(workspaces) }));

    const { GET } = await import("@/app/api/admin/workspaces/route");
    const response = await GET();
    const payload = await response.json();

    expect(payload.workspaces.map((w: { key: string }) => w.key)).toEqual(["technology"]);
  });
});
