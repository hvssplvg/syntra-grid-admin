// lib/social-media/server.ts
//
// Core CRUD, status-transition enforcement, and read models for the
// Social Media module. Status transitions are validated here — server
// side — not just hidden in the UI, per the approval-workflow requirement.

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import {
  SocialMediaPlacement,
  SocialPlatform,
  SocialPostActivityType,
  SocialPostStatus,
  SocialPostTargetStatus,
} from "@/app/generated/prisma/enums";
import { Prisma } from "@/app/generated/prisma/client";
import {
  AccessAction,
  type ResolvedIdentity,
  socialMediaOwnScopeFilter,
} from "@/lib/social-media/permissions";

/* ============================================================================
   PAGINATION — matches app/api/admin/invoices/route.ts's house style
============================================================================ */

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export function resolvePagination(page: number | null, pageSize: number | null) {
  const resolvedPage = Math.max(DEFAULT_PAGE, page ?? DEFAULT_PAGE);
  const resolvedPageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize ?? DEFAULT_PAGE_SIZE));
  return { page: resolvedPage, pageSize: resolvedPageSize, skip: (resolvedPage - 1) * resolvedPageSize };
}

export function buildPaginationResult(page: number, pageSize: number, total: number): Pagination {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return { page, pageSize, total, pages, hasPrevious: page > 1, hasNext: page < pages };
}

/* ============================================================================
   STATUS TRANSITIONS

   Enforced here, server-side — the UI only ever shows the actions that
   would be valid; an API call attempting an invalid transition is
   rejected regardless of what the client sends.
============================================================================ */

const ALLOWED_TRANSITIONS: Record<SocialPostStatus, SocialPostStatus[]> = {
  DRAFT: [SocialPostStatus.PENDING_REVIEW, SocialPostStatus.CANCELLED],
  PENDING_REVIEW: [SocialPostStatus.APPROVED, SocialPostStatus.CHANGES_REQUESTED, SocialPostStatus.CANCELLED],
  CHANGES_REQUESTED: [SocialPostStatus.PENDING_REVIEW, SocialPostStatus.DRAFT, SocialPostStatus.CANCELLED],
  APPROVED: [SocialPostStatus.SCHEDULED, SocialPostStatus.CANCELLED],
  SCHEDULED: [SocialPostStatus.PUBLISHING, SocialPostStatus.CANCELLED],
  PUBLISHING: [SocialPostStatus.PUBLISHED, SocialPostStatus.PARTIALLY_PUBLISHED, SocialPostStatus.FAILED],
  PUBLISHED: [],
  PARTIALLY_PUBLISHED: [],
  FAILED: [],
  CANCELLED: [],
};

export function assertTransition(current: SocialPostStatus, next: SocialPostStatus) {
  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new AuthorisationError(
      `A post in ${current.replace(/_/g, " ").toLowerCase()} status cannot move to ${next.replace(/_/g, " ").toLowerCase()}.`,
    );
  }
}

/* ============================================================================
   ACTIVITY LOG
============================================================================ */

export async function logPostActivity(
  postId: string,
  actorId: string | null,
  type: SocialPostActivityType,
  description?: string | null,
  metadata?: Prisma.InputJsonValue,
) {
  await prisma.socialPostActivity.create({
    data: { postId, actorId, type, description: description ?? null, metadata },
  });
}

/* ============================================================================
   INCLUDES
============================================================================ */

const ADMIN_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

const POST_INCLUDE = {
  campaign: { select: { id: true, name: true, status: true } },
  createdBy: { select: ADMIN_SELECT },
  updatedBy: { select: ADMIN_SELECT },
  reviewedBy: { select: ADMIN_SELECT },
  targets: { include: { account: { select: { id: true, platform: true, accountName: true, username: true, status: true } } } },
  assets: { include: { asset: true }, orderBy: { position: "asc" as const } },
} satisfies Prisma.SocialPostInclude;

export type PostWithRelations = Prisma.SocialPostGetPayload<{ include: typeof POST_INCLUDE }>;

/* ============================================================================
   LIST / GET POSTS
============================================================================ */

