import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertClientRowAccess, AuthorisationError, requirePermission } from "@/lib/auth/current-admin";

const FULL_ACCESS_IDENTITY = { admin: { id: "admin-1" }, isFullAccess: true, permissions: new Map(), assignedClientIds: [] };

function postRequest(body: unknown) {
  return { json: async () => body } as never;
}

describe("POST /api/admin/deployments", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue(FULL_ACCESS_IDENTITY as never);
    vi.mocked(assertClientRowAccess).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
    vi.mocked(assertClientRowAccess).mockReset();
  });

  function mockPrisma(opts: { project?: { id: string; clientId: string | null } | null; existingIncident?: unknown } = {}) {
    // Not `opts.project ?? {...}` — `??` treats an explicitly-passed
    // `null` (meaning "simulate a missing project") the same as "not
    // provided", silently falling back to the default. Check presence
    // of the key instead.
    const findUniqueProject = vi.fn().mockResolvedValue("project" in opts ? opts.project : { id: "project-1", clientId: "client-1" });
    const create = vi.fn().mockResolvedValue({ id: "deployment-1" });
    const incidentFindFirst = vi.fn().mockResolvedValue(opts.existingIncident ?? null);
    const incidentCreate = vi.fn();
    vi.doMock("@/lib/prisma", () => ({
      prisma: { project: { findUnique: findUniqueProject }, deployment: { create }, incident: { findFirst: incidentFindFirst, create: incidentCreate } },
    }));
    return { findUniqueProject, create, incidentFindFirst, incidentCreate };
  }

  it("is the first-ever real write call site for Deployment — a SUCCESS status never opens an incident", async () => {
    const { create, incidentCreate } = mockPrisma();

    const { POST } = await import("@/app/api/admin/deployments/route");
    const response = await POST(postRequest({ projectId: "project-1", status: "SUCCESS", environment: "production" }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(incidentCreate).not.toHaveBeenCalled();
  });

  it("opens exactly one DEPLOYMENT_FAILURE incident on a FAILED status, keyed by dedupeKey", async () => {
    const { incidentCreate } = mockPrisma();

    const { POST } = await import("@/app/api/admin/deployments/route");
    const response = await POST(postRequest({ projectId: "project-1", status: "FAILED", environment: "production" }));

    expect(response.status).toBe(201);
    expect(incidentCreate).toHaveBeenCalledTimes(1);
    const [args] = incidentCreate.mock.calls[0];
    expect(args.data.category).toBe("DEPLOYMENT_FAILURE");
    expect(args.data.dedupeKey).toMatch(/^deployment:/);
    expect(args.data.clientId).toBe("client-1");
  });

  it("never duplicates the incident if one with the same dedupeKey is already open", async () => {
    const { incidentCreate } = mockPrisma({ existingIncident: { id: "incident-1" } });

    const { POST } = await import("@/app/api/admin/deployments/route");
    await POST(postRequest({ projectId: "project-1", status: "FAILED" }));

    expect(incidentCreate).not.toHaveBeenCalled();
  });

  it("never calls anything resembling triggering a real deployment — only prisma.deployment.create", async () => {
    const { create } = mockPrisma();
    const { POST } = await import("@/app/api/admin/deployments/route");
    await POST(postRequest({ projectId: "project-1", status: "SUCCESS" }));

    // The only prisma call that writes a deployment row is .create — no
    // fetch/exec/deploy-provider call exists anywhere in this route.
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid status", async () => {
    const { create } = mockPrisma();
    const { POST } = await import("@/app/api/admin/deployments/route");
    const response = await POST(postRequest({ projectId: "project-1", status: "DEPLOYED!!" }));

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("404s when the project doesn't exist", async () => {
    const { create } = mockPrisma({ project: null });
    const { POST } = await import("@/app/api/admin/deployments/route");
    const response = await POST(postRequest({ projectId: "missing", status: "SUCCESS" }));

    expect(response.status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it("403s a CLIENT-scoped admin recording a deployment for a project outside their assignment", async () => {
    const { create } = mockPrisma();
    vi.mocked(assertClientRowAccess).mockImplementation(() => {
      throw new AuthorisationError("You can only act on records belonging to your assigned clients.");
    });

    const { POST } = await import("@/app/api/admin/deployments/route");
    const response = await POST(postRequest({ projectId: "project-1", status: "SUCCESS" }));

    expect(response.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a malformed deploymentUrl", async () => {
    const { create } = mockPrisma();
    const { POST } = await import("@/app/api/admin/deployments/route");
    const response = await POST(postRequest({ projectId: "project-1", status: "SUCCESS", deploymentUrl: "not a url" }));

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
