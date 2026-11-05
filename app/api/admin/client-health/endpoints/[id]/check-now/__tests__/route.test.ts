import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertClientRowAccess, AuthorisationError, requirePermission } from "@/lib/auth/current-admin";

const IDENTITY = { admin: { id: "admin-1" }, isFullAccess: true, permissions: new Map(), assignedClientIds: [] };

const BASE_ENDPOINT = {
  id: "endpoint-1",
  clientId: "client-1",
  projectId: null,
  label: "Production site",
  url: "https://example.com",
  method: "GET",
  consecutiveFailureCount: 0,
  consecutiveFailureThreshold: null,
  checkInProgressAt: null,
  healthChecks: [],
};

function postRequest() {
  return {} as never;
}

function params(id = "endpoint-1") {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/admin/client-health/endpoints/:id/check-now", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue(IDENTITY as never);
    vi.mocked(assertClientRowAccess).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
    vi.mocked(assertClientRowAccess).mockReset();
  });

  function mockModules(opts: {
    endpoint?: Partial<typeof BASE_ENDPOINT> | null;
    updateManyCount?: number;
    performMonitoringCheck?: ReturnType<typeof vi.fn>;
    applyHealthCheckResult?: ReturnType<typeof vi.fn>;
    checkNowRateLimit?: ReturnType<typeof vi.fn>;
  }) {
    const findUnique = vi.fn().mockResolvedValue(opts.endpoint === null ? null : { ...BASE_ENDPOINT, ...opts.endpoint });
    const updateMany = vi.fn().mockResolvedValue({ count: opts.updateManyCount ?? 1 });
    const update = vi.fn().mockResolvedValue(undefined);
    const performMonitoringCheck = opts.performMonitoringCheck ?? vi.fn().mockResolvedValue({ healthy: true, status: "HEALTHY", statusCode: 200, responseTimeMs: 90, message: null });
    const applyHealthCheckResult = opts.applyHealthCheckResult ?? vi.fn().mockResolvedValue({ incidentAction: "none" });
    const checkNowRateLimit = opts.checkNowRateLimit ?? vi.fn().mockReturnValue({ allowed: true });

    vi.doMock("@/lib/prisma", () => ({ prisma: { monitoredEndpoint: { findUnique, updateMany, update } } }));
    vi.doMock("@/lib/monitoring/safeFetch", () => ({ performMonitoringCheck }));
    vi.doMock("@/lib/monitoring/applyHealthCheckResult", () => ({ applyHealthCheckResult }));
    vi.doMock("@/lib/monitoring/checkNowRateLimit", () => ({ checkNowRateLimit }));

    return { findUnique, updateMany, update, performMonitoringCheck, applyHealthCheckResult, checkNowRateLimit };
  }

  it("404s when the endpoint doesn't exist", async () => {
    mockModules({ endpoint: null });
    const { POST } = await import("@/app/api/admin/client-health/endpoints/[id]/check-now/route");
    const response = await POST(postRequest(), params());
    expect(response.status).toBe(404);
  });

  it("403s a CLIENT-scoped admin checking an endpoint outside their assignment", async () => {
    mockModules({});
    vi.mocked(assertClientRowAccess).mockImplementation(() => {
      throw new AuthorisationError("You do not have access to this client's data.");
    });

    const { POST } = await import("@/app/api/admin/client-health/endpoints/[id]/check-now/route");
    const response = await POST(postRequest(), params());
    expect(response.status).toBe(403);
  });

  it("429s when the per-admin rate limit is exceeded", async () => {
    const { performMonitoringCheck } = mockModules({ checkNowRateLimit: vi.fn().mockReturnValue({ allowed: false, retryAfterMs: 1000 }) });

    const { POST } = await import("@/app/api/admin/client-health/endpoints/[id]/check-now/route");
    const response = await POST(postRequest(), params());
    expect(response.status).toBe(429);
    expect(performMonitoringCheck).not.toHaveBeenCalled();
  });

  it("429s when the endpoint was checked less than 30 seconds ago", async () => {
    const { performMonitoringCheck } = mockModules({ endpoint: { healthChecks: [{ checkedAt: new Date() }] } as never });

    const { POST } = await import("@/app/api/admin/client-health/endpoints/[id]/check-now/route");
    const response = await POST(postRequest(), params());
    expect(response.status).toBe(429);
    expect(performMonitoringCheck).not.toHaveBeenCalled();
  });

  it("409s when a check is already in progress (lock held)", async () => {
    const { performMonitoringCheck } = mockModules({ updateManyCount: 0 });

    const { POST } = await import("@/app/api/admin/client-health/endpoints/[id]/check-now/route");
    const response = await POST(postRequest(), params());
    expect(response.status).toBe(409);
    expect(performMonitoringCheck).not.toHaveBeenCalled();
  });

  it("succeeds, calls only the SSRF-safe checker (never a raw fetch path), and releases the lock", async () => {
    const check = { healthy: true, status: "HEALTHY", statusCode: 200, responseTimeMs: 90, message: null };
    const { performMonitoringCheck, applyHealthCheckResult, update } = mockModules({
      performMonitoringCheck: vi.fn().mockResolvedValue(check),
      applyHealthCheckResult: vi.fn().mockResolvedValue({ incidentAction: "resolved" }),
    });

    const { POST } = await import("@/app/api/admin/client-health/endpoints/[id]/check-now/route");
    const response = await POST(postRequest(), params());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.incidentAction).toBe("resolved");
    expect(performMonitoringCheck).toHaveBeenCalledWith("https://example.com", { method: "GET" });
    expect(applyHealthCheckResult).toHaveBeenCalledWith(
      expect.objectContaining({ id: "endpoint-1", clientId: "client-1" }),
      check,
      { trigger: "manual", triggeredBy: "admin-1" },
    );
    expect(update).toHaveBeenCalledWith({ where: { id: "endpoint-1" }, data: { checkInProgressAt: null } });
  });

  it("releases the lock even if the check throws", async () => {
    const { update } = mockModules({ performMonitoringCheck: vi.fn().mockRejectedValue(new Error("boom")) });

    const { POST } = await import("@/app/api/admin/client-health/endpoints/[id]/check-now/route");
    const response = await POST(postRequest(), params());
    expect(response.status).toBe(500);
    expect(update).toHaveBeenCalledWith({ where: { id: "endpoint-1" }, data: { checkInProgressAt: null } });
  });
});
