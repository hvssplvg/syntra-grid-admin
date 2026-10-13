// lib/brand-assets/server.ts
//
// Core CRUD, status-transition enforcement, and read models for the
// Brand Assets module — mirrors lib/social-media/server.ts's shape and
// conventions exactly (pagination house style, server-side transition
// enforcement, real activity logging).

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import {
  BrandAssetStatus,
  BrandAssetType,
  BrandGuidelineStatus,
  BrandKitStatus,
  BrandRequestActivityType,
  BrandRequestPriority,
  BrandRequestStatus,
  BrandRequestType,
  BrandTemplateCategory,
  BrandTemplateStatus,
} from "@/app/generated/prisma/enums";
import { Prisma } from "@/app/generated/prisma/client";
import {
  AccessAction,
  brandAssetsOwnScopeFilter,
  brandRequestOwnScopeFilter,
  type ResolvedIdentity,
} from "@/lib/brand-assets/permissions";
import { deleteBrandAssetFiles, uploadBrandAssetFile } from "@/lib/brand-assets/media";
import { createNotification, NotificationType } from "@/lib/notifications/create";

/* ============================================================================
   PAGINATION — matches lib/social-media/server.ts's own house style
============================================================================ */

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function resolvePagination(page: number | null, pageSize: number | null) {
  const resolvedPage = Math.max(DEFAULT_PAGE, page ?? DEFAULT_PAGE);
  const resolvedPageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize ?? DEFAULT_PAGE_SIZE));
  return { page: resolvedPage, pageSize: resolvedPageSize, skip: (resolvedPage - 1) * resolvedPageSize };
}

export function buildPaginationResult(page: number, pageSize: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return { page, pageSize, total, pages, hasPrevious: page > 1, hasNext: page < pages };
}

/* ============================================================================
   BRAND KITS
============================================================================ */

const KIT_INCLUDE = {
  client: { select: { id: true, name: true, slug: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  logoAsset: true,
  _count: { select: { assets: true, templates: true, requests: true } },
} satisfies Prisma.BrandKitInclude;

export type BrandKitWithRelations = Prisma.BrandKitGetPayload<{ include: typeof KIT_INCLUDE }>;

export async function listBrandKits(filters: { status?: BrandKitStatus | null; clientId?: string | null; search?: string | null }) {
  const where: Prisma.BrandKitWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.search
      ? { OR: [{ name: { contains: filters.search, mode: "insensitive" } }, { description: { contains: filters.search, mode: "insensitive" } }] }
      : {}),
  };

  return prisma.brandKit.findMany({ where, include: KIT_INCLUDE, orderBy: { updatedAt: "desc" } });
}

export async function getBrandKitOrThrow(id: string): Promise<BrandKitWithRelations> {
  const kit = await prisma.brandKit.findUnique({ where: { id }, include: KIT_INCLUDE });
  if (!kit) throw new AuthorisationError("This brand kit could not be found.");
  return kit;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "brand-kit"
  );
}

async function uniqueKitSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let suffix = 1;
  while (await prisma.brandKit.findUnique({ where: { slug }, select: { id: true } })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

export type CreateBrandKitInput = {
  name: string;
  description?: string | null;
  clientId?: string | null;
  primaryColors?: string[];
  secondaryColors?: string[];
  typography?: Record<string, string> | null;
};

export async function createBrandKit(identity: ResolvedIdentity, input: CreateBrandKitInput) {
  const slug = await uniqueKitSlug(input.name);

  return prisma.brandKit.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      clientId: input.clientId ?? null,
      primaryColors: input.primaryColors ?? Prisma.JsonNull,
      secondaryColors: input.secondaryColors ?? Prisma.JsonNull,
      typography: input.typography ?? Prisma.JsonNull,
      createdById: identity.admin.id,
    },
    include: KIT_INCLUDE,
  });
}

export type UpdateBrandKitInput = Partial<Omit<CreateBrandKitInput, "name">> & {
  name?: string;
  logoAssetId?: string | null;
  status?: BrandKitStatus;
};

export async function updateBrandKit(id: string, input: UpdateBrandKitInput) {
  await getBrandKitOrThrow(id);

  return prisma.brandKit.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
      ...(input.primaryColors !== undefined ? { primaryColors: input.primaryColors ?? Prisma.JsonNull } : {}),
      ...(input.secondaryColors !== undefined ? { secondaryColors: input.secondaryColors ?? Prisma.JsonNull } : {}),
      ...(input.typography !== undefined ? { typography: input.typography ?? Prisma.JsonNull } : {}),
      ...(input.logoAssetId !== undefined ? { logoAssetId: input.logoAssetId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include: KIT_INCLUDE,
  });
}

