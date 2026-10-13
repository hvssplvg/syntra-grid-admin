// lib/social-media/publishing.ts
//
// The publishing job runner (called by app/api/cron/social-publish/route.ts)
// and the PublishAdapter interface real provider integrations plug into.
//
// No adapter here fabricates success. LinkedIn personal-profile posting
// (LinkedInAdapter), Instagram publishing (InstagramAdapter) and X/Twitter
// publishing (XAdapter, text + up to 4 images) are real adapters that call
// the provider's actual API and only report success once the provider
// confirms a real post/media id. The other 3 platforms (Facebook, TikTok,
// YouTube) are still stub adapters that resolve to a real failure with an
// honest, specific reason — either "platform not configured" (no OAuth app
// registered) or "account not connected" (no valid token) — because that
// is genuinely the current state in every environment without real
// provider credentials for them. Each of those is real, substantial,
// platform-specific work (YouTube's resumable upload, etc.) that plugs in
// the same way without touching the job-runner orchestration below.
// X video publishing specifically is also not implemented (needs X's
// chunked INIT/APPEND/FINALIZE media upload) — XAdapter rejects a video
// attachment with an honest error rather than silently dropping it.

import { prisma } from "@/lib/prisma";
import {
  SocialMediaPlacement,
  SocialPlatform,
  SocialPostActivityType,
  SocialPostStatus,
  SocialPostTargetStatus,
} from "@/app/generated/prisma/enums";
import { Prisma } from "@/app/generated/prisma/client";
import type { SocialMediaAsset } from "@/app/generated/prisma/client";
import { getValidSocialAccessToken, isPlatformConfigured, markAccountError, PLATFORM_CONFIG } from "@/lib/social-media/accounts";
import { logPostActivity } from "@/lib/social-media/server";

export type PublishParams = {
  accountId: string;
  platform: SocialPlatform;
  caption: string;
  assets: SocialMediaAsset[];
  /** Only Instagram currently reads this — every other adapter ignores it. */
  placement: SocialMediaPlacement;
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
   INSTAGRAM — real publishing via Instagram API with Instagram Login
   (graph.instagram.com), using the Instagram professional account id
   stored on SocialAccount.platformAccountId — never a Facebook Page id,
   since this account was never connected through Facebook Login (see
   lib/social-media/accounts.ts PLATFORM_CONFIG.INSTAGRAM).

   Scope required: instagram_business_content_publish (already requested
   at connect time).

   Supports, driven by params.placement and how many assets are attached:
   - placement STORY            -> one image or video, media_type STORIES
   - 1 video asset, not STORY   -> REELS (Instagram folded standalone feed
                                    video into Reels; there is no other way
                                    to publish a single video to the feed)
   - 1 image asset, not STORY   -> a plain feed image post
   - 2+ assets, not STORY       -> CAROUSEL (each asset becomes a child
                                    container first, up to Instagram's
                                    10-item limit; video children use
                                    media_type VIDEO, not REELS)

   All media URLs are the existing Cloudinary-hosted asset URLs, which are
   public by default (lib/cloudinary-server.ts never sets a private/
   authenticated delivery type) — exactly what image_url/video_url need,
   since Meta's servers fetch them directly.

   Video processing (Reels, video Stories, video carousel children) is
   asynchronous: the container is polled for up to ~45 seconds. That
   comfortably covers normal short-form video, but is well inside the
   cron route's 60-second maxDuration — a video that genuinely needs
   longer than that fails honestly for this attempt rather than risking
   the whole cron invocation timing out mid-poll. Creating a fresh
   container costs nothing against Instagram's publishing limits (only
   the actual media_publish call counts toward the 25-posts/24h cap), so
   the next scheduled run retries cleanly from scratch.
============================================================================ */

const INSTAGRAM_GRAPH_BASE = "https://graph.instagram.com";
const INSTAGRAM_API_VERSION = "v21.0";

