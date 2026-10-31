import { describe, expect, it, vi } from "vitest";

describe("listWorkspaces", () => {
  it("returns workspaces ordered by displayOrder, selecting only the public fields", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "w1", key: "executive", name: "Executive", description: null, icon: "layout-dashboard", colour: "#000", sectionKeys: [] },
    ]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { workspace: { findMany } } }));

    const { listWorkspaces } = await import("@/lib/workspaces/server");
    const result = await listWorkspaces();

    expect(result).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { displayOrder: "asc" },
        select: { id: true, key: true, name: true, description: true, icon: true, colour: true, sectionKeys: true },
      }),
    );
  });
});

describe("resolveWorkspaceIcon", () => {
  it("resolves a known icon key to its component", async () => {
    const { resolveWorkspaceIcon } = await import("@/lib/workspaces/icons");
    const { Code2 } = await import("lucide-react");
    expect(resolveWorkspaceIcon("code-2")).toBe(Code2);
  });

  it("falls back to LayoutDashboard for an unknown or missing icon key — never throws", async () => {
    const { resolveWorkspaceIcon } = await import("@/lib/workspaces/icons");
    const { LayoutDashboard } = await import("lucide-react");
    expect(resolveWorkspaceIcon("not-a-real-icon")).toBe(LayoutDashboard);
    expect(resolveWorkspaceIcon(null)).toBe(LayoutDashboard);
    expect(resolveWorkspaceIcon(undefined)).toBe(LayoutDashboard);
  });
});