export async function archiveBrandKit(id: string) {
  await getBrandKitOrThrow(id);
  return prisma.brandKit.update({ where: { id }, data: { status: BrandKitStatus.ARCHIVED }, include: KIT_INCLUDE });
}

export async function duplicateBrandKit(identity: ResolvedIdentity, id: string) {
  const existing = await getBrandKitOrThrow(id);
  const slug = await uniqueKitSlug(`${existing.name} copy`);

  return prisma.brandKit.create({
    data: {
      name: `${existing.name} (copy)`,
      slug,
      description: existing.description,
      clientId: existing.clientId,
      primaryColors: existing.primaryColors ?? Prisma.JsonNull,
      secondaryColors: existing.secondaryColors ?? Prisma.JsonNull,
      typography: existing.typography ?? Prisma.JsonNull,
      createdById: identity.admin.id,
      status: BrandKitStatus.DRAFT,
    },
    include: KIT_INCLUDE,
  });
}

/* ============================================================================
   BRAND ASSETS (library)
============================================================================ */

const ASSET_INCLUDE = {
  brandKit: { select: { id: true, name: true } },
  uploadedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.BrandAssetInclude;

export type BrandAssetWithRelations = Prisma.BrandAssetGetPayload<{ include: typeof ASSET_INCLUDE }>;

export type ListBrandAssetsFilters = {
  type?: BrandAssetType | null;
  status?: BrandAssetStatus | null;
  category?: string | null;
  tag?: string | null;
  brandKitId?: string | null;
  search?: string | null;
  page?: number | null;
  pageSize?: number | null;
  sort?: "newest" | "oldest" | "name" | "size";
};

export async function listBrandAssets(identity: ResolvedIdentity, filters: ListBrandAssetsFilters) {
  const { page, pageSize, skip } = resolvePagination(filters.page ?? null, filters.pageSize ?? null);

  // A caller granted VIEW at OWN scope only ever sees assets they
  // uploaded themselves — the same scope-filtering Social Media applies
  // to listPosts, just keyed to uploadedById instead of createdById.
  const ownFilter = brandAssetsOwnScopeFilter(identity, AccessAction.VIEW, "uploadedById");

  const where: Prisma.BrandAssetWhereInput = {
    status: filters.status ?? BrandAssetStatus.ACTIVE,
    ...(ownFilter ?? {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.tag ? { tags: { has: filters.tag } } : {}),
    ...(filters.brandKitId ? { brandKitId: filters.brandKitId } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.BrandAssetOrderByWithRelationInput =
    filters.sort === "oldest"
      ? { createdAt: "asc" }
      : filters.sort === "name"
        ? { name: "asc" }
        : filters.sort === "size"
          ? { fileSizeBytes: "desc" }
          : { createdAt: "desc" };

  const [total, assets] = await Promise.all([
    prisma.brandAsset.count({ where }),
    prisma.brandAsset.findMany({ where, include: ASSET_INCLUDE, orderBy, skip, take: pageSize }),
  ]);

  return { assets, pagination: buildPaginationResult(page, pageSize, total) };
}

export async function getBrandAssetOrThrow(id: string): Promise<BrandAssetWithRelations> {
  const asset = await prisma.brandAsset.findUnique({ where: { id }, include: ASSET_INCLUDE });
  if (!asset) throw new AuthorisationError("This brand asset could not be found.");
  return asset;
}

export type CreateBrandAssetInput = {
  name: string;
  description?: string | null;
  type: BrandAssetType;
  category?: string | null;
  tags?: string[];
  usageRights?: "INTERNAL_ONLY" | "CLIENT_APPROVED" | "PUBLIC" | "UNRESTRICTED";
  brandKitId?: string | null;
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

export async function createBrandAsset(identity: ResolvedIdentity, input: CreateBrandAssetInput) {
  const uploaded = await uploadBrandAssetFile({ buffer: input.buffer, mimeType: input.mimeType, filename: input.filename, type: input.type });

  return prisma.brandAsset.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      category: input.category ?? null,
      tags: input.tags ?? [],
      usageRights: input.usageRights ?? "INTERNAL_ONLY",
      brandKitId: input.brandKitId ?? null,
      url: uploaded.url,
      cloudinaryPublicId: uploaded.cloudinaryPublicId,
      mimeType: input.mimeType,
      fileSizeBytes: uploaded.fileSizeBytes,
      width: uploaded.width,
      height: uploaded.height,
      durationSeconds: uploaded.durationSeconds,
      uploadedById: identity.admin.id,
    },
    include: ASSET_INCLUDE,
  });
}

export type UpdateBrandAssetMetadataInput = {
  name?: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
  usageRights?: "INTERNAL_ONLY" | "CLIENT_APPROVED" | "PUBLIC" | "UNRESTRICTED";
  brandKitId?: string | null;
};

export async function updateBrandAssetMetadata(id: string, input: UpdateBrandAssetMetadataInput) {
  await getBrandAssetOrThrow(id);

  return prisma.brandAsset.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.usageRights !== undefined ? { usageRights: input.usageRights } : {}),
      ...(input.brandKitId !== undefined ? { brandKitId: input.brandKitId } : {}),
    },
    include: ASSET_INCLUDE,
  });
}

