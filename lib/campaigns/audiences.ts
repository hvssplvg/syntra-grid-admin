// lib/campaigns/audiences.ts
//
// Audiences are shared master data reused across many campaigns (like
// Brand Assets' BrandKit) rather than rows owned by one campaign's
// creator — so CRUD is gated by the plain CREATE/EDIT/MANAGE module
// actions with no row-ownership check, while assigning/removing an
// audience TO a specific campaign is checked against THAT campaign's own
// row access (if you can edit the campaign, you can manage what it
// targets).

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import { CampaignActivityType, CampaignAudienceCategory, CampaignRecordStatus } from "@/app/generated/prisma/enums";
import type { ResolvedIdentity } from "@/lib/campaigns/permissions";
import { logCampaignActivity } from "@/lib/campaigns/activity";
import { getCampaignOrThrow } from "@/lib/campaigns/server";

const ADMIN_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

export async function listCampaignAudiences(filters: {
  status?: CampaignRecordStatus | null;
  category?: CampaignAudienceCategory | null;
  search?: string | null;
}) {
  return prisma.campaignAudience.findMany({
    where: {
      status: filters.status ?? "ACTIVE",
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.search ? { name: { contains: filters.search, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    include: { createdBy: { select: ADMIN_SELECT }, _count: { select: { campaigns: true } } },
  });
}

export async function getCampaignAudienceOrThrow(id: string) {
  const audience = await prisma.campaignAudience.findUnique({
    where: { id },
    include: { createdBy: { select: ADMIN_SELECT }, _count: { select: { campaigns: true } } },
  });
  if (!audience) throw new AuthorisationError("This audience could not be found.");
  return audience;
}

export type AudienceInput = {
  name: string;
  description?: string | null;
  category?: CampaignAudienceCategory;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  ageRangeMin?: number | null;
  ageRangeMax?: number | null;
  interests?: string[];
  industry?: string | null;
  jobTitles?: string[];
  customerSegment?: string | null;
  source?: string | null;
  estimatedSize?: number | null;
  isEstimate?: boolean;
  notes?: string | null;
};

export async function createCampaignAudience(identity: ResolvedIdentity, input: AudienceInput) {
  if (input.ageRangeMin != null && input.ageRangeMax != null && input.ageRangeMin > input.ageRangeMax) {
    throw new AuthorisationError("The minimum age cannot be greater than the maximum age.");
  }

  return prisma.campaignAudience.create({
    data: { ...input, createdById: identity.admin.id, updatedById: identity.admin.id },
    include: { createdBy: { select: ADMIN_SELECT }, _count: { select: { campaigns: true } } },
  });
}

export async function updateCampaignAudience(identity: ResolvedIdentity, audienceId: string, input: Partial<AudienceInput>) {
  const existing = await getCampaignAudienceOrThrow(audienceId);

  const nextMin = input.ageRangeMin !== undefined ? input.ageRangeMin : existing.ageRangeMin;
  const nextMax = input.ageRangeMax !== undefined ? input.ageRangeMax : existing.ageRangeMax;
  if (nextMin != null && nextMax != null && nextMin > nextMax) {
    throw new AuthorisationError("The minimum age cannot be greater than the maximum age.");
  }

  return prisma.campaignAudience.update({
    where: { id: audienceId },
    data: { ...input, updatedById: identity.admin.id },
    include: { createdBy: { select: ADMIN_SELECT }, _count: { select: { campaigns: true } } },
  });
}

export async function archiveCampaignAudience(audienceId: string) {
  await getCampaignAudienceOrThrow(audienceId);
  return prisma.campaignAudience.update({ where: { id: audienceId }, data: { status: "ARCHIVED" } });
}

export async function restoreCampaignAudience(audienceId: string) {
  await getCampaignAudienceOrThrow(audienceId);
  return prisma.campaignAudience.update({ where: { id: audienceId }, data: { status: "ACTIVE" } });
}

/* ============================================================================
   CAMPAIGN ASSIGNMENT
============================================================================ */

export async function listCampaignAudienceAssignments(campaignId: string) {
  await getCampaignOrThrow(campaignId);
  return prisma.campaignAudienceAssignment.findMany({
    where: { campaignId },
    include: { audience: true },
  });
}

export async function assignAudienceToCampaign(identity: ResolvedIdentity, campaignId: string, audienceId: string) {
  await getCampaignOrThrow(campaignId);
  const audience = await getCampaignAudienceOrThrow(audienceId);

  const existing = await prisma.campaignAudienceAssignment.findUnique({
    where: { campaignId_audienceId: { campaignId, audienceId } },
  });
  if (existing) return existing;

  const assignment = await prisma.campaignAudienceAssignment.create({
    data: { campaignId, audienceId },
    include: { audience: true },
  });

  await logCampaignActivity(campaignId, identity.admin.id, CampaignActivityType.AUDIENCE_ASSIGNED, `Audience "${audience.name}" assigned.`);

  return assignment;
}

export async function removeAudienceFromCampaign(identity: ResolvedIdentity, campaignId: string, assignmentId: string) {
  const existing = await prisma.campaignAudienceAssignment.findUnique({ where: { id: assignmentId }, include: { audience: true } });
  if (!existing || existing.campaignId !== campaignId) throw new AuthorisationError("This assignment could not be found.");

  await prisma.campaignAudienceAssignment.delete({ where: { id: assignmentId } });

  await logCampaignActivity(campaignId, identity.admin.id, CampaignActivityType.AUDIENCE_REMOVED, `Audience "${existing.audience.name}" removed.`);
}
