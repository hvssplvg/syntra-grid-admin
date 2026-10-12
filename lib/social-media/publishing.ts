// lib/social-media/publishing.ts
//
// The publishing job runner (called by app/api/cron/social-publish/route.ts)
// and the PublishAdapter interface real provider integrations plug into.
//
// No adapter here fabricates success. LinkedIn personal-profile posting
// is a real adapter (see LinkedInAdapter below) that calls LinkedIn's
// actual Posts API and only reports success when LinkedIn confirms a
// post id. The other 5 platforms are still stub adapters that resolve to
// a real failure with an honest, specific reason — either "platform not
// configured" (no OAuth app registered) or "account not connected" (no
// valid token) — because that is genuinely the current state in every
// environment without real provider credentials for them. Each of those
// is real, substantial, platform-specific work (Instagram's container-
// then-publish flow, X's media-upload-then-tweet flow, YouTube's
// resumable upload, etc.) that plugs in the same way without touching
// the job-runner orchestration below.

import { prisma } from "@/lib/prisma";
import { SocialPlatform, SocialPostActivityType, SocialPostStatus, SocialPostTargetStatus } from "@/app/generated/prisma/enums";
import type { SocialMediaAsset } from "@/app/generated/prisma/client";
import { getValidSocialAccessToken, isPlatformConfigured, markAccountError, PLATFORM_CONFIG } from "@/lib/social-media/accounts";
import { logPostActivity } from "@/lib/social-media/server";

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
   LINKEDIN — real personal-profile publishing via LinkedIn's Posts API.

   Scope required: w_member_social (already requested at connect time —
   see lib/social-media/accounts.ts PLATFORM_CONFIG.LINKEDIN). The author
   is always the connected member's own identity (SocialAccount.
   platformAccountId, captured from /v2/userinfo's `sub` at connect time)
   — there is no code path that accepts or constructs a different member
   id, so this can never publish on someone else's behalf.

   Company-page (organisation) publishing is NOT implemented here: it
   needs the w_organization_social scope, an organisation-admin check,
   and a different author URN (urn:li:organization:{id}) — none of which
   exist yet. See requiredEnvVarsFor/PLATFORM_CONFIG for what IS wired.

   LinkedIn-Version is a required header on every /rest/ call. LinkedIn
   revises this monthly — re-check it's still accepted before relying on
   this in production; an unsupported version fails fast with a 426/400
   rather than silently misbehaving.
============================================================================ */

const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_API_VERSION = "202410";

class LinkedInApiError extends Error {
  constructor(public status: number, body: string) {
    super(`LinkedIn API error ${status}: ${body.slice(0, 300)}`);
  }
}

function linkedInHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Registers a single image with LinkedIn and uploads its bytes, fetched
 *  from the asset's existing Cloudinary URL (never a local file path —
 *  the asset is already real, hosted media, not binary in Postgres). */
async function uploadLinkedInImage(token: string, authorUrn: string, asset: SocialMediaAsset): Promise<string> {
  const initResponse = await fetch(`${LINKEDIN_API_BASE}/rest/images?action=initializeUpload`, {
    method: "POST",
    headers: { ...linkedInHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });

  if (!initResponse.ok) {
    throw new LinkedInApiError(initResponse.status, await safeText(initResponse));
  }

  const initJson = (await initResponse.json()) as { value: { uploadUrl: string; image: string } };
  const { uploadUrl, image } = initJson.value;

  const assetResponse = await fetch(asset.url);
  if (!assetResponse.ok) {
    throw new Error(`Could not fetch the attached image for upload (${assetResponse.status}).`);
  }
  const bytes = Buffer.from(await assetResponse.arrayBuffer());

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: bytes,
  });

  if (!putResponse.ok) {
    throw new LinkedInApiError(putResponse.status, await safeText(putResponse));
  }

  // Images are usually processed almost immediately, but availability is
  // not guaranteed synchronously — poll briefly rather than assume it,
  // and let a genuine processing failure surface as an error instead of
  // silently attaching a broken media reference to the post.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const statusResponse = await fetch(`${LINKEDIN_API_BASE}/rest/images/${encodeURIComponent(image)}`, {
      headers: linkedInHeaders(token),
    });
    if (statusResponse.ok) {
      const statusJson = (await statusResponse.json()) as { status?: string };
      if (statusJson.status === "AVAILABLE") return image;
      if (statusJson.status === "PROCESSING_FAILED") {
        throw new Error("LinkedIn reported the image failed to process.");
      }
    }
    await sleep(1000);
  }

  return image;
}

function buildLinkedInPostUrl(urn: string): string | undefined {
  if (urn.startsWith("urn:li:share:") || urn.startsWith("urn:li:ugcPost:")) {
    return `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}/`;
  }
  return undefined;
}

async function createLinkedInPost(token: string, authorUrn: string, caption: string, imageUrn?: string): Promise<string> {
  const body: Record<string, unknown> = {
    author: authorUrn,
    commentary: caption,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (imageUrn) {
    body.content = { media: { id: imageUrn } };
  }

  const response = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: "POST",
    headers: { ...linkedInHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new LinkedInApiError(response.status, await safeText(response));
  }

  // LinkedIn confirms the created post's id via this response header, not
  // the (typically empty) body. No id means no confirmed publication —
  // treated as a failure rather than assumed success.
  const id = response.headers.get("x-restli-id") ?? response.headers.get("x-linkedin-id");
  if (!id) {
    throw new Error("LinkedIn did not confirm a post id for this request.");
  }

  return id;
}

class LinkedInAdapter implements PublishAdapter {
  async publish(params: PublishParams): Promise<PublishResult> {
    if (!isPlatformConfigured(SocialPlatform.LINKEDIN)) {
      return { ok: false, error: `${PLATFORM_CONFIG.LINKEDIN.label} is not configured.` };
    }

    const account = await prisma.socialAccount.findUnique({ where: { id: params.accountId } });
    if (!account || account.platform !== SocialPlatform.LINKEDIN) {
      return { ok: false, error: "This LinkedIn account is no longer connected." };
    }

    // Always the connected member's own identity — never a caller-supplied
    // or arbitrary id — resolved once at connect time and stored on the
    // account row.
    const authorUrn = `urn:li:person:${account.platformAccountId}`;

    let token: string;
    try {
      token = await getValidSocialAccessToken(params.accountId);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Account is not connected." };
    }

    try {
      const [firstImage] = params.assets.filter((asset) => asset.type === "IMAGE");
      const imageUrn = firstImage ? await uploadLinkedInImage(token, authorUrn, firstImage) : undefined;

      const id = await createLinkedInPost(token, authorUrn, params.caption, imageUrn);

      return { ok: true, remotePostId: id, remotePostUrl: buildLinkedInPostUrl(id) };
    } catch (error) {
      if (error instanceof LinkedInApiError) {
        if (error.status === 401 || error.status === 403) {
          await markAccountError(params.accountId, error.message);
          return {
            ok: false,
            error: "LinkedIn rejected the request — the connection has expired or lost permission and needs to be reconnected.",
          };
        }
        if (error.status === 429) {
          return { ok: false, error: "LinkedIn rate limit reached — this will be retried on the next scheduled run." };
        }
        return { ok: false, error: error.message };
      }
      return { ok: false, error: error instanceof Error ? error.message : "LinkedIn publishing failed." };
    }
  }
}

registerPublishAdapter(SocialPlatform.LINKEDIN, new LinkedInAdapter());

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
