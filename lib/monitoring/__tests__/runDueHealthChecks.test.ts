import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENDPOINT = {
  id: "endpoint-1",
  clientId: "client-1",
  projectId: null,
  label: "Production website",
  url: "https://example.com",
  method: "GET",
  checkIntervalMinutes: 15,
  enabled: true,
  consecutiveFailureCount: 0,
  consecutiveFailureThreshold: null,
  checkInProgressAt: null,
};

function mockPrisma(overrides: { updateManyCount?: number } = {}) {
  const updateMany = vi.fn().mockResolvedValue({ count: overrides.updateManyCount ?? 1 });
  const update = vi.fn().mockResolvedValue(undefined);
  return { updateMany, update, prismaModule: { prisma: { monitoredEndpoint: { findMany: vi.fn(), updateMany, update } } } };
}

describe("runDueHealthChecks", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips an endpoint that was checked too recently", async () => {
    const { updateMany, prismaModule } = mockPrisma();
    prismaModule.prisma.monitoredEndpoint.findMany = vi.fn().mockResolvedValue([{ ...ENDPOINT, healthChecks: [{ checkedAt: new Date() }] }]);
    const performMonitoringCheck = vi.fn();
    const applyHealthCheckResult = vi.fn();

    vi.doMock("@/lib/prisma", () => prismaModule);
    vi.doMock("@/lib/monitoring/safeFetch", () => ({ performMonitoringCheck }));
    vi.doMock("@/lib/monitoring/applyHealthCheckResult", () => ({ applyHealthCheckResult }));

    const { runDueHealthChecks } = await import("@/lib/monitoring/runDueHealthChecks");
    const result = await runDueHealthChecks();

    expect(performMonitoringCheck).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(result.checked).toBe(0);
  });

  it("checks a due endpoint, acquires the lock, delegates to applyHealthCheckResult, and releases the lock", async () => {
    const { updateMany, update, prismaModule } = mockPrisma();
    prismaModule.prisma.monitoredEndpoint.findMany = vi.fn().mockResolvedValue([{ ...ENDPOINT, healthChecks: [] }]);
    const check = { healthy: false, status: "OFFLINE", statusCode: 500, responseTimeMs: 120, message: "HTTP 500." };
    const performMonitoringCheck = vi.fn().mockResolvedValue(check);
    const applyHealthCheckResult = vi.fn().mockResolvedValue({ incidentAction: "opened" });

    vi.doMock("@/lib/prisma", () => prismaModule);
    vi.doMock("@/lib/monitoring/safeFetch", () => ({ performMonitoringCheck }));
    vi.doMock("@/lib/monitoring/applyHealthCheckResult", () => ({ applyHealthCheckResult }));

    const { runDueHealthChecks } = await import("@/lib/monitoring/runDueHealthChecks");
    const result = await runDueHealthChecks();

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "endpoint-1" }), data: expect.objectContaining({ checkInProgressAt: expect.any(Date) }) }),
    );
    expect(performMonitoringCheck).toHaveBeenCalledWith("https://example.com", { method: "GET" });
    expect(applyHealthCheckResult).toHaveBeenCalledWith(
      expect.objectContaining({ id: "endpoint-1", clientId: "client-1", consecutiveFailureCount: 0 }),
      check,
      { trigger: "scheduled" },
    );
    // Lock release is the last monitoredEndpoint.update call.
    expect(update).toHaveBeenCalledWith({ where: { id: "endpoint-1" }, data: { checkInProgressAt: null } });
    expect(result.checked).toBe(1);
    expect(result.incidentsOpened).toBe(1);
  });

  it("skips an endpoint whose lock is already held (concurrent manual Check Now)", async () => {
    const { updateMany, prismaModule } = mockPrisma({ updateManyCount: 0 });
    prismaModule.prisma.monitoredEndpoint.findMany = vi.fn().mockResolvedValue([{ ...ENDPOINT, healthChecks: [] }]);
    const performMonitoringCheck = vi.fn();
    const applyHealthCheckResult = vi.fn();

    vi.doMock("@/lib/prisma", () => prismaModule);
    vi.doMock("@/lib/monitoring/safeFetch", () => ({ performMonitoringCheck }));
    vi.doMock("@/lib/monitoring/applyHealthCheckResult", () => ({ applyHealthCheckResult }));

    const { runDueHealthChecks } = await import("@/lib/monitoring/runDueHealthChecks");
    const result = await runDueHealthChecks();

    expect(updateMany).toHaveBeenCalled();
    expect(performMonitoringCheck).not.toHaveBeenCalled();
    expect(applyHealthCheckResult).not.toHaveBeenCalled();
    expect(result.skippedLocked).toBe(1);
    expect(result.checked).toBe(0);
  });

  it("isolates one endpoint's unexpected error so the rest of the run still completes, and still releases its lock", async () => {
    const { update, prismaModule } = mockPrisma();
    prismaModule.prisma.monitoredEndpoint.findMany = vi.fn().mockResolvedValue([
      { ...ENDPOINT, id: "endpoint-1", healthChecks: [] },
      { ...ENDPOINT, id: "endpoint-2", healthChecks: [] },
    ]);
    const performMonitoringCheck = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ healthy: true, status: "HEALTHY", statusCode: 200, responseTimeMs: 90, message: null });
    const applyHealthCheckResult = vi.fn().mockResolvedValue({ incidentAction: "none" });

    vi.doMock("@/lib/prisma", () => prismaModule);
    vi.doMock("@/lib/monitoring/safeFetch", () => ({ performMonitoringCheck }));
    vi.doMock("@/lib/monitoring/applyHealthCheckResult", () => ({ applyHealthCheckResult }));

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runDueHealthChecks } = await import("@/lib/monitoring/runDueHealthChecks");
    const result = await runDueHealthChecks();

    expect(result.failed).toBe(1);
    expect(result.checked).toBe(1);
    expect(applyHealthCheckResult).toHaveBeenCalledTimes(1); // only for endpoint-2 — endpoint-1 threw before reaching it
    consoleError.mockRestore();

    expect(update).toHaveBeenCalledWith({ where: { id: "endpoint-1" }, data: { checkInProgressAt: null } });
  });
});
