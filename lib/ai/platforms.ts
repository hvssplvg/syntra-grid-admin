// lib/ai/platforms.ts
//
// Static, factual per-platform writing guidance used only to steer the
// AI prompt — never presented to an admin as a claim about what the
// model "knows". Character limits are read from the same PLATFORMS data
// the composer itself already uses, so the two never drift apart.

import { PLATFORMS } from "@/app/components/admin/tabs/social-media/shared/constants";
import type { SocialPlatform } from "@/app/components/admin/tabs/social-media/shared/types";

const PLATFORM_GUIDANCE: Record<SocialPlatform, string> = {
  LINKEDIN: "Professional, informative and credible — written for a business audience evaluating a vendor or partner.",
  INSTAGRAM: "Engaging and visually oriented. Concise. Close with a small set of relevant hashtags, never a wall of them.",
  X: "Short and direct. Make the point in the first sentence; no filler.",
  FACEBOOK: "Conversational and community-oriented — written to a mixed, less formal audience than LinkedIn.",
  TIKTOK: "Strong hook in the first line, concise caption, written to earn discovery rather than explain everything.",
  YOUTUBE: "A clear, descriptive caption that explains what the video shows, written for search and discovery.",
};

export function platformGuidance(platform: SocialPlatform): string {
  const definition = PLATFORMS.find((item) => item.id === platform);
  const limit = definition?.limit;
  const base = PLATFORM_GUIDANCE[platform];
  return limit ? `${base} Stay within ${limit} characters.` : base;
}
