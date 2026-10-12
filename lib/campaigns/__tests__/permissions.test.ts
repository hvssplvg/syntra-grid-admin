import { describe, expect, it } from "vitest";
import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import { assertCampaignRowAccess, campaignOwnScopeFilter, isOwnAdminUser, isOwnEmployee, type ResolvedIdentity } from "@/lib/campaigns/permissions";

function fakeIdentity(opts: {
  adminId?: string;
  employeeId?: string | null;
  departmentId?: string | null;
  isFullAccess?: boolean;
  grants?: Array<[string, AccessAction, AccessScope]>;
}): ResolvedIdentity {
  const permissions = new Map<string, Map<AccessAction, AccessScope>>();
  for (const [module, action, scope] of opts.grants ?? []) {
    if (!permissions.has(module)) permissions.set(module, new Map());
    permissions.get(module)!.set(action, scope);
  }

  return {
    admin: { id: opts.adminId ?? "admin-1" } as ResolvedIdentity["admin"],
    employee: opts.employeeId ? ({ id: opts.employeeId, departmentId: opts.departmentId ?? null } as ResolvedIdentity["employee"]) : null,
    isFullAccess: opts.isFullAccess ?? false,
    permissions,
  };
}

describe("campaignOwnScopeFilter", () => {
  it("returns undefined (unrestricted) for a full-access caller", () => {
    const identity = fakeIdentity({ isFullAccess: true });
    expect(campaignOwnScopeFilter(identity, AccessAction.VIEW)).toBeUndefined();
  });

  it("restricts to createdById for an OWN-scoped caller", () => {
    const identity = fakeIdentity({ adminId: "admin-7", grants: [["campaigns", AccessAction.VIEW, AccessScope.OWN]] });
    expect(campaignOwnScopeFilter(identity, AccessAction.VIEW)).toEqual({ createdById: "admin-7" });
  });

  it("restricts to the caller's own departmentId for a DEPARTMENT-scoped caller", () => {
    const identity = fakeIdentity({ employeeId: "emp-1", departmentId: "dept-5", grants: [["campaigns", AccessAction.VIEW, AccessScope.DEPARTMENT]] });
    expect(campaignOwnScopeFilter(identity, AccessAction.VIEW)).toEqual({ departmentId: "dept-5" });
  });

  it("resolves to an unmatchable filter for a DEPARTMENT-scoped caller with no linked department", () => {
    const identity = fakeIdentity({ grants: [["campaigns", AccessAction.VIEW, AccessScope.DEPARTMENT]] });
    const filter = campaignOwnScopeFilter(identity, AccessAction.VIEW);
    // Must never silently fall back to "no filter" (= see everything).
    expect(filter).not.toBeUndefined();
  });

  it("returns undefined for an ALL-scoped caller", () => {
    const identity = fakeIdentity({ grants: [["campaigns", AccessAction.VIEW, AccessScope.ALL]] });
    expect(campaignOwnScopeFilter(identity, AccessAction.VIEW)).toBeUndefined();
  });
});

describe("assertCampaignRowAccess", () => {
  it("allows a full-access caller on any row", () => {
    const identity = fakeIdentity({ isFullAccess: true });
    expect(() => assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: "someone-else" })).not.toThrow();
  });

  it("throws if the caller holds no grant at all for the action", () => {
    const identity = fakeIdentity({});
    expect(() => assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: "admin-1" })).toThrow();
  });

  it("blocks an OWN-scoped caller from a campaign she didn't create (IDOR guard)", () => {
    const identity = fakeIdentity({ adminId: "admin-1", grants: [["campaigns", AccessAction.EDIT, AccessScope.OWN]] });
    expect(() => assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: "admin-2" })).toThrow();
  });

  it("allows an OWN-scoped caller on her own campaign", () => {
    const identity = fakeIdentity({ adminId: "admin-1", grants: [["campaigns", AccessAction.EDIT, AccessScope.OWN]] });
    expect(() => assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: "admin-1" })).not.toThrow();
  });

  it("blocks a DEPARTMENT-scoped caller from a campaign in a different department", () => {
    const identity = fakeIdentity({ employeeId: "emp-1", departmentId: "dept-1", grants: [["campaigns", AccessAction.EDIT, AccessScope.DEPARTMENT]] });
    expect(() => assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: "admin-9", departmentId: "dept-2" })).toThrow();
  });

  it("allows a DEPARTMENT-scoped caller on a campaign in her own department", () => {
    const identity = fakeIdentity({ employeeId: "emp-1", departmentId: "dept-1", grants: [["campaigns", AccessAction.EDIT, AccessScope.DEPARTMENT]] });
    expect(() => assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: "admin-9", departmentId: "dept-1" })).not.toThrow();
  });
});

describe("isOwnEmployee / isOwnAdminUser", () => {
  it("isOwnEmployee matches the caller's own linked employee id", () => {
    const identity = fakeIdentity({ employeeId: "emp-1" });
    expect(isOwnEmployee(identity, "emp-1")).toBe(true);
    expect(isOwnEmployee(identity, "emp-2")).toBe(false);
    expect(isOwnEmployee(identity, null)).toBe(false);
  });

  it("isOwnAdminUser matches the caller's own admin id", () => {
    const identity = fakeIdentity({ adminId: "admin-3" });
    expect(isOwnAdminUser(identity, "admin-3")).toBe(true);
    expect(isOwnAdminUser(identity, "admin-4")).toBe(false);
  });
});
