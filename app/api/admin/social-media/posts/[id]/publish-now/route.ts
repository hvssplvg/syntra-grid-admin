import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { getPostOrThrow, prepareDirectPublish } from "@/lib/social-media/server";
import { publishTargetsNow } from "@/lib/social-media/publishing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Matches the cron route's own ceiling — publishing a handful of targets
// concurrently (see publishTargetsNow) comfortably fits inside this on
// Vercel's Hobby plan; a target that's still processing when the
// function is eventually killed is recovered later by the cron sweep's
// stale-PUBLISHING reconciliation rather than left stuck.
export const maxDuration = 60;

/* ============================================================================
   POST /api/admin/social-media/posts/:id/publish-now

   "Publish Now" — requires the same APPROVE permission schedulePost/
   approvePost already require (no new permission model), verified here
   server-side regardless of what the UI shows. Never calls the
   CRON_SECRET-protected cron route or exposes it to the browser: this is
   an ordinary session-authenticated admin route that calls the exact
   same publishing code (publishTargetsNow -> executeTarget) the cron job
   uses, directly, in-request.
============================================================================ */

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.APPROVE);
    const { id } = await params;

    const { targetIds } = await prepareDirectPublish(identity, id);
    const { results } = await publishTargetsNow(targetIds);
    const post = await getPostOrThrow(id);

    return NextResponse.json({ ok: true, post, results });
  } catch (error) {
    console.error("[admin/social-media/posts/:id/publish-now]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
