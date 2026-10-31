import { describe, expect, it } from "vitest";
import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import {
  mergeManualGrantsWithTemplates,
  mergeRoleTemplateGrants,
  type RoleTemplateGrantInput,
} from "@/lib/access/roleTemplateGrants";

describe("mergeRoleTemplateGrants", () => {
  it("returns an empty list for no templates", () => {
    expect(mergeRoleTemplateGrants([])).toEqual([]);
  });

  it("passes through a single template's grants unchanged", () => {
    const grants: RoleTemplateGrantInput[] = [
      { module: "projects", action: AccessAction.VIEW, scope: AccessScope.CLIENT },
    ];
    expect(mergeRoleTemplateGrants([{ grants }])).toEqual(grants);
  });

  it("unions distinct module+action pairs across templates — a narrower template never removes what a broader one grants", () => {
    const developer: RoleTemplateGrantInput[] = [
      { module: "projects", action: AccessAction.VIEW, scope: AccessScope.CLIENT },
    ];
    const projectManager: RoleTemplateGrantInput[] = [
      { module: "contracts", action: AccessAction.VIEW, scope: AccessScope.CLIENT },
    ];

    const merged = mergeRoleTemplateGrants([{ grants: developer }, { grants: projectManager }]);

    expect(merged).toHaveLength(2);
    expect(merged).toEqual(
      expect.arrayContaining([
        { module: "projects", action: AccessAction.VIEW, scope: AccessScope.CLIENT },
        { module: "contracts", action: AccessAction.VIEW, scope: AccessScope.CLIENT },
      ]),
    );
  });

  it("resolves the SAME module+action across templates to the highest-ranked scope (OWN < CLIENT < DEPARTMENT < ALL)", () => {
    const clientScoped: RoleTemplateGrantInput[] = [
      { module: "client_health", action: AccessAction.VIEW, scope: AccessScope.CLIENT },
    ];
    const departmentScoped: RoleTemplateGrantInput[] = [
      { module: "client_health", action: AccessAction.VIEW, scope: AccessScope.DEPARTMENT },
    ];

    // Order shouldn't matter — the broader one always wins regardless of
    // which template was applied first or second.
    const mergedA = mergeRoleTemplateGrants([{ grants: clientScoped }, { grants: departmentScoped }]);
    const mergedB = mergeRoleTemplateGrants([{ grants: departmentScoped }, { grants: clientScoped }]);

    expect(mergedA).toEqual([{ module: "client_health", action: AccessAction.VIEW, scope: AccessScope.DEPARTMENT }]);
    expect(mergedB).toEqual([{ module: "client_health", action: AccessAction.VIEW, scope: AccessScope.DEPARTMENT }]);
  });

  it("never lets a template silently narrow another template's grant for the same module+action", () => {
    const broad: RoleTemplateGrantInput[] = [
      { module: "team", action: AccessAction.VIEW, scope: AccessScope.ALL },
    ];
    const narrow: RoleTemplateGrantInput[] = [
      { module: "team", action: AccessAction.VIEW, scope: AccessScope.OWN },
    ];

    const merged = mergeRoleTemplateGrants([{ grants: broad }, { grants: narrow }]);

    expect(merged).toEqual([{ module: "team", action: AccessAction.VIEW, scope: AccessScope.ALL }]);
  });

  it("treats different actions on the same module as independent — EDIT doesn't inherit VIEW's scope or vice versa", () => {
    const grants: RoleTemplateGrantInput[] = [
      { module: "contracts", action: AccessAction.VIEW, scope: AccessScope.ALL },
      { module: "contracts", action: AccessAction.EDIT, scope: AccessScope.CLIENT },
    ];

    const merged = mergeRoleTemplateGrants([{ grants }]);

    expect(merged).toHaveLength(2);
    expect(merged).toEqual(expect.arrayContaining(grants));
  });
});

describe("mergeManualGrantsWithTemplates", () => {
  it("lets a manual edit widen what a template grants", () => {
    const templateGrants: RoleTemplateGrantInput[] = [
      { module: "campaigns", action: AccessAction.VIEW, scope: AccessScope.CLIENT },
    ];
    const manualGrants: RoleTemplateGrantInput[] = [
      { module: "campaigns", action: AccessAction.VIEW, scope: AccessScope.ALL },
    ];

    const merged = mergeManualGrantsWithTemplates(templateGrants, manualGrants);

    expect(merged).toEqual([{ module: "campaigns", action: AccessAction.VIEW, scope: AccessScope.ALL }]);
  });

  it("keeps a template's grant when the manual list doesn't mention that module+action", () => {
    const templateGrants: RoleTemplateGrantInput[] = [
      { module: "leave", action: AccessAction.VIEW, scope: AccessScope.OWN },
    ];

    const merged = mergeManualGrantsWithTemplates(templateGrants, []);

    expect(merged).toEqual(templateGrants);
  });
});
