// lib/ai/imageCost.ts
//
// Cost estimation for Mode A image generation/revision — the numbers
// behind the visible cost estimate AND the server-side spend-cap
// enforcement (imageUsage.ts). Deliberately conservative: every figure
// here is a verified official number or an explicit upper-bound
// extrapolation, never an optimistic guess, per the explicit
// instruction to use a conservative estimate where an exact cost can't
// be determined in advance.
//
// Verified directly against developers.openai.com on 2026-10-14 (not
// third-party trackers):
//   - developers.openai.com/api/docs/pricing: gpt-image-2,
//     gpt-image-2.5-sunburst and gpt-image-2.5-flare all bill the
//     identical token rate — $8.00 per 1M image input tokens, $30.00
//     per 1M image output tokens (this app uses gpt-image-2.5-sunburst
//     by default — see providers/openaiImage.ts).
//   - developers.openai.com/api/docs/guides/image-generation's worked
//     example for that model family at 1024x1024: low $0.006, medium
//     $0.053, high $0.211 per image.
//
// No official worked example exists for the non-square recommended
// sizes (1024x1536 / 1536x1024) under this model family — those use a
// deliberately conservative multiplier (more pixels → more output
// tokens → higher cost), clearly marked as an estimate, not an
// official figure. /v1/images/edits (revisions) has no separately
// published rate either — treated as costing the same as a fresh
// generation at the same size/quality, which is itself conservative
// (an edit typically touches fewer new pixels than a full generation).

import type { AiImageQuality, AiImageSize } from "./imageTypes";

/** Official worked example, gpt-image-2-family, 1024x1024. */
const SQUARE_COST_USD: Record<AiImageQuality, number> = {
  medium: 0.053,
  high: 0.211,
};

/** Conservative (deliberately over-, not under-, estimated) — the
 *  non-square recommended sizes are roughly 1.5x the pixel count of
 *  1024x1024; rounded up further for safety margin. Not an official
 *  OpenAI figure — see file header. */
const NON_SQUARE_MULTIPLIER = 1.6;

export function estimateImageCostUsd(size: AiImageSize, quality: AiImageQuality): number {
  const base = SQUARE_COST_USD[quality];
  return size === "1024x1024" ? base : Math.round(base * NON_SQUARE_MULTIPLIER * 1000) / 1000;
}

/** Revisions (/v1/images/edits) — see file header for why this
 *  conservatively reuses the generation estimate rather than assuming
 *  a lower, unverified edit-specific cost. */
export function estimateRevisionCostUsd(size: AiImageSize, quality: AiImageQuality): number {
  return estimateImageCostUsd(size, quality);
}
