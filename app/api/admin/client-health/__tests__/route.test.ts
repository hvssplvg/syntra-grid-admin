import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/current-admin";

function getRequest(search: string) {
  return { nextUrl: new URL(`http://localhost/api/admin/client-health${search}`) } as never;
}

describe("GET /api/admin/client-health", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue({ admin: { id: "admin-1" } } as never);
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("passes through only recognised filter values, ignoring garbage query params", async () => {
    const listClientHealth = vi.fn().mockResolvedValue([]);
    vi.doMock("@/lib/client-health/server", () => ({ listClientHealth }));

    const { GET } = await import("@/app/api/admin/client-health/route");
    await GET(getRequest("?status=NOT_A_REAL_STATUS&dimension=monitoring&search=acme"));

    const [filters] = listClientHealth.mock.calls[0];
    expect(filters.status).toBeUndefined();
    expect(filters.dimension).toBe("monitoring");
    expect(filters.search).toBe("acme");
  });

  it("returns the items from listClientHealth", async () => {
    const items = [{ client: { id: "c1" }, health: { status: "HEALTHY" } }];
    vi.doMock("@/lib/client-health/server", () => ({ listClientHealth: vi.fn().mockResolvedValue(items) }));

    const { GET } = await import("@/app/api/admin/client-health/route");
    const response = await GET(getRequest(""));
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.items).toEqual(items);
  });
});
