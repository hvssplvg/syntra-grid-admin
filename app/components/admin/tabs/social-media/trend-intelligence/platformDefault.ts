// Picks a sensible default platform when "Generate Video"/"Generate
// Graphic" opens from a trend — the Video/Graphic Studio's own
// platform selector still lets the admin override this, it just no
// longer always starts on TikTok regardless of where the trend came
// from.

import type { SocialPlatform } from "../shared/types";
import type { TrendPlatform, TrendRecord } from "./api";

const PLATFORM_FROM_TREND: Partial<Record<TrendPlatform, SocialPlatform>> = {
  YOUTUBE: "YOUTUBE",
  TIKTOK: "TIKTOK",
  INSTAGRAM: "INSTAGRAM",
  LINKEDIN: "LINKEDIN",
  X: "X",
  // REDDIT/OTHER have no direct SocialPlatform equivalent — falls
  // through to the AI's own suggestion, then the TIKTOK default below.
};

const SOCIAL_PLATFORMS: SocialPlatform[] = ["TIKTOK", "INSTAGRAM", "LINKEDIN", "X", "FACEBOOK", "YOUTUBE"];

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as string[]).includes(value);
}

export function defaultPlatformForTrend(trend: TrendRecord): SocialPlatform {
  const suggested = trend.aiAnalysis?.suitablePlatforms?.[0];
  if (suggested && isSocialPlatform(suggested)) return suggested;
  return PLATFORM_FROM_TREND[trend.platform] ?? "TIKTOK";
}
