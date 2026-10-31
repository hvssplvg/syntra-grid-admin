// lib/ai/aiVideoJobs.ts
//
// Shared helpers for AI Video jobs — used by both the job-creation API
// route (app/api/admin/social-media/ai/ai-video-jobs/route.ts) and the
// cron poller (app/api/cron/ai-video-poll/route.ts), so job-claiming
// and status-application logic is defined exactly once, not duplicated
// across the two call sites.

import { prisma } from "@/lib/prisma";
import { AiVideoGenerationMethod, AiVideoJobStatus } from "@/app/generated/prisma/client";
import { isOwnSocialMediaDeliveryUrl, uploadBufferToCloudinary } from "@/lib/cloudinary-server";
import "./providers/lumaVideo"; // registers the provider as a side effect — see registry.ts
import { getAiVideoProvider, isAiVideoConfigured, requiredAiVideoEnvVars } from "./registry";
import { estimateVideoCostUsd } from "./videoCost";
import { checkVideoUsageAllowed } from "./videoUsage";
import { AiProviderError } from "./types";
import type { AiVideoDurationSeconds, AiVideoResolution } from "./videoGenTypes";

export type ResolvedImageSource = { url: string; assetId: string | null };

/** The ONLY place a start-frame image's URL is ever decided — never
 *  trusts a raw client-supplied URL directly. A `sourceImageAssetId`
 *  resolves through our own `SocialMediaAsset` table (confirms the
 *  asset exists and is actually an image); a `sourceImageUrl` — the
 *  "reuse the canvas's own already-known background image" case,
 *  where the caller already has a trusted URL but no asset id handy —
 *  is accepted only if it matches our own Cloudinary cloud and the
 *  Social Media library's own upload folder. Anything else is
 *  rejected. Closes a real gap: the job-creation route previously
 *  accepted any `https://` URL for this field with no further check
 *  (unused by any UI until now, but exploitable the moment a caller
 *  appeared) — handing an arbitrary external URL to Luma as if it
 *  were our own asset. */
export async function resolveTrustedStartFrame(input: {
  sourceImageAssetId?: string;
  sourceImageUrl?: string;
}): Promise<{ ok: true; source: ResolvedImageSource | null } | { ok: false; error: string }> {
  if (input.sourceImageAssetId) {
    const asset = await prisma.socialMediaAsset.findUnique({ where: { id: input.sourceImageAssetId }, select: { id: true, url: true, type: true } });
    if (!asset || asset.type !== "IMAGE") {
      return { ok: false, error: "That image couldn't be found — it may have been removed. Choose a different one." };
    }
    return { ok: true, source: { url: asset.url, assetId: asset.id } };
  }
  if (input.sourceImageUrl) {
    if (!isOwnSocialMediaDeliveryUrl(input.sourceImageUrl)) {
      return { ok: false, error: "That image isn't one we can use as a starting frame." };
    }
    return { ok: true, source: { url: input.sourceImageUrl, assetId: null } };
  }
  return { ok: true, source: null };
}

const NON_TERMINAL_STATUSES: AiVideoJobStatus[] = [
  AiVideoJobStatus.AWAITING_CONFIRMATION,
  AiVideoJobStatus.QUEUED,
  AiVideoJobStatus.GENERATING,
  AiVideoJobStatus.PROCESSING,
];

export type CreateVideoJobInput = {
  adminUserId: string;
  contentProjectId?: string;
  sceneId?: string;
  prompt: string;
  aspectRatio: string;
  resolution: AiVideoResolution;
  durationSeconds: AiVideoDurationSeconds;
  /** Untrusted source descriptors for an image-to-video generation —
   *  resolved via resolveTrustedStartFrame before ever being sent to
   *  Luma or stored. Omit both for a plain text-to-video job. */
  sourceImageAssetId?: string;
  sourceImageUrl?: string;
};

export type CreateVideoJobResult =
  | { ok: true; job: { id: string; estimatedCostUsd: number } }
  | { ok: false; status: 400 | 429 | 503; error: string; missingEnvVars?: string[] };

/** Creates a job row and submits it to Luma in one call — this app
 *  never leaves a row sitting unsubmitted, since the admin only ever
 *  reaches this after already confirming cost client-side (the
 *  DRAFT/AWAITING_CONFIRMATION states in the schema are reserved for a
 *  future "save storyboard without generating yet" feature, not used
 *  by v1's flow). Enforces, server-side, every protection the user
 *  asked for: duplicate-job prevention, a real DB-backed usage-cap
 *  check, and a cost that is always computed here — never trusted from
 *  the client. */
