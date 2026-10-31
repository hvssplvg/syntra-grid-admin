// lib/ai/imageUsage.ts
//
// Per-admin daily usage ledger for Mode A image generation — the
// server-side enforcement behind "maximum N generations/revisions per
// day" and "a configurable daily spending cap", so these are real
// limits, not just numbers displayed in the UI.
//
// KNOWN LIMITATION, stated plainly (same honest tradeoff already
// documented and accepted in this codebase for rateLimit.ts): this is
// per-process memory. It resets on a cold start and is not shared
// across concurrent serverless instances. It reliably stops this
// admin tool's own UI from running up unbounded cost in normal use,
// but it is not a hard guarantee against, say, two concurrent
// serverless instances each independently allowing up to the limit at
// the same moment. A durable, cross-instance guarantee would need a
// new database table — out of scope until separately approved (no
// migration was authorised for this phase), and deliberately NOT
// worked around by writing into an existing, differently-purposed
// table (AuditLog feeds the Command Overview's activity feed —
// repurposing it here would silently change what that unrelated
// screen shows).

import { estimateImageCostUsd, estimateRevisionCostUsd } from "./imageCost";
import type { AiImageQuality, AiImageSize } from "./imageTypes";

export const MAX_GENERATIONS_PER_DAY = 5;
export const MAX_REVISIONS_PER_DAY = 2;
const DEFAULT_DAILY_SPEND_CAP_USD = 2;

export function dailySpendCapUsd(): number {
  const raw = Number(process.env.AI_IMAGE_DAILY_SPEND_CAP_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_SPEND_CAP_USD;
}

type DailyUsage = { day: string; generations: number; revisions: number; spentUsd: number };

const usageByAdmin = new Map<string, DailyUsage>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // UTC calendar day
}

function currentUsage(adminUserId: string): DailyUsage {
  const today = todayKey();
  const existing = usageByAdmin.get(adminUserId);
  if (existing && existing.day === today) return existing;
  const fresh: DailyUsage = { day: today, generations: 0, revisions: 0, spentUsd: 0 };
  usageByAdmin.set(adminUserId, fresh);
  return fresh;
}

export type ImageUsageSnapshot = {
  generations: number;
  maxGenerations: number;
  revisions: number;
  maxRevisions: number;
  spentUsd: number;
  capUsd: number;
};

export function getImageUsageSnapshot(adminUserId: string): ImageUsageSnapshot {
  const usage = currentUsage(adminUserId);
  return {
    generations: usage.generations,
    maxGenerations: MAX_GENERATIONS_PER_DAY,
    revisions: usage.revisions,
    maxRevisions: MAX_REVISIONS_PER_DAY,
    spentUsd: usage.spentUsd,
    capUsd: dailySpendCapUsd(),
  };
}

export type ImageUsageCheck = { allowed: true; estimatedCostUsd: number } | { allowed: false; reason: string; estimatedCostUsd: number };

/** Checked BEFORE every paid call — generate and revise both go
 *  through this, never straight to the provider. */
export function checkImageUsageAllowed(adminUserId: string, kind: "generate" | "revision", size: AiImageSize, quality: AiImageQuality): ImageUsageCheck {
  const usage = currentUsage(adminUserId);
  const cap = dailySpendCapUsd();
  const estimatedCostUsd = kind === "generate" ? estimateImageCostUsd(size, quality) : estimateRevisionCostUsd(size, quality);

  if (kind === "generate" && usage.generations >= MAX_GENERATIONS_PER_DAY) {
    return { allowed: false, reason: `Daily limit reached — ${MAX_GENERATIONS_PER_DAY} image generations per admin per day. Try again tomorrow.`, estimatedCostUsd };
  }
  if (kind === "revision" && usage.revisions >= MAX_REVISIONS_PER_DAY) {
    return { allowed: false, reason: `Daily limit reached — ${MAX_REVISIONS_PER_DAY} image revisions per admin per day. Try again tomorrow.`, estimatedCostUsd };
  }
  if (usage.spentUsd + estimatedCostUsd > cap) {
    return {
      allowed: false,
      reason: `This would exceed today's $${cap.toFixed(2)} image-generation budget ($${usage.spentUsd.toFixed(2)} used so far today). Try again tomorrow, or ask an admin to raise AI_IMAGE_DAILY_SPEND_CAP_USD.`,
      estimatedCostUsd,
    };
  }
  return { allowed: true, estimatedCostUsd };
}

/** Recorded ONLY after a provider call actually succeeds — a failed
 *  request never counts against the admin's daily limits. */
export function recordImageUsage(adminUserId: string, kind: "generate" | "revision", estimatedCostUsd: number): void {
  const usage = currentUsage(adminUserId);
  if (kind === "generate") usage.generations += 1;
  else usage.revisions += 1;
  usage.spentUsd += estimatedCostUsd;
}
