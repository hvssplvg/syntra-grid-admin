// lib/campaigns/server.ts
//
// Core CRUD, lifecycle and read models for the Campaigns module — mirrors
// lib/social-media/server.ts's shape and conventions exactly (pagination
// house style, OWN-scope row filtering, honest "not yet built" stats
// instead of fabricated ones for anything the Planner/Budget/Analytics
// sub-systems would eventually own).

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import { CampaignStatus } from "@/app/generated/prisma/enums";
import { Prisma } from "@/app/generated/prisma/client";
import { AccessAction, campaignOwnScopeFilter, type ResolvedIdentity } from "@/lib/campaigns/permissions";

/* ============================================================================
   PAGINATION — matches lib/social-media/server.ts's own house style
============================================================================ */

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function resolvePagination(page: number | null, pageSize: number | null) {
  const resolvedPage = Math.max(DEFAULT_PAGE, page ?? DEFAULT_PAGE);
  const resolvedPageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize ?? DEFAULT_PAGE_SIZE));
  return { page: resolvedPage, pageSize: resolvedPageSize, skip: (resolvedPage - 1) * resolvedPageSize };
}

export function buildPaginationResult(page: number, pageSize: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return { page, pageSize, total, pages, hasPrevious: page > 1, hasNext: page < pages };
}

const ADMIN_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

const CAMPAIGN_INCLUDE = {
  createdBy: { select: ADMIN_SELECT },
  updatedBy: { select: ADMIN_SELECT },
} satisfies Prisma.CampaignInclude;

/* ============================================================================
   LIST / DETAIL
============================================================================ */

export type ListCampaignsFilters = {
  status?: CampaignStatus | null;
  search?: string | null;
  page?: number | null;
  pageSize?: number | null;
};

export async function listCampaigns(identity: ResolvedIdentity, filters: ListCampaignsFilters) {
  const { page, pageSize, skip } = resolvePagination(filters.page ?? null, filters.pageSize ?? null);

  const ownFilter = campaignOwnScopeFilter(identity, AccessAction.VIEW);

  const where: Prisma.CampaignWhereInput = {
    ...(ownFilter ?? {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, campaigns] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.findMany({ where, include: CAMPAIGN_INCLUDE, orderBy: { updatedAt: "desc" }, skip, take: pageSize }),
  ]);

  return { campaigns, pagination: buildPaginationResult(page, pageSize, total) };
}

export async function getCampaignOrThrow(id: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id }, include: CAMPAIGN_INCLUDE });
  if (!campaign) throw new AuthorisationError("This campaign could not be found.");
  return campaign;
}

/* ============================================================================
   OVERVIEW

   pendingApprovals reflects campaigns actually in PENDING_APPROVAL status —
   real data, not a separate approval workflow (that's a documented
   follow-up). upcomingActivities is honestly 0: there is no Planner table
   yet, and the UI must never be fed a fabricated number.
============================================================================ */

export async function getCampaignOverview(identity: ResolvedIdentity) {
  const ownFilter = campaignOwnScopeFilter(identity, AccessAction.VIEW);
  const where: Prisma.CampaignWhereInput = { ...(ownFilter ?? {}) };

  const [total, active, scheduled, completed, pendingApprovals, campaigns] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.count({ where: { ...where, status: CampaignStatus.ACTIVE } }),
    prisma.campaign.count({ where: { ...where, status: CampaignStatus.SCHEDULED } }),
    prisma.campaign.count({ where: { ...where, status: CampaignStatus.COMPLETED } }),
    prisma.campaign.count({ where: { ...where, status: CampaignStatus.PENDING_APPROVAL } }),
    prisma.campaign.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, description: true, status: true, startDate: true, endDate: true, updatedAt: true },
    }),
  ]);

  return { total, active, scheduled, completed, pendingApprovals, upcomingActivities: 0, campaigns };
}

/* ============================================================================
   CREATE / EDIT / LIFECYCLE
============================================================================ */

export type CampaignInput = {
  name: string;
  description?: string | null;
  status?: CampaignStatus;
  startDate?: Date | null;
  endDate?: Date | null;
};

export async function createCampaign(identity: ResolvedIdentity, input: CampaignInput) {
  return prisma.campaign.create({
    data: { ...input, createdById: identity.admin.id, updatedById: identity.admin.id },
    include: CAMPAIGN_INCLUDE,
  });
}

export async function updateCampaign(identity: ResolvedIdentity, campaignId: string, input: Partial<CampaignInput>) {
  await getCampaignOrThrow(campaignId);

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { ...input, updatedById: identity.admin.id },
    include: CAMPAIGN_INCLUDE,
  });
}

export async function archiveCampaign(identity: ResolvedIdentity, campaignId: string) {
  const existing = await getCampaignOrThrow(campaignId);
  if (existing.status === CampaignStatus.ARCHIVED) {
    throw new AuthorisationError("This campaign is already archived.");
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.ARCHIVED, updatedById: identity.admin.id },
    include: CAMPAIGN_INCLUDE,
  });
}

/** Restores an archived campaign back to DRAFT — the campaign's prior
 *  status isn't tracked, so restoring always lands on DRAFT rather than
 *  guessing where it was before archiving. */
export async function restoreCampaign(identity: ResolvedIdentity, campaignId: string) {
  const existing = await getCampaignOrThrow(campaignId);
  if (existing.status !== CampaignStatus.ARCHIVED) {
    throw new AuthorisationError("This campaign is not archived.");
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.DRAFT, updatedById: identity.admin.id },
    include: CAMPAIGN_INCLUDE,
  });
}