export async function createAndSubmitVideoJob(input: CreateVideoJobInput): Promise<CreateVideoJobResult> {
  if (!isAiVideoConfigured()) {
    return { ok: false, status: 503, error: "AI video generation isn't configured yet.", missingEnvVars: requiredAiVideoEnvVars() };
  }
  const provider = getAiVideoProvider();
  if (!provider) {
    return { ok: false, status: 503, error: "No AI video provider is registered.", missingEnvVars: requiredAiVideoEnvVars() };
  }

  const resolvedSource = await resolveTrustedStartFrame(input);
  if (!resolvedSource.ok) {
    return { ok: false, status: 400, error: resolvedSource.error };
  }
  const startFrameUrl = resolvedSource.source?.url;
  const sourceImageAssetId = resolvedSource.source?.assetId ?? undefined;
  const generationMethod = startFrameUrl ? AiVideoGenerationMethod.IMAGE_TO_VIDEO : AiVideoGenerationMethod.TEXT_TO_VIDEO;

  if (input.durationSeconds === 10 && startFrameUrl) {
    return { ok: false, status: 400, error: "Image-to-video is only available at 5 seconds — choose a 5s duration, or drop the reference image for a 10s generation." };
  }

  const estimate = estimateVideoCostUsd(input.resolution, input.durationSeconds);
  if (!estimate.available) {
    return { ok: false, status: 400, error: estimate.reason };
  }

  // Duplicate-request prevention: never allow two non-terminal jobs for
  // the same scene at once (covers double-clicks and accidental
  // repeated confirmation).
  if (input.contentProjectId && input.sceneId) {
    const existing = await prisma.aiVideoJob.findFirst({
      where: { contentProjectId: input.contentProjectId, sceneId: input.sceneId, status: { in: NON_TERMINAL_STATUSES } },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, status: 429, error: "A video is already generating for this scene." };
    }
  }

  const usageCheck = await checkVideoUsageAllowed(input.adminUserId, estimate.estimatedCostUsd);
  if (!usageCheck.allowed) {
    return { ok: false, status: 429, error: usageCheck.reason };
  }

  const job = await prisma.aiVideoJob.create({
    data: {
      adminUserId: input.adminUserId,
      contentProjectId: input.contentProjectId,
      sceneId: input.sceneId,
      provider: provider.id,
      model: "ray-3.2",
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      durationSeconds: input.durationSeconds,
      generationMethod,
      sourceImageAssetId,
      startFrameUrl,
      estimatedCostUsd: estimate.estimatedCostUsd,
      status: AiVideoJobStatus.QUEUED,
      lastAttemptAt: new Date(),
    },
    select: { id: true, estimatedCostUsd: true },
  });

  try {
    const submitted = await provider.submit({
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      durationSeconds: input.durationSeconds,
      startFrameUrl,
    });

    await prisma.aiVideoJob.update({
      where: { id: job.id },
      data: { providerJobId: submitted.providerJobId, status: AiVideoJobStatus.GENERATING },
    });
  } catch (error) {
    // Submission itself failed — nothing was generated, so this never
    // counts toward the admin's spend (videoUsage.ts's COUNTED_STATUSES
    // excludes FAILED). Never auto-retried; the admin sees the error
    // and can explicitly try again, which creates a brand-new job.
    await prisma.aiVideoJob.update({
      where: { id: job.id },
      data: { status: AiVideoJobStatus.FAILED, errorMessage: error instanceof AiProviderError ? error.message : "Submission to the video provider failed." },
    });
    return { ok: false, status: 503, error: error instanceof AiProviderError ? error.message : "Submission to the video provider failed." };
  }

  return { ok: true, job: { id: job.id, estimatedCostUsd: job.estimatedCostUsd } };
}

export type VideoJobView = {
  id: string;
  status: AiVideoJobStatus;
  sceneId: string | null;
  outputVideoUrl: string | null;
  errorMessage: string | null;
  estimatedCostUsd: number;
  actualCostUsd: number | null;
  generationMethod: AiVideoGenerationMethod;
  /** The clip's actual generated length — used to snap the owning
   *  scene's own durationSeconds to match on completion, so the
   *  timeline never shows a longer slot than the footage that's
   *  actually in it (found via real export testing: without this, a
   *  scene whose concept suggested 10s but whose job was submitted at
   *  the default 5s left a silent 5s gap of frozen last-frame). */
  durationSeconds: number;
};

