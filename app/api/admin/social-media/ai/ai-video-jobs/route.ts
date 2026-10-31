import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { createAndSubmitVideoJob, pollVideoJob, VIDEO_JOB_LIST_SELECT } from "@/lib/ai/aiVideoJobs";
import { AI_VIDEO_DURATIONS, AI_VIDEO_RESOLUTIONS, type AiVideoDurationSeconds, type AiVideoResolution } from "@/lib/ai/videoGenTypes";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROMPT_LENGTH = 4000;

function parseBody(body: unknown):
  | {
      prompt: string;
      aspectRatio: string;
      resolution: AiVideoResolution;
      durationSeconds: AiVideoDurationSeconds;
      contentProjectId?: string;
      sceneId?: string;
      sourceImageAssetId?: string;
      sourceImageUrl?: string;
    }
  | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const input = body as Record<string, unknown>;

  if (typeof input.prompt !== "string" || !input.prompt.trim()) return { error: "A video prompt is required." };
  if (typeof input.aspectRatio !== "string" || !input.aspectRatio.trim()) return { error: "An aspect ratio is required." };
  if (typeof input.resolution !== "string" || !(AI_VIDEO_RESOLUTIONS as readonly string[]).includes(input.resolution)) {
    return { error: `resolution must be one of: ${AI_VIDEO_RESOLUTIONS.join(", ")}.` };
  }
  const durationSeconds = Number(input.durationSeconds);
  if (!(AI_VIDEO_DURATIONS as readonly number[]).includes(durationSeconds)) {
    return { error: `durationSeconds must be one of: ${AI_VIDEO_DURATIONS.join(", ")}.` };
  }
  if (input.contentProjectId !== undefined && typeof input.contentProjectId !== "string") return { error: "contentProjectId must be text." };
  if (input.sceneId !== undefined && typeof input.sceneId !== "string") return { error: "sceneId must be text." };
  // Shape-only validation here — these are never trusted as the final
  // image source. resolveTrustedStartFrame (lib/ai/aiVideoJobs.ts),
  // called from createAndSubmitVideoJob, does the real resolution: a
  // sourceImageAssetId must resolve to a real SocialMediaAsset of type
  // IMAGE; a sourceImageUrl must match our own Cloudinary delivery URL
  // shape. Neither is ever handed to Luma unresolved.
  if (input.sourceImageAssetId !== undefined && typeof input.sourceImageAssetId !== "string") return { error: "sourceImageAssetId must be text." };
  if (input.sourceImageUrl !== undefined && (typeof input.sourceImageUrl !== "string" || !input.sourceImageUrl.startsWith("https://"))) {
    return { error: "sourceImageUrl must be an https URL." };
  }

  return {
    prompt: input.prompt.trim().slice(0, MAX_PROMPT_LENGTH),
    aspectRatio: input.aspectRatio.trim().slice(0, 10),
    resolution: input.resolution as AiVideoResolution,
    durationSeconds: durationSeconds as AiVideoDurationSeconds,
    contentProjectId: typeof input.contentProjectId === "string" ? input.contentProjectId : undefined,
    sceneId: typeof input.sceneId === "string" ? input.sceneId : undefined,
    sourceImageAssetId: typeof input.sourceImageAssetId === "string" ? input.sourceImageAssetId : undefined,
    sourceImageUrl: typeof input.sourceImageUrl === "string" ? input.sourceImageUrl : undefined,
  };
}

/* ============================================================================
   POST /api/admin/social-media/ai/ai-video-jobs

   Creates and submits exactly one real, paid Luma video-generation job.
   Only ever reached after the admin has already seen and confirmed the
   cost dialog client-side — this route re-derives and re-checks that
   cost server-side regardless, never trusting the client's number.
============================================================================ */
export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const parsed = parseBody(body);
    if ("error" in parsed) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

    const result = await createAndSubmitVideoJob({ adminUserId: identity.admin.id, ...parsed });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, missingEnvVars: result.missingEnvVars }, { status: result.status });
    }

    return NextResponse.json({ ok: true, job: result.job });
  } catch (error) {
    console.error("[admin/social-media/ai/ai-video-jobs:POST]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}

/* ============================================================================
   GET /api/admin/social-media/ai/ai-video-jobs?id=...
   GET /api/admin/social-media/ai/ai-video-jobs?projectId=...

   Advances and returns one job's current status (the live-tab polling
   path), or lists every job for a project (the "resume on reopen" path
   — any job that finished while the tab was closed is picked up here).
============================================================================ */
export async function GET(request: NextRequest) {
  try {
    await requireSocialMediaPermission(AccessAction.VIEW);

    const id = request.nextUrl.searchParams.get("id");
    const projectId = request.nextUrl.searchParams.get("projectId");

    if (id) {
      const job = await pollVideoJob(id);
      if (!job) return NextResponse.json({ ok: false, error: "Job not found." }, { status: 404 });
      return NextResponse.json({ ok: true, job });
    }

    if (projectId) {
      const jobs = await prisma.aiVideoJob.findMany({
        where: { contentProjectId: projectId },
        select: VIDEO_JOB_LIST_SELECT,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ ok: true, jobs });
    }

    return NextResponse.json({ ok: false, error: "id or projectId is required." }, { status: 400 });
  } catch (error) {
    console.error("[admin/social-media/ai/ai-video-jobs:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
