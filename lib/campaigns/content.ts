// lib/campaigns/content.ts
//
// Campaign content workflow. Brand Assets are attached by reference only
// (CampaignContentAsset.brandAssetId) — never re-uploaded, never copied —
// and every attach/detach goes through Brand Assets' own permission and
// row-access checks so this module can never see or touch an asset its
// caller isn't actually allowed to. Publishing reuses Social Media's real
// pipeline (createPost + the existing reuse-without-reupload helper) —
// this module never talks to a platform API directly, and content is
// never marked PUBLISHED except by reflecting that real post's own
// confirmed status.

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import { CampaignActivityType, CampaignContentStatus, CampaignContentType } from "@/app/generated/prisma/enums";
import type { ResolvedIdentity } from "@/lib/campaigns/permissions";
import { logCampaignActivity } from "@/lib/campaigns/activity";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import {
  AccessAction as BrandAssetsAction,
  assertBrandAssetsRowAccess,
  getCurrentIdentity as getBrandAssetsIdentity,
} from "@/lib/brand-assets/permissions";
import { getBrandAssetOrThrow } from "@/lib/brand-assets/server";
import { reuseBrandAssetAsSocialMediaAsset } from "@/lib/social-media/media";
import { createPost, type PostTargetInput } from "@/lib/social-media/server";

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, jobTitle: true, avatarUrl: true } as const;
const ADMIN_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

const CONTENT_INCLUDE = {
  creator: { select: EMPLOYEE_SELECT },
  reviewer: { select: EMPLOYEE_SELECT },
  createdBy: { select: ADMIN_SELECT },
  updatedBy: { select: ADMIN_SELECT },
  assets: { include: { brandAsset: { select: { id: true, name: true, url: true, type: true, usageRights: true } } } },
  socialPost: { select: { id: true, status: true, publishedAt: true } },
} as const;

/* ============================================================================
   STATUS TRANSITIONS

   PUBLISHED never appears as a reachable "next" value here on purpose —
   it can only be set by syncContentPublishStatusFromSocialPost, reflecting
   a real linked SocialPost's own confirmed status.
============================================================================ */

