import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/current-admin";

function postRequest(body: unknown) {
  return { json: async () => body } as never;
}

describe("POST /api/admin/client-health/endpoints — the monitoring authorisation step", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue({ admin: { id: "admin-1" } } as never);
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("rejects a URL that fails the SSRF/private-network guard, and never creates a row", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "client-1" });
    const create = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique }, project: { findUnique: vi.fn() }, monitoredEndpoint: { create } } }));
    vi.doMock("@/lib/monitoring/safeFetch", async () => {
      const actual = await vi.importActual<typeof import("@/lib/monitoring/safeFetch")>("@/lib/monitoring/safeFetch");
      return { ...actual, assertSafeMonitoringUrl: vi.fn().mockRejectedValue(new actual.UnsafeUrlError("This URL resolves to a private or internal network address and cannot be monitored.")) };
    });

    const { POST } = await import("@/app/api/admin/client-health/endpoints/route");
    const response = await POST(postRequest({ clientId: "client-1", label: "Internal admin panel", url: "http://169.254.169.254/" }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("404s when the client doesn't exist, before ever validating the URL", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const assertSafeMonitoringUrl = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique }, project: { findUnique: vi.fn() }, monitoredEndpoint: { create: vi.fn() } } }));
    vi.doMock("@/lib/monitoring/safeFetch", () => ({ assertSafeMonitoringUrl, UnsafeUrlError: class extends Error {} }));

    const { POST } = await import("@/app/api/admin/client-health/endpoints/route");
    const response = await POST(postRequest({ clientId: "missing", label: "Site", url: "https://example.com" }));

    expect(response.status).toBe(404);
    expect(assertSafeMonitoringUrl).not.toHaveBeenCalled();
  });

  it("creates the endpoint for a safe URL and clamps a too-low requested interval to the server-enforced floor", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "client-1" });
    const create = vi.fn().mockResolvedValue({ id: "endpoint-1" });
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique }, project: { findUnique: vi.fn() }, monitoredEndpoint: { create } } }));
    vi.doMock("@/lib/monitoring/safeFetch", () => ({
      assertSafeMonitoringUrl: vi.fn().mockResolvedValue(new URL("https://example.com/")),
      UnsafeUrlError: class extends Error {},
    }));

    const { POST } = await import("@/app/api/admin/client-health/endpoints/route");
    const response = await POST(postRequest({ clientId: "client-1", label: "Production site", url: "https://example.com", checkIntervalMinutes: 1 }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    const [args] = create.mock.calls[0];
    expect(args.data.checkIntervalMinutes).toBe(5); // clamped up from the requested 1
    expect(args.data.createdById).toBe("admin-1");
  });

  it("rejects a projectId that doesn't belong to the given client", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "client-1" });
    const projectFindUnique = vi.fn().mockResolvedValue({ id: "project-1", clientId: "some-other-client" });
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique }, project: { findUnique: projectFindUnique }, monitoredEndpoint: { create: vi.fn() } } }));
    vi.doMock("@/lib/monitoring/safeFetch", () => ({ assertSafeMonitoringUrl: vi.fn(), UnsafeUrlError: class extends Error {} }));

    const { POST } = await import("@/app/api/admin/client-health/endpoints/route");
    const response = await POST(postRequest({ clientId: "client-1", projectId: "project-1", label: "Site", url: "https://example.com" }));

    expect(response.status).toBe(400);
  });
});