class InstagramApiError extends Error {
  constructor(public status: number, body: string, public code?: number) {
    super(`Instagram API error ${status}${code ? ` (code ${code})` : ""}: ${body.slice(0, 300)}`);
  }
}

async function instagramFetch(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  const text = await response.text();

  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    // Non-JSON body — the !response.ok / !json branches below handle it.
  }

  const apiError = json?.error as { message?: string; code?: number } | undefined;

  if (!response.ok || apiError) {
    throw new InstagramApiError(response.status, apiError?.message ?? text, apiError?.code);
  }

  return json ?? {};
}

type InstagramContainerParams = {
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  mediaType?: "REELS" | "STORIES" | "CAROUSEL" | "VIDEO";
  isCarouselItem?: boolean;
  children?: string[];
};

async function createInstagramContainer(igUserId: string, token: string, params: InstagramContainerParams): Promise<string> {
  const body = new URLSearchParams({ access_token: token });
  if (params.imageUrl) body.set("image_url", params.imageUrl);
  if (params.videoUrl) body.set("video_url", params.videoUrl);
  if (params.caption) body.set("caption", params.caption);
  if (params.mediaType) body.set("media_type", params.mediaType);
  if (params.isCarouselItem) body.set("is_carousel_item", "true");
  if (params.children) body.set("children", params.children.join(","));

  const json = await instagramFetch(`${INSTAGRAM_GRAPH_BASE}/${INSTAGRAM_API_VERSION}/${igUserId}/media`, {
    method: "POST",
    body,
  });

  if (typeof json.id !== "string") {
    throw new Error("Instagram did not return a media container id.");
  }

  return json.id;
}

/** Polls a container's processing status. Only needed for containers with
 *  a video component — image containers are ready immediately. */