export type ListPostsFilters = {
  status?: SocialPostStatus | null;
  platform?: SocialPlatform | null;
  campaignId?: string | null;
  search?: string | null;
  page?: number | null;
  pageSize?: number | null;
};

export async function listPosts(identity: ResolvedIdentity, filters: ListPostsFilters) {
  const { page, pageSize, skip } = resolvePagination(filters.page ?? null, filters.pageSize ?? null);

  const ownFilter = socialMediaOwnScopeFilter(identity, AccessAction.VIEW);

  const where: Prisma.SocialPostWhereInput = {
    ...(ownFilter ?? {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.platform ? { targets: { some: { platform: filters.platform } } } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            { caption: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, posts] = await Promise.all([
    prisma.socialPost.count({ where }),
    prisma.socialPost.findMany({
      where,
      include: POST_INCLUDE,
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return { posts, pagination: buildPaginationResult(page, pageSize, total) };
}

export async function getPostOrThrow(postId: string): Promise<PostWithRelations> {
  const post = await prisma.socialPost.findUnique({ where: { id: postId }, include: POST_INCLUDE });
  if (!post) throw new AuthorisationError("Post could not be found.");
  return post;
}

/* ============================================================================
   CREATE / UPDATE / DELETE
============================================================================ */

export type PostTargetInput = { accountId: string; caption?: string | null; placement?: SocialMediaPlacement };

export type CreatePostInput = {
  title?: string | null;
  caption: string;
  category?: string | null;
  campaignId?: string | null;
  targets: PostTargetInput[];
  assetIds?: string[];
};

async function requireAccountsExist(accountIds: string[]) {
  if (accountIds.length === 0) return;
  const count = await prisma.socialAccount.count({ where: { id: { in: accountIds } } });
  if (count !== accountIds.length) {
    throw new AuthorisationError("One or more selected accounts could not be found.");
  }
}

async function requireAssetsExist(assetIds: string[]) {
  if (assetIds.length === 0) return;
  const count = await prisma.socialMediaAsset.count({ where: { id: { in: assetIds } } });
  if (count !== assetIds.length) {
    throw new AuthorisationError("One or more selected media items could not be found.");
  }
}

export async function createPost(identity: ResolvedIdentity, input: CreatePostInput) {
  await requireAccountsExist(input.targets.map((target) => target.accountId));
  await requireAssetsExist(input.assetIds ?? []);

  const accounts = input.targets.length
    ? await prisma.socialAccount.findMany({
        where: { id: { in: input.targets.map((target) => target.accountId) } },
        select: { id: true, platform: true },
      })
    : [];

  const platformByAccount = new Map(accounts.map((account) => [account.id, account.platform]));

  const post = await prisma.socialPost.create({
    data: {
      title: input.title ?? null,
      caption: input.caption,
      category: input.category ?? null,
      campaignId: input.campaignId ?? null,
      createdById: identity.admin.id,
      updatedById: identity.admin.id,
      targets: {
        create: input.targets.map((target) => ({
          accountId: target.accountId,
          platform: platformByAccount.get(target.accountId) as SocialPlatform,
          caption: target.caption ?? null,
          placement: target.placement ?? SocialMediaPlacement.FEED,
        })),
      },
      assets: {
        create: (input.assetIds ?? []).map((assetId, position) => ({ assetId, position })),
      },
    },
    include: POST_INCLUDE,
  });

  await logPostActivity(post.id, identity.admin.id, SocialPostActivityType.CREATED, "Post created");

  return post;
}

export type UpdatePostInput = Partial<Omit<CreatePostInput, "targets">> & { targets?: PostTargetInput[] };

const EDITABLE_STATUSES: SocialPostStatus[] = [SocialPostStatus.DRAFT, SocialPostStatus.CHANGES_REQUESTED];

export async function updatePost(identity: ResolvedIdentity, postId: string, input: UpdatePostInput) {
  const existing = await getPostOrThrow(postId);

  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw new AuthorisationError(
      `A post in ${existing.status.replace(/_/g, " ").toLowerCase()} status can no longer be edited.`,
    );
  }

  if (input.targets) {
    await requireAccountsExist(input.targets.map((target) => target.accountId));
  }

  if (input.assetIds) {
    await requireAssetsExist(input.assetIds);
  }

  await prisma.$transaction(async (tx) => {
    if (input.targets) {
      const accounts = await tx.socialAccount.findMany({
        where: { id: { in: input.targets.map((target) => target.accountId) } },
        select: { id: true, platform: true },
      });
      const platformByAccount = new Map(accounts.map((account) => [account.id, account.platform]));

      await tx.socialPostPlatform.deleteMany({ where: { postId } });
      await tx.socialPostPlatform.createMany({
        data: input.targets.map((target) => ({
          postId,
          accountId: target.accountId,
          platform: platformByAccount.get(target.accountId) as SocialPlatform,
          caption: target.caption ?? null,
          placement: target.placement ?? SocialMediaPlacement.FEED,
        })),
      });
    }

    if (input.assetIds) {
      await tx.socialPostAsset.deleteMany({ where: { postId } });
      await tx.socialPostAsset.createMany({
        data: input.assetIds.map((assetId, position) => ({ postId, assetId, position })),
      });
    }

    await tx.socialPost.update({
      where: { id: postId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
        updatedById: identity.admin.id,
      },
    });
  });

  await logPostActivity(postId, identity.admin.id, SocialPostActivityType.EDITED, "Post edited");

  return getPostOrThrow(postId);
}

/**
 * Deletion is allowed for every status except PUBLISHING (actively
 * racing a cron/"Publish Now" call) and PUBLISHED/PARTIALLY_PUBLISHED
 * (requires an explicit separate confirmation, since the post already
 * exists on the external platform and we never claim to remove it
 * there too). A past-due scheduledAt has no bearing on any of this —
 * only SocialPost.status matters.
 */
export class PostDeletionConflictError extends Error {
  code: "CURRENTLY_PUBLISHING" | "REQUIRES_PUBLISHED_CONFIRMATION";

  constructor(message: string, code: "CURRENTLY_PUBLISHING" | "REQUIRES_PUBLISHED_CONFIRMATION") {
    super(message);
    this.code = code;
  }
}

const CANCEL_THEN_DELETE_STATUSES: SocialPostStatus[] = [
  SocialPostStatus.PENDING_REVIEW,
  SocialPostStatus.CHANGES_REQUESTED,
  SocialPostStatus.APPROVED,
  SocialPostStatus.SCHEDULED,
];

const PUBLISHED_STATUSES: SocialPostStatus[] = [SocialPostStatus.PUBLISHED, SocialPostStatus.PARTIALLY_PUBLISHED];

export async function deletePost(
  identity: ResolvedIdentity,
  postId: string,
  options?: { confirmPublishedRemoval?: boolean },
) {
  const existing = await getPostOrThrow(postId);

  if (existing.status === SocialPostStatus.PUBLISHING) {
    throw new PostDeletionConflictError(
      "This post is currently publishing and can't be deleted yet. Try again in a moment.",
      "CURRENTLY_PUBLISHING",
    );
  }

  if (PUBLISHED_STATUSES.includes(existing.status) && !options?.confirmPublishedRemoval) {
    throw new PostDeletionConflictError(
      "This post has already been published. Confirm removal to continue — this will not delete it from the connected social platform.",
      "REQUIRES_PUBLISHED_CONFIRMATION",
    );
  }

  await prisma.$transaction(async (tx) => {
    // Re-check status inside the transaction: closes the window between
    // the read above and this write, so a cron/"Publish Now" claim that
    // lands in between is not blown away mid-flight.
    const current = await tx.socialPost.findUniqueOrThrow({ where: { id: postId }, select: { status: true } });

    if (current.status === SocialPostStatus.PUBLISHING) {
      throw new PostDeletionConflictError(
        "This post started publishing just now and can't be deleted yet. Try again in a moment.",
        "CURRENTLY_PUBLISHING",
      );
    }

    if (CANCEL_THEN_DELETE_STATUSES.includes(current.status)) {
      await tx.socialPostPlatform.updateMany({
        where: { postId, status: { in: [SocialPostTargetStatus.PENDING, SocialPostTargetStatus.SCHEDULED] } },
        data: { status: SocialPostTargetStatus.CANCELLED },
      });
    }

    await tx.socialPost.delete({ where: { id: postId } });

    await tx.auditLog.create({
      data: {
        actorId: identity.admin.id,
        action: PUBLISHED_STATUSES.includes(existing.status) ? "SOCIAL_POST_REMOVED_PUBLISHED" : "SOCIAL_POST_DELETED",
        entityType: "SOCIAL_POST",
        entityId: postId,
        metadata: {
          status: existing.status,
          title: existing.title,
          scheduledAt: existing.scheduledAt,
          targets: existing.targets.map((target) => ({
            platform: target.platform,
            status: target.status,
            remotePostId: target.remotePostId,
            remotePostUrl: target.remotePostUrl,
          })),
        },
      },
    });
  });
}

export async function duplicatePost(identity: ResolvedIdentity, postId: string) {
  const existing = await getPostOrThrow(postId);

  return createPost(identity, {
    title: existing.title ? `${existing.title} (copy)` : null,
    caption: existing.caption,
    category: existing.category,
    campaignId: existing.campaignId,
    targets: existing.targets.map((target) => ({ accountId: target.accountId, caption: target.caption })),
    assetIds: existing.assets.map((item) => item.assetId),
  });
}

/* ============================================================================
   WORKFLOW ACTIONS
============================================================================ */

export async function submitPost(identity: ResolvedIdentity, postId: string) {
  const existing = await getPostOrThrow(postId);
  assertTransition(existing.status, SocialPostStatus.PENDING_REVIEW);

  if (existing.targets.length === 0) {
    throw new AuthorisationError("Select at least one account before submitting for review.");
  }

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: SocialPostStatus.PENDING_REVIEW, updatedById: identity.admin.id },
  });

  await logPostActivity(postId, identity.admin.id, SocialPostActivityType.SUBMITTED, "Submitted for review");

  return getPostOrThrow(postId);
}

export async function approvePost(identity: ResolvedIdentity, postId: string) {
  const existing = await getPostOrThrow(postId);
  assertTransition(existing.status, SocialPostStatus.APPROVED);

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: SocialPostStatus.APPROVED, reviewedById: identity.admin.id, reviewNotes: null },
  });

  await logPostActivity(postId, identity.admin.id, SocialPostActivityType.APPROVED, "Approved");

  return getPostOrThrow(postId);
}

