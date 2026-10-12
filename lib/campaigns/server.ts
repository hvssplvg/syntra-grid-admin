// lib/campaigns/server.ts
//
// Core CRUD, lifecycle and read models for the Campaigns module — mirrors
// lib/social-media/server.ts's shape and conventions exactly (pagination
// house style, OWN/DEPARTMENT-scope row filtering, server-enforced status
// transitions, real activity logging via lib/campaigns/activity.ts).

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import { CampaignActivityType, CampaignObjective, CampaignPriority, CampaignStatus, CurrencyCode } from "@/app/generated/prisma/enums";
import { Prisma } from "@/app/generated/prisma/client";
import { AccessAction, campaignOwnScopeFilter, type ResolvedIdentity } from "@/lib/campaigns/permissions";
import { logCampaignActivity } from "@/lib/campaigns/activity";

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
const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, jobTitle: true, avatarUrl: true } as const;

export const CAMPAIGN_INCLUDE = {
  createdBy: { select: ADMIN_SELECT },
  updatedBy: { select: ADMIN_SELECT },
  client: { select: { id: true, name: true, slug: true } },
  project: { select: { id: true, name: true, slug: true } },
  department: { select: { id: true, name: true, slug: true } },
  owner: { select: EMPLOYEE_SELECT },
  manager: { select: EMPLOYEE_SELECT },
  _count: { select: { members: true, tasks: true, content: true, expenses: true } },
} satisfies Prisma.CampaignInclude;

/* ============================================================================
   STATUS TRANSITIONS

   Archiving/restoring have their own dedicated endpoints (archiveCampaign/
   restoreCampaign below) and are not reachable through this table —
   archiving is valid from any non-terminal status, restoring always comes
   back to DRAFT. COMPLETED and CANCELLED have no outgoing transitions at
   all other than archiving: "appropriate restrictions on further changes"
   for a finished or cancelled campaign.
============================================================================ */

const STATUS_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  DRAFT: ["PLANNING", "PENDING_APPROVAL", "CANCELLED"],
  PLANNING: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "CANCELLED"],
  PENDING_APPROVAL: ["PLANNING", "APPROVED", "CANCELLED"],
  APPROVED: ["SCHEDULED", "ACTIVE", "CANCELLED"],
  SCHEDULED: ["ACTIVE", "PAUSED", "CANCELLED"],
  ACTIVE: ["PAUSED", "COMPLETED", "CANCELLED"],
  PAUSED: ["ACTIVE", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  ARCHIVED: [],
};

const TERMINAL_STATUSES: CampaignStatus[] = ["COMPLETED", "CANCELLED", "ARCHIVED"];

export function assertValidStatusTransition(current: CampaignStatus, next: CampaignStatus) {
  if (current === next) return;
  if (!STATUS_TRANSITIONS[current].includes(next)) {
    throw new AuthorisationError(`A campaign cannot move from ${current} to ${next}.`);
  }
}

export function assertCampaignIsEditable(current: CampaignStatus) {
  if (TERMINAL_STATUSES.includes(current)) {
    throw new AuthorisationError(
      current === "ARCHIVED"
        ? "This campaign is archived. Restore it before making changes."
        : `This campaign is ${current.toLowerCase()} and can no longer be edited.`,
    );
  }
}

/* ============================================================================
   LIST / DETAIL
============================================================================ */

