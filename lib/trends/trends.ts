// lib/trends/trends.ts
//
// Trend Intelligence's persistence layer. Trend rows aren't owner-
// scoped the way ContentProject is (see contentProjects.ts) — like
// SocialAccount, a trend is a shared, company-wide resource any admin
// with social_media permission can see; createdById/savedById are
// audit fields, not an access-control boundary. Validation is the
// same hand-rolled "structural envelope, not full schema" idiom used
// by isValidCanvasDataShape.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { TrendLicensingStatus, TrendPlatform, TrendSource, TrendStatus, TrendType } from "@/app/generated/prisma/enums";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_CATEGORY_LENGTH = 100;
const MAX_URL_LENGTH = 2000;

const TREND_PLATFORMS = new Set(Object.values(TrendPlatform));
const TREND_TYPES = new Set(Object.values(TrendType));
const TREND_LICENSING_STATUSES = new Set(Object.values(TrendLicensingStatus));
const TREND_STATUSES = new Set(Object.values(TrendStatus));

export type CreateTrendInput = {
  title: string;
  platform: TrendPlatform;
  type?: TrendType;
  category?: string;
  description: string;
  sourceUrl?: string;
  popularityIndicators?: Prisma.InputJsonValue;
  audioInfo?: Prisma.InputJsonValue;
  licensingStatus?: TrendLicensingStatus;
  hashtags?: string[];
};

/** Hand-rolled structural validation — never trusts the client's body
 *  blindly, but doesn't over-specify every optional field either. */
export function validateCreateTrendInput(body: unknown): { input: CreateTrendInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const data = body as Record<string, unknown>;

  if (typeof data.title !== "string" || !data.title.trim()) return { error: "Title is required." };
  if (data.title.length > MAX_TITLE_LENGTH) return { error: `Keep the title under ${MAX_TITLE_LENGTH} characters.` };

  if (typeof data.platform !== "string" || !TREND_PLATFORMS.has(data.platform as TrendPlatform)) {
    return { error: "Unknown platform." };
  }

  if (typeof data.description !== "string" || !data.description.trim()) return { error: "Description is required." };
  if (data.description.length > MAX_DESCRIPTION_LENGTH) return { error: `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.` };

  if (data.type !== undefined && (typeof data.type !== "string" || !TREND_TYPES.has(data.type as TrendType))) {
    return { error: "Unknown trend type." };
  }

  if (data.category !== undefined && data.category !== null) {
    if (typeof data.category !== "string" || data.category.length > MAX_CATEGORY_LENGTH) {
      return { error: `Keep the category under ${MAX_CATEGORY_LENGTH} characters.` };
    }
  }

  if (data.sourceUrl !== undefined && data.sourceUrl !== null && data.sourceUrl !== "") {
    if (typeof data.sourceUrl !== "string" || data.sourceUrl.length > MAX_URL_LENGTH) {
      return { error: "Source URL is too long." };
    }
    try {
      new URL(data.sourceUrl);
    } catch {
      return { error: "Source URL must be a valid URL." };
    }
  }

  if (
    data.licensingStatus !== undefined &&
    (typeof data.licensingStatus !== "string" || !TREND_LICENSING_STATUSES.has(data.licensingStatus as TrendLicensingStatus))
  ) {
    return { error: "Unknown licensing status." };
  }

  let hashtags: string[] | undefined;
  if (data.hashtags !== undefined) {
    if (!Array.isArray(data.hashtags) || !data.hashtags.every((tag) => typeof tag === "string")) {
      return { error: "Hashtags must be a list of strings." };
    }
    hashtags = data.hashtags.map((tag) => tag.trim()).filter(Boolean);
  }

  return {
    input: {
      title: data.title.trim(),
      platform: data.platform as TrendPlatform,
      type: data.type as TrendType | undefined,
      category: typeof data.category === "string" ? data.category.trim() || undefined : undefined,
      description: data.description.trim(),
      sourceUrl: typeof data.sourceUrl === "string" && data.sourceUrl.trim() ? data.sourceUrl.trim() : undefined,
      popularityIndicators: (data.popularityIndicators as Prisma.InputJsonValue) ?? undefined,
      audioInfo: (data.audioInfo as Prisma.InputJsonValue) ?? undefined,
      licensingStatus: data.licensingStatus as TrendLicensingStatus | undefined,
      hashtags,
    },
  };
}