export async function requestPostChanges(identity: ResolvedIdentity, postId: string, notes: string) {
  const existing = await getPostOrThrow(postId);
  assertTransition(existing.status, SocialPostStatus.CHANGES_REQUESTED);

  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: SocialPostStatus.CHANGES_REQUESTED, reviewedById: identity.admin.id, reviewNotes: notes },
  });

  await logPostActivity(postId, identity.admin.id, SocialPostActivityType.CHANGES_REQUESTED, notes);

  return getPostOrThrow(postId);
}

export async function schedulePost(identity: ResolvedIdentity, postId: string, scheduledAt: Date) {
  const existing = await getPostOrThrow(postId);
  assertTransition(existing.status, SocialPostStatus.SCHEDULED);

  if (scheduledAt.getTime() <= Date.now()) {
    throw new AuthorisationError("Scheduled time must be in the future.");
  }

  await prisma.$transaction([
    prisma.socialPost.update({
      where: { id: postId },
      data: { status: SocialPostStatus.SCHEDULED, scheduledAt },
    }),
    prisma.socialPostPlatform.updateMany({
      where: { postId },
      data: { status: SocialPostTargetStatus.SCHEDULED, scheduledAt },
    }),
  ]);

  await logPostActivity(postId, identity.admin.id, SocialPostActivityType.SCHEDULED, `Scheduled for ${scheduledAt.toISOString()}`);

  return getPostOrThrow(postId);
}