export type ListCampaignsFilters = {
  status?: CampaignStatus | null;
  clientId?: string | null;
  projectId?: string | null;
  objective?: CampaignObjective | null;
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
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.objective ? { objective: filters.objective } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
            { code: { contains: filters.search, mode: "insensitive" } },
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

   Every count is a real query. upcomingActivities/overdueMilestones/
   outstanding deliverables come from the real Planner/Content tables
   added in this build — nothing here is fabricated or hardcoded to 0
   anymore (that was only true before Planner/Content existed).
============================================================================ */

export async function getCampaignOverview(identity: ResolvedIdentity) {
  const ownFilter = campaignOwnScopeFilter(identity, AccessAction.VIEW);
  const where: Prisma.CampaignWhereInput = { ...(ownFilter ?? {}) };
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    total,
    active,
    draft,
    scheduled,
    paused,
    completed,
    cancelled,
    archived,
    pendingApprovals,
    upcomingDeadlines,
    overdueMilestones,
    outstandingDeliverables,
    completedDeliverables,
    budgetAgg,
    campaigns,
  ] = await Promise.all([
    prisma.campaign.count({ where }),
    prisma.campaign.count({ where: { ...where, status: CampaignStatus.ACTIVE } }),
    prisma.campaign.count({ where: { ...where, status: CampaignStatus.DRAFT } }),
    prisma.campaign.count({ where: { ...where, status: CampaignStatus.SCHEDULED } }),
    prisma.campaign.count({ where: { ...where, status: CampaignStatus.PAUSED } }),
    prisma.campaign.count({ where: { ...where, status: CampaignStatus.COMPLETED } }),
    prisma.campaign.count({ where: { ...where, status: CampaignStatus.CANCELLED } }),
    prisma.campaign.count({ where: { ...where, status: CampaignStatus.ARCHIVED } }),
    prisma.campaign.count({ where: { ...where, status: CampaignStatus.PENDING_APPROVAL } }),
    prisma.campaignMilestone.count({
      where: { campaign: where, status: "PENDING", dueAt: { gte: now, lte: soon } },
    }),
    prisma.campaignMilestone.count({
      where: { campaign: where, status: "PENDING", dueAt: { lt: now } },
    }),
    prisma.campaignContent.count({
      where: { campaign: where, status: { notIn: ["PUBLISHED", "CANCELLED", "ARCHIVED"] } },
    }),
    prisma.campaignContent.count({
      where: { campaign: where, status: "PUBLISHED" },
    }),
    prisma.campaign.groupBy({ by: ["currency"], where, _sum: { budget: true } }),
    prisma.campaign.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, description: true, status: true, startDate: true, endDate: true, updatedAt: true },
    }),
  ]);

  // Money is never summed across currencies without a verified exchange
  // rate (none exists in this system) — every total below is grouped by
  // currency instead of blindly combined. A campaign's expenses can carry
  // their own currency independent of the campaign's budget currency, so
  // "over budget" only ever compares amounts actually in the SAME
  // currency as that campaign's budget; expenses in a different currency
  // are tracked (see lib/campaigns/budget.ts) but never forced into that
  // comparison.
  const expensesByCampaign = await prisma.campaignExpense.groupBy({
    by: ["campaignId", "currency"],
    where: { campaign: where },
    _sum: { amount: true },
  });

  const campaignBudgets = await prisma.campaign.findMany({ where, select: { id: true, budget: true, currency: true } });
  const budgetByCampaign = new Map(campaignBudgets.map((c) => [c.id, c]));

  const spentByCurrency = new Map<CurrencyCode, number>();
  let overBudgetCount = 0;
  const spentByCampaignInBudgetCurrency = new Map<string, number>();

  for (const row of expensesByCampaign) {
    const amount = Number(row._sum.amount ?? 0);
    spentByCurrency.set(row.currency, (spentByCurrency.get(row.currency) ?? 0) + amount);

    const campaign = budgetByCampaign.get(row.campaignId);
    if (campaign && campaign.currency === row.currency) {
      spentByCampaignInBudgetCurrency.set(row.campaignId, (spentByCampaignInBudgetCurrency.get(row.campaignId) ?? 0) + amount);
    }
  }

  for (const campaign of campaignBudgets) {
    if (campaign.budget == null) continue;
    const spent = spentByCampaignInBudgetCurrency.get(campaign.id) ?? 0;
    if (spent > Number(campaign.budget)) overBudgetCount += 1;
  }

  const allocatedByCurrency = new Map(budgetAgg.map((row) => [row.currency, Number(row._sum.budget ?? 0)]));
  const currencies = new Set([...allocatedByCurrency.keys(), ...spentByCurrency.keys()]);

  const budgetByCurrencySummary = Array.from(currencies).map((currency) => {
    const allocated = allocatedByCurrency.get(currency) ?? 0;
    const spent = spentByCurrency.get(currency) ?? 0;
    return { currency, allocated, spent, remaining: allocated - spent };
  });

  return {
    total,
    active,
    draft,
    scheduled,
    paused,
    completed,
    cancelled,
    archived,
    pendingApprovals,
    upcomingActivities: upcomingDeadlines,
    upcomingDeadlines,
    overdueMilestones,
    outstandingDeliverables,
    completedDeliverables,
    budgetByCurrency: budgetByCurrencySummary,
    overBudgetCampaigns: overBudgetCount,
    campaigns,
  };
}

