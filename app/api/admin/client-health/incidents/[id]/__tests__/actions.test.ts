import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requirePermission } from "@/lib/auth/current-admin";

function postRequest() {
  return {} as never;
}

describe("POST /api/admin/client-health/incidents/:id/acknowledge", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue({ admin: { id: "admin-1" } } as never);
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("404s for an incident that doesn't exist", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    vi.doMock("@/lib/prisma", () => ({ prisma: { incident: { findUnique, update: vi.fn() } } }));

    const { POST } = await import("@/app/api/admin/client-health/incidents/[id]/acknowledge/route");
    const response = await POST(postRequest(), { params: Promise.resolve({ id: "missing" }) });

    expect(response.status).toBe(404);
  });

  it("refuses to acknowledge an already-resolved incident", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "incident-1", resolved: true });
    const update = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { incident: { findUnique, update } } }));

    const { POST } = await import("@/app/api/admin/client-health/incidents/[id]/acknowledge/route");
    const response = await POST(postRequest(), { params: Promise.resolve({ id: "incident-1" }) });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("records who acknowledged it and when", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "incident-1", resolved: false });
    const update = vi.fn().mockResolvedValue({ id: "incident-1", status: "ACKNOWLEDGED" });
    vi.doMock("@/lib/prisma", () => ({ prisma: { incident: { findUnique, update } } }));

    const { POST } = await import("@/app/api/admin/client-health/incidents/[id]/acknowledge/route");
    const response = await POST(postRequest(), { params: Promise.resolve({ id: "incident-1" }) });
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    const [args] = update.mock.calls[0];
    expect(args.data.acknowledgedById).toBe("admin-1");
    expect(args.data.acknowledgedAt).toBeInstanceOf(Date);
  });
});

describe("POST /api/admin/client-health/incidents/:id/resolve", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(requirePermission).mockResolvedValue({ admin: { id: "admin-1" } } as never);
  });

  afterEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("marks the incident resolved", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "incident-1", resolved: false });
    const update = vi.fn().mockResolvedValue({ id: "incident-1", resolved: true });
    vi.doMock("@/lib/prisma", () => ({ prisma: { incident: { findUnique, update } } }));

    const { POST } = await import("@/app/api/admin/client-health/incidents/[id]/resolve/route");
    const response = await POST(postRequest(), { params: Promise.resolve({ id: "incident-1" }) });
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    const [args] = update.mock.calls[0];
    expect(args.data.resolved).toBe(true);
    expect(args.data.status).toBe("RESOLVED");
  });

  it("refuses to resolve an already-resolved incident", async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: "incident-1", resolved: true });
    const update = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ prisma: { incident: { findUnique, update } } }));

    const { POST } = await import("@/app/api/admin/client-health/incidents/[id]/resolve/route");
    const response = await POST(postRequest(), { params: Promise.resolve({ id: "incident-1" }) });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});
