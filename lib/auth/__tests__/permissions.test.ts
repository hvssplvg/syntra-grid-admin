import { describe, expect, it } from "vitest";
import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import {
  AuthorisationError,
  SCOPE_RANK,
  assertClientRowAccess,
  clientScopeIdFilter,
  hasPermission,
  resolveClientScope,
  type ResolvedIdentity,
} from "@/lib/auth/permissions";

// Deliberately NOT importing from '@/lib/auth/current-admin' — this
// module is globally mocked in vitest.setup.ts (it transitively pulls in
// next/headers, which only resolves inside Next's own runtime). These
// tests exercise the real, pure CLIENT-scope logic directly.

function fakeIdentity(opts: {
  isFullAccess?: boolean;
  grants?: Array<[string, AccessAction, AccessScope]>;
  assignedClientIds?: string[];
}): ResolvedIdentity {
  const permissions = new Map<string, Map<AccessAction, AccessScope>>();
  for (const [module, action, scope] of opts.grants ?? []) {
    if (!permissions.has(module)) permissions.set(module, new Map());
    permissions.get(module)!.set(action, scope);
  }

  return {
    admin: { id: "admin-1" } as ResolvedIdentity["admin"],
    employee: null,
    isFullAccess: opts.isFullAccess ?? false,
    permissions,
    assignedClientIds: opts.assignedClientIds ?? [],
  };
}

describe("SCOPE_RANK", () => {
  it("orders OWN < CLIENT < DEPARTMENT < ALL", () => {
    expect(SCOPE_RANK[AccessScope.OWN]).toBeLessThan(SCOPE_RANK[AccessScope.CLIENT]);
    expect(SCOPE_RANK[AccessScope.CLIENT]).toBeLessThan(SCOPE_RANK[AccessScope.DEPARTMENT]);
    expect(SCOPE_RANK[AccessScope.DEPARTMENT]).toBeLessThan(SCOPE_RANK[AccessScope.ALL]);
  });
});

describe("hasPermission", () => {
  it("full access always passes, regardless of grants", () => {
    const identity = fakeIdentity({ isFullAccess: true });
    expect(hasPermission(identity, "contracts", AccessAction.DELETE)).toBe(true);
  });

  it("restricted with no grant for the module denies", () => {
    const identity = fakeIdentity({ grants: [] });
    expect(hasPermission(identity, "contracts", AccessAction.VIEW)).toBe(false);
  });

  it("restricted with a narrower scope than requested denies", () => {
    const identity = fakeIdentity({ grants: [["contracts", AccessAction.VIEW, AccessScope.CLIENT]] });
    expect(hasPermission(identity, "contracts", AccessAction.VIEW, { scope: AccessScope.ALL })).toBe(false);
  });

  it("restricted with a scope at or above the requested one allows", () => {
    const identity = fakeIdentity({ grants: [["contracts", AccessAction.VIEW, AccessScope.ALL]] });
    expect(hasPermission(identity, "contracts", AccessAction.VIEW, { scope: AccessScope.CLIENT })).toBe(true);
  });
});

describe("resolveClientScope / clientScopeIdFilter", () => {
  it("full access never restricts", () => {
    const identity = fakeIdentity({ isFullAccess: true, assignedClientIds: ["meldex"] });
    expect(resolveClientScope(identity, "contracts", AccessAction.VIEW)).toEqual({ restricted: false });
    expect(clientScopeIdFilter(identity, "contracts", AccessAction.VIEW)).toBeUndefined();
  });

  it("a grant scoped to ALL never restricts by client", () => {
    const identity = fakeIdentity({ grants: [["contracts", AccessAction.VIEW, AccessScope.ALL]] });
    expect(resolveClientScope(identity, "contracts", AccessAction.VIEW)).toEqual({ restricted: false });
  });

  it("a CLIENT-scoped grant restricts to exactly the assigned client ids", () => {
    const identity = fakeIdentity({
      grants: [["contracts", AccessAction.VIEW, AccessScope.CLIENT]],
      assignedClientIds: ["meldex", "homewise"],
    });
    expect(resolveClientScope(identity, "contracts", AccessAction.VIEW)).toEqual({
      restricted: true,
      clientIds: ["meldex", "homewise"],
    });
    expect(clientScopeIdFilter(identity, "contracts", AccessAction.VIEW)).toEqual({
      in: ["meldex", "homewise"],
    });
  });

  it("a CLIENT-scoped grant with zero assignments restricts to an empty set — never falls back to seeing everything", () => {
    const identity = fakeIdentity({
      grants: [["contracts", AccessAction.VIEW, AccessScope.CLIENT]],
      assignedClientIds: [],
    });
    expect(clientScopeIdFilter(identity, "contracts", AccessAction.VIEW)).toEqual({ in: [] });
  });
});

describe("assertClientRowAccess", () => {
  it("full access always passes", () => {
    const identity = fakeIdentity({ isFullAccess: true });
    expect(() => assertClientRowAccess(identity, "contracts", AccessAction.EDIT, { clientId: "anything" })).not.toThrow();
  });

  it("no grant at all throws AuthorisationError", () => {
    const identity = fakeIdentity({ grants: [] });
    expect(() => assertClientRowAccess(identity, "contracts", AccessAction.EDIT, { clientId: "meldex" })).toThrow(
      AuthorisationError,
    );
  });

  it("a non-CLIENT scope (e.g. ALL) with a grant always passes, any row", () => {
    const identity = fakeIdentity({ grants: [["contracts", AccessAction.EDIT, AccessScope.ALL]] });
    expect(() => assertClientRowAccess(identity, "contracts", AccessAction.EDIT, { clientId: "anyone-elses-client" })).not.toThrow();
  });

  it("CLIENT scope with the row's clientId in the assigned set passes", () => {
    const identity = fakeIdentity({
      grants: [["contracts", AccessAction.EDIT, AccessScope.CLIENT]],
      assignedClientIds: ["meldex"],
    });
    expect(() => assertClientRowAccess(identity, "contracts", AccessAction.EDIT, { clientId: "meldex" })).not.toThrow();
  });

  it("CLIENT scope with the row belonging to an unassigned client throws — the core cross-client isolation guarantee", () => {
    const identity = fakeIdentity({
      grants: [["contracts", AccessAction.EDIT, AccessScope.CLIENT]],
      assignedClientIds: ["meldex"],
    });
    expect(() => assertClientRowAccess(identity, "contracts", AccessAction.EDIT, { clientId: "homewise" })).toThrow(
      AuthorisationError,
    );
  });

  it("CLIENT scope with a null-owned row (e.g. Syntra Grid's own social account) always throws", () => {
    const identity = fakeIdentity({
      grants: [["social_media", AccessAction.MANAGE, AccessScope.CLIENT]],
      assignedClientIds: ["meldex"],
    });
    expect(() => assertClientRowAccess(identity, "social_media", AccessAction.MANAGE, { clientId: null })).toThrow(
      AuthorisationError,
    );
  });
});
