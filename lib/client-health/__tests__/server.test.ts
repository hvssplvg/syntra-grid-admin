import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2026-10-31T12:00:00Z");

function baseClient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "client-1",
    name: "Acme Ltd",
    displayName: null,
    logoUrl: null,
    status: "ACTIVE",
    priority: "STANDARD",
    monitoredEndpoints: [],
    tickets: [],
    projects: [],
    contracts: [],
    invoices: [],
    billing: null,
    incidents: [],
    ...overrides,
  };
}

describe("listClientHealth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a client with nothing configured is reported UNKNOWN, not fabricated as healthy", async () => {
    const findMany = vi.fn().mockResolvedValue([baseClient()]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findMany } } }));

    const { listClientHealth } = await import("@/lib/client-health/server");
    const result = await listClientHealth();

    expect(result).toHaveLength(1);
    expect(result[0].health.status).toBe("UNKNOWN");
  });

  it("filters by computed health status (post-processed in JS, not pushed into the Prisma query)", async () => {
    const findMany = vi.fn().mockResolvedValue([
      baseClient({ id: "healthy-client", projects: [{ status: "ACTIVE" }] }),
      baseClient({ id: "at-risk-client", contracts: [{ status: "EXPIRED", renewalAt: null, endDate: null, autoRenew: false }] }),
    ]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findMany } } }));

    const { listClientHealth } = await import("@/lib/client-health/server");
    const result = await listClientHealth({ status: "AT_RISK" });

    expect(result).toHaveLength(1);
    expect(result[0].client.id).toBe("at-risk-client");
  });

  it("filters by applicable dimension", async () => {
    const findMany = vi.fn().mockResolvedValue([
      baseClient({ id: "with-monitoring", monitoredEndpoints: [{ id: "e1", label: "Site", healthChecks: [{ status: "HEALTHY", checkedAt: NOW }] }] }),
      baseClient({ id: "without-monitoring" }),
    ]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findMany } } }));

    const { listClientHealth } = await import("@/lib/client-health/server");
    const result = await listClientHealth({ dimension: "monitoring" });

    expect(result).toHaveLength(1);
    expect(result[0].client.id).toBe("with-monitoring");
  });

  it("passes search and priority filters through to the Prisma query", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findMany } } }));

    const { listClientHealth } = await import("@/lib/client-health/server");
    await listClientHealth({ search: "acme", priority: "STRATEGIC" as never });

    const [args] = findMany.mock.calls[0];
    expect(args.where.priority).toBe("STRATEGIC");
    expect(args.where.OR).toBeDefined();
  });

  it("narrows to exactly one client when clientId is given — the header's client-context switcher", async () => {
    const findMany = vi.fn().mockResolvedValue([baseClient({ id: "client-42" })]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findMany } } }));

    const { listClientHealth } = await import("@/lib/client-health/server");
    const result = await listClientHealth({ clientId: "client-42" });

    const [args] = findMany.mock.calls[0];
    expect(args.where.id).toBe("client-42");
    expect(result).toHaveLength(1);
  });

  it("omits the id filter entirely when no clientId is given — company-wide means everyone, not accidentally nobody", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findMany } } }));

    const { listClientHealth } = await import("@/lib/client-health/server");
    await listClientHealth({});

    const [args] = findMany.mock.calls[0];
    expect(args.where.id).toBeUndefined();
  });

  it("counts overdue tickets using the same heuristic compute.ts uses — no second, divergent copy", async () => {
    const findMany = vi.fn().mockResolvedValue([
      baseClient({ tickets: [{ status: "OPEN", priority: "URGENT", createdAt: new Date(NOW.getTime() - 2 * 86_400_000) }] }),
    ]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findMany } } }));

    const { listClientHealth } = await import("@/lib/client-health/server");
    const result = await listClientHealth();

    expect(result[0].overdueTicketCount).toBe(1);
    expect(result[0].health.status).toBe("AT_RISK");
  });
});

describe("getClientHealthDetail", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns null for a client that doesn't exist", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique } } }));

    const { getClientHealthDetail } = await import("@/lib/client-health/server");
    const result = await getClientHealthDetail("missing-client");

    expect(result).toBeNull();
  });

  it("includes incidents and endpoint detail alongside the summary", async () => {
    const findUnique = vi.fn().mockResolvedValue(
      baseClient({
        incidents: [{ id: "incident-1", title: "Site down", severity: "critical", category: "MONITORING_OUTAGE", status: "OPEN", resolved: false, acknowledgedAt: null, startedAt: NOW, resolvedAt: null }],
      }),
    );
    vi.doMock("@/lib/prisma", () => ({ prisma: { client: { findUnique } } }));

    const { getClientHealthDetail } = await import("@/lib/client-health/server");
    const result = await getClientHealthDetail("client-1");

    expect(result?.incidents).toHaveLength(1);
    expect(result?.health).toBeDefined();
  });
});
