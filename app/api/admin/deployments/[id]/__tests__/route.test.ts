import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertClientRowAccess, requirePermission } from "@/lib/auth/current-admin";

const FULL_ACCESS_IDENTITY = { admin: { id: "admin-1" }, isFullAccess: true, permissions: new Map(), assignedClientIds: [] };

function params(id = "deployment-1") {
  return { params: Promise.resolve({ id }) };
}

const FULL_DEPLOYMENT_ROW = {
  id: "deployment-1",
  projectId: "project-1",
  provider: null,
  environment: "production",
  status: "FAILED",
  branch: "main",
  commitHash: "abc1234",
  commitTitle: null,
  deploymentUrl: null,
  startedAt: new Date("2026-01-01T00:00:00Z"),
  finishedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  project: { id: "project-1", name: "Marketing site", clientId: "client-1", client: { id: "client-1", name: "Acme", displayName: null } },
};

describe("GET /api/admin/deployments/:id", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue(FULL_ACCESS_IDENTITY as never);
    vi.mocked(assertClientRowAccess).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
    vi.mocked(assertClientRowAccess).mockReset();
  });

  it("404s when the deployment doesn't exist", async () => {
    vi.doMock("@/lib/prisma", () => ({ prisma: { deployment: { findUnique: vi.fn().mockResolvedValue(null) }, healthCheck: { findMany: vi.fn() } } }));

    const { GET } = await import("@/app/api/admin/deployments/[id]/route");
    const response = await GET({} as never, params());

    expect(response.status).toBe(404);
  });

  it("never fabricates a correlation when finishedAt is null", async () => {
    const findUnique = vi.fn().mockResolvedValue(FULL_DEPLOYMENT_ROW);
    const healthCheckFindMany = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { deployment: { findUnique }, healthCheck: { findMany: healthCheckFindMany } } }));

    const { GET } = await import("@/app/api/admin/deployments/[id]/route");
    const response = await GET({} as never, params());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.deployment.correlation.hasPossibleCorrelation).toBe(false);
    expect(healthCheckFindMany).not.toHaveBeenCalled();
  });

  it("surfaces a possible correlation when a failing check exists within the window after finishedAt", async () => {
    const finishedAt = new Date("2026-01-01T12:00:00Z");
    const findUnique = vi.fn().mockResolvedValue({ ...FULL_DEPLOYMENT_ROW, finishedAt });
    const healthCheckFindMany = vi.fn().mockResolvedValue([
      { id: "check-1", status: "OFFLINE", checkedAt: new Date("2026-01-01T12:30:00Z"), monitoredEndpoint: { label: "Production" } },
    ]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { deployment: { findUnique }, healthCheck: { findMany: healthCheckFindMany } } }));

    const { GET } = await import("@/app/api/admin/deployments/[id]/route");
    const response = await GET({} as never, params());
    const payload = await response.json();

    expect(payload.deployment.correlation.hasPossibleCorrelation).toBe(true);
    expect(payload.deployment.correlation.failingChecks).toHaveLength(1);
  });
});