/** Uploads a new file for an existing asset, snapshotting the current
 *  file as a version first — so "replace" never loses the prior file,
 *  and "version history" is just these snapshots ordered by number. */
export async function replaceBrandAsset(
  identity: ResolvedIdentity,
  id: string,
  input: { buffer: Buffer; mimeType: string; filename: string; note?: string | null },
) {
  const existing = await getBrandAssetOrThrow(id);

  const uploaded = await uploadBrandAssetFile({ buffer: input.buffer, mimeType: input.mimeType, filename: input.filename, type: existing.type });

  const lastVersion = await prisma.brandAssetVersion.findFirst({ where: { assetId: id }, orderBy: { versionNumber: "desc" } });
  const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

  await prisma.brandAssetVersion.create({
    data: {
      assetId: id,
      versionNumber: nextVersionNumber,
      url: existing.url,
      cloudinaryPublicId: existing.cloudinaryPublicId,
      fileSizeBytes: existing.fileSizeBytes,
      note: input.note ?? "Replaced",
      createdById: identity.admin.id,
    },
  });

  return prisma.brandAsset.update({
    where: { id },
    data: {
      url: uploaded.url,
      cloudinaryPublicId: uploaded.cloudinaryPublicId,
      mimeType: input.mimeType,
      fileSizeBytes: uploaded.fileSizeBytes,
      width: uploaded.width,
      height: uploaded.height,
      durationSeconds: uploaded.durationSeconds,
    },
    include: ASSET_INCLUDE,
  });
}

export async function listBrandAssetVersions(assetId: string) {
  await getBrandAssetOrThrow(assetId);
  return prisma.brandAssetVersion.findMany({
    where: { assetId },
    orderBy: { versionNumber: "desc" },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
  });
}

/** Restores a past version onto the live asset — the asset's current
 *  file is itself snapshotted first, so restoring is never destructive:
 *  you can always restore forward again afterwards. */
export async function restoreBrandAssetVersion(identity: ResolvedIdentity, assetId: string, versionId: string) {
  const existing = await getBrandAssetOrThrow(assetId);
  const version = await prisma.brandAssetVersion.findUnique({ where: { id: versionId } });

  if (!version || version.assetId !== assetId) {
    throw new AuthorisationError("That version could not be found for this asset.");
  }

  const lastVersion = await prisma.brandAssetVersion.findFirst({ where: { assetId }, orderBy: { versionNumber: "desc" } });
  const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

  await prisma.brandAssetVersion.create({
    data: {
      assetId,
      versionNumber: nextVersionNumber,
      url: existing.url,
      cloudinaryPublicId: existing.cloudinaryPublicId,
      fileSizeBytes: existing.fileSizeBytes,
      note: `Before restoring to version ${version.versionNumber}`,
      createdById: identity.admin.id,
    },
  });

  return prisma.brandAsset.update({
    where: { id: assetId },
    data: {
      url: version.url,
      cloudinaryPublicId: version.cloudinaryPublicId,
      fileSizeBytes: version.fileSizeBytes,
    },
    include: ASSET_INCLUDE,
  });
}

export async function archiveBrandAsset(id: string) {
  await getBrandAssetOrThrow(id);
  return prisma.brandAsset.update({ where: { id }, data: { status: BrandAssetStatus.ARCHIVED }, include: ASSET_INCLUDE });
}