const CANCELLABLE_STATUSES: SocialPostStatus[] = [
  SocialPostStatus.DRAFT,
  SocialPostStatus.PENDING_REVIEW,
  SocialPostStatus.CHANGES_REQUESTED,
  SocialPostStatus.APPROVED,
  SocialPostStatus.SCHEDULED,
];

export async function cancelPost(identity: ResolvedIdentity, postId: string) {
  const existing = await getPostOrThrow(postId);

  if (!CANCELLABLE_STATUSES.includes(existing.status)) {
    throw new AuthorisationError(`A post in ${existing.status.replace(/_/g, " ").toLowerCase()} status cannot be cancelled.`);
  }

  await prisma.$transaction([
    prisma.socialPost.update({ where: { id: postId }, data: { status: SocialPostStatus.CANCELLED } }),
    prisma.socialPostPlatform.updateMany({
      where: { postId, status: { in: [SocialPostTargetStatus.PENDING, SocialPostTargetStatus.SCHEDULED] } },
      data: { status: SocialPostTargetStatus.CANCELLED },
    }),
  ]);

  await logPostActivity(postId, identity.admin.id, SocialPostActivityType.CANCELLED, "Cancelled");

  return getPostOrThrow(postId);
}

/* ============================================================================
   PUBLISH NOW

   A deliberate fast lane for "Publish Now": the caller already holds
   APPROVE (the same permission schedulePost/approvePost already require
   — no new permission is introduced), so any intermediate review steps
   this bypasses are recorded in the activity log rather than silently
   skipped, keeping the audit trail honest about what actually happened.

   This function only decides WHICH targets to execute and moves them
   into SCHEDULED (scheduledAt = now) — it never calls a provider API
   itself. The actual publish mechanics live in exactly one place:
   lib/social-media/publishing.ts's executeTarget, invoked by the route
   handler right after this returns (publishTargetsNow) — kept separate
   so this file never needs to import the publishing module.
============================================================================ */

