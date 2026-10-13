// lib/social-media/publishing.ts
//
// The publishing job runner (called by app/api/cron/social-publish/route.ts)
// and the PublishAdapter interface real provider integrations plug into.
//
// No adapter here fabricates success. LinkedIn personal-profile posting
// (LinkedInAdapter), Instagram publishing (InstagramAdapter), X/Twitter
// publishing (XAdapter, text + up to 4 images) and TikTok Content Posting
// (TikTokAdapter, video only) are real adapters that call the provider's
// actual API and only report success once the provider confirms a real
// post id — TikTok's confirmation is asynchronous (see "ok:true,
// pending:true" below and pollPendingTikTokPublishes), so a TikTok target
// is never marked PUBLISHED just because the initial upload was accepted.
// The other 2 platforms (Facebook, YouTube) are still stub adapters that
// resolve to a real failure with an honest, specific reason — either
// "platform not configured" (no OAuth app registered) or "account not
// connected" (no valid token) — because that is genuinely the current
// state in every environment without real provider credentials for them.
// Each of those is real, substantial, platform-specific work (YouTube's
// resumable upload, etc.) that plugs in the same way without touching the
// job-runner orchestration below.
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
  /** Only TikTok currently reads this — every other adapter ignores it. */
  metadata: Prisma.JsonValue | null;
};

export type PublishResult =
  | { ok: true; remotePostId: string; remotePostUrl?: string }
  /**
   * The provider accepted the request but hasn't confirmed the real
   * outcome yet (TikTok's Content Posting API is asynchronous — only
   * its own status-polling endpoint can say what actually happened).
   * executeTarget leaves the target in PUBLISHING rather than marking
   * it PUBLISHED; only pollPendingTikTokPublishes can resolve it further.
   */
  | { ok: true; remotePostId: string; pending: true }
  | { ok: false; error: string };

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

   LinkedIn-Version is a required header on every /rest/ call, format
   YYYYMM, and LinkedIn only keeps roughly the last 12 months' worth of
   versions live — anything older is retired and the API starts
   rejecting it with HTTP 426 {"code":"NONEXISTENT_VERSION"}. There is
   no "always valid" value to set once and forget; this must be bumped
   periodically (last confirmed 2026-10-13, set to 202609 — the most
   recent version confirmed live as of that check). Re-verify against
   https://learn.microsoft.com/linkedin/marketing/versioning (LinkedIn's
   REST API versioning applies this same header/scheme across products,
   not just Marketing) before assuming this value is still accepted.
============================================================================ */

const LINKEDIN_API_BASE = "https://api.linkedin.com";
const LINKEDIN_API_VERSION = "202609";

class LinkedInApiError extends Error {
  code?: string;

  constructor(public status: number, rawBody: string) {
    let message = `LinkedIn API error ${status}: ${rawBody.slice(0, 300)}`;
    let code: string | undefined;

    try {
      const json = rawBody ? (JSON.parse(rawBody) as { message?: string; code?: string }) : null;
      if (json?.message) message = json.message;
      code = json?.code;
    } catch {
      // Non-JSON body — the generic message above already covers it.
    }

    super(message);
    this.code = code;
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
        if (error.status === 426 || error.code === "NONEXISTENT_VERSION" || error.code === "VERSION_MISSING") {
          console.error(`[linkedin] Unsupported LinkedIn-Version "${LINKEDIN_API_VERSION}" — update it in lib/social-media/publishing.ts.`);
          return {
            ok: false,
            error: "LinkedIn's API version used by this server is out of date and needs to be updated by an administrator — this is not an account or permission problem.",
          };
        }
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
  constructor(
    public status: number,
    public title: string | undefined,
    public detail: string | undefined,
    public type: string | undefined,
    public code: string | number | undefined,
    public requestId: string | undefined,
    rawBody: string,
  ) {
    super(detail || title || `X API error ${status}: ${rawBody.slice(0, 300)}`);
  }
}

/** X v2 errors arrive as either RFC7807 problem details ({title, detail,
 *  type}) or a legacy {errors: [{message, code}]} array — never guess a
 *  reason beyond what the response actually says. Every failure is
 *  logged server-side with the full safe diagnostic set (status, title,
 *  detail, type URI, provider code, X's own request id if supplied, and
 *  rate-limit headers) — enough to hand to X Developer Support without
 *  ever including the Authorization header, the access/refresh token,
 *  or any other secret. */
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
    const type = typeof json?.type === "string" ? json.type : undefined;
    const legacyErrors = Array.isArray(json?.errors) ? (json!.errors as Array<{ message?: string; code?: string | number }>) : undefined;
    const legacyMessage = legacyErrors?.map((entry) => entry.message).filter(Boolean).join("; ");
    const code = (typeof json?.code === "string" || typeof json?.code === "number" ? json.code : undefined) ?? legacyErrors?.[0]?.code;
    const requestId = response.headers.get("x-request-id") ?? response.headers.get("x-transaction-id") ?? undefined;

