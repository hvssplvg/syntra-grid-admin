// app/api/cron/health-check/route.ts
//
// Scheduled by Vercel Cron (see vercel.json) — polls every due
// MonitoredEndpoint. Mirrors app/api/cron/social-publish/route.ts's
// shape exactly: same CRON_SECRET bearer check, same vague 404 on
// mismatch, same runtime/dynamic/maxDuration exports.
//
// Running once daily (Vercel Hobby-plan compatible, same constraint as
// the other two cron jobs — see vercel.json) means real check frequency
// is "at most daily" regardless of any MonitoredEndpoint's own
// checkIntervalMinutes — this is not live/real-time monitoring on the
// current plan. Upgrading to Vercel Pro and a tighter cron schedule
// needs no code change here; runDueHealthChecks already only polls
// endpoints that are actually due.

import { NextRequest, NextResponse } from "next/server";

import { runDueHealthChecks } from "@/lib/monitoring/runDueHealthChecks";

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

  const result = await runDueHealthChecks();

  return NextResponse.json(result);
}
