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
};

describe("runDueHealthChecks", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips an endpoint that was checked too recently", async () => {
    const findMany = vi.fn().mockResolvedValue([{ ...ENDPOINT, healthChecks: [{ checkedAt: new Date() }] }]);
    const performMonitoringCheck = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { monitoredEndpoint: { findMany }, healthCheck: { create: vi.fn() }, incident: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() } } }));
    vi.doMock("@/lib/monitoring/safeFetch", () => ({ performMonitoringCheck }));

    const { runDueHealthChecks } = await import("@/lib/monitoring/runDueHealthChecks");
    const result = await runDueHealthChecks();

    expect(performMonitoringCheck).not.toHaveBeenCalled();
    expect(result.checked).toBe(0);
  });

  it("checks an endpoint that has never been checked, writes a HealthCheck row, and opens an incident on a bad result", async () => {
    const findMany = vi.fn().mockResolvedValue([{ ...ENDPOINT, healthChecks: [] }]);
    const healthCheckCreate = vi.fn();
    const incidentFindFirst = vi.fn().mockResolvedValue(null);
    const incidentCreate = vi.fn();
    const performMonitoringCheck = vi.fn().mockResolvedValue({ healthy: false, status: "OFFLINE", statusCode: 500, responseTimeMs: 120, message: "HTTP 500." });

    vi.doMock("@/lib/prisma", () => ({
      prisma: { monitoredEndpoint: { findMany }, healthCheck: { create: healthCheckCreate }, incident: { findFirst: incidentFindFirst, create: incidentCreate, update: vi.fn() } },
    }));
    vi.doMock("@/lib/monitoring/safeFetch", () => ({ performMonitoringCheck }));

    const { runDueHealthChecks } = await import("@/lib/monitoring/runDueHealthChecks");
    const result = await runDueHealthChecks();

    expect(performMonitoringCheck).toHaveBeenCalledWith("https://example.com", { method: "GET" });
    expect(healthCheckCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ monitoredEndpointId: "endpoint-1", status: "OFFLINE" }) }));
    expect(incidentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ clientId: "client-1", monitoredEndpointId: "endpoint-1", category: "MONITORING_OUTAGE", dedupeKey: "monitored-endpoint:endpoint-1" }) }),
    );
    expect(result.checked).toBe(1);
    expect(result.incidentsOpened).toBe(1);
  });

  it("does NOT open a second incident when one is already open for the same endpoint — dedupe", async () => {
    const findMany = vi.fn().mockResolvedValue([{ ...ENDPOINT, healthChecks: [{ checkedAt: new Date(Date.now() - 60 * 60 * 1000) }] }]);
    const incidentFindFirst = vi.fn().mockResolvedValue({ id: "incident-1", category: "MONITORING_OUTAGE" });
    const incidentCreate = vi.fn();
    const incidentUpdate = vi.fn();
    const performMonitoringCheck = vi.fn().mockResolvedValue({ healthy: false, status: "OFFLINE", statusCode: 500, responseTimeMs: 120, message: "HTTP 500." });

    vi.doMock("@/lib/prisma", () => ({
      prisma: { monitoredEndpoint: { findMany }, healthCheck: { create: vi.fn() }, incident: { findFirst: incidentFindFirst, create: incidentCreate, update: incidentUpdate } },
    }));
    vi.doMock("@/lib/monitoring/safeFetch", () => ({ performMonitoringCheck }));

    const { runDueHealthChecks } = await import("@/lib/monitoring/runDueHealthChecks");
    const result = await runDueHealthChecks();

    expect(incidentCreate).not.toHaveBeenCalled();
    expect(incidentUpdate).not.toHaveBeenCalled(); // same category — nothing to escalate
    expect(result.incidentsOpened).toBe(0);
  });

  it("auto-resolves an open incident once a subsequent check comes back healthy", async () => {
    const findMany = vi.fn().mockResolvedValue([{ ...ENDPOINT, healthChecks: [{ checkedAt: new Date(Date.now() - 60 * 60 * 1000) }] }]);
    const incidentFindFirst = vi.fn().mockResolvedValue({ id: "incident-1", category: "MONITORING_OUTAGE" });
    const incidentUpdate = vi.fn();
    const performMonitoringCheck = vi.fn().mockResolvedValue({ healthy: true, status: "HEALTHY", statusCode: 200, responseTimeMs: 90, message: null });

    vi.doMock("@/lib/prisma", () => ({
      prisma: { monitoredEndpoint: { findMany }, healthCheck: { create: vi.fn() }, incident: { findFirst: incidentFindFirst, create: vi.fn(), update: incidentUpdate } },
    }));
    vi.doMock("@/lib/monitoring/safeFetch", () => ({ performMonitoringCheck }));

    const { runDueHealthChecks } = await import("@/lib/monitoring/runDueHealthChecks");
    const result = await runDueHealthChecks();

    expect(incidentUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "incident-1" }, data: expect.objectContaining({ resolved: true }) }));
    expect(result.incidentsResolved).toBe(1);
  });

  it("escalates an existing DEGRADED incident to OUTAGE in place rather than opening a second one", async () => {
    const findMany = vi.fn().mockResolvedValue([{ ...ENDPOINT, healthChecks: [{ checkedAt: new Date(Date.now() - 60 * 60 * 1000) }] }]);
    const incidentFindFirst = vi.fn().mockResolvedValue({ id: "incident-1", category: "MONITORING_DEGRADED" });
    const incidentCreate = vi.fn();
    const incidentUpdate = vi.fn();
    const performMonitoringCheck = vi.fn().mockResolvedValue({ healthy: false, status: "OFFLINE", statusCode: null, responseTimeMs: 10000, message: "Timed out." });

    vi.doMock("@/lib/prisma", () => ({
      prisma: { monitoredEndpoint: { findMany }, healthCheck: { create: vi.fn() }, incident: { findFirst: incidentFindFirst, create: incidentCreate, update: incidentUpdate } },
    }));
    vi.doMock("@/lib/monitoring/safeFetch", () => ({ performMonitoringCheck }));

    const { runDueHealthChecks } = await import("@/lib/monitoring/runDueHealthChecks");
    const result = await runDueHealthChecks();

    expect(incidentCreate).not.toHaveBeenCalled();
    expect(incidentUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "incident-1" }, data: expect.objectContaining({ category: "MONITORING_OUTAGE" }) }));
    expect(result.incidentsEscalated).toBe(1);
  });
});