    console.error(
      JSON.stringify({
        scope: "x_api_error",
        endpoint: url.replace(/^https?:\/\/[^/]+/, ""),
        status: response.status,
        title,
        detail: detail ?? legacyMessage,
        type,
        code,
        requestId,
        rateLimitLimit: response.headers.get("x-rate-limit-limit"),
        rateLimitRemaining: response.headers.get("x-rate-limit-remaining"),
        rateLimitReset: response.headers.get("x-rate-limit-reset"),
      }),
    );

    throw new XApiError(response.status, title, detail ?? legacyMessage, type, code, requestId, text);
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
          const reference = error.requestId ? ` (reference: ${error.requestId})` : "";
          return {
            ok: false,
            error: `X rejected this post: ${error.detail ?? error.title ?? "insufficient permission for this action."}${reference} — this is typically an X Developer Console / account restriction, not something retrying fixes.`,
          };
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
   TIKTOK — Content Posting API. Publishing is asynchronous: FILE_UPLOAD
   accepts the video and returns a publish_id; the real outcome
   (published publicly, delivered to the creator's TikTok inbox as a
   draft, or failed) only becomes known from TikTok's own status-polling
   endpoint (pollPendingTikTokPublishes, called from runDuePublishJobs).
   publish() below NEVER returns a final PUBLISHED/DELIVERED_TO_INBOX
   result — only { ok:true, pending:true }.

   Direct Post (params.metadata.tiktokPostMode === "DIRECT_POST") and
   Upload-to-TikTok ("UPLOAD_TO_TIKTOK") are genuinely different
   endpoints with different request shapes — confirmed against TikTok's
   current official docs, not assumed:
     - /v2/post/publish/video/init/ (Direct Post) takes a full post_info
       object: privacy_level (required, must be one of creator_info's
       privacy_level_options), title/caption, disable_duet/comment/stitch,
       brand_content_toggle/brand_organic_toggle.
     - /v2/post/publish/inbox/video/init/ (Upload-to-TikTok) takes ONLY
       source_info — no post_info, no caption, no privacy level, no
       toggles. The creator sets all of that themselves inside the
       TikTok app when they open the draft notification. A post_info
       body is never sent to this endpoint; it isn't part of its
       documented schema.