async function waitForInstagramContainer(containerId: string, token: string, budgetMs = 45_000): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < budgetMs) {
    const json = await instagramFetch(
      `${INSTAGRAM_GRAPH_BASE}/${INSTAGRAM_API_VERSION}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`,
    );
    const status = json.status_code;

    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Instagram reported this media as "${status}" during processing.`);
    }

    await sleep(3000);
  }

  throw new Error("Instagram is still processing this video — it will be retried on the next scheduled run.");
}

async function publishInstagramContainer(igUserId: string, containerId: string, token: string): Promise<string> {
  const body = new URLSearchParams({ creation_id: containerId, access_token: token });
  const json = await instagramFetch(`${INSTAGRAM_GRAPH_BASE}/${INSTAGRAM_API_VERSION}/${igUserId}/media_publish`, {
    method: "POST",
    body,
  });

  if (typeof json.id !== "string") {
    throw new Error("Instagram did not confirm a published media id.");
  }

  return json.id;
}

async function fetchInstagramPermalink(mediaId: string, token: string): Promise<string | undefined> {
  try {
    const json = await instagramFetch(
      `${INSTAGRAM_GRAPH_BASE}/${INSTAGRAM_API_VERSION}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`,
    );
    return typeof json.permalink === "string" ? json.permalink : undefined;
  } catch {
    // A missing permalink is cosmetic — the post is already confirmed
    // published by this point, so this never turns a success into a
    // failure.
    return undefined;
  }
}

class InstagramAdapter implements PublishAdapter {
  async publish(params: PublishParams): Promise<PublishResult> {
    if (!isPlatformConfigured(SocialPlatform.INSTAGRAM)) {
      return { ok: false, error: `${PLATFORM_CONFIG.INSTAGRAM.label} is not configured.` };
    }

    const account = await prisma.socialAccount.findUnique({ where: { id: params.accountId } });
    if (!account || account.platform !== SocialPlatform.INSTAGRAM) {
      return { ok: false, error: "This Instagram account is no longer connected." };
    }

    if (params.assets.length === 0) {
      return { ok: false, error: "Instagram requires at least one image or video attached to the post." };
    }

    // The stored Instagram professional account id, resolved once at
    // connect time via graph.instagram.com/me — never a Facebook Page id.
    const igUserId = account.platformAccountId;

    let token: string;
    try {
      token = await getValidSocialAccessToken(params.accountId);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Account is not connected." };
    }

    try {
      const mediaId = await this.createAndPublish(igUserId, token, params);
      const remotePostUrl = await fetchInstagramPermalink(mediaId, token);
      return { ok: true, remotePostId: mediaId, remotePostUrl };
    } catch (error) {
      if (error instanceof InstagramApiError) {
        // 190 = OAuthException (invalid/expired token) — Meta's Graph API
        // signals this in the JSON body's error.code, not always via a
        // 401 status.
        if (error.status === 401 || error.code === 190) {
          await markAccountError(params.accountId, error.message);
          return {
            ok: false,
            error: "Instagram rejected the request — the connection has expired or lost permission and needs to be reconnected.",
          };
        }
        // Meta's rate-limit errors come back as ordinary 400s with one of
        // these codes, not HTTP 429.
        if (error.code === 4 || error.code === 17 || error.code === 32 || error.code === 613) {
          return { ok: false, error: "Instagram rate limit reached — this will be retried on the next scheduled run." };
        }
        return { ok: false, error: error.message };
      }
      return { ok: false, error: error instanceof Error ? error.message : "Instagram publishing failed." };
    }
  }

  private async createAndPublish(igUserId: string, token: string, params: PublishParams): Promise<string> {
    const { assets, caption, placement } = params;

    if (placement === SocialMediaPlacement.STORY) {
      const [asset] = assets;
      const containerId = await createInstagramContainer(igUserId, token, {
        imageUrl: asset.type === "IMAGE" ? asset.url : undefined,
        videoUrl: asset.type === "VIDEO" ? asset.url : undefined,
        mediaType: "STORIES",
      });
      if (asset.type === "VIDEO") await waitForInstagramContainer(containerId, token);
      return publishInstagramContainer(igUserId, containerId, token);
    }

    if (assets.length > 1) {
      const childIds: string[] = [];
      for (const asset of assets.slice(0, 10)) {
        const childId = await createInstagramContainer(igUserId, token, {
          imageUrl: asset.type === "IMAGE" ? asset.url : undefined,
          videoUrl: asset.type === "VIDEO" ? asset.url : undefined,
          mediaType: asset.type === "VIDEO" ? "VIDEO" : undefined,
          isCarouselItem: true,
        });
        if (asset.type === "VIDEO") await waitForInstagramContainer(childId, token);
        childIds.push(childId);
      }

      const parentId = await createInstagramContainer(igUserId, token, {
        mediaType: "CAROUSEL",
        children: childIds,
        caption,
      });
      return publishInstagramContainer(igUserId, parentId, token);
    }

    const [asset] = assets;

    if (asset.type === "VIDEO") {
      const containerId = await createInstagramContainer(igUserId, token, {
        videoUrl: asset.url,
        caption,
        mediaType: "REELS",
      });
      await waitForInstagramContainer(containerId, token);
      return publishInstagramContainer(igUserId, containerId, token);
    }

    const containerId = await createInstagramContainer(igUserId, token, { imageUrl: asset.url, caption });
    return publishInstagramContainer(igUserId, containerId, token);
  }
}

registerPublishAdapter(SocialPlatform.INSTAGRAM, new InstagramAdapter());

/* ============================================================================
   X (TWITTER) — real publishing via API v2's POST /2/tweets, authenticated
   with the connected account's own OAuth 2.0 user access token (never an
   app-only bearer token — that can't post on a user's behalf at all).

   Scope required: tweet.write (already requested at connect time — see
   lib/social-media/accounts.ts PLATFORM_CONFIG.X), plus tweet.read /
   users.read / offline.access for profile lookup and token refresh.

   Media: images only, via X's v2 media upload endpoints
   (api.x.com/2/media/upload — INITIALIZE / APPEND / FINALIZE). This
   integration is OAuth 2.0 only — this codebase never stores an OAuth
   1.0a consumer key/secret or user access token/secret anywhere (see
   lib/social-media/accounts.ts PLATFORM_CONFIG.X; only X_CLIENT_ID/
   X_CLIENT_SECRET, which are OAuth 2.0 app credentials). The legacy
   v1.1 endpoint (upload.twitter.com/1.1/media/upload.json), used here
   previously, is documented and built around OAuth 1.0a user-context
   signing; its OAuth 2.0 Bearer support has been inconsistent and is
   not the path X's current docs point an OAuth2-only app at. Since
   there is no OAuth 1.0a credential in this app to fall back to, the
   v1.1 endpoint could not reliably authenticate here — migrated to the
   v2 flow, which is documented to accept the same OAuth 2.0 User
   Context bearer token already used for /2/tweets.

   Still chunked (INITIALIZE → APPEND → FINALIZE, one chunk per image —
   simple enough that a single-request "simple upload" shortcut isn't
   needed), still images only. X's chunked media flow's exact endpoint
   shapes are an actively-evolving part of X's API; re-verify against
   X's current developer docs if a request starts failing in a way the
   error messages below don't explain. Video is still NOT implemented —
   rejected with an honest error rather than silently dropped or falsely
   reported as published. Up to 4 images per Tweet, X's own documented
   limit.
============================================================================ */

const X_API_BASE = "https://api.x.com";
const X_MEDIA_UPLOAD_BASE = "https://api.x.com/2/media/upload";
const X_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const X_MAX_IMAGES_PER_POST = 4;
const X_SUPPORTED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const X_MEDIA_PROCESSING_BUDGET_MS = 30_000;

class XApiError extends Error {
  constructor(public status: number, public title: string | undefined, public detail: string | undefined, rawBody: string) {
    super(detail || title || `X API error ${status}: ${rawBody.slice(0, 300)}`);
  }
}

/** X v2 errors arrive as either RFC7807 problem details ({title, detail})
 *  or a legacy {errors: [{message}]} array — never guess a reason beyond
 *  what the response actually says. */
async function xFetch(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  const text = await response.text();

  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    // Non-JSON body — handled by the !response.ok branch below.
  }

  if (!response.ok) {
    const title = typeof json?.title === "string" ? json.title : undefined;
    const detail = typeof json?.detail === "string" ? json.detail : undefined;
    const legacyMessage = Array.isArray(json?.errors)
      ? (json!.errors as Array<{ message?: string }>).map((entry) => entry.message).filter(Boolean).join("; ")
      : undefined;
    throw new XApiError(response.status, title, detail ?? legacyMessage, text);
  }

  return json ?? {};
}

type XMediaProcessingInfo = { state?: string; check_after_secs?: number };
type XMediaUploadResponse = { data?: { id?: string; media_key?: string; processing_info?: XMediaProcessingInfo } };

async function initializeXMediaUpload(token: string, totalBytes: number, mimeType: string): Promise<string> {
  const json = (await xFetch(`${X_MEDIA_UPLOAD_BASE}/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: mimeType, total_bytes: totalBytes, media_category: "tweet_image" }),
  })) as XMediaUploadResponse;

  const mediaId = json.data?.id;
  if (!mediaId) throw new Error("X did not confirm a media upload id.");
  return mediaId;
}