/* ============================================================================
   FK VALIDATION — clear 400s instead of opaque FK-constraint 500s
============================================================================ */

async function assertRelatedRecordsExist(input: {
  clientId?: string | null;
  projectId?: string | null;
  departmentId?: string | null;
  ownerId?: string | null;
  managerId?: string | null;
}) {
  const [client, project, department, owner, manager] = await Promise.all([
    input.clientId ? prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } }) : null,
    input.projectId
      ? prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true, clientId: true } })
      : null,
    input.departmentId
      ? prisma.department.findUnique({ where: { id: input.departmentId }, select: { id: true } })
      : null,
    input.ownerId ? prisma.employee.findUnique({ where: { id: input.ownerId }, select: { id: true } }) : null,
    input.managerId ? prisma.employee.findUnique({ where: { id: input.managerId }, select: { id: true } }) : null,
  ]);

  if (input.clientId && !client) throw new AuthorisationError("The selected client could not be found.");
  if (input.projectId && !project) throw new AuthorisationError("The selected project could not be found.");
  if (input.departmentId && !department) throw new AuthorisationError("The selected department could not be found.");
  if (input.ownerId && !owner) throw new AuthorisationError("The selected owner could not be found.");
  if (input.managerId && !manager) throw new AuthorisationError("The selected manager could not be found.");

  if (project && input.clientId && project.clientId !== input.clientId) {
    throw new AuthorisationError("The selected project does not belong to the selected client.");
  }

  return { derivedClientId: project && !input.clientId ? project.clientId : input.clientId };
}

/* ============================================================================
   CREATE / EDIT / LIFECYCLE
============================================================================ */

export type CampaignInput = {
  name: string;
  code?: string | null;
  description?: string | null;
  objective?: CampaignObjective | null;
  category?: string | null;
  priority?: CampaignPriority;
  status?: CampaignStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  clientId?: string | null;
  projectId?: string | null;
  departmentId?: string | null;
  ownerId?: string | null;
  managerId?: string | null;
  currency?: "NGN" | "GBP" | "USD" | "EUR";
  budget?: number | null;
  goals?: string | null;
  notes?: string | null;
};

export async function createCampaign(identity: ResolvedIdentity, input: CampaignInput) {
  const { derivedClientId } = await assertRelatedRecordsExist(input);

  const campaign = await prisma.campaign.create({
    data: {
      ...input,
      clientId: derivedClientId ?? null,
      createdById: identity.admin.id,
      updatedById: identity.admin.id,
    },
    include: CAMPAIGN_INCLUDE,
  });

  await logCampaignActivity(campaign.id, identity.admin.id, CampaignActivityType.CREATED, `Campaign "${campaign.name}" created.`);

  return campaign;
}

export async function updateCampaign(identity: ResolvedIdentity, campaignId: string, input: Partial<CampaignInput>) {
  const existing = await getCampaignOrThrow(campaignId);
  assertCampaignIsEditable(existing.status);

  if (input.status && input.status !== existing.status) {
    assertValidStatusTransition(existing.status, input.status);
  }

  await assertRelatedRecordsExist({
    clientId: input.clientId ?? undefined,
    projectId: input.projectId ?? undefined,
    departmentId: input.departmentId ?? undefined,
    ownerId: input.ownerId ?? undefined,
    managerId: input.managerId ?? undefined,
  });

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { ...input, updatedById: identity.admin.id },
    include: CAMPAIGN_INCLUDE,
  });

  if (input.budget !== undefined && Number(existing.budget ?? 0) !== Number(campaign.budget ?? 0)) {
    // Dynamic import avoids a static circular dependency — budget.ts
    // imports getCampaignOrThrow from this file.
    const { recordCampaignBudgetChange } = await import("@/lib/campaigns/budget");
    await recordCampaignBudgetChange(
      campaignId,
      identity.admin.id,
      existing.budget != null ? Number(existing.budget) : null,
      campaign.budget != null ? Number(campaign.budget) : null,
      campaign.currency,
    );
  }

  if (input.status && input.status !== existing.status) {
    await logCampaignActivity(
      campaign.id,
      identity.admin.id,
      CampaignActivityType.STATUS_CHANGED,
      `Status changed from ${existing.status} to ${campaign.status}.`,
      { from: existing.status, to: campaign.status },
    );
  } else {
    await logCampaignActivity(campaign.id, identity.admin.id, CampaignActivityType.EDITED, "Campaign details edited.");
    const { supersedeApprovalsForEntity } = await import("@/lib/campaigns/approvals");
    await supersedeApprovalsForEntity("Campaign", campaign.id);
  }

  return campaign;
}