export async function restoreBrandAsset(id: string) {
  await getBrandAssetOrThrow(id);
  return prisma.brandAsset.update({ where: { id }, data: { status: BrandAssetStatus.ACTIVE }, include: ASSET_INCLUDE });
}

/** Real, irreversible delete — blocked while the asset is a brand kit's
 *  logo or still attached to a non-terminal social media post, exactly
 *  like Social Media's own deleteSocialMediaAsset guard. */
export async function deleteBrandAsset(id: string) {
  const asset = await prisma.brandAsset.findUnique({
    where: { id },
    include: {
      logoForKit: { select: { id: true, name: true } },
      socialMediaAssets: { include: { postAssets: { include: { post: { select: { id: true, title: true, status: true } } } } } },
      versions: true,
    },
  });

  if (!asset) throw new AuthorisationError("This brand asset could not be found.");

  if (asset.logoForKit) {
    throw new AuthorisationError(`This asset is the logo for "${asset.logoForKit.name}". Choose a different logo first.`);
  }

  // Deliberately stricter than Social Media's own deleteSocialMediaAsset
  // (which allows deleting a PUBLISHED post's media, since that post's
  // content is already live on the platform itself). A Brand Asset is a
  // shared master file that can be reused across many posts — including
  // ones already published, whose history/thumbnail in the Social Media
  // tab still renders this same Cloudinary file. Destroying it here
  // would silently break that historical record, which is exactly what
  // this guard exists to prevent — so ANY reuse at all blocks the hard
  // delete, not just an in-flight one. Archiving (which never touches
  // the Cloudinary file) is always available as the reversible
  // alternative.
  if (asset.socialMediaAssets.length > 0) {
    const referencedPost = asset.socialMediaAssets.flatMap((socialAsset) => socialAsset.postAssets)[0]?.post;
    throw new AuthorisationError(
      referencedPost
        ? `This asset is still used by "${referencedPost.title ?? "an untitled post"}" in Social Media. Archive it instead, or remove it from that post first.`
        : "This asset has been attached to a social media post and can no longer be safely deleted. Archive it instead.",
    );
  }

  await deleteBrandAssetFiles([
    { cloudinaryPublicId: asset.cloudinaryPublicId, type: asset.type },
    ...asset.versions.map((version) => ({ cloudinaryPublicId: version.cloudinaryPublicId, type: asset.type })),
  ]);

  await prisma.brandAsset.delete({ where: { id } });
}

/* ============================================================================
   BRAND GUIDELINES
============================================================================ */