async function appendXMediaChunk(token: string, mediaId: string, bytes: Buffer, mimeType: string, extension: string): Promise<void> {
  const form = new FormData();
  form.append("segment_index", "0");
  form.append("media", new Blob([new Uint8Array(bytes)], { type: mimeType }), `image.${extension}`);

  await xFetch(`${X_MEDIA_UPLOAD_BASE}/${encodeURIComponent(mediaId)}/append`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

/** Polls FINALIZE's reported processing state until it's done — images
 *  are normally ready synchronously (no processing_info at all, or
 *  state already "succeeded"), but this covers the case where X queues
 *  it, mirroring the same bounded-poll pattern already used for
 *  LinkedIn's image status and Instagram's video containers. */
async function waitForXMediaProcessing(token: string, mediaId: string): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < X_MEDIA_PROCESSING_BUDGET_MS) {
    const json = (await xFetch(`${X_MEDIA_UPLOAD_BASE}?media_id=${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })) as XMediaUploadResponse;

    const state = json.data?.processing_info?.state;
    if (!state || state === "succeeded") return;
    if (state === "failed") throw new Error("X reported this image failed to process.");

    await sleep((json.data?.processing_info?.check_after_secs ?? 1) * 1000);
  }

  throw new Error("X is still processing this image — it will be retried on the next scheduled run.");
}

async function finalizeXMediaUpload(token: string, mediaId: string): Promise<void> {
  const json = (await xFetch(`${X_MEDIA_UPLOAD_BASE}/${encodeURIComponent(mediaId)}/finalize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })) as XMediaUploadResponse;

  const state = json.data?.processing_info?.state;
  if (!state || state === "succeeded") return;
  if (state === "failed") throw new Error("X reported this image failed to process.");

  await waitForXMediaProcessing(token, mediaId);
}

