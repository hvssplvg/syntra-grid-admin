import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertClientRowAccess, AuthorisationError, requirePermission } from "@/lib/auth/current-admin";

const FULL_ACCESS_IDENTITY = { admin: { id: "admin-1" }, isFullAccess: true, permissions: new Map(), assignedClientIds: [] };

function params(id = "system-1") {
  return { params: Promise.resolve({ id }) };
}

// toSummary (called inside getManagedSystemDetail, used by GET) needs every
// MANAGED_SYSTEM_SELECT field — it runs BEFORE the route's own row-ownership
// check, so an incomplete mock row crashes regardless of what the test is
// actually trying to exercise.
const FULL_SYSTEM_ROW = {
  id: "system-1",
  clientId: "client-1",
  projectId: null,
  name: "Marketing site",
  description: null,
  systemType: "WEBSITE",
  lifecycleStatus: "ACTIVE",
  hostingProvider: null,
  repositoryUrl: null,
  techStack: [],
  productionUrl: null,
  stagingUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  client: null,
  project: null,
  monitoredEndpoints: [],
};

describe("GET/PATCH/DELETE /api/admin/systems/:id", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue(FULL_ACCESS_IDENTITY as never);
    vi.mocked(assertClientRowAccess).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
    vi.mocked(assertClientRowAccess).mockReset();
  });

  it("404s GET for a system that doesn't exist", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: { managedSystem: { findUnique: vi.fn().mockResolvedValue(null) } } }));

    const { GET } = await import("@/app/api/admin/systems/[id]/route");
    const response = await GET({} as never, params());

    expect(response.status).toBe(404);
  });

  it("403s GET for a CLIENT-scoped admin outside their assignment — row-ownership check happens after load, before returning data", async () => {
    const findUnique = vi.fn().mockResolvedValue(FULL_SYSTEM_ROW);
    vi.doMock("@/lib/prisma", () => ({ prisma: { managedSystem: { findUnique } } }));
    vi.mocked(assertClientRowAccess).mockImplementation(() => {
      throw new AuthorisationError("You can only act on records belonging to your assigned clients.");
    });

    const { GET } = await import("@/app/api/admin/systems/[id]/route");
    const response = await GET({} as never, params());

    expect(response.status).toBe(403);
  });

  it("404s PATCH/DELETE before attempting the row-ownership check, when the system doesn't exist", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    vi.doMock("@/lib/prisma", () => ({ prisma: { managedSystem: { findUnique, update: vi.fn(), delete: vi.fn() } } }));

    const { PATCH, DELETE } = await import("@/app/api/admin/systems/[id]/route");
    const patchResponse = await PATCH({ json: async () => ({ name: "New name" }) } as never, params());
    const deleteResponse = await DELETE({} as never, params());

    expect(patchResponse.status).toBe(404);
    expect(deleteResponse.status).toBe(404);
  });

  it("deletes a system without touching its monitored endpoints/deployments/incidents (no cascading relation on ManagedSystem to any of those)", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "system-1", clientId: "client-1" });
    const deleteFn = vi.fn().mockResolvedValue({ id: "system-1" });
    vi.doMock("@/lib/prisma", () => ({ prisma: { managedSystem: { findUnique, delete: deleteFn } } }));

    const { DELETE } = await import("@/app/api/admin/systems/[id]/route");
    const response = await DELETE({} as never, params());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(deleteFn).toHaveBeenCalledWith({ where: { id: "system-1" } });
  });
});