export type TrendListFilters = {
  platform?: TrendPlatform;
  type?: TrendType;
  status?: TrendStatus;
  /** Matches trends whose suitableIndustries array contains this value. */
  industry?: string;
  /** Only trends discovered on or after this date. */
  since?: Date;
};

export function parseTrendListFilters(searchParams: URLSearchParams): TrendListFilters {
  const filters: TrendListFilters = {};

  const platform = searchParams.get("platform");
  if (platform && TREND_PLATFORMS.has(platform as TrendPlatform)) filters.platform = platform as TrendPlatform;

  const type = searchParams.get("type");
  if (type && TREND_TYPES.has(type as TrendType)) filters.type = type as TrendType;

  const status = searchParams.get("status");
  if (status && TREND_STATUSES.has(status as TrendStatus)) filters.status = status as TrendStatus;

  const industry = searchParams.get("industry");
  if (industry) filters.industry = industry;

  const since = searchParams.get("since");
  if (since) {
    const date = new Date(since);
    if (!Number.isNaN(date.getTime())) filters.since = date;
  }

  return filters;
}

export async function listTrends(filters: TrendListFilters) {
  return prisma.trend.findMany({
    where: {
      platform: filters.platform,
      type: filters.type,
      status: filters.status,
      suitableIndustries: filters.industry ? { has: filters.industry } : undefined,
      discoveredAt: filters.since ? { gte: filters.since } : undefined,
    },
    orderBy: [{ relevanceScore: "desc" }, { discoveredAt: "desc" }],
  });
}

export async function getTrend(id: string) {
  return prisma.trend.findUnique({ where: { id } });
}

export async function createTrend(adminUserId: string, input: CreateTrendInput) {
  return prisma.trend.create({
    data: {
      title: input.title,
      platform: input.platform,
      type: input.type ?? TrendType.GENERAL,
      category: input.category,
      description: input.description,
      sourceUrl: input.sourceUrl,
      popularityIndicators: input.popularityIndicators,
      audioInfo: input.audioInfo,
      licensingStatus: input.licensingStatus ?? TrendLicensingStatus.UNKNOWN,
      hashtags: input.hashtags ?? [],
      source: TrendSource.MANUAL,
      createdById: adminUserId,
    },
  });
}

/** Admin-driven status transitions (Save/Skip/Archive from the swipe
 *  UI, and USED once "Generate content" opens the Graphic/Video
 *  workspace with this trend's brief — contentProjectId stays null
 *  for that direct transition; it's only set by
 *  promoteTrendToContentProject below, for a future deeper handoff).
 *  NEW is included so the "Undo" toast after a Save/Skip can put a
 *  freshly-discovered trend back into triage. */
const UPDATABLE_STATUSES = new Set<TrendStatus>([TrendStatus.NEW, TrendStatus.SAVED, TrendStatus.DISMISSED, TrendStatus.ARCHIVED, TrendStatus.USED]);

export async function updateTrendStatus(adminUserId: string, id: string, status: TrendStatus) {
  if (!UPDATABLE_STATUSES.has(status)) throw new Error(`Status ${status} cannot be set directly.`);
  return prisma.trend.update({
    where: { id },
    data: {
      status,
      savedById: status === TrendStatus.SAVED ? adminUserId : undefined,
      lastVerifiedAt: new Date(),
    },
  });
}

/** Sets a ContentProject link once one is actually created from this
 *  trend — the forward-promotion pattern, same as
 *  ContentProject.socialPostId. Not wired to the UI yet (Generate
 *  content currently just sets status:USED via updateTrendStatus);
 *  kept as the documented hook for a future deeper handoff. */
export async function promoteTrendToContentProject(id: string, contentProjectId: string) {
  return prisma.trend.update({
    where: { id },
    data: { status: TrendStatus.USED, contentProjectId },
  });
}

export async function deleteTrend(id: string) {
  await prisma.trend.delete({ where: { id } });
}