/** Chunked (INITIALIZE → APPEND → FINALIZE) image upload against X's v2
 *  media endpoints — see the module header comment for why this
 *  replaced the old v1.1 simple-upload call. Fetches the asset's
 *  existing Cloudinary URL (never a local path) and forwards its real
 *  bytes; the Content-Type returned by that fetch is what gets
 *  validated against X's supported formats, not the asset's own `type`
 *  column (which only distinguishes IMAGE/VIDEO, not file format). */
async function uploadXImage(token: string, asset: SocialMediaAsset): Promise<string> {
  if (asset.fileSizeBytes && asset.fileSizeBytes > X_MAX_IMAGE_BYTES) {
    throw new Error(`Image exceeds X's 5MB limit (${(asset.fileSizeBytes / (1024 * 1024)).toFixed(1)}MB).`);
  }

  const assetResponse = await fetch(asset.url);
  if (!assetResponse.ok) {
    throw new Error(`Could not fetch the attached image for upload (${assetResponse.status}).`);
  }

  const contentType = assetResponse.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = X_SUPPORTED_IMAGE_TYPES[contentType];
  if (!extension) {
    throw new Error(`X does not support this image format (${contentType || "unknown"}). Use JPEG, PNG or WebP.`);
  }

  const bytes = Buffer.from(await assetResponse.arrayBuffer());
  if (bytes.byteLength > X_MAX_IMAGE_BYTES) {
    throw new Error(`Image exceeds X's 5MB limit (${(bytes.byteLength / (1024 * 1024)).toFixed(1)}MB).`);
  }

  const mediaId = await initializeXMediaUpload(token, bytes.byteLength, contentType);
  await appendXMediaChunk(token, mediaId, bytes, contentType, extension);
  await finalizeXMediaUpload(token, mediaId);

  return mediaId;
}

