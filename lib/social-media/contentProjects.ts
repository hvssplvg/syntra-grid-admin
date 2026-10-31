// lib/social-media/contentProjects.ts
//
// Content Studio's editable-project persistence (Phase 3, 3B). Same
// permission module as the rest of Social Media (AccessAction.CREATE/
// EDIT/VIEW on "social_media") — no new permission concept. Ownership
// is keyed on ContentProject.ownerId rather than createdById, so this
// uses its own small scope check rather than reusing
// socialMediaOwnScopeFilter/assertSocialMediaRowAccess verbatim (those
// are hardcoded to createdById for the other social-media models).

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, AccessScope, type ResolvedIdentity } from "@/lib/social-media/permissions";
import { Prisma } from "@/app/generated/prisma/client";
import { ContentProjectType } from "@/app/generated/prisma/enums";

function ownScopeFilter(identity: ResolvedIdentity, action: AccessAction): { ownerId: string } | undefined {
  if (identity.isFullAccess) return undefined;
  const scope = identity.permissions.get("social_media")?.get(action);
  return scope === AccessScope.OWN ? { ownerId: identity.admin.id } : undefined;
}

function assertRowAccess(identity: ResolvedIdentity, action: AccessAction, row: { ownerId: string }) {
  if (identity.isFullAccess) return;
  const scope = identity.permissions.get("social_media")?.get(action);
  if (!scope) throw new AuthorisationError(`You are not authorised to ${action.toLowerCase()} content projects.`);
  if (scope === AccessScope.OWN && row.ownerId !== identity.admin.id) {
    throw new AuthorisationError("You can only act on content projects you own.");
  }
}

/** Minimal shape check before anything is written — never trusts the
 *  client's canvasData blindly. Doesn't validate every field (layer
 *  shapes evolve), just the structural envelope every real GRAPHIC
 *  canvas has. */
export function isValidCanvasDataShape(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.width === "number" &&
    typeof data.height === "number" &&
    typeof data.background === "string" &&
    Array.isArray(data.layers)
  );
}

/** Same idea as isValidCanvasDataShape, for type VIDEO's scene-timeline
 *  shape (wizard/videoCanvas.ts's VideoCanvasData) — structural
 *  envelope only, not a full per-scene/per-layer validation. */
export function isValidVideoCanvasDataShape(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return typeof data.width === "number" && typeof data.height === "number" && typeof data.fps === "number" && Array.isArray(data.scenes);
}

/** Dispatches to the right shape check for a given project type — the
 *  single place a route needs to call rather than branching itself. */
export function isValidCanvasDataShapeForType(type: ContentProjectType, value: unknown): boolean {
  return type === ContentProjectType.VIDEO ? isValidVideoCanvasDataShape(value) : isValidCanvasDataShape(value);
}

export async function listContentProjects(identity: ResolvedIdentity) {
  const own = ownScopeFilter(identity, AccessAction.VIEW);
  return prisma.contentProject.findMany({
    where: own,
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, type: true, updatedAt: true, socialPostId: true },
  });
}

export async function getContentProject(identity: ResolvedIdentity, id: string) {
  const project = await prisma.contentProject.findUnique({ where: { id } });
  if (!project) return null;
  assertRowAccess(identity, AccessAction.VIEW, project);
  return project;
}

export async function createContentProject(
  identity: ResolvedIdentity,
  input: { title: string; type?: ContentProjectType; canvasData: Prisma.InputJsonValue },
) {
  return prisma.contentProject.create({
    data: {
      title: input.title,
      type: input.type ?? ContentProjectType.GRAPHIC,
      canvasData: input.canvasData,
      ownerId: identity.admin.id,
    },
  });
}

export async function updateContentProject(
  identity: ResolvedIdentity,
  id: string,
  input: { title?: string; canvasData?: Prisma.InputJsonValue },
) {
  const project = await prisma.contentProject.findUnique({ where: { id } });
  if (!project) throw new AuthorisationError("Content project not found.");
  assertRowAccess(identity, AccessAction.EDIT, project);

  return prisma.contentProject.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.canvasData !== undefined ? { canvasData: input.canvasData } : {}),
    },
  });
}

export async function deleteContentProject(identity: ResolvedIdentity, id: string) {
  const project = await prisma.contentProject.findUnique({ where: { id } });
  if (!project) throw new AuthorisationError("Content project not found.");
  assertRowAccess(identity, AccessAction.EDIT, project);
  await prisma.contentProject.delete({ where: { id } });
}

export async function duplicateContentProject(identity: ResolvedIdentity, id: string) {
  const project = await prisma.contentProject.findUnique({ where: { id } });
  if (!project) throw new AuthorisationError("Content project not found.");
  assertRowAccess(identity, AccessAction.VIEW, project);

  return prisma.contentProject.create({
    data: {
      title: `Copy of ${project.title}`,
      type: project.type,
      canvasData: project.canvasData as Prisma.InputJsonValue,
      ownerId: identity.admin.id,
    },
  });
}
