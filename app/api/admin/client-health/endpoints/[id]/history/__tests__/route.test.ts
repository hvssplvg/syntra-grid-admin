import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertClientRowAccess, AuthorisationError, requirePermission } from "@/lib/auth/current-admin";

const IDENTITY = { admin: { id: "admin-1" }, isFullAccess: true, permissions: new Map(), assignedClientIds: [] };

function getRequest(url: string) {
  return { nextUrl: new URL(url) } as never;
}

function params(id = "endpoint-1") {
  return { params: Promise.resolve({ id }) };
}

const BASE_ENDPOINT = { id: "endpoint-1", clientId: "client-1", label: "Production site", url: "https://example.com", checkIntervalMinutes: 15 };

describe("GET /api/admin/client-health/endpoints/:id/history", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue(IDENTITY as never);
    vi.mocked(assertClientRowAccess).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
    vi.mocked(assertClientRowAccess).mockReset();
  });

  function mockModules(opts: { endpoint?: typeof BASE_ENDPOINT | null; checks?: Array<{ status: string; healthy: boolean; responseTimeMs: number | null; statusCode: number | null; checkedAt: Date }> }) {
    const findUnique = vi.fn().mockResolvedValue(opts.endpoint === null ? null : (opts.endpoint ?? BASE_ENDPOINT));
    const findMany = vi.fn().mockResolvedValue(opts.checks ?? []);
    vi.doMock("@/lib/prisma", () => ({ prisma: { monitoredEndpoint: { findUnique }, healthCheck: { findMany } } }));
    return { findUnique, findMany };
  }

  it("404s when the endpoint doesn't exist", async () => {
    mockModules({ endpoint: null });
    const { GET } = await import("@/app/api/admin/client-health/endpoints/[id]/history/route");
    const response = await GET(getRequest("https://admin.test/api/x?range=24h"), params());
    expect(response.status).toBe(404);
  });

  it("403s a CLIENT-scoped admin outside their assignment", async () => {
    mockModules({});
    vi.mocked(assertClientRowAccess).mockImplementation(() => {
      throw new AuthorisationError("You do not have access to this client's data.");
    });

    const { GET } = await import("@/app/api/admin/client-health/endpoints/[id]/history/route");
    const response = await GET(getRequest("https://admin.test/api/x?range=24h"), params());
    expect(response.status).toBe(403);
  });

  it("falls back to 24h on an invalid range value", async () => {
    const { findMany } = mockModules({});
    const { GET } = await import("@/app/api/admin/client-health/endpoints/[id]/history/route");

    const response = await GET(getRequest("https://admin.test/api/x?range=bogus"), params());
    const payload = await response.json();

    expect(payload.range).toBe("24h");
    const [args] = findMany.mock.calls[0];
    expect(args.where.monitoredEndpointId).toBe("endpoint-1");
  });

  it("reports insufficientData with zero checks, and a null uptimePercent", async () => {
    mockModules({ checks: [] });
    const { GET } = await import("@/app/api/admin/client-health/endpoints/[id]/history/route");
    const response = await GET(getRequest("https://admin.test/api/x?range=24h"), params());
    const payload = await response.json();

    expect(payload.totalChecks).toBe(0);
    expect(payload.uptimePercent).toBeNull();
    expect(payload.insufficientData).toBe(true);
  });

  it("reports insufficientData=false with enough checks spanning the window, and computes real uptime", async () => {
    const now = Date.now();
    const checks = [
      { status: "HEALTHY", healthy: true, responseTimeMs: 90, statusCode: 200, checkedAt: new Date(now - 23 * 60 * 60 * 1000) },
      { status: "HEALTHY", healthy: true, responseTimeMs: 95, statusCode: 200, checkedAt: new Date(now - 12 * 60 * 60 * 1000) },
      { status: "OFFLINE", healthy: false, responseTimeMs: 100, statusCode: 500, checkedAt: new Date(now - 1 * 60 * 60 * 1000) },
    ];
    mockModules({ checks });

    const { GET } = await import("@/app/api/admin/client-health/endpoints/[id]/history/route");
    const response = await GET(getRequest("https://admin.test/api/x?range=24h"), params());
    const payload = await response.json();

    expect(payload.totalChecks).toBe(3);
    expect(payload.insufficientData).toBe(false);
    expect(payload.uptimePercent).toBeCloseTo((2 / 3) * 100, 5);
  });

  it("never fabricates uptime when there are too few samples, even if they span the window", async () => {
    const now = Date.now();
    mockModules({ checks: [{ status: "HEALTHY", healthy: true, responseTimeMs: 90, statusCode: 200, checkedAt: new Date(now - 23 * 60 * 60 * 1000) }] });

    const { GET } = await import("@/app/api/admin/client-health/endpoints/[id]/history/route");
    const response = await GET(getRequest("https://admin.test/api/x?range=24h"), params());
    const payload = await response.json();

    expect(payload.insufficientData).toBe(true);
  });
});
