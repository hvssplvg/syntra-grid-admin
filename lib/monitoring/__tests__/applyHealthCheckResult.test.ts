import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENDPOINT = {
  id: "endpoint-1",
  clientId: "client-1",
  projectId: null,
  label: "Production website",
  consecutiveFailureCount: 0,
  consecutiveFailureThreshold: null,
};

const OFFLINE_CHECK = { healthy: false, status: "OFFLINE" as const, statusCode: 500, responseTimeMs: 120, message: "HTTP 500." };
const HEALTHY_CHECK = { healthy: true, status: "HEALTHY" as const, statusCode: 200, responseTimeMs: 90, message: null };

function mockPrisma() {
  const healthCheckCreate = vi.fn();
  const monitoredEndpointUpdate = vi.fn();
  const incidentFindFirst = vi.fn().mockResolvedValue(null);
  const incidentCreate = vi.fn();
  const incidentUpdate = vi.fn();

  return {
    healthCheckCreate,
    monitoredEndpointUpdate,
    incidentFindFirst,
    incidentCreate,
    incidentUpdate,
    module: {
      prisma: {
        healthCheck: { create: healthCheckCreate },
        monitoredEndpoint: { update: monitoredEndpointUpdate },
        incident: { findFirst: incidentFindFirst, create: incidentCreate, update: incidentUpdate },
      },
    },
  };
}

describe("applyHealthCheckResult", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("always writes a HealthCheck row, even below the failure threshold", async () => {
    const mocks = mockPrisma();
    vi.doMock("@/lib/prisma", () => mocks.module);

    const { applyHealthCheckResult } = await import("@/lib/monitoring/applyHealthCheckResult");
    await applyHealthCheckResult(ENDPOINT, OFFLINE_CHECK);

    expect(mocks.healthCheckCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ monitoredEndpointId: "endpoint-1", status: "OFFLINE" }) }),
    );
  });

  it("does NOT open an incident on the first (below-threshold) failure — just increments the counter", async () => {
    const mocks = mockPrisma();
    vi.doMock("@/lib/prisma", () => mocks.module);

    const { applyHealthCheckResult } = await import("@/lib/monitoring/applyHealthCheckResult");
    const outcome = await applyHealthCheckResult(ENDPOINT, OFFLINE_CHECK);

    expect(mocks.incidentCreate).not.toHaveBeenCalled();
    expect(mocks.monitoredEndpointUpdate).toHaveBeenCalledWith({ where: { id: "endpoint-1" }, data: { consecutiveFailureCount: 1 } });
    expect(outcome.incidentAction).toBe("none");
  });

  it("opens an incident once the default threshold (2) is reached", async () => {
    const mocks = mockPrisma();
    vi.doMock("@/lib/prisma", () => mocks.module);

    const { applyHealthCheckResult } = await import("@/lib/monitoring/applyHealthCheckResult");
    const outcome = await applyHealthCheckResult({ ...ENDPOINT, consecutiveFailureCount: 1 }, OFFLINE_CHECK);

    expect(mocks.incidentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientId: "client-1", monitoredEndpointId: "endpoint-1", category: "MONITORING_OUTAGE", dedupeKey: "monitored-endpoint:endpoint-1" }) }),
    );
    expect(outcome.incidentAction).toBe("opened");
  });

  it("respects a per-endpoint consecutiveFailureThreshold override", async () => {
    const mocks = mockPrisma();
    vi.doMock("@/lib/prisma", () => mocks.module);

    const { applyHealthCheckResult } = await import("@/lib/monitoring/applyHealthCheckResult");
    const outcome = await applyHealthCheckResult({ ...ENDPOINT, consecutiveFailureCount: 3, consecutiveFailureThreshold: 5 }, OFFLINE_CHECK);

    expect(mocks.incidentCreate).not.toHaveBeenCalled();
    expect(outcome.incidentAction).toBe("none");
  });

  it("escalates an already-open incident regardless of the threshold", async () => {
    const mocks = mockPrisma();
    mocks.incidentFindFirst.mockResolvedValue({ id: "incident-1", category: "MONITORING_DEGRADED" });
    vi.doMock("@/lib/prisma", () => mocks.module);

    const { applyHealthCheckResult } = await import("@/lib/monitoring/applyHealthCheckResult");
    const outcome = await applyHealthCheckResult(ENDPOINT, OFFLINE_CHECK);

    expect(mocks.incidentCreate).not.toHaveBeenCalled();
    expect(mocks.incidentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "incident-1" }, data: expect.objectContaining({ category: "MONITORING_OUTAGE" }) }),
    );
    expect(outcome.incidentAction).toBe("escalated");
  });

  it("does not touch an already-open incident of the same category again", async () => {
    const mocks = mockPrisma();
    mocks.incidentFindFirst.mockResolvedValue({ id: "incident-1", category: "MONITORING_OUTAGE" });
    vi.doMock("@/lib/prisma", () => mocks.module);

    const { applyHealthCheckResult } = await import("@/lib/monitoring/applyHealthCheckResult");
    const outcome = await applyHealthCheckResult(ENDPOINT, OFFLINE_CHECK);

    expect(mocks.incidentCreate).not.toHaveBeenCalled();
    expect(mocks.incidentUpdate).not.toHaveBeenCalled();
    expect(outcome.incidentAction).toBe("none");
  });

  it("resets the failure counter and resolves any open incident on recovery", async () => {
    const mocks = mockPrisma();
    mocks.incidentFindFirst.mockResolvedValue({ id: "incident-1", category: "MONITORING_OUTAGE" });
    vi.doMock("@/lib/prisma", () => mocks.module);

    const { applyHealthCheckResult } = await import("@/lib/monitoring/applyHealthCheckResult");
    const outcome = await applyHealthCheckResult({ ...ENDPOINT, consecutiveFailureCount: 2 }, HEALTHY_CHECK);

    expect(mocks.monitoredEndpointUpdate).toHaveBeenCalledWith({ where: { id: "endpoint-1" }, data: { consecutiveFailureCount: 0 } });
    expect(mocks.incidentUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "incident-1" }, data: expect.objectContaining({ resolved: true }) }));
    expect(outcome.incidentAction).toBe("resolved");
  });

  it("records trigger metadata for a manual Check Now call", async () => {
    const mocks = mockPrisma();
    vi.doMock("@/lib/prisma", () => mocks.module);

    const { applyHealthCheckResult } = await import("@/lib/monitoring/applyHealthCheckResult");
    await applyHealthCheckResult(ENDPOINT, HEALTHY_CHECK, { trigger: "manual", triggeredBy: "admin-1" });

    expect(mocks.healthCheckCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ metadata: { trigger: "manual", triggeredBy: "admin-1" } }) }),
    );
  });
});