const DIRECT_PUBLISHABLE_STATUSES: SocialPostStatus[] = [
  SocialPostStatus.DRAFT,
  SocialPostStatus.CHANGES_REQUESTED,
  SocialPostStatus.PENDING_REVIEW,
  SocialPostStatus.APPROVED,
  SocialPostStatus.SCHEDULED,
  SocialPostStatus.PARTIALLY_PUBLISHED,
  SocialPostStatus.FAILED,
];

export async function prepareDirectPublish(identity: ResolvedIdentity, postId: string): Promise<{ targetIds: string[] }> {
  const existing = await getPostOrThrow(postId);

  if (!DIRECT_PUBLISHABLE_STATUSES.includes(existing.status)) {
    throw new AuthorisationError(
      `A post in ${existing.status.replace(/_/g, " ").toLowerCase()} status cannot be published now.`,
    );
  }

  if (existing.targets.length === 0) {
    throw new AuthorisationError("Select at least one connected account before publishing.");
  }

  // Already-PUBLISHED targets are left untouched — calling this again on
  // a PARTIALLY_PUBLISHED or FAILED post retries only what didn't
  // succeed, never reposts something that already went out.
  const eligibleTargets = existing.targets.filter((target) => target.status !== SocialPostTargetStatus.PUBLISHED);

  if (eligibleTargets.length === 0) {
    throw new AuthorisationError("Every connected destination for this post has already published.");
  }

  const now = new Date();
  const skippedReview = existing.status === SocialPostStatus.DRAFT || existing.status === SocialPostStatus.CHANGES_REQUESTED;
  const skippedApproval = skippedReview || existing.status === SocialPostStatus.PENDING_REVIEW;

  await prisma.$transaction([
    prisma.socialPost.update({
      where: { id: postId },
      data: { status: SocialPostStatus.SCHEDULED, scheduledAt: now, reviewedById: identity.admin.id, reviewNotes: null },
    }),
    prisma.socialPostPlatform.updateMany({
      where: { id: { in: eligibleTargets.map((target) => target.id) } },
      data: { status: SocialPostTargetStatus.SCHEDULED, scheduledAt: now },
    }),
  ]);

  if (skippedReview) {
    await logPostActivity(postId, identity.admin.id, SocialPostActivityType.SUBMITTED, "Submitted for review (via Publish Now)");
  }
  if (skippedApproval) {
    await logPostActivity(postId, identity.admin.id, SocialPostActivityType.APPROVED, "Approved (via Publish Now)");
  }
  await logPostActivity(postId, identity.admin.id, SocialPostActivityType.SCHEDULED, "Publishing now");

  return { targetIds: eligibleTargets.map((target) => target.id) };
}