const GUIDELINE_INCLUDE = {
  updatedBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.BrandGuidelineInclude;

export async function getBrandGuideline(brandKitId: string) {
  await getBrandKitOrThrow(brandKitId);
  return prisma.brandGuideline.findUnique({ where: { brandKitId }, include: GUIDELINE_INCLUDE });
}

export type UpsertGuidelineInput = Partial<{
  tagline: string | null;
  mission: string | null;
  vision: string | null;
  values: string[];
  personality: string | null;
  toneOfVoice: string | null;
  logoSpacingNotes: string | null;
  minLogoSizeNotes: string | null;
  approvedUsageNotes: string | null;
  incorrectUsageNotes: string | null;
  fontUsageNotes: string | null;
  socialMediaGuidelines: string | null;
  photographyGuidelines: string | null;
  videoGuidelines: string | null;
  marketingStandards: string | null;
  emailSignatureGuidelines: string | null;
}>;

export async function upsertBrandGuideline(identity: ResolvedIdentity, brandKitId: string, input: UpsertGuidelineInput) {
  await getBrandKitOrThrow(brandKitId);

  const data = {
    ...input,
    updatedById: identity.admin.id,
  };

  return prisma.brandGuideline.upsert({
    where: { brandKitId },
    create: { brandKitId, ...data, status: BrandGuidelineStatus.DRAFT },
    update: data,
    include: GUIDELINE_INCLUDE,
  });
}

async function snapshotGuidelineVersion(identity: ResolvedIdentity, guidelineId: string, note: string) {
  const guideline = await prisma.brandGuideline.findUnique({ where: { id: guidelineId } });
  if (!guideline) return;

  const lastVersion = await prisma.brandGuidelineVersion.findFirst({ where: { guidelineId }, orderBy: { versionNumber: "desc" } });
  const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

  await prisma.brandGuidelineVersion.create({
    data: {
      guidelineId,
      versionNumber: nextVersionNumber,
      snapshot: guideline as unknown as Prisma.InputJsonValue,
      note,
      createdById: identity.admin.id,
    },
  });
}

export async function publishBrandGuideline(identity: ResolvedIdentity, brandKitId: string) {
  const guideline = await getBrandGuideline(brandKitId);
  if (!guideline) throw new AuthorisationError("Add some guideline content before publishing.");

  await snapshotGuidelineVersion(identity, guideline.id, "Published");

  return prisma.brandGuideline.update({
    where: { brandKitId },
    data: { status: BrandGuidelineStatus.PUBLISHED, updatedById: identity.admin.id },
    include: GUIDELINE_INCLUDE,
  });
}

export async function unpublishBrandGuideline(identity: ResolvedIdentity, brandKitId: string) {
  const guideline = await getBrandGuideline(brandKitId);
  if (!guideline) throw new AuthorisationError("This brand kit has no guideline yet.");

  return prisma.brandGuideline.update({
    where: { brandKitId },
    data: { status: BrandGuidelineStatus.DRAFT, updatedById: identity.admin.id },
    include: GUIDELINE_INCLUDE,
  });
}

export async function listBrandGuidelineVersions(brandKitId: string) {
  const guideline = await getBrandGuideline(brandKitId);
  if (!guideline) return [];

  return prisma.brandGuidelineVersion.findMany({
    where: { guidelineId: guideline.id },
    orderBy: { versionNumber: "desc" },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
  });
}

/* ============================================================================
   BRAND TEMPLATES
============================================================================ */

const TEMPLATE_INCLUDE = {
  brandKit: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.BrandTemplateInclude;

export type ListBrandTemplatesFilters = {
  category?: BrandTemplateCategory | null;
  status?: BrandTemplateStatus | null;
  brandKitId?: string | null;
  search?: string | null;
  page?: number | null;
  pageSize?: number | null;
};

export async function listBrandTemplates(filters: ListBrandTemplatesFilters) {
  const { page, pageSize, skip } = resolvePagination(filters.page ?? null, filters.pageSize ?? null);

  const where: Prisma.BrandTemplateWhereInput = {
    status: filters.status ?? BrandTemplateStatus.ACTIVE,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.brandKitId ? { brandKitId: filters.brandKitId } : {}),
    ...(filters.search ? { name: { contains: filters.search, mode: "insensitive" } } : {}),
  };

  const [total, templates] = await Promise.all([
    prisma.brandTemplate.count({ where }),
    prisma.brandTemplate.findMany({ where, include: TEMPLATE_INCLUDE, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
  ]);

  return { templates, pagination: buildPaginationResult(page, pageSize, total) };
}

export async function getBrandTemplateOrThrow(id: string) {
  const template = await prisma.brandTemplate.findUnique({ where: { id }, include: TEMPLATE_INCLUDE });
  if (!template) throw new AuthorisationError("This template could not be found.");
  return template;
}

export type CreateBrandTemplateInput = {
  name: string;
  description?: string | null;
  category: BrandTemplateCategory;
  tags?: string[];
  brandKitId?: string | null;
  buffer: Buffer;
  mimeType: string;
  filename: string;
};

export async function createBrandTemplate(identity: ResolvedIdentity, input: CreateBrandTemplateInput) {
  // Templates reuse the same file-type rules as a generic design/document
  // asset would — a template is just as likely to be a PDF, a design
  // file or an image export.
  const uploaded = await uploadBrandAssetFile({
    buffer: input.buffer,
    mimeType: input.mimeType,
    filename: input.filename,
    type: guessAssetTypeForTemplate(input.mimeType, input.filename),
  });

  return prisma.brandTemplate.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      tags: input.tags ?? [],
      brandKitId: input.brandKitId ?? null,
      url: uploaded.url,
      cloudinaryPublicId: uploaded.cloudinaryPublicId,
      mimeType: input.mimeType,
      fileSizeBytes: uploaded.fileSizeBytes,
      width: uploaded.width,
      height: uploaded.height,
      createdById: identity.admin.id,
    },
    include: TEMPLATE_INCLUDE,
  });
}

function guessAssetTypeForTemplate(mimeType: string, filename: string): BrandAssetType {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (mimeType.startsWith("image/svg")) return BrandAssetType.SVG;
  if (mimeType.startsWith("image/")) return BrandAssetType.IMAGE;
  if (mimeType === "application/pdf" || ext === "pdf") return BrandAssetType.DOCUMENT;
  if (["ppt", "pptx"].includes(ext)) return BrandAssetType.PRESENTATION;
  if (["ai", "eps", "psd", "sketch", "fig", "xd"].includes(ext)) return BrandAssetType.DESIGN_FILE;
  return BrandAssetType.OTHER;
}

