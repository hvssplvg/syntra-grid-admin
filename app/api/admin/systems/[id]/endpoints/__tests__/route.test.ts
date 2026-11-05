import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertClientRowAccess, requirePermission } from "@/lib/auth/current-admin";

const FULL_ACCESS_IDENTITY = { admin: { id: "admin-1" }, isFullAccess: true, permissions: new Map(), assignedClientIds: [] };

function postRequest(body: unknown) {
  return { json: async () => body } as never;
}

function params(id = "system-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/systems/:id/endpoints", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue(FULL_ACCESS_IDENTITY as never);
    vi.mocked(assertClientRowAccess).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
    vi.mocked(assertClientRowAccess).mockReset();
  });

  it("links an endpoint belonging to the same client", async () => {
    const findUniqueSystem = vi.fn().mockResolvedValue({ id: "system-1", clientId: "client-1" });
    const findUniqueEndpoint = vi.fn().mockResolvedValue({ id: "endpoint-1", clientId: "client-1" });
    const update = vi.fn().mockResolvedValue({ id: "endpoint-1", managedSystemId: "system-1" });
    vi.doMock("@/lib/prisma", () => ({ prisma: { managedSystem: { findUnique: findUniqueSystem }, monitoredEndpoint: { findUnique: findUniqueEndpoint, update } } }));

    const { POST } = await import("@/app/api/admin/systems/[id]/endpoints/route");
    const response = await POST(postRequest({ monitoredEndpointId: "endpoint-1" }), params());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({ where: { id: "endpoint-1" }, data: { managedSystemId: "system-1" } });
  });

  it("rejects linking an endpoint that belongs to a different client", async () => {
    const findUniqueSystem = vi.fn().mockResolvedValue({ id: "system-1", clientId: "client-1" });
    const findUniqueEndpoint = vi.fn().mockResolvedValue({ id: "endpoint-1", clientId: "some-other-client" });
    const update = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { managedSystem: { findUnique: findUniqueSystem }, monitoredEndpoint: { findUnique: findUniqueEndpoint, update } } }));

    const { POST } = await import("@/app/api/admin/systems/[id]/endpoints/route");
    const response = await POST(postRequest({ monitoredEndpointId: "endpoint-1" }), params());

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects linking any endpoint to a Syntra-Grid-internal (clientId: null) system", async () => {
    const findUniqueSystem = vi.fn().mockResolvedValue({ id: "system-1", clientId: null });
    const findUniqueEndpoint = vi.fn();
    const update = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { managedSystem: { findUnique: findUniqueSystem }, monitoredEndpoint: { findUnique: findUniqueEndpoint, update } } }));

    const { POST } = await import("@/app/api/admin/systems/[id]/endpoints/route");
    const response = await POST(postRequest({ monitoredEndpointId: "endpoint-1" }), params());

    expect(response.status).toBe(400);
    expect(findUniqueEndpoint).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("404s when the endpoint doesn't exist", async () => {
    const findUniqueSystem = vi.fn().mockResolvedValue({ id: "system-1", clientId: "client-1" });
    const findUniqueEndpoint = vi.fn().mockResolvedValue(null);
    const update = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { managedSystem: { findUnique: findUniqueSystem }, monitoredEndpoint: { findUnique: findUniqueEndpoint, update } } }));

    const { POST } = await import("@/app/api/admin/systems/[id]/endpoints/route");
    const response = await POST(postRequest({ monitoredEndpointId: "missing" }), params());

    expect(response.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });
});
