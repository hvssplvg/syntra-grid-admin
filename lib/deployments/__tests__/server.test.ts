import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getDeploymentCorrelation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns no correlation, and queries nothing, when finishedAt is null", async () => {
    const findMany = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { healthCheck: { findMany } } }));

    const { getDeploymentCorrelation } = await import("@/lib/deployments/server");
    const result = await getDeploymentCorrelation({ projectId: "project-1", finishedAt: null });

    expect(result).toEqual({ hasPossibleCorrelation: false, failingChecks: [] });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("queries only non-healthy checks within the window, scoped to the deployment's project", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { healthCheck: { findMany } } }));

    const { getDeploymentCorrelation, CORRELATION_WINDOW_MINUTES } = await import("@/lib/deployments/server");
    const finishedAt = new Date("2026-01-01T12:00:00Z");
    await getDeploymentCorrelation({ projectId: "project-1", finishedAt });

    const [args] = findMany.mock.calls[0];
    expect(args.where.healthy).toBe(false);
    expect(args.where.monitoredEndpoint.projectId).toBe("project-1");
    expect(args.where.checkedAt.gte).toEqual(finishedAt);
    expect(args.where.checkedAt.lte).toEqual(new Date(finishedAt.getTime() + CORRELATION_WINDOW_MINUTES * 60_000));
  });

  it("reports hasPossibleCorrelation true when at least one failing check is found", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "check-1", status: "OFFLINE", checkedAt: new Date(), monitoredEndpoint: { label: "Production" } },
    ]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { healthCheck: { findMany } } }));

    const { getDeploymentCorrelation } = await import("@/lib/deployments/server");
    const result = await getDeploymentCorrelation({ projectId: "project-1", finishedAt: new Date() });

    expect(result.hasPossibleCorrelation).toBe(true);
    expect(result.failingChecks[0].monitoredEndpointLabel).toBe("Production");
  });

  it("reports hasPossibleCorrelation false (not causation) when no failing checks are found in the window", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { healthCheck: { findMany } } }));

    const { getDeploymentCorrelation } = await import("@/lib/deployments/server");
    const result = await getDeploymentCorrelation({ projectId: "project-1", finishedAt: new Date() });

    expect(result.hasPossibleCorrelation).toBe(false);
  });
});