export type UpdateBrandTemplateInput = Partial<{
  name: string;
  description: string | null;
  category: BrandTemplateCategory;
  tags: string[];
  brandKitId: string | null;
}>;

export async function updateBrandTemplate(id: string, input: UpdateBrandTemplateInput) {
  await getBrandTemplateOrThrow(id);
  return prisma.brandTemplate.update({ where: { id }, data: input, include: TEMPLATE_INCLUDE });
}

export async function archiveBrandTemplate(id: string) {
  await getBrandTemplateOrThrow(id);
  return prisma.brandTemplate.update({ where: { id }, data: { status: BrandTemplateStatus.ARCHIVED }, include: TEMPLATE_INCLUDE });
}

export async function restoreBrandTemplate(id: string) {
  await getBrandTemplateOrThrow(id);
  return prisma.brandTemplate.update({ where: { id }, data: { status: BrandTemplateStatus.ACTIVE }, include: TEMPLATE_INCLUDE });
}

export async function duplicateBrandTemplate(identity: ResolvedIdentity, id: string) {
  const existing = await getBrandTemplateOrThrow(id);

  return prisma.brandTemplate.create({
    data: {
      name: `${existing.name} (copy)`,
      description: existing.description,
      category: existing.category,
      tags: existing.tags,
      brandKitId: existing.brandKitId,
      url: existing.url,
      cloudinaryPublicId: existing.cloudinaryPublicId,
      mimeType: existing.mimeType,
      fileSizeBytes: existing.fileSizeBytes,
      width: existing.width,
      height: existing.height,
      createdById: identity.admin.id,
    },
    include: TEMPLATE_INCLUDE,
  });
}

/* ============================================================================
   BRAND REQUESTS (requests & approvals)
============================================================================ */

