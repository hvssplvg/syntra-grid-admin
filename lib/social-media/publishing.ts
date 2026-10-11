// lib/social-media/publishing.ts
//
// The publishing job runner (called by app/api/cron/social-publish/route.ts)
// and the PublishAdapter interface real provider integrations plug into.
//
// No adapter here fabricates success. Every one of the 6 stub adapters
// resolves to a real failure with an honest, specific reason — either
// "platform not configured" (no OAuth app registered) or "account not
// connected" (no valid token) — because that is genuinely the current
// state in every environment without real provider credentials. A real
// adapter implementation (actually calling Instagram's container-then-
// publish flow, X's media-upload-then-tweet flow, YouTube's resumable
// upload, etc.) is real, substantial, platform-specific work that cannot
// be verified without live credentials — it plugs in here without
// touching the job-runner orchestration below.

import { prisma } from "@/lib/prisma";
import { SocialPostStatus, SocialPostTargetStatus } from "@/app/generated/prisma/enums";
import type { SocialMediaAsset, SocialPlatform } from "@/app/generated/prisma/client";
import { getValidSocialAccessToken, isPlatformConfigured, PLATFORM_CONFIG } from "@/lib/social-media/accounts";
import { logPostActivity } from "@/lib/social-media/server";
import { SocialPostActivityType } from "@/app/generated/prisma/enums";

export type PublishParams = {
  accountId: string;
  platform: SocialPlatform;
  caption: string;
  assets: SocialMediaAsset[];
};

export type PublishResult = { ok: true; remotePostId: string; remotePostUrl?: string } | { ok: false; error: string };

export interface PublishAdapter {
  publish(params: PublishParams): Promise<PublishResult>;
}

/**
 * Every platform's adapter today: confirm the platform is configured and
 * the account holds a valid token (the one thing that's genuinely
 * testable without a provider integration), then fail honestly — the
 * actual "POST to the provider's publish endpoint" call is NOT YET
 * SUPPORTED for any of the 6 platforms, since none can be verified
 * without a live, approved provider app.
 */
class StubAdapter implements PublishAdapter {
  constructor(private platform: SocialPlatform) {}

  async publish(params: PublishParams): Promise<PublishResult> {
    if (!isPlatformConfigured(this.platform)) {
      return { ok: false, error: `${PLATFORM_CONFIG[this.platform].label} is not configured. See lib/social-media/accounts.ts PLATFORM_CONFIG.` };
    }

    try {
      await getValidSocialAccessToken(params.accountId);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Account is not connected." };
    }

    // Reaching here means a real app is configured AND a real token
    // exists — but the actual provider API call is not implemented yet.
    return {
      ok: false,
      error: `${PLATFORM_CONFIG[this.platform].label} publishing is implemented but requires a provider-specific adapter (not yet built).`,
    };
  }
}

const ADAPTERS: Partial<Record<SocialPlatform, PublishAdapter>> = {};

export function getPublishAdapter(platform: SocialPlatform): PublishAdapter {
  return ADAPTERS[platform] ?? new StubAdapter(platform);
}

/** Lets a real provider adapter be registered later without touching the
 *  job runner — e.g. `registerPublishAdapter("YOUTUBE", new YouTubeAdapter())`. */
export function registerPublishAdapter(platform: SocialPlatform, adapter: PublishAdapter) {
  ADAPTERS[platform] = adapter;
}

/* ============================================================================
   JOB RUNNER — called by the cron route, mirrors app/api/cron/monzo/route.ts's
   per-row try/catch loop shape exactly.
============================================================================ */