const CONTENT_TRANSITIONS: Record<CampaignContentStatus, CampaignContentStatus[]> = {
  DRAFT: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["READY_FOR_REVIEW", "CANCELLED"],
  READY_FOR_REVIEW: ["APPROVED", "CHANGES_REQUESTED", "CANCELLED"],
  CHANGES_REQUESTED: ["IN_PROGRESS", "CANCELLED"],
  APPROVED: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["CANCELLED"],
  PUBLISHED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function assertValidContentTransition(current: CampaignContentStatus, next: CampaignContentStatus) {
  if (current === next) return;
  if (next === "PUBLISHED") {
    throw new AuthorisationError("Content can only be published through its linked social media post.");
  }
  if (!CONTENT_TRANSITIONS[current].includes(next)) {
    throw new AuthorisationError(`Content cannot move from ${current} to ${next}.`);
  }
}

/* ============================================================================
   LIST / DETAIL
============================================================================ */

export async function listCampaignContent(
  campaignId: string,
  filters: { status?: CampaignContentStatus | null; type?: CampaignContentType | null },
) {
  await getCampaignOrThrow(campaignId);
  return prisma.campaignContent.findMany({
    where: { campaignId, ...(filters.status ? { status: filters.status } : {}), ...(filters.type ? { type: filters.type } : {}) },
    orderBy: { updatedAt: "desc" },
    include: CONTENT_INCLUDE,
  });
}

export async function getCampaignContentOrThrow(campaignId: string, contentId: string) {
  const content = await prisma.campaignContent.findUnique({ where: { id: contentId }, include: CONTENT_INCLUDE });
  if (!content || content.campaignId !== campaignId) throw new AuthorisationError("This content item could not be found.");
  return content;
}

/* ============================================================================
   CREATE / EDIT
============================================================================ */

export type ContentInput = {
  title: string;
  description?: string | null;
  type: CampaignContentType;
  body?: string | null;
  caption?: string | null;
  hashtags?: string[];
  callToAction?: string | null;
  channel?: string | null;
  creatorId?: string | null;
  reviewerId?: string | null;
  dueAt?: Date | null;
  scheduledAt?: Date | null;
};

export async function createCampaignContent(identity: ResolvedIdentity, campaignId: string, input: ContentInput) {
  await getCampaignOrThrow(campaignId);

  if (input.creatorId) {
    const creator = await prisma.employee.findUnique({ where: { id: input.creatorId }, select: { id: true } });
    if (!creator) throw new AuthorisationError("The selected creator could not be found.");
  }
  if (input.reviewerId) {
    const reviewer = await prisma.employee.findUnique({ where: { id: input.reviewerId }, select: { id: true } });
    if (!reviewer) throw new AuthorisationError("The selected reviewer could not be found.");
  }

  const content = await prisma.campaignContent.create({
    data: { campaignId, ...input, createdById: identity.admin.id, updatedById: identity.admin.id },
    include: CONTENT_INCLUDE,
  });

  await logCampaignActivity(campaignId, identity.admin.id, CampaignActivityType.CREATED, `Content "${content.title}" created.`);

  return content;
}

export async function updateCampaignContent(
  identity: ResolvedIdentity,
  campaignId: string,
  contentId: string,
  input: Partial<ContentInput> & { status?: CampaignContentStatus; reviewNotes?: string | null },
) {
  const existing = await getCampaignContentOrThrow(campaignId, contentId);

  if (input.status && input.status !== existing.status) {
    assertValidContentTransition(existing.status, input.status);
    if (input.status === "CHANGES_REQUESTED" && !input.reviewNotes?.trim()) {
      throw new AuthorisationError("Reviewer notes are required when requesting changes.");
    }
  }

  const content = await prisma.campaignContent.update({
    where: { id: contentId },
    data: { ...input, updatedById: identity.admin.id },
    include: CONTENT_INCLUDE,
  });

  if (input.status && input.status !== existing.status) {
    const activityByStatus: Partial<Record<CampaignContentStatus, CampaignActivityType>> = {
      READY_FOR_REVIEW: CampaignActivityType.CONTENT_SUBMITTED,
      APPROVED: CampaignActivityType.CONTENT_APPROVED,
      CHANGES_REQUESTED: CampaignActivityType.CONTENT_CHANGES_REQUESTED,
    };
    const type = activityByStatus[input.status];
    if (type) await logCampaignActivity(campaignId, identity.admin.id, type, `"${content.title}" moved to ${input.status}.`);
  } else {
    const { supersedeApprovalsForEntity } = await import("@/lib/campaigns/approvals");
    await supersedeApprovalsForEntity("CampaignContent", content.id);
  }

  return content;
}

export async function deleteCampaignContent(campaignId: string, contentId: string) {
  const existing = await getCampaignContentOrThrow(campaignId, contentId);
  if (existing.status === "PUBLISHED") {
    throw new AuthorisationError("This content has already been published and can no longer be deleted. Archive it instead.");
  }
  await prisma.campaignContent.delete({ where: { id: contentId } });
}

/* ============================================================================
   BRAND ASSETS INTEGRATION

   Every attach goes through Brand Assets' own VIEW-level row access check
   (brandAssetsOwnScopeFilter's row-level twin, assertBrandAssetsRowAccess)
   using THIS caller's identity resolved against the brand_assets module —
   never this module's own campaigns permissions, which have no bearing on
   what brand assets the caller is allowed to see.
============================================================================ */

export async function attachBrandAssetToContent(campaignId: string, contentId: string, brandAssetId: string) {
  await getCampaignContentOrThrow(campaignId, contentId);

  const brandIdentity = await getBrandAssetsIdentity();
  const asset = await getBrandAssetOrThrow(brandAssetId);
  assertBrandAssetsRowAccess(brandIdentity, BrandAssetsAction.VIEW, { ownerId: asset.uploadedById });

  if (asset.status !== "ACTIVE") {
    throw new AuthorisationError("This brand asset is not active and cannot be attached.");
  }
  if (asset.usageRights === "INTERNAL_ONLY") {
    throw new AuthorisationError("This asset is marked internal-only and cannot be used in campaign content intended for publication.");
  }

  const existing = await prisma.campaignContentAsset.findUnique({
    where: { contentId_brandAssetId: { contentId, brandAssetId } },
  });
  if (existing) return existing;

  const position = await prisma.campaignContentAsset.count({ where: { contentId } });

  return prisma.campaignContentAsset.create({ data: { contentId, brandAssetId, position } });
}

export async function removeBrandAssetFromContent(campaignId: string, contentId: string, contentAssetId: string) {
  await getCampaignContentOrThrow(campaignId, contentId);
  const existing = await prisma.campaignContentAsset.findUnique({ where: { id: contentAssetId } });
  if (!existing || existing.contentId !== contentId) throw new AuthorisationError("This attachment could not be found.");
  // Only the join row is removed — the BrandAsset and its Cloudinary file
  // are never touched, exactly like Social Media's own asset detach.
  await prisma.campaignContentAsset.delete({ where: { id: contentAssetId } });
}

/* ============================================================================
   SOCIAL MEDIA INTEGRATION

   Reuses the existing publishing pipeline end to end: brand assets become
   real SocialMediaAsset rows via the already-audited reuse helper (no
   re-upload, same INTERNAL_ONLY guard enforced a second time inside it),
   and the post itself is created by Social Media's own createPost — this
   module never calls a platform API.
============================================================================ */

export async function createSocialPostFromContent(
  identity: ResolvedIdentity,
  campaignId: string,
  contentId: string,
  targets: PostTargetInput[],
) {
  const content = await getCampaignContentOrThrow(campaignId, contentId);

  if (content.socialPostId) {
    throw new AuthorisationError("This content is already linked to a social media post.");
  }
  if (!content.caption?.trim()) {
    throw new AuthorisationError("This content needs a caption before it can become a social media post.");
  }
  if (!["APPROVED", "SCHEDULED"].includes(content.status)) {
    throw new AuthorisationError("Only approved content can be published to social media.");
  }
  if (targets.length === 0) {
    throw new AuthorisationError("At least one connected account is required.");
  }

  const assetIds: string[] = [];
  for (const contentAsset of content.assets) {
    if (contentAsset.brandAsset.type !== "IMAGE" && contentAsset.brandAsset.type !== "VIDEO") continue;
    const socialAsset = await reuseBrandAssetAsSocialMediaAsset(contentAsset.brandAssetId, identity.admin.id);
    assetIds.push(socialAsset.id);
  }

  const post = await createPost(identity, {
    title: content.title,
    caption: content.caption,
    targets,
    assetIds,
  });

  await prisma.campaignContent.update({ where: { id: contentId }, data: { socialPostId: post.id, updatedById: identity.admin.id } });

  await logCampaignActivity(campaignId, identity.admin.id, CampaignActivityType.CONTENT_SUBMITTED, `"${content.title}" published to social media as a new post.`);

  return post;
}

/** Reflects a linked SocialPost's own confirmed status onto its campaign
 *  content — the only path by which content ever becomes PUBLISHED. Safe
 *  to call speculatively (e.g. after a manual refresh); it is a no-op if
 *  nothing changed. */
export async function syncContentPublishStatusFromSocialPost(contentId: string) {
  const content = await prisma.campaignContent.findUnique({ where: { id: contentId }, include: { socialPost: true } });
  if (!content?.socialPost) return content;

  if (["PUBLISHED", "PARTIALLY_PUBLISHED"].includes(content.socialPost.status) && content.status !== "PUBLISHED") {
    return prisma.campaignContent.update({
      where: { id: contentId },
      data: { status: "PUBLISHED", publishedAt: content.socialPost.publishedAt ?? new Date() },
      include: CONTENT_INCLUDE,
    });
  }

  return content;
}