const REQUEST_INCLUDE = {
  brandKit: { select: { id: true, name: true } },
  requestedBy: { select: { id: true, firstName: true, lastName: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  attachments: { include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } } },
  comments: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" as const } },
  activities: { include: { actor: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.BrandRequestInclude;

export type BrandRequestWithRelations = Prisma.BrandRequestGetPayload<{ include: typeof REQUEST_INCLUDE }>;

async function logRequestActivity(
  requestId: string,
  actorId: string | null,
  type: BrandRequestActivityType,
  description?: string | null,
  metadata?: Prisma.InputJsonValue,
) {
  await prisma.brandRequestActivity.create({ data: { requestId, actorId, type, description: description ?? null, metadata } });
}

const REQUEST_TRANSITIONS: Record<BrandRequestStatus, BrandRequestStatus[]> = {
  SUBMITTED: [BrandRequestStatus.IN_PROGRESS, BrandRequestStatus.CANCELLED],
  IN_PROGRESS: [BrandRequestStatus.READY_FOR_REVIEW, BrandRequestStatus.CANCELLED],
  READY_FOR_REVIEW: [
    BrandRequestStatus.APPROVED,
    BrandRequestStatus.CHANGES_REQUESTED,
    BrandRequestStatus.REJECTED,
    BrandRequestStatus.CANCELLED,
  ],
  CHANGES_REQUESTED: [BrandRequestStatus.IN_PROGRESS, BrandRequestStatus.CANCELLED],
  APPROVED: [BrandRequestStatus.COMPLETED, BrandRequestStatus.CANCELLED],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

function assertRequestTransition(current: BrandRequestStatus, next: BrandRequestStatus) {
  if (!REQUEST_TRANSITIONS[current].includes(next)) {
    throw new AuthorisationError(
      `A request in ${current.replace(/_/g, " ").toLowerCase()} status cannot move to ${next.replace(/_/g, " ").toLowerCase()}.`,
    );
  }
}

export type ListBrandRequestsFilters = {
  status?: BrandRequestStatus | null;
  type?: BrandRequestType | null;
  priority?: BrandRequestPriority | null;
  assignedToId?: string | null;
  requestedById?: string | null;
  brandKitId?: string | null;
  search?: string | null;
  page?: number | null;
  pageSize?: number | null;
};

export async function listBrandRequests(identity: ResolvedIdentity, filters: ListBrandRequestsFilters) {
  const { page, pageSize, skip } = resolvePagination(filters.page ?? null, filters.pageSize ?? null);

  const ownFilter = brandRequestOwnScopeFilter(identity, AccessAction.VIEW);

  const where: Prisma.BrandRequestWhereInput = {
    ...(ownFilter ?? {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
    ...(filters.requestedById ? { requestedById: filters.requestedById } : {}),
    ...(filters.brandKitId ? { brandKitId: filters.brandKitId } : {}),
    ...(filters.search
      ? { OR: [{ title: { contains: filters.search, mode: "insensitive" } }, { description: { contains: filters.search, mode: "insensitive" } }] }
      : {}),
  };

  const [total, requests] = await Promise.all([
    prisma.brandRequest.count({ where }),
    prisma.brandRequest.findMany({
      where,
      include: {
        brandKit: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { comments: true, attachments: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return { requests, pagination: buildPaginationResult(page, pageSize, total) };
}

export async function getBrandRequestOrThrow(id: string): Promise<BrandRequestWithRelations> {
  const request = await prisma.brandRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
  if (!request) throw new AuthorisationError("This request could not be found.");
  return request;
}

export type CreateBrandRequestInput = {
  title: string;
  description: string;
  type: BrandRequestType;
  priority?: BrandRequestPriority;
  brandKitId?: string | null;
  dueDate?: Date | null;
  assignedToId?: string | null;
};

export async function createBrandRequest(identity: ResolvedIdentity, input: CreateBrandRequestInput) {
  const request = await prisma.brandRequest.create({
    data: {
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority ?? BrandRequestPriority.MEDIUM,
      brandKitId: input.brandKitId ?? null,
      dueDate: input.dueDate ?? null,
      assignedToId: input.assignedToId ?? null,
      requestedById: identity.admin.id,
    },
    include: REQUEST_INCLUDE,
  });

  await logRequestActivity(request.id, identity.admin.id, BrandRequestActivityType.CREATED, "Request created");
  if (input.assignedToId) {
    await logRequestActivity(request.id, identity.admin.id, BrandRequestActivityType.ASSIGNED, "Assigned at creation");
  }

  return getBrandRequestOrThrow(request.id);
}

export async function assignBrandRequest(identity: ResolvedIdentity, requestId: string, assignedToId: string | null) {
  await getBrandRequestOrThrow(requestId);

  await prisma.brandRequest.update({ where: { id: requestId }, data: { assignedToId } });
  await logRequestActivity(
    requestId,
    identity.admin.id,
    BrandRequestActivityType.ASSIGNED,
    assignedToId ? "Assigned" : "Unassigned",
  );

  return getBrandRequestOrThrow(requestId);
}

export async function updateBrandRequestDetails(
  requestId: string,
  input: Partial<{ title: string; description: string; priority: BrandRequestPriority; dueDate: Date | null; brandKitId: string | null }>,
) {
  await getBrandRequestOrThrow(requestId);
  await prisma.brandRequest.update({ where: { id: requestId }, data: input });
  return getBrandRequestOrThrow(requestId);
}

async function transitionBrandRequest(
  identity: ResolvedIdentity,
  requestId: string,
  next: BrandRequestStatus,
  activityType: BrandRequestActivityType,
  description: string,
  extra?: Prisma.BrandRequestUpdateInput,
) {
  const existing = await getBrandRequestOrThrow(requestId);
  assertRequestTransition(existing.status, next);

  await prisma.brandRequest.update({
    where: { id: requestId },
    data: { status: next, ...(extra ?? {}) },
  });

  await logRequestActivity(requestId, identity.admin.id, activityType, description);

  if ((next === BrandRequestStatus.APPROVED || next === BrandRequestStatus.REJECTED) && existing.requestedById) {
    await createNotification({
      recipientAdminUserId: existing.requestedById,
      actorId: identity.admin.id,
      type: NotificationType.BRAND_REQUEST_DECIDED,
      title: `Brand request ${next === BrandRequestStatus.APPROVED ? "approved" : "rejected"} — ${existing.title}`,
      body: next === BrandRequestStatus.REJECTED ? description : null,
      module: "brand_assets",
      entityType: "BrandRequest",
      entityId: requestId,
      sourceKey: `brand_request_decided:${requestId}`,
    });
  }

  return getBrandRequestOrThrow(requestId);
}

export const startBrandRequestProgress = (identity: ResolvedIdentity, requestId: string) =>
  transitionBrandRequest(identity, requestId, BrandRequestStatus.IN_PROGRESS, BrandRequestActivityType.STATUS_CHANGED, "Started work");

export const submitBrandRequestForReview = (identity: ResolvedIdentity, requestId: string) =>
  transitionBrandRequest(identity, requestId, BrandRequestStatus.READY_FOR_REVIEW, BrandRequestActivityType.STATUS_CHANGED, "Ready for review");

export const approveBrandRequest = (identity: ResolvedIdentity, requestId: string) =>
  transitionBrandRequest(identity, requestId, BrandRequestStatus.APPROVED, BrandRequestActivityType.APPROVED, "Approved");

export const rejectBrandRequest = (identity: ResolvedIdentity, requestId: string, reason: string) =>
  transitionBrandRequest(identity, requestId, BrandRequestStatus.REJECTED, BrandRequestActivityType.REJECTED, reason);

export const requestBrandRequestChanges = (identity: ResolvedIdentity, requestId: string, notes: string) =>
  transitionBrandRequest(identity, requestId, BrandRequestStatus.CHANGES_REQUESTED, BrandRequestActivityType.CHANGES_REQUESTED, notes);

export const completeBrandRequest = (identity: ResolvedIdentity, requestId: string) =>
  transitionBrandRequest(identity, requestId, BrandRequestStatus.COMPLETED, BrandRequestActivityType.COMPLETED, "Completed", {
    completedAt: new Date(),
  });

export const cancelBrandRequest = (identity: ResolvedIdentity, requestId: string) =>
  transitionBrandRequest(identity, requestId, BrandRequestStatus.CANCELLED, BrandRequestActivityType.CANCELLED, "Cancelled");

export async function addBrandRequestComment(identity: ResolvedIdentity, requestId: string, body: string) {
  await getBrandRequestOrThrow(requestId);

  await prisma.brandRequestComment.create({ data: { requestId, authorId: identity.admin.id, body } });
  await logRequestActivity(requestId, identity.admin.id, BrandRequestActivityType.COMMENTED, body.slice(0, 140));

  return getBrandRequestOrThrow(requestId);
}

export async function addBrandRequestAttachment(
  identity: ResolvedIdentity,
  requestId: string,
  input: { buffer: Buffer; mimeType: string; filename: string },
) {
  await getBrandRequestOrThrow(requestId);

  const uploaded = await uploadBrandAssetFile({
    buffer: input.buffer,
    mimeType: input.mimeType,
    filename: input.filename,
    type: guessAssetTypeForTemplate(input.mimeType, input.filename),
  });

  await prisma.brandRequestAttachment.create({
    data: {
      requestId,
      name: input.filename,
      url: uploaded.url,
      cloudinaryPublicId: uploaded.cloudinaryPublicId,
      mimeType: input.mimeType,
      fileSizeBytes: uploaded.fileSizeBytes,
      uploadedById: identity.admin.id,
    },
  });

  await logRequestActivity(requestId, identity.admin.id, BrandRequestActivityType.ATTACHMENT_ADDED, input.filename);

  return getBrandRequestOrThrow(requestId);
}

/* ============================================================================
   OVERVIEW
============================================================================ */

export async function getBrandAssetsOverview() {
  const [
    totalAssets,
    assetStorage,
    templateStorage,
    activeBrandKits,
    totalTemplates,
    pendingRequests,
    recentAssets,
    recentKits,
  ] = await Promise.all([
    prisma.brandAsset.count({ where: { status: BrandAssetStatus.ACTIVE } }),
    prisma.brandAsset.aggregate({ _sum: { fileSizeBytes: true } }),
    prisma.brandTemplate.aggregate({ _sum: { fileSizeBytes: true } }),
    prisma.brandKit.count({ where: { status: BrandKitStatus.ACTIVE } }),
    prisma.brandTemplate.count({ where: { status: BrandTemplateStatus.ACTIVE } }),
    prisma.brandRequest.count({ where: { status: { in: [BrandRequestStatus.READY_FOR_REVIEW] } } }),
    prisma.brandAsset.findMany({
      where: { status: BrandAssetStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.brandKit.findMany({
      where: { status: { not: BrandKitStatus.ARCHIVED } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, status: true, updatedAt: true },
    }),
  ]);

  return {
    totalAssets,
    storageBytes: (assetStorage._sum.fileSizeBytes ?? 0) + (templateStorage._sum.fileSizeBytes ?? 0),
    activeBrandKits,
    totalTemplates,
    pendingApprovalRequests: pendingRequests,
    recentAssets,
    recentKits,
  };
}