/** The exact Prisma `select` shape for listing a project's jobs
 *  (app/api/.../ai-video-jobs/route.ts's GET ?projectId= path) —
 *  `satisfies Record<keyof VideoJobView, true>` makes tsc fail the
 *  build if a field is ever added to VideoJobView without also being
 *  selected here. Found the hard way: an earlier version of the list
 *  route hand-wrote its own select object without durationSeconds,
 *  silently returning `undefined` for it, which (via the resume-on-
 *  reopen path) set a scene's durationSeconds to undefined, produced
 *  NaN for the whole timeline's total duration, and hung the recorder
 *  forever — a bug nothing caught until a real browser export test. */
export const VIDEO_JOB_LIST_SELECT = {
  id: true,
  status: true,
  sceneId: true,
  outputVideoUrl: true,
  errorMessage: true,
  estimatedCostUsd: true,
  actualCostUsd: true,
  generationMethod: true,
  durationSeconds: true,
} as const satisfies Record<keyof VideoJobView, true>;

/** Advances one job by checking its provider status and, on
 *  completion, downloading + re-uploading the output to Cloudinary
 *  (Luma's own output URL is presigned and expires in 1 hour — never
 *  stored long-term). Used by both the cron poller and the client-side
 *  "while this project is open" poll route, so the two paths can never
 *  disagree about what a completed job looks like. */
export async function pollVideoJob(jobId: string): Promise<VideoJobView | null> {
  const job = await prisma.aiVideoJob.findUnique({ where: { id: jobId } });
  if (!job) return null;

  if (job.status !== AiVideoJobStatus.GENERATING && job.status !== AiVideoJobStatus.PROCESSING) {
    return job;
  }
  if (!job.providerJobId) return job;

  const provider = getAiVideoProvider();
  if (!provider) return job;

  await prisma.aiVideoJob.update({ where: { id: job.id }, data: { lastPolledAt: new Date() } });

  try {
    const result = await provider.checkStatus(job.providerJobId);

    if (result.state === "completed") {
      const videoResponse = await fetch(result.outputUrl);
      if (!videoResponse.ok) throw new Error(`Could not download the completed video (HTTP ${videoResponse.status}).`);
      const buffer = Buffer.from(await videoResponse.arrayBuffer());
      const uploaded = await uploadBufferToCloudinary(buffer, { folder: "syntragrid/ai-video", publicId: job.id, resourceType: "video" });

      return prisma.aiVideoJob.update({
        where: { id: job.id },
        data: {
          status: AiVideoJobStatus.COMPLETED,
          outputVideoUrl: uploaded.secure_url,
          actualCostUsd: job.estimatedCostUsd,
          completedAt: new Date(),
        },
      });
    }

    if (result.state === "failed") {
      return prisma.aiVideoJob.update({
        where: { id: job.id },
        data: { status: AiVideoJobStatus.FAILED, errorMessage: result.errorMessage, retryCount: { increment: 1 } },
      });
    }

    // "queued"/"processing" — still in flight, lastPolledAt already
    // recorded above. Mirrors publishing.ts's TikTok poller: never
    // infer failure from elapsed time here, only from the provider's
    // own explicit answer.
    if (result.state === "processing" && job.status !== AiVideoJobStatus.PROCESSING) {
      return prisma.aiVideoJob.update({ where: { id: job.id }, data: { status: AiVideoJobStatus.PROCESSING } });
    }
    return job;
  } catch {
    // A network/transient error checking status is not the same as the
    // provider reporting failure — never change status here, retried
    // on the next poll.
    return job;
  }
}

/** Finds every non-terminal job and advances each — the cron poller's
 *  entry point. Caps the batch, same idea as runDuePublishJobs, to
 *  stay well within a cron invocation's execution-time budget. */
export async function pollAllPendingVideoJobs(limit = 25): Promise<{ polled: number }> {
  const pending = await prisma.aiVideoJob.findMany({
    where: { status: { in: [AiVideoJobStatus.GENERATING, AiVideoJobStatus.PROCESSING] } },
    select: { id: true },
    take: limit,
  });
  for (const job of pending) {
    await pollVideoJob(job.id).catch(() => undefined);
  }
  return { polled: pending.length };
}
