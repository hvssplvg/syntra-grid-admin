// Shared data constants used across SocialMediaTab.tsx and the
// content-studio directory. Moved verbatim from SocialMediaTab.tsx as
// part of the circular-import cleanup described in
// /Users/hvss/.claude/plans/cuddly-gathering-willow.md — no value
// changed, only relocated.

import { CalendarDays, FileText, ShieldCheck } from "lucide-react";

import type { ContentStatus, IconType, PlatformDefinition, RealPostStatus } from "./types";

export const PLATFORMS: PlatformDefinition[] = [
  {
    id: "INSTAGRAM",
    name: "Instagram",
    description: "Feed posts, reels and stories",
    color: "#D6246E",
    limit: 2200,
  },
  {
    id: "FACEBOOK",
    name: "Facebook",
    description: "Page posts and updates",
    color: "#1877F2",
    limit: 63206,
  },
  {
    id: "LINKEDIN",
    name: "LinkedIn",
    description: "Company page updates",
    color: "#0A66C2",
    limit: 3000,
  },
  {
    id: "X",
    name: "X",
    description: "Short updates and replies",
    color: "var(--text)",
    limit: 280,
  },
  {
    id: "TIKTOK",
    name: "TikTok",
    description: "Short-form video",
    // Monochrome and theme-adaptive, like X.
    color: "var(--text)",
    limit: 2200,
  },
  {
    id: "YOUTUBE",
    name: "YouTube",
    description: "Video uploads and shorts",
    color: "#FF0000",
    limit: 5000,
  },
];

export const STATUS_ORDER: ContentStatus[] = ["DRAFT", "READY", "SCHEDULED"];

export const STATUS_META: Record<
  ContentStatus,
  { label: string; short: string; description: string; hue: string; icon: IconType }
> = {
  DRAFT: {
    label: "Draft",
    short: "Drafts",
    description: "Still being written",
    hue: "var(--text-muted)",
    icon: FileText,
  },
  READY: {
    label: "Ready for review",
    short: "In review",
    description: "Waiting for sign-off",
    hue: "#D97706",
    icon: ShieldCheck,
  },
  SCHEDULED: {
    label: "Scheduled",
    short: "Scheduled",
    description: "Has a planned time",
    hue: "var(--accent)",
    icon: CalendarDays,
  },
};

export const REAL_STATUS_META: Record<RealPostStatus, { label: string; hue: string }> = {
  DRAFT: { label: "Draft", hue: "var(--text-muted)" },
  PENDING_REVIEW: { label: "Pending review", hue: "#D97706" },
  CHANGES_REQUESTED: { label: "Changes requested", hue: "#DC2626" },
  APPROVED: { label: "Approved", hue: "#059669" },
  SCHEDULED: { label: "Scheduled", hue: "var(--accent)" },
  PUBLISHING: { label: "Publishing…", hue: "var(--accent)" },
  PUBLISHED: { label: "Published", hue: "#059669" },
  // TikTok's Upload-to-TikTok workflow only ever delivers a video as a
  // draft to the creator's TikTok inbox — genuinely distinct from
  // PUBLISHED, never shown the same way.
  DELIVERED_TO_INBOX: { label: "Delivered to TikTok inbox", hue: "#7C3AED" },
  PARTIALLY_PUBLISHED: { label: "Partially published", hue: "#D97706" },
  FAILED: { label: "Failed", hue: "#DC2626" },
  CANCELLED: { label: "Cancelled", hue: "var(--text-subtle)" },
};

export const MARK_SIZES = {
  xs: "h-4 w-4 rounded-[5px]",
  sm: "h-5 w-5 rounded-md",
  md: "h-7 w-7 rounded-[9px]",
  lg: "h-11 w-11 rounded-[14px]",
} as const;

export const MARK_ICON_PIXELS = {
  xs: 9,
  sm: 11,
  md: 15,
  lg: 22,
} as const;
