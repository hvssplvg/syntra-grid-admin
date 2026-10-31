import { describe, expect, it, vi } from "vitest";
import {
  reconcileClientAssignments,
  reconcileRoleTemplateAssignments,
} from "@/lib/access/server";

// @/lib/prisma is globally mocked (vitest.setup.ts) — irrelevant here
// since both functions take their `tx` client as an explicit argument
// rather than reaching for the module-level prisma singleton.

function fakeTx(existingRows: { clientId?: string; roleTemplateId?: string }[]) {
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const createMany = vi.fn().mockResolvedValue({ count: 0 });

  const tx = {
    clientAssignment: {
      findMany: vi.fn().mockResolvedValue(existingRows.filter((r) => r.clientId).map((r) => ({ clientId: r.clientId }))),
      deleteMany,
      createMany,
    },
    adminUserRoleTemplate: {
      findMany: vi.fn().mockResolvedValue(existingRows.filter((r) => r.roleTemplateId).map((r) => ({ roleTemplateId: r.roleTemplateId }))),
      deleteMany,
      createMany,
    },
  };

  return tx as unknown as Parameters<typeof reconcileClientAssignments>[0] & typeof tx;
}

describe("reconcileClientAssignments", () => {
  it("creates rows for newly-assigned clients and leaves unrelated ones untouched", async () => {
    const tx = fakeTx([{ clientId: "meldex" }]);

    const result = await reconcileClientAssignments(tx, "admin-1", ["meldex", "homewise"], "actor-1");

    expect(result).toEqual({ added: ["homewise"], removed: [] });
    expect(tx.clientAssignment.createMany).toHaveBeenCalledWith({
      data: [{ adminUserId: "admin-1", clientId: "homewise", assignedById: "actor-1" }],
    });
    expect(tx.clientAssignment.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes rows for clients no longer in the submitted set", async () => {
    const tx = fakeTx([{ clientId: "meldex" }, { clientId: "homewise" }]);

    const result = await reconcileClientAssignments(tx, "admin-1", ["meldex"], "actor-1");

    expect(result).toEqual({ added: [], removed: ["homewise"] });
    expect(tx.clientAssignment.deleteMany).toHaveBeenCalledWith({
      where: { adminUserId: "admin-1", clientId: { in: ["homewise"] } },
    });
    expect(tx.clientAssignment.createMany).not.toHaveBeenCalled();
  });

  it("an empty submitted set revokes every existing assignment", async () => {
    const tx = fakeTx([{ clientId: "meldex" }]);

    const result = await reconcileClientAssignments(tx, "admin-1", [], "actor-1");

    expect(result).toEqual({ added: [], removed: ["meldex"] });
  });

  it("no change when the submitted set exactly matches the existing one", async () => {
    const tx = fakeTx([{ clientId: "meldex" }]);

    const result = await reconcileClientAssignments(tx, "admin-1", ["meldex"], "actor-1");

    expect(result).toEqual({ added: [], removed: [] });
    expect(tx.clientAssignment.createMany).not.toHaveBeenCalled();
    expect(tx.clientAssignment.deleteMany).not.toHaveBeenCalled();
  });
});

describe("reconcileRoleTemplateAssignments", () => {
  it("creates and deletes AdminUserRoleTemplate rows the same way", async () => {
    const tx = fakeTx([{ roleTemplateId: "role_developer" }]);

    const result = await reconcileRoleTemplateAssignments(
      tx,
      "admin-1",
      ["role_developer", "role_project_manager"],
      "actor-1",
    );

    expect(result).toEqual({ added: ["role_project_manager"], removed: [] });
    expect(tx.adminUserRoleTemplate.createMany).toHaveBeenCalledWith({
      data: [{ adminUserId: "admin-1", roleTemplateId: "role_project_manager", assignedById: "actor-1" }],
    });
  });
});