async function createXPost(token: string, text: string, mediaIds: string[]): Promise<string> {
  const body: Record<string, unknown> = { text };
  if (mediaIds.length > 0) {
    body.media = { media_ids: mediaIds };
  }

  const json = await xFetch(`${X_API_BASE}/2/tweets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = json.data as { id?: string } | undefined;
  if (!data?.id) {
    throw new Error("X did not confirm a post id for this request.");
  }

  return data.id;
}

class XAdapter implements PublishAdapter {
  async publish(params: PublishParams): Promise<PublishResult> {
    if (!isPlatformConfigured(SocialPlatform.X)) {
      return { ok: false, error: `${PLATFORM_CONFIG.X.label} is not configured.` };
    }

    const account = await prisma.socialAccount.findUnique({ where: { id: params.accountId } });
    if (!account || account.platform !== SocialPlatform.X) {
      return { ok: false, error: "This X account is no longer connected." };
    }

    const videoAssets = params.assets.filter((asset) => asset.type === "VIDEO");
    if (videoAssets.length > 0) {
      return {
        ok: false,
        error: "Video publishing to X is not implemented yet — remove the video or post with images only.",
      };
    }

    const imageAssets = params.assets.filter((asset) => asset.type === "IMAGE").slice(0, X_MAX_IMAGES_PER_POST);
    if (params.assets.length > imageAssets.length) {
      return { ok: false, error: `X allows at most ${X_MAX_IMAGES_PER_POST} images per post.` };
    }

    let token: string;
    try {
      token = await getValidSocialAccessToken(params.accountId);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Account is not connected." };
    }

    try {
      const mediaIds: string[] = [];
      for (const asset of imageAssets) {
        // Uploaded one at a time, not Promise.all — if an upload fails
        // partway through, no Tweet is ever created (see the catch below),
        // so there's nothing to clean up on X's side either way.
        mediaIds.push(await uploadXImage(token, asset));
      }

      const id = await createXPost(token, params.caption, mediaIds);
      const handle = account.username;
      const remotePostUrl = handle ? `https://x.com/${encodeURIComponent(handle)}/status/${id}` : undefined;

      return { ok: true, remotePostId: id, remotePostUrl };
    } catch (error) {
      if (error instanceof XApiError) {
        if (error.status === 401) {
          await markAccountError(params.accountId, error.message);
          return { ok: false, error: "Your X connection has expired and needs to be reconnected." };
        }

        if (error.title === "UsageCapExceeded" || /cap|credit/i.test(error.detail ?? "")) {
          return { ok: false, error: "X API credits are insufficient — the usage cap for this billing period has been reached." };
        }

        if (error.status === 429) {
          return { ok: false, error: "X API rate limit reached — this will be retried on the next scheduled run." };
        }

        if (error.status === 403) {
          return { ok: false, error: `X rejected this post: ${error.detail ?? error.title ?? "insufficient permission for this action."}` };
        }

        return { ok: false, error: `X rejected this post: ${error.message}` };
      }

      if (
        error instanceof Error &&
        /fetch the attached image|does not support this image format|exceeds X's 5MB|failed to process|still processing this image|did not confirm a media/.test(
          error.message,
        )
      ) {
        return { ok: false, error: `Image upload failed: ${error.message}` };
      }

      return { ok: false, error: error instanceof Error ? error.message : "X publishing failed." };
    }
  }
}

registerPublishAdapter(SocialPlatform.X, new XAdapter());

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

const TARGET_INCLUDE = {
  account: true,
  post: { include: { assets: { include: { asset: true } } } },
} satisfies Prisma.SocialPostPlatformInclude;

type TargetWithRelations = Prisma.SocialPostPlatformGetPayload<{ include: typeof TARGET_INCLUDE }>;

/**
 * Executes a single already-SCHEDULED target: atomic claim, adapter
 * call, result recorded, parent post reconciled. Shared by the cron
 * job runner (bulk, due-by-time) and publishTargetsNow (a specific
 * post's targets, triggered immediately by "Publish Now") — the actual
 * publish mechanics live in exactly one place either way.
 */
async function executeTarget(target: TargetWithRelations): Promise<JobRunResult> {
  const now = new Date();

  try {
    // Atomic claim: the WHERE clause's status check and the UPDATE run as
    // one statement, so two overlapping callers (an overlapping cron run,
    // or a double-clicked "Publish Now") can never both move the same
    // target into PUBLISHING — the second one's count is 0 and it skips.
    const claimed = await prisma.socialPostPlatform.updateMany({
      where: { id: target.id, status: SocialPostTargetStatus.SCHEDULED },
      data: { status: SocialPostTargetStatus.PUBLISHING, lastAttemptAt: now },
    });

    if (claimed.count === 0) {
      return { id: target.id, ok: true, skipped: true };
    }

    await prisma.socialPost.updateMany({
      where: { id: target.postId, status: { in: [SocialPostStatus.SCHEDULED, SocialPostStatus.PARTIALLY_PUBLISHED, SocialPostStatus.FAILED] } },
      data: { status: SocialPostStatus.PUBLISHING },
    });

    await logPostActivity(target.postId, null, SocialPostActivityType.PUBLISHING_STARTED, `Publishing to ${target.platform}`);

    const adapter = getPublishAdapter(target.platform);
    const caption = target.caption ?? target.post.caption;
    const assets = target.post.assets.map((item) => item.asset);

    const result = await adapter.publish({
      accountId: target.accountId,
      platform: target.platform,
      caption,
      assets,
      placement: target.placement,
    });

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

    return { id: target.id, ok: result.ok, error: result.ok ? undefined : result.error };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown publishing error.";

    await prisma.socialPostPlatform
      .update({
        where: { id: target.id },
        data: { status: SocialPostTargetStatus.FAILED, lastError: message, retryCount: { increment: 1 } },
      })
      .catch(() => undefined);

    await reconcilePostStatus(target.postId).catch(() => undefined);

    return { id: target.id, ok: false, error: message };
  }
}

