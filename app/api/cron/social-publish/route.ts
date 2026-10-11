// app/api/cron/social-publish/route.ts
//
// Scheduled by Vercel Cron (see vercel.json) — picks up every
// SocialPostPlatform target whose scheduledAt has passed and attempts to
// publish it. Mirrors app/api/cron/monzo/route.ts's shape exactly: same
// CRON_SECRET bearer check, same vague 404 on mismatch, same
// runtime/dynamic/maxDuration exports.
//
// Running once daily (Vercel Hobby-plan compatible — see vercel.json)
// means a scheduled post publishes within a day of its scheduled time,
// not at the exact minute. Upgrading to Vercel Pro and a tighter cron
// schedule needs no code change here.

import { NextRequest, NextResponse } from "next/server";

import { runDuePublishJobs } from "@/lib/social-media/publishing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const result = await runDuePublishJobs();

  return NextResponse.json(result);
}