   PULL_FROM_URL is never used: it requires TikTok-side verification of
   the exact serving domain, independent of and unrelated to
   syntragrid.com's own DNS verification (that only covers the Login Kit
   redirect domain), and there is no way for this codebase to confirm
   Cloudinary's delivery domain is verified with TikTok. FILE_UPLOAD
   works regardless of that, so every upload downloads the asset's bytes
   from Cloudinary server-side and chunks them to TikTok directly.

   Chunking rule (TikTok's Content Posting API Media Transfer Guide):
   videos up to 64MB upload as a single whole-file chunk (mandatory for
   anything under 5MB, also valid up to 64MB); anything larger is split
   into chunk_size-sized pieces (fixed at the 64MB ceiling here), with
   total_chunk_count = floor(video_size / chunk_size) and the final
   chunk absorbing the remainder (TikTok's own documented rule — the
   final chunk may exceed chunk_size, up to 128MB, rather than leaving a
   trailing sub-5MB chunk). Chunks are uploaded strictly in order.
============================================================================ */

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";
// Files under 5MB must be uploaded whole (handled by the <=
// TIKTOK_MAX_CHUNK_BYTES branch in computeTikTokChunkPlan below, which
// already covers both the <5MB-whole-file and 5–64MB-single-chunk cases
// identically — there's no separate 5MB threshold to branch on).
const TIKTOK_MAX_CHUNK_BYTES = 64 * 1024 * 1024;
const TIKTOK_MAX_TITLE_LENGTH = 2200;

export class TikTokApiError extends Error {
  constructor(
    public status: number,
    public code: string | undefined,
    public logId: string | undefined,
    rawBody: string,
  ) {
    super(TikTokApiError.extractMessage(rawBody, status));
  }

  private static extractMessage(rawBody: string, status: number): string {
    try {
      const json = rawBody ? (JSON.parse(rawBody) as { error?: { message?: string } }) : null;
      if (json?.error?.message) return json.error.message;
    } catch {
      // Non-JSON body — the generic message below already covers it.
    }
    return `TikTok API error ${status}: ${rawBody.slice(0, 300)}`;
  }
}

/** TikTok's Open API typically answers with HTTP 200 even for a logical
 *  failure — the real signal is `error.code !== "ok"` inside the JSON
 *  body, not the HTTP status alone. Both are checked. Every failure is
 *  logged server-side with status/code/message/log_id only — never a
 *  token, secret or Authorization header. */
type TikTokRawResponse<T> = { data?: T; error?: { code?: string; message?: string; log_id?: string; logid?: string } };

async function tiktokFetch<T>(url: string, init: RequestInit): Promise<{ data: T }> {
  const response = await fetch(url, init);
  const text = await response.text();

  let json: TikTokRawResponse<T> | null = null;
  try {
    json = text ? (JSON.parse(text) as TikTokRawResponse<T>) : null;
  } catch {
    // Non-JSON body — handled by the failure branch below.
  }

  const errorCode = json?.error?.code;
  const logId = json?.error?.log_id ?? json?.error?.logid;

  if (!response.ok || (errorCode && errorCode !== "ok")) {
    console.error(
      JSON.stringify({
        scope: "tiktok_api_error",
        endpoint: url.replace(/^https?:\/\/[^/]+/, ""),
        status: response.status,
        code: errorCode,
        message: json?.error?.message,
        logId,
      }),
    );
    throw new TikTokApiError(response.status, errorCode, logId, text);
  }

  if (!json?.data) throw new Error("TikTok returned an unreadable response.");
  return { data: json.data };
}

export type TikTokCreatorInfo = {
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

/** Must be called immediately before every post — these options are
 *  live, per-creator, and never hardcoded. An unaudited (sandbox) app's
 *  creator_info is itself restricted (see TIKTOK_FRIENDLY_ERRORS for how
 *  the resulting publish-time rejection is surfaced). */
export async function fetchTikTokCreatorInfo(token: string): Promise<TikTokCreatorInfo> {
  const { data } = await tiktokFetch<TikTokCreatorInfo>(`${TIKTOK_API_BASE}/post/publish/creator_info/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({}),
  });
  return data;
}

function computeTikTokChunkPlan(totalBytes: number): { chunkSize: number; totalChunkCount: number } {
  if (totalBytes <= TIKTOK_MAX_CHUNK_BYTES) {
    return { chunkSize: totalBytes, totalChunkCount: 1 };
  }

  const chunkSize = TIKTOK_MAX_CHUNK_BYTES;
  return { chunkSize, totalChunkCount: Math.max(1, Math.floor(totalBytes / chunkSize)) };
}

async function uploadTikTokVideoChunks(uploadUrl: string, bytes: Buffer, mimeType: string, chunkSize: number, totalChunkCount: number): Promise<void> {
  // Sequential, strictly in order (TikTok's own requirement) — also
  // keeps memory bounded to one chunk at a time rather than buffering
  // every chunk's request concurrently.
  for (let index = 0; index < totalChunkCount; index++) {
    const start = index * chunkSize;
    const end = index === totalChunkCount - 1 ? bytes.byteLength - 1 : start + chunkSize - 1;
    const chunk = bytes.subarray(start, end + 1);

    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "Content-Range": `bytes ${start}-${end}/${bytes.byteLength}`,
        "Content-Length": String(chunk.byteLength),
      },
      body: new Uint8Array(chunk),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`TikTok rejected a video chunk upload (${response.status}): ${text.slice(0, 200)}`);
    }
  }
}

type TikTokInitResponse = { publish_id?: string; upload_url?: string };

async function initTikTokVideoUpload(
  token: string,
  endpoint: "video/init" | "inbox/video/init",
  postInfo: Record<string, unknown> | null,
  totalBytes: number,
  chunkSize: number,
  totalChunkCount: number,
): Promise<{ publishId: string; uploadUrl: string }> {
  const body: Record<string, unknown> = {
    source_info: { source: "FILE_UPLOAD", video_size: totalBytes, chunk_size: chunkSize, total_chunk_count: totalChunkCount },
  };
  if (postInfo) body.post_info = postInfo;

  const { data } = await tiktokFetch<TikTokInitResponse>(`${TIKTOK_API_BASE}/post/publish/${endpoint}/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
  });

  if (!data.publish_id || !data.upload_url) throw new Error("TikTok did not return a publish id / upload URL.");
  return { publishId: data.publish_id, uploadUrl: data.upload_url };
}

type TikTokPublishMetadata = {
  tiktokPostMode?: "DIRECT_POST" | "UPLOAD_TO_TIKTOK";
  tiktokPrivacyLevel?: string;
  tiktokDisableComment?: boolean;
  tiktokDisableDuet?: boolean;
  tiktokDisableStitch?: boolean;
  tiktokBrandedContent?: boolean;
  tiktokYourBrand?: boolean;
};

function parseTikTokMetadata(metadata: Prisma.JsonValue | null): TikTokPublishMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as TikTokPublishMetadata;
}