async function transitionCampaignStatus(
  identity: ResolvedIdentity,
  campaignId: string,
  next: CampaignStatus,
  activityDescription: string,
) {
  const existing = await getCampaignOrThrow(campaignId);
  assertCampaignIsEditable(existing.status);
  assertValidStatusTransition(existing.status, next);

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: next, updatedById: identity.admin.id },
    include: CAMPAIGN_INCLUDE,
  });

  await logCampaignActivity(campaign.id, identity.admin.id, CampaignActivityType.STATUS_CHANGED, activityDescription, {
    from: existing.status,
    to: next,
  });

  return campaign;
}

export const launchCampaign = (identity: ResolvedIdentity, id: string) =>
  transitionCampaignStatus(identity, id, CampaignStatus.ACTIVE, "Campaign launched.");

export const pauseCampaign = (identity: ResolvedIdentity, id: string) =>
  transitionCampaignStatus(identity, id, CampaignStatus.PAUSED, "Campaign paused.");

export const resumeCampaign = (identity: ResolvedIdentity, id: string) =>
  transitionCampaignStatus(identity, id, CampaignStatus.ACTIVE, "Campaign resumed.");

export const completeCampaign = (identity: ResolvedIdentity, id: string) =>
  transitionCampaignStatus(identity, id, CampaignStatus.COMPLETED, "Campaign marked complete.");

export const cancelCampaign = (identity: ResolvedIdentity, id: string) =>
  transitionCampaignStatus(identity, id, CampaignStatus.CANCELLED, "Campaign cancelled.");

export async function archiveCampaign(identity: ResolvedIdentity, campaignId: string) {
  const existing = await getCampaignOrThrow(campaignId);
  if (existing.status === CampaignStatus.ARCHIVED) {
    throw new AuthorisationError("This campaign is already archived.");
  }

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.ARCHIVED, updatedById: identity.admin.id },
    include: CAMPAIGN_INCLUDE,
  });

  await logCampaignActivity(campaign.id, identity.admin.id, CampaignActivityType.ARCHIVED, "Campaign archived.");

  return campaign;
}

/** Restores an archived campaign back to DRAFT — the campaign's prior
 *  status isn't tracked, so restoring always lands on DRAFT rather than
 *  guessing where it was before archiving. */
export async function restoreCampaign(identity: ResolvedIdentity, campaignId: string) {
  const existing = await getCampaignOrThrow(campaignId);
  if (existing.status !== CampaignStatus.ARCHIVED) {
    throw new AuthorisationError("This campaign is not archived.");
  }

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.DRAFT, updatedById: identity.admin.id },
    include: CAMPAIGN_INCLUDE,
  });

  await logCampaignActivity(campaign.id, identity.admin.id, CampaignActivityType.RESTORED, "Campaign restored.");

  return campaign;
}

/** Duplicates a campaign's core details as a new DRAFT — never copies
 *  team/tasks/content/budget/approvals, since those are specific to the
 *  original campaign's execution, not its template. */
export async function duplicateCampaign(identity: ResolvedIdentity, campaignId: string) {
  const existing = await getCampaignOrThrow(campaignId);

  const campaign = await prisma.campaign.create({
    data: {
      name: `${existing.name} (Copy)`,
      description: existing.description,
      objective: existing.objective,
      category: existing.category,
      priority: existing.priority,
      status: CampaignStatus.DRAFT,
      clientId: existing.clientId,
      projectId: existing.projectId,
      departmentId: existing.departmentId,
      ownerId: existing.ownerId,
      managerId: existing.managerId,
      currency: existing.currency,
      budget: existing.budget,
      goals: existing.goals,
      createdById: identity.admin.id,
      updatedById: identity.admin.id,
    },
    include: CAMPAIGN_INCLUDE,
  });

  await logCampaignActivity(
    campaign.id,
    identity.admin.id,
    CampaignActivityType.CREATED,
    `Duplicated from "${existing.name}".`,
  );

  return campaign;
}
