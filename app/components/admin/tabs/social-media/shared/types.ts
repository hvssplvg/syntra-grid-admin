// Shared types used across SocialMediaTab.tsx and the content-studio
// directory. Moved verbatim from SocialMediaTab.tsx as part of the
// circular-import cleanup described in
// /Users/hvss/.claude/plans/cuddly-gathering-willow.md — no field or
// value changed, only relocated (and, where a type was previously
// module-local, exported so both sides can share one definition instead
// of each declaring their own).

import type { FileText } from "lucide-react";

import type { SocialPlatformId } from "../../../common/SocialPlatformIcon";

export type SocialPlatform = SocialPlatformId;

/** The real backend status (SocialPostStatus in prisma/schema.prisma). */
export type RealPostStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "DELIVERED_TO_INBOX"
  | "PARTIALLY_PUBLISHED"
  | "FAILED"
  | "CANCELLED";

/** The UI's 3-stage pipeline bucket. realStatus always carries the true
 *  backend status; this bucket only decides which pipeline column a post
 *  sits in. */
export type ContentStatus = "DRAFT" | "READY" | "SCHEDULED";

export type ContentFilter = "ALL" | ContentStatus;

export type PlatformFilter = "ALL" | SocialPlatform;

export type LibraryLayout = "list" | "grid";

export type InstagramPlacement = "FEED" | "STORY";

export type TargetStatus = "PENDING" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "DELIVERED_TO_INBOX" | "FAILED" | "CANCELLED";

export type TikTokPostMode = "DIRECT_POST" | "UPLOAD_TO_TIKTOK";

export type TikTokTargetMetadata = {
  tiktokPostMode?: TikTokPostMode;
  tiktokPrivacyLevel?: string;
  tiktokDisableComment?: boolean;
  tiktokDisableDuet?: boolean;
  tiktokDisableStitch?: boolean;
  tiktokBrandedContent?: boolean;
  tiktokYourBrand?: boolean;
};

export type ApiAccountRef = { id: string; platform: SocialPlatform; accountName: string; username: string | null; status: string };

export type PostTarget = {
  accountId: string;
  platform: SocialPlatform;
  caption: string | null;
  placement: InstagramPlacement;
  /** Only meaningful for TikTok today; every other platform ignores it. */
  metadata: TikTokTargetMetadata | null;
  status: TargetStatus;
  remotePostUrl: string | null;
  lastError: string | null;
  publishedAt: string | null;
  lastAttemptAt: string | null;
  /** Set only by TikTok's status poller — when its async publish status
   *  was last checked. Drives the "still processing, last checked…" /
   *  "taking longer than expected" label; never implies a status change
   *  on its own. */
  lastPolledAt: string | null;
  account: ApiAccountRef;
};

export type SocialPost = {
  id: string;
  title: string | null;
  caption: string;
  category: string | null;
  campaignId: string | null;
  platforms: SocialPlatform[];
  targets: PostTarget[];
  status: ContentStatus;
  realStatus: RealPostStatus;
  reviewNotes: string | null;
  scheduledAt: string | null;
  image: string | null;
  imageType: "IMAGE" | "VIDEO" | null;
  assetIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type Counts = Record<ContentStatus, number> & { total: number };

export type IconType = typeof FileText;

export type PlatformDefinition = {
  id: SocialPlatform;
  name: string;
  description: string;
  color: string;
  limit: number;
};