/** Known TikTok error codes that mean "this is an expected sandbox/app
 *  restriction," not a bug — surfaced verbatim so an admin never mistakes
 *  one for a transient failure worth retrying as-is. */
const TIKTOK_FRIENDLY_ERRORS: Record<string, string> = {
  unaudited_client_can_only_post_to_private_accounts:
    "This TikTok app has not been audited/approved by TikTok yet, so TikTok restricts every post from it to private/self-only visibility. This is an expected sandbox limitation, not a bug — it is lifted once TikTok approves the app.",
  reached_active_user_cap:
    "This TikTok app is still in sandbox mode, which caps the number of distinct TikTok accounts that can authorize it (a small daily cap). This is an expected sandbox limitation — it is lifted once TikTok approves the app.",
  spam_risk_too_many_posts: "TikTok flagged this as too many posts in a short period and declined it as a spam-risk precaution. Wait and try again later.",
  spam_risk_user_banned_from_posting: "TikTok has restricted this account from posting.",
  scope_not_authorized: "This TikTok connection is missing a permission this action needs. Reconnect the TikTok account to grant it.",
  privacy_level_option_mismatch:
    "The chosen privacy setting is no longer one TikTok allows for this account — reopen the composer so it can refresh the available options.",
};

class TikTokAdapter implements PublishAdapter {
  async publish(params: PublishParams): Promise<PublishResult> {
    if (!isPlatformConfigured(SocialPlatform.TIKTOK)) {
      return { ok: false, error: `${PLATFORM_CONFIG.TIKTOK.label} is not configured.` };
    }

    const video = params.assets.find((asset) => asset.type === "VIDEO");
    if (!video) {
      return { ok: false, error: "TikTok requires an attached video. Add a video to publish to TikTok." };
    }

    const meta = parseTikTokMetadata(params.metadata);
    if (meta.tiktokPostMode !== "DIRECT_POST" && meta.tiktokPostMode !== "UPLOAD_TO_TIKTOK") {
      return {
        ok: false,
        error: "TikTok publishing mode was not specified. Choose Direct Post or Upload to TikTok before publishing.",
      };
    }

    let token: string;
    try {
      token = await getValidSocialAccessToken(params.accountId);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Account is not connected." };
    }

    try {
      let postInfo: Record<string, unknown> | null = null;

      if (meta.tiktokPostMode === "DIRECT_POST") {
        const creatorInfo = await fetchTikTokCreatorInfo(token);
        const options = creatorInfo.privacy_level_options ?? [];

        if (!meta.tiktokPrivacyLevel || !options.includes(meta.tiktokPrivacyLevel)) {
          return {
            ok: false,
            error:
              options.length > 0
                ? `Choose a privacy setting TikTok currently allows for this account: ${options.join(", ")}.`
                : "TikTok did not return any allowed privacy settings for this account — it may need to be reconnected.",
          };
        }

        postInfo = {
          privacy_level: meta.tiktokPrivacyLevel,
          title: params.caption.slice(0, TIKTOK_MAX_TITLE_LENGTH),
          disable_duet: Boolean(meta.tiktokDisableDuet),
          disable_comment: Boolean(meta.tiktokDisableComment),
          disable_stitch: Boolean(meta.tiktokDisableStitch),
          brand_content_toggle: Boolean(meta.tiktokBrandedContent),
          brand_organic_toggle: Boolean(meta.tiktokYourBrand),
        };
      }
      // Upload-to-TikTok (inbox): deliberately no post_info — that
      // endpoint's documented schema takes only source_info (see the
      // module header comment above).

      const assetResponse = await fetch(video.url);
      if (!assetResponse.ok) {
        return { ok: false, error: `Could not fetch the attached video for upload (${assetResponse.status}).` };
      }

      const contentType = assetResponse.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "video/mp4";
      const bytes = Buffer.from(await assetResponse.arrayBuffer());

      if (bytes.byteLength === 0) {
        return { ok: false, error: "The attached video is empty." };
      }

      const { chunkSize, totalChunkCount } = computeTikTokChunkPlan(bytes.byteLength);
      const endpoint = meta.tiktokPostMode === "DIRECT_POST" ? "video/init" : "inbox/video/init";

      const { publishId, uploadUrl } = await initTikTokVideoUpload(token, endpoint, postInfo, bytes.byteLength, chunkSize, totalChunkCount);
      await uploadTikTokVideoChunks(uploadUrl, bytes, contentType, chunkSize, totalChunkCount);

      // Accepted, not confirmed — see the PublishResult type's "pending"
      // variant. Only pollPendingTikTokPublishes, reading TikTok's own
      // status endpoint, may ever mark this PUBLISHED/DELIVERED_TO_INBOX.
      return { ok: true, remotePostId: publishId, pending: true };
    } catch (error) {
      if (error instanceof TikTokApiError) {
        const friendly = error.code ? TIKTOK_FRIENDLY_ERRORS[error.code] : undefined;
        if (friendly) return { ok: false, error: friendly };

        if (error.status === 401 || error.code === "access_token_invalid") {
          await markAccountError(params.accountId, error.message);
          return { ok: false, error: "Your TikTok connection has expired and needs to be reconnected." };
        }

        const reference = error.logId ? ` (reference: ${error.logId})` : "";
        return { ok: false, error: `TikTok rejected this post: ${error.message}${reference}` };
      }

      return { ok: false, error: error instanceof Error ? error.message : "TikTok publishing failed." };
    }
  }
}

