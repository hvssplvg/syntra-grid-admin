// lib/ai/videoCost.ts
//
// Cost estimation for real AI video generation (Luma Ray3.2). Every
// figure below was verified live against docs.agents.lumalabs.ai's
// official pricing page on 2026-10-30 (credits x $0.003/credit), not a
// third-party tracker or an extrapolation.
//
// The 360p/10s cell is deliberately left OUT of this table — Luma's
// pricing page did not publish an official number for it, and per the
// explicit instruction "if pricing cannot be verified, do not present
// an invented cost estimate," 10s generations are only offered at
// 540p and above (where a verified number exists), not at 360p.

import { AI_VIDEO_DURATIONS, type AiVideoDurationSeconds, type AiVideoResolution } from "./videoGenTypes";

const PRICE_TABLE: Partial<Record<AiVideoResolution, Partial<Record<AiVideoDurationSeconds, number>>>> = {
  "360p": { 5: 0.06 },
  "540p": { 5: 0.15, 10: 0.45 },
  "720p": { 5: 0.3, 10: 0.9 },
  "1080p": { 5: 1.2, 10: 3.6 },
};

export type VideoCostEstimate = { available: true; estimatedCostUsd: number } | { available: false; reason: string };

export function estimateVideoCostUsd(resolution: AiVideoResolution, durationSeconds: AiVideoDurationSeconds): VideoCostEstimate {
  const cost = PRICE_TABLE[resolution]?.[durationSeconds];
  if (cost === undefined) {
    return { available: false, reason: `${resolution} at ${durationSeconds}s has no officially verified Luma price — choose a different resolution or duration.` };
  }
  return { available: true, estimatedCostUsd: cost };
}

/** Picks a duration that's actually priced at the given resolution,
 *  starting from whatever duration was requested (typically a
 *  storyboard scene's own timeline length, clamped to Luma's 5s/10s).
 *  Found via real browser testing: a trend-adapted 10s scene at the
 *  default 360p resolution (which only prices 5s — see the table
 *  above) made the cost-confirmation dialog fail to open at all, with
 *  only an easy-to-miss inline error. 5s is priced at every resolution,
 *  so it's always a safe fallback when the requested duration isn't
 *  available at the current resolution. */
export function nearestAvailableDuration(resolution: AiVideoResolution, requestedDurationSeconds: number): AiVideoDurationSeconds {
  const snapped = AI_VIDEO_DURATIONS.reduce((closest, candidate) =>
    Math.abs(candidate - requestedDurationSeconds) < Math.abs(closest - requestedDurationSeconds) ? candidate : closest,
  );
  return estimateVideoCostUsd(resolution, snapped).available ? snapped : 5;
}

/** The resolution x duration combinations this app will actually offer
 *  in the storyboard UI and cost-confirmation dialog — every one of
 *  these has a verified price above. */
export function availableVideoOptions(): Array<{ resolution: AiVideoResolution; durationSeconds: AiVideoDurationSeconds; estimatedCostUsd: number }> {
  const options: Array<{ resolution: AiVideoResolution; durationSeconds: AiVideoDurationSeconds; estimatedCostUsd: number }> = [];
  for (const resolution of Object.keys(PRICE_TABLE) as AiVideoResolution[]) {
    for (const durationSeconds of Object.keys(PRICE_TABLE[resolution] ?? {}).map(Number) as AiVideoDurationSeconds[]) {
      options.push({ resolution, durationSeconds, estimatedCostUsd: PRICE_TABLE[resolution]![durationSeconds]! });
    }
  }
  return options;
}