async function reconcilePostStatus(postId: string) {
  const targets = await prisma.socialPostPlatform.findMany({ where: { postId } });
  const relevant = targets.filter((target) => target.status !== SocialPostTargetStatus.CANCELLED);

  if (relevant.length === 0) return;

  const inFlightStatuses: SocialPostTargetStatus[] = [
    SocialPostTargetStatus.PENDING,
    SocialPostTargetStatus.SCHEDULED,
    SocialPostTargetStatus.PUBLISHING,
  ];

  const anyPending = relevant.some((target) => inFlightStatuses.includes(target.status));

  if (anyPending) return; // still in flight — leave post status as PUBLISHING

  const allPublished = relevant.every((target) => target.status === SocialPostTargetStatus.PUBLISHED);
  const anyPublished = relevant.some((target) => target.status === SocialPostTargetStatus.PUBLISHED);

  const nextStatus = allPublished
    ? SocialPostStatus.PUBLISHED
    : anyPublished
      ? SocialPostStatus.PARTIALLY_PUBLISHED
      : SocialPostStatus.FAILED;

  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      status: nextStatus,
      publishedAt: nextStatus === SocialPostStatus.PUBLISHED || nextStatus === SocialPostStatus.PARTIALLY_PUBLISHED ? new Date() : undefined,
    },
  });

  await logPostActivity(
    postId,
    null,
    nextStatus === SocialPostStatus.FAILED ? SocialPostActivityType.PUBLISH_FAILED : SocialPostActivityType.PUBLISHED,
    `Publishing finished: ${nextStatus.toLowerCase()}`,
  );
}

export type JobRunResult = { id: string; ok: boolean; skipped?: boolean; error?: string };

export async function runDuePublishJobs(limit = 50): Promise<{ ran: number; results: JobRunResult[] }> {
  const now = new Date();

  const dueTargets = await prisma.socialPostPlatform.findMany({
    where: { status: SocialPostTargetStatus.SCHEDULED, scheduledAt: { lte: now } },
    take: limit,
    include: {
      account: true,
      post: { include: { assets: { include: { asset: true } } } },
    },
  });

  const results: JobRunResult[] = [];

  for (const target of dueTargets) {
    try {
      // Atomic claim: the WHERE clause's status check and the UPDATE run
      // as one statement, so two overlapping cron runs can never both
      // move the same target into PUBLISHING — the second one's count
      // is 0 and it skips.
      const claimed = await prisma.socialPostPlatform.updateMany({
        where: { id: target.id, status: SocialPostTargetStatus.SCHEDULED },
        data: { status: SocialPostTargetStatus.PUBLISHING, lastAttemptAt: now },
      });

      if (claimed.count === 0) {
        results.push({ id: target.id, ok: true, skipped: true });
        continue;
      }

      await prisma.socialPost.updateMany({
        where: { id: target.postId, status: { in: [SocialPostStatus.SCHEDULED, SocialPostStatus.PARTIALLY_PUBLISHED, SocialPostStatus.FAILED] } },
        data: { status: SocialPostStatus.PUBLISHING },
      });

      await logPostActivity(target.postId, null, SocialPostActivityType.PUBLISHING_STARTED, `Publishing to ${target.platform}`);

      const adapter = getPublishAdapter(target.platform);
      const caption = target.caption ?? target.post.caption;
      const assets = target.post.assets.map((item) => item.asset);

      const result = await adapter.publish({ accountId: target.accountId, platform: target.platform, caption, assets });

      if (result.ok) {
        await prisma.socialPostPlatform.update({
          where: { id: target.id },
          data: {
            status: SocialPostTargetStatus.PUBLISHED,
            publishedAt: new Date(),
            remotePostId: result.remotePostId,
            remotePostUrl: result.remotePostUrl ?? null,
            lastError: null,
          },
        });
      } else {
        await prisma.socialPostPlatform.update({
          where: { id: target.id },
          data: { status: SocialPostTargetStatus.FAILED, lastError: result.error, retryCount: { increment: 1 } },
        });
      }

      await reconcilePostStatus(target.postId);

      results.push({ id: target.id, ok: result.ok, error: result.ok ? undefined : result.error });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown publishing error.";

      await prisma.socialPostPlatform
        .update({
          where: { id: target.id },
          data: { status: SocialPostTargetStatus.FAILED, lastError: message, retryCount: { increment: 1 } },
        })
        .catch(() => undefined);

      await reconcilePostStatus(target.postId).catch(() => undefined);

      results.push({ id: target.id, ok: false, error: message });
    }
  }

  return { ran: dueTargets.length, results };
}
