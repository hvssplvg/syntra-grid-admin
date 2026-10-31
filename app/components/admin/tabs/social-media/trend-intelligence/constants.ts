// Trend Intelligence's own small platform-tagging map. Reuses the
// shared PLATFORMS colors for the 6 platforms it overlaps with
// (shared/constants.ts), and adds REDDIT/OTHER locally rather than
// pushing them into the shared posting-PLATFORMS array — Reddit isn't
// a publish target, only a trend source.

import { PLATFORMS } from "../shared/constants";
import type { TrendPlatform, TrendType } from "./api";

const SHARED_COLORS = new Map(PLATFORMS.map((platform) => [platform.id, platform.color]));

export const TREND_PLATFORM_META: Record<TrendPlatform, { label: string; color: string }> = {
  TIKTOK: { label: "TikTok", color: SHARED_COLORS.get("TIKTOK") ?? "var(--text)" },
  INSTAGRAM: { label: "Instagram", color: SHARED_COLORS.get("INSTAGRAM") ?? "#D6246E" },
  YOUTUBE: { label: "YouTube", color: SHARED_COLORS.get("YOUTUBE") ?? "#FF0000" },
  LINKEDIN: { label: "LinkedIn", color: SHARED_COLORS.get("LINKEDIN") ?? "#0A66C2" },
  REDDIT: { label: "Reddit", color: "#FF4500" },
  X: { label: "X", color: SHARED_COLORS.get("X") ?? "var(--text)" },
  OTHER: { label: "Other", color: "var(--text-subtle)" },
};

export const TREND_TYPE_META: Record<TrendType, { label: string }> = {
  AUDIO: { label: "Trending audio" },
  MEME: { label: "Meme" },
  VIDEO_FORMAT: { label: "Viral video format" },
  HOOK: { label: "Trending hook" },
  GENERAL: { label: "General" },
};

/** Drives the 7 requested nav sections as filters over one Trend
 *  model — see the Trend Intelligence plan. */
export type TrendSection = "discover" | "audio" | "meme" | "video_format" | "hook" | "saved" | "library";

export const TREND_SECTIONS: Array<{ id: TrendSection; label: string }> = [
  { id: "discover", label: "Discover trends" },
  { id: "audio", label: "Trending audio" },
  { id: "meme", label: "Meme library" },
  { id: "video_format", label: "Viral video formats" },
  { id: "hook", label: "Trending hooks" },
  { id: "saved", label: "Saved trends" },
  { id: "library", label: "My trend library" },
];