registerPublishAdapter(SocialPlatform.TIKTOK, new TikTokAdapter());

type TikTokStatusResponse = {
  status?: "PROCESSING_DOWNLOAD" | "PROCESSING_UPLOAD" | "SEND_TO_USER_INBOX" | "PUBLISH_COMPLETE" | "FAILED";
  fail_reason?: string;
  publicaly_available_post_id?: string[];
};

/**
 * The only thing allowed to move a TikTok target out of PUBLISHING once
 * it holds a publish_id. Never infers failure from elapsed time — only
 * from TikTok's own explicit `status: "FAILED"` answer. Any error
 * actually talking to TikTok (network failure, 5xx, 429, an unparseable
 * body, a token that needs refreshing) leaves the target completely
 * unchanged and is simply logged — retried on the next poll. This is
 * deliberate: a lack of confirmation is not proof of failure, and
 * polling that can't confirm the outcome must retain the pending status
 * rather than guess.
 */
async function pollPendingTikTokPublishes(): Promise<void> {
  const pending = await prisma.socialPostPlatform.findMany({
    where: { platform: SocialPlatform.TIKTOK, status: SocialPostTargetStatus.PUBLISHING, remotePostId: { not: null } },
    select: { id: true, postId: true, accountId: true, remotePostId: true },
  });

  for (const target of pending) {
    try {
      await prisma.socialPostPlatform.update({ where: { id: target.id }, data: { lastPolledAt: new Date() } });

      const token = await getValidSocialAccessToken(target.accountId);
      const { data } = await tiktokFetch<TikTokStatusResponse>(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ publish_id: target.remotePostId }),
      });

      if (data.status === "PUBLISH_COMPLETE") {
        const realId = data.publicaly_available_post_id?.[0] ?? target.remotePostId!;
        await prisma.socialPostPlatform.update({
          where: { id: target.id },
          data: { status: SocialPostTargetStatus.PUBLISHED, publishedAt: new Date(), remotePostId: realId, lastError: null },
        });
        await logPostActivity(target.postId, null, SocialPostActivityType.PUBLISHED, "TikTok confirmed this post was published.");
        await reconcilePostStatus(target.postId);
      } else if (data.status === "SEND_TO_USER_INBOX") {
        await prisma.socialPostPlatform.update({
          where: { id: target.id },
          data: { status: SocialPostTargetStatus.DELIVERED_TO_INBOX, publishedAt: new Date(), lastError: null },
        });
        await logPostActivity(
          target.postId,
          null,
          SocialPostActivityType.PUBLISHED,
          "Delivered to the creator's TikTok inbox as a draft — not published publicly. The creator must open the TikTok app to finish posting it.",
        );
        await reconcilePostStatus(target.postId);
      } else if (data.status === "FAILED") {
        await prisma.socialPostPlatform.update({
          where: { id: target.id },
          data: {
            status: SocialPostTargetStatus.FAILED,
            lastError: data.fail_reason ?? "TikTok reported this publish failed.",
            retryCount: { increment: 1 },
          },
        });
        await reconcilePostStatus(target.postId);
      }
      // PROCESSING_DOWNLOAD / PROCESSING_UPLOAD / anything else: no
      // status change. lastPolledAt above already reflects this check.
    } catch (error) {
      console.error(
        JSON.stringify({
          scope: "tiktok_poll_error",
          targetId: target.id,
          code: error instanceof TikTokApiError ? error.code : undefined,
          message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
        }),
      );
      // Never change status here — an error checking TikTok is not the
      // same as TikTok reporting a failure. Retried on the next poll.
    }
  }
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
  // TikTok's Upload-to-TikTok workflow: the video reached the creator's
  // TikTok inbox as a draft, never actually published publicly. Counted
  // as a real completion for rollup purposes, but never folded into
  // "published" — a post where every target delivered to an inbox gets
  // its own distinct status, not SocialPostStatus.PUBLISHED.
  const allDeliveredToInbox = relevant.every((target) => target.status === SocialPostTargetStatus.DELIVERED_TO_INBOX);
  const anySucceeded = relevant.some(
    (target) => target.status === SocialPostTargetStatus.PUBLISHED || target.status === SocialPostTargetStatus.DELIVERED_TO_INBOX,
  );

  const nextStatus = allPublished
    ? SocialPostStatus.PUBLISHED
    : allDeliveredToInbox
      ? SocialPostStatus.DELIVERED_TO_INBOX
      : anySucceeded
        ? SocialPostStatus.PARTIALLY_PUBLISHED
        : SocialPostStatus.FAILED;

  const isSuccessLike =
    nextStatus === SocialPostStatus.PUBLISHED ||
    nextStatus === SocialPostStatus.DELIVERED_TO_INBOX ||
    nextStatus === SocialPostStatus.PARTIALLY_PUBLISHED;

  await prisma.socialPost.update({
    where: { id: postId },
    data: {
      status: nextStatus,
      publishedAt: isSuccessLike ? new Date() : undefined,
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
      metadata: target.metadata,
    });

    if (result.ok && "pending" in result) {
      // Accepted by the provider but not yet confirmed (TikTok only,
      // today) — deliberately NOT marked PUBLISHED. Status stays
      // PUBLISHING; only pollPendingTikTokPublishes can resolve it
      // further, once TikTok's own status endpoint gives a real answer.
      await prisma.socialPostPlatform.update({
        where: { id: target.id },
        data: { remotePostId: result.remotePostId, lastError: null },
      });
      await logPostActivity(
        target.postId,
        null,
        SocialPostActivityType.PUBLISHING_STARTED,
        `${target.platform} accepted the upload and is processing it — awaiting confirmation.`,
      );
    } else if (result.ok) {
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

/**
 * TikTok is deliberately excluded from this sweep ONCE it has a
 * remotePostId (TikTok's publish_id) — at that point TikTok itself holds
 * the real state, and a lack of confirmation within this short window is
 * not proof of failure; only pollPendingTikTokPublishes, reading TikTok's
 * own status endpoint, may resolve it further (see the correction this
 * reflects: never auto-FAIL an async TikTok publish on elapsed time
 * alone). A TikTok target that's still PUBLISHING with NO remotePostId
 * past the grace period never even got a publish_id back — that's the
 * same "the serverless function was killed mid-call" failure mode this
 * sweep exists for on every other platform, so it's swept normally.
 */
async function reconcileStalePublishingTargets(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_PUBLISHING_GRACE_MS);

  const stale = await prisma.socialPostPlatform.findMany({
    where: {
      status: SocialPostTargetStatus.PUBLISHING,
      lastAttemptAt: { lte: cutoff },
      OR: [{ platform: { not: SocialPlatform.TIKTOK } }, { platform: SocialPlatform.TIKTOK, remotePostId: null }],
    },
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
  // Runs on the same (currently once-daily) cron cadence as everything
  // else here — a TikTok target's confirmation can take up to that long
  // between polls. Submission itself (publishTargetsNow) is immediate;
  // only turning "accepted" into a final state is on this schedule.
  await pollPendingTikTokPublishes().catch((error) =>
    console.error(JSON.stringify({ scope: "tiktok_poll_error", stage: "batch", message: error instanceof Error ? error.message.slice(0, 200) : "unknown" })),
  );

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
