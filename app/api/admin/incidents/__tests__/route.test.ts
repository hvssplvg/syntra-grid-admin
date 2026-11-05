import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertClientRowAccess, AuthorisationError, requirePermission } from "@/lib/auth/current-admin";

const FULL_ACCESS_IDENTITY = { admin: { id: "admin-1" }, isFullAccess: true, permissions: new Map(), assignedClientIds: [] };

function postRequest(body: unknown) {
  return { json: async () => body } as never;
}

function getRequest(url: string) {
  return { nextUrl: new URL(url) } as never;
}

describe("GET /api/admin/incidents", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue(FULL_ACCESS_IDENTITY as never);
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("only returns TECHNICAL_INCIDENT_CATEGORIES by default — never an unrelated category like CONTRACT_RENEWAL", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { incident: { findMany } } }));

    const { GET } = await import("@/app/api/admin/incidents/route");
    await GET(getRequest("https://admin.test/api/incidents"));

    const [args] = findMany.mock.calls[0];
    expect(args.where.category.in).toEqual(["MONITORING_OUTAGE", "MONITORING_DEGRADED", "DEPLOYMENT_FAILURE", "INFRASTRUCTURE_INCIDENT"]);
    expect(args.where.category.in).not.toContain("CONTRACT_RENEWAL");
  });

  it("restricted employee without an `incidents` grant is denied", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new AuthorisationError("You are not authorised to view incidents."));
    vi.doMock("@/lib/prisma", () => ({ prisma: { incident: { findMany: vi.fn() } } }));

    const { GET } = await import("@/app/api/admin/incidents/route");
    const response = await GET(getRequest("https://admin.test/api/incidents"));

    expect(response.status).toBe(403);
  });

  it("returns the SAME Incident rows Client Health would show — never a second, duplicated record", async () => {
    const sharedIncident = { id: "incident-1", projectId: null, clientId: "client-1", monitoredEndpointId: "endpoint-1", title: "Site unreachable", description: null, severity: "critical", category: "MONITORING_OUTAGE", status: "OPEN", resolved: false, acknowledgedAt: null, startedAt: new Date(), resolvedAt: null, client: null, project: null, monitoredEndpoint: { id: "endpoint-1", label: "Production" } };
    const findMany = vi.fn().mockResolvedValue([sharedIncident]);
    vi.doMock("@/lib/prisma", () => ({ prisma: { incident: { findMany } } }));

    const { GET } = await import("@/app/api/admin/incidents/route");
    const response = await GET(getRequest("https://admin.test/api/incidents"));
    const payload = await response.json();

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].id).toBe("incident-1"); // same id Client Health's own monitoring flow created
  });
});

describe("POST /api/admin/incidents (manual, ad hoc)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue(FULL_ACCESS_IDENTITY as never);
    vi.mocked(assertClientRowAccess).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
    vi.mocked(assertClientRowAccess).mockReset();
  });

  it("creates a manual incident with a valid category", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "incident-2", projectId: null, clientId: null, monitoredEndpointId: null, title: "Office internet down", description: null, severity: "warning", category: "INFRASTRUCTURE_INCIDENT", status: "OPEN", resolved: false, acknowledgedAt: null, startedAt: new Date(), resolvedAt: null, client: null, project: null, monitoredEndpoint: null,
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: { incident: { create } } }));

    const { POST } = await import("@/app/api/admin/incidents/route");
    const response = await POST(postRequest({ title: "Office internet down", severity: "warning", category: "INFRASTRUCTURE_INCIDENT" }));

    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("rejects a category outside the manual-creation allow-list (e.g. MONITORING_OUTAGE is monitoring-only)", async () => {
    const create = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { incident: { create } } }));

    const { POST } = await import("@/app/api/admin/incidents/route");
    const response = await POST(postRequest({ title: "Site down", severity: "critical", category: "MONITORING_OUTAGE" }));

    expect(response.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});
