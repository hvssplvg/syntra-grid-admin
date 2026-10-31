// lib/ai/videoUsage.ts
//
// Per-admin daily usage ledger for real AI video generation — unlike
// imageUsage.ts (deliberately in-memory, see that file's header), this
// is backed directly by the persisted AiVideoJob table. A video job
// spans multiple serverless invocations (submit now, poll/complete
// minutes later), so an in-memory-only cap would not reliably survive
// the gap — a real database row is a hard requirement here, not an
// upgrade. No separate ledger table: usage is derived by summing
// today's AiVideoJob rows for this admin, so there is exactly one
// source of truth for "what did this admin spend today," never two
// numbers that can drift apart.

import { prisma } from "@/lib/prisma";
import { AiVideoJobStatus } from "@/app/generated/prisma/client";

export const MAX_VIDEO_GENERATIONS_PER_DAY = 5;
const DEFAULT_DAILY_SPEND_CAP_USD = 5;

export function dailyVideoSpendCapUsd(): number {
  const raw = Number(process.env.AI_VIDEO_DAILY_SPEND_CAP_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_SPEND_CAP_USD;
}

// A job counts toward spend/count once it has actually been submitted
// (QUEUED or further) — a DRAFT/AWAITING_CONFIRMATION row the admin
// never confirmed, or a FAILED/CANCELLED one, never did or no longer
// will cost anything, so it's excluded from both counters.
const COUNTED_STATUSES: AiVideoJobStatus[] = [
  AiVideoJobStatus.QUEUED,
  AiVideoJobStatus.GENERATING,
  AiVideoJobStatus.PROCESSING,
  AiVideoJobStatus.COMPLETED,
];

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export type VideoUsageSnapshot = {
  generations: number;
  maxGenerations: number;
  spentUsd: number;
  capUsd: number;
};

export async function getVideoUsageSnapshot(adminUserId: string): Promise<VideoUsageSnapshot> {
  const todaysJobs = await prisma.aiVideoJob.findMany({
    where: { adminUserId, status: { in: COUNTED_STATUSES }, createdAt: { gte: startOfTodayUtc() } },
    select: { estimatedCostUsd: true, actualCostUsd: true },
  });

  const spentUsd = todaysJobs.reduce((total, job) => total + (job.actualCostUsd ?? job.estimatedCostUsd), 0);

  return {
    generations: todaysJobs.length,
    maxGenerations: MAX_VIDEO_GENERATIONS_PER_DAY,
    spentUsd: Math.round(spentUsd * 1000) / 1000,
    capUsd: dailyVideoSpendCapUsd(),
  };
}

export type VideoUsageCheck = { allowed: true } | { allowed: false; reason: string };

/** Checked BEFORE every job is created and submitted — never trusts a
 *  client-provided price, always re-derives from today's real rows. */
export async function checkVideoUsageAllowed(adminUserId: string, estimatedCostUsd: number): Promise<VideoUsageCheck> {
  const usage = await getVideoUsageSnapshot(adminUserId);

  if (usage.generations >= MAX_VIDEO_GENERATIONS_PER_DAY) {
    return { allowed: false, reason: `Daily limit reached — ${MAX_VIDEO_GENERATIONS_PER_DAY} video generations per admin per day. Try again tomorrow.` };
  }
  if (usage.spentUsd + estimatedCostUsd > usage.capUsd) {
    return {
      allowed: false,
      reason: `This would exceed today's $${usage.capUsd.toFixed(2)} video-generation budget ($${usage.spentUsd.toFixed(2)} used so far today). Try again tomorrow, or ask an admin to raise AI_VIDEO_DAILY_SPEND_CAP_USD.`,
    };
  }
  return { allowed: true };
}