/**
 * Targets left in PUBLISHING past this grace period never got a final
 * answer from their adapter call — most plausibly because the serverless
 * function that was running them was killed (Vercel's maxDuration) mid
 * network call, which leaves no code running to record a result. Without
 * this sweep such a target would sit in PUBLISHING forever, since the
 * cron query only ever picks up SCHEDULED rows. Flipped to FAILED rather
 * than retried automatically — Instagram/LinkedIn's own container may or
 * may not have actually finished on their end, and retrying blind risks
 * a duplicate post; a human can confirm and press "Publish Now" again.
 */
const STALE_PUBLISHING_GRACE_MS = 10 * 60 * 1000;

async function reconcileStalePublishingTargets(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_PUBLISHING_GRACE_MS);

  const stale = await prisma.socialPostPlatform.findMany({
    where: { status: SocialPostTargetStatus.PUBLISHING, lastAttemptAt: { lte: cutoff } },
    select: { id: true, postId: true },
  });

  for (const target of stale) {
    await prisma.socialPostPlatform.update({
      where: { id: target.id },
      data: {
        status: SocialPostTargetStatus.FAILED,
        lastError: "Publishing did not complete in time and was not confirmed by the platform. Check before retrying.",
        retryCount: { increment: 1 },
      },
    });
    await reconcilePostStatus(target.postId).catch(() => undefined);
  }
}

export async function runDuePublishJobs(limit = 50): Promise<{ ran: number; results: JobRunResult[] }> {
  await reconcileStalePublishingTargets();

  const now = new Date();

  const dueTargets = await prisma.socialPostPlatform.findMany({
    // post status guard is defensive hardening, not load-bearing: deleting
    // a post cascade-deletes its targets, and cancelling one sets targets
    // to CANCELLED directly — but excluding a cancelled parent post here
    // too means a future cancel-without-target-sync path can't resurrect
    // a publish for a post the user already walked away from.
    where: { status: SocialPostTargetStatus.SCHEDULED, scheduledAt: { lte: now }, post: { status: { not: SocialPostStatus.CANCELLED } } },
    take: limit,
    include: TARGET_INCLUDE,
  });

  const results: JobRunResult[] = [];

  for (const target of dueTargets) {
    results.push(await executeTarget(target));
  }

  return { ran: dueTargets.length, results };
}

/**
 * Runs a specific set of already-SCHEDULED targets immediately, within
 * the calling request — this is what "Publish Now" uses instead of
 * waiting for the next cron sweep. Targets run concurrently (a post
 * typically has a handful, not dozens) so the wall-clock cost is close
 * to the slowest single target rather than their sum, which matters
 * since this runs inside one HTTP request on a time-boxed function.
 */
export async function publishTargetsNow(targetIds: string[]): Promise<{ ran: number; results: JobRunResult[] }> {
  if (targetIds.length === 0) return { ran: 0, results: [] };

  const targets = await prisma.socialPostPlatform.findMany({
    where: { id: { in: targetIds }, status: SocialPostTargetStatus.SCHEDULED },
    include: TARGET_INCLUDE,
  });

  const results = await Promise.all(targets.map(executeTarget));

  return { ran: targets.length, results };
}
