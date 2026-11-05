import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertClientRowAccess, AuthorisationError, requirePermission } from "@/lib/auth/current-admin";

const FULL_ACCESS_IDENTITY = { admin: { id: "admin-1" }, isFullAccess: true, permissions: new Map(), assignedClientIds: [] };

function postRequest(body: unknown) {
  return { json: async () => body } as never;
}

describe("GET/POST /api/admin/systems", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue(FULL_ACCESS_IDENTITY as never);
    vi.mocked(assertClientRowAccess).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
    vi.mocked(assertClientRowAccess).mockReset();
  });

  it("creates a client-owned system after validating the client exists", async () => {
    const findUniqueClient = vi.fn().mockResolvedValue({ id: "client-1" });
    const create = vi.fn().mockResolvedValue({ id: "system-1", clientId: "client-1" });
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique: findUniqueClient }, project: { findUnique: vi.fn() }, managedSystem: { create } } }));

    const { POST } = await import("@/app/api/admin/systems/route");
    const response = await POST(postRequest({ clientId: "client-1", name: "Marketing site", systemType: "WEBSITE" }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    const [args] = create.mock.calls[0];
    expect(args.data.clientId).toBe("client-1");
    expect(args.data.createdById).toBe("admin-1");
  });

  it("creates a Syntra-Grid-internal system when clientId is null — no fake client row involved", async () => {
    const findUniqueClient = vi.fn();
    const create = vi.fn().mockResolvedValue({ id: "system-1", clientId: null });
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique: findUniqueClient }, project: { findUnique: vi.fn() }, managedSystem: { create } } }));

    const { POST } = await import("@/app/api/admin/systems/route");
    const response = await POST(postRequest({ clientId: null, name: "Internal admin tool", systemType: "BACKEND_SERVICE" }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(findUniqueClient).not.toHaveBeenCalled(); // no client row to look up for an internal system
    const [args] = create.mock.calls[0];
    expect(args.data.clientId).toBeNull();
  });

  it("404s when the given clientId doesn't exist", async () => {
    const findUniqueClient = vi.fn().mockResolvedValue(null);
    const create = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique: findUniqueClient }, project: { findUnique: vi.fn() }, managedSystem: { create } } }));

    const { POST } = await import("@/app/api/admin/systems/route");
    const response = await POST(postRequest({ clientId: "missing", name: "Site", systemType: "WEBSITE" }));

    expect(response.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it("403s a CLIENT-scoped admin creating a system for a client outside their assignment — cross-client isolation", async () => {
    const findUniqueClient = vi.fn().mockResolvedValue({ id: "client-1" });
    const create = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique: findUniqueClient }, project: { findUnique: vi.fn() }, managedSystem: { create } } }));
    vi.mocked(assertClientRowAccess).mockImplementation(() => {
      throw new AuthorisationError("You can only act on records belonging to your assigned clients.");
    });

    const { POST } = await import("@/app/api/admin/systems/route");
    const response = await POST(postRequest({ clientId: "client-1", name: "Site", systemType: "WEBSITE" }));

    expect(response.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a projectId that doesn't belong to the given client", async () => {
    const findUniqueClient = vi.fn().mockResolvedValue({ id: "client-1" });
    const findUniqueProject = vi.fn().mockResolvedValue({ id: "project-1", clientId: "some-other-client" });
    const create = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique: findUniqueClient }, project: { findUnique: findUniqueProject }, managedSystem: { create } } }));

    const { POST } = await import("@/app/api/admin/systems/route");
    const response = await POST(postRequest({ clientId: "client-1", projectId: "project-1", name: "Site", systemType: "WEBSITE" }));

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an invalid systemType", async () => {
    const create = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique: vi.fn() }, project: { findUnique: vi.fn() }, managedSystem: { create } } }));

    const { POST } = await import("@/app/api/admin/systems/route");
    const response = await POST(postRequest({ clientId: null, name: "Site", systemType: "NOT_A_REAL_TYPE" }));

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a malformed productionUrl rather than silently dropping it", async () => {
    const create = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique: vi.fn() }, project: { findUnique: vi.fn() }, managedSystem: { create } } }));

    const { POST } = await import("@/app/api/admin/systems/route");
    const response = await POST(postRequest({ clientId: null, name: "Site", systemType: "WEBSITE", productionUrl: "javascript:alert(1)" }));

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