/* ============================================================================
   CAMPAIGNS
============================================================================ */

export async function listCampaigns(page: number | null, pageSize: number | null) {
  const { page: resolvedPage, pageSize: resolvedPageSize, skip } = resolvePagination(page, pageSize);

  const [total, campaigns] = await Promise.all([
    prisma.socialCampaign.count(),
    prisma.socialCampaign.findMany({
      orderBy: { updatedAt: "desc" },
      skip,
      take: resolvedPageSize,
      include: { _count: { select: { posts: true } }, createdBy: { select: ADMIN_SELECT } },
    }),
  ]);

  return { campaigns, pagination: buildPaginationResult(resolvedPage, resolvedPageSize, total) };
}

export type CampaignInput = {
  name: string;
  description?: string | null;
  status?: "PLANNED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  startDate?: Date | null;
  endDate?: Date | null;
};

export async function createCampaign(identity: ResolvedIdentity, input: CampaignInput) {
  return prisma.socialCampaign.create({
    data: { ...input, createdById: identity.admin.id },
  });
}

export async function updateCampaign(campaignId: string, input: Partial<CampaignInput>) {
  const existing = await prisma.socialCampaign.findUnique({ where: { id: campaignId } });
  if (!existing) throw new AuthorisationError("Campaign could not be found.");

  return prisma.socialCampaign.update({ where: { id: campaignId }, data: input });
}

export async function deleteCampaign(campaignId: string) {
  const existing = await prisma.socialCampaign.findUnique({ where: { id: campaignId } });
  if (!existing) throw new AuthorisationError("Campaign could not be found.");

  await prisma.socialPost.updateMany({ where: { campaignId }, data: { campaignId: null } });
  await prisma.socialCampaign.delete({ where: { id: campaignId } });
}

/* ============================================================================
   CALENDAR
============================================================================ */

export type CalendarFilters = {
  from: Date;
  to: Date;
  status?: SocialPostStatus | null;
  platform?: SocialPlatform | null;
  campaignId?: string | null;
};

export async function getCalendarPosts(identity: ResolvedIdentity, filters: CalendarFilters) {
  const ownFilter = socialMediaOwnScopeFilter(identity, AccessAction.VIEW);

  const where: Prisma.SocialPostWhereInput = {
    ...(ownFilter ?? {}),
    scheduledAt: { gte: filters.from, lte: filters.to },
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.platform ? { targets: { some: { platform: filters.platform } } } : {}),
  };

  return prisma.socialPost.findMany({
    where,
    include: POST_INCLUDE,
    orderBy: { scheduledAt: "asc" },
  });
}

/* ============================================================================
   ACTIVITY FEED
============================================================================ */

export async function getRecentPostActivity(postId: string | null, limit: number) {
  return prisma.socialPostActivity.findMany({
    where: postId ? { postId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: ADMIN_SELECT }, post: { select: { id: true, title: true, caption: true } } },
  });
}

/* ============================================================================
   ANALYTICS

   Real aggregates of real SocialPostMetric rows only. If none exist yet
   (no provider sync has ever run), every number here is genuinely zero/
   empty — the route layer turns that into "No analytics available yet."
============================================================================ */

export async function getAnalyticsSummary() {
  const [statusCounts, metricTotals, metricRowCount] = await Promise.all([
    prisma.socialPost.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.socialPostMetric.aggregate({
      _sum: { impressions: true, reach: true, likes: true, comments: true, shares: true, saves: true, clicks: true },
    }),
    prisma.socialPostMetric.count(),
  ]);

  return {
    postsByStatus: Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])),
    hasMetrics: metricRowCount > 0,
    totals: metricRowCount > 0 ? metricTotals._sum : null,
  };
}
