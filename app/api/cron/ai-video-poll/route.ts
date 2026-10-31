// app/api/cron/ai-video-poll/route.ts
//
// Scheduled by Vercel Cron (see vercel.json) — advances every
// in-flight AiVideoJob by checking its Luma status and, on completion,
// downloading+persisting the output to Cloudinary. Mirrors
// app/api/cron/social-publish/route.ts's shape exactly: same
// CRON_SECRET bearer check, same vague 404 on mismatch, same
// runtime/dynamic/maxDuration exports.
//
// This is the "leave the page and come back" safety net — the admin's
// own open tab polls far more responsively (every ~5s) while open; this
// cron route exists so a job started and then abandoned (tab closed,
// browser crashed) still completes and persists on its own.
//
// Scheduled once daily (see vercel.json) — confirmed against Vercel's
// own docs (vercel.com/docs/cron-jobs/usage-and-pricing, fetched
// 2026-10-30) that Hobby-plan projects cannot deploy a cron expression
// more frequent than once per day; the deploy itself fails outright,
// not just runs less often. An earlier version of this file's cron
// entry was "*/5 * * * *", which would have broken deployment on a
// Hobby plan. Luma generations complete in well under a minute, so a
// once-daily safety net means an abandoned job could sit unresolved
// for up to a day in the worst case — the live-tab polling above is
// what makes the common case fast; this cron only guarantees eventual
// completion, same posture as social-publish's own once-daily cron.
// If this project is actually on Vercel Pro (not confirmed), the
// schedule in vercel.json can be tightened to e.g. "*/5 * * * *" with
// no code change needed here.

import { NextRequest, NextResponse } from "next/server";
import { pollAllPendingVideoJobs } from "@/lib/ai/aiVideoJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const result = await pollAllPendingVideoJobs();
  return NextResponse.json(result);
}
