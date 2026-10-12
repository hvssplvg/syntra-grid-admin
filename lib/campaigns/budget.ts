// lib/campaigns/budget.ts
//
// Campaign budgeting — internal financial tracking, not payment
// processing. Every amount is Prisma Decimal (never float arithmetic),
// and money is never summed across currencies without a verified
// exchange rate (none exists in this system) — every total here is
// grouped or compared strictly within one CurrencyCode at a time.
// Reconciliation against a real bank transaction reuses MonzoTransaction
// (mirrors ClientInvoice's own matching) instead of duplicating
// accounting records, and rejects a transaction that's already matched
// to anything else in the Finance system, preventing double-counting.

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import {
  CampaignActivityType,
  CampaignBudgetCategory,
  CampaignChannelType,
  CampaignExpenseApprovalStatus,
  CampaignExpensePaymentStatus,
  CurrencyCode,
} from "@/app/generated/prisma/enums";
import type { ResolvedIdentity } from "@/lib/campaigns/permissions";
import { logCampaignActivity } from "@/lib/campaigns/activity";
import { getCampaignOrThrow } from "@/lib/campaigns/server";

const ADMIN_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

/* ============================================================================
   BUDGET ALLOCATIONS
============================================================================ */

export async function listCampaignBudgetAllocations(campaignId: string) {
  await getCampaignOrThrow(campaignId);
  return prisma.campaignBudgetAllocation.findMany({
    where: { campaignId },
    orderBy: { createdAt: "asc" },
    include: { createdBy: { select: ADMIN_SELECT } },
  });
}

export type BudgetAllocationInput = {
  category: CampaignBudgetCategory;
  channel?: CampaignChannelType | null;
  amount: number;
  currency?: CurrencyCode;
  notes?: string | null;
};

export async function createCampaignBudgetAllocation(identity: ResolvedIdentity, campaignId: string, input: BudgetAllocationInput) {
  const campaign = await getCampaignOrThrow(campaignId);

  return prisma.campaignBudgetAllocation.create({
    data: { ...input, campaignId, currency: input.currency ?? campaign.currency, createdById: identity.admin.id, updatedById: identity.admin.id },
    include: { createdBy: { select: ADMIN_SELECT } },
  });
}

export async function updateCampaignBudgetAllocation(
  identity: ResolvedIdentity,
  campaignId: string,
  allocationId: string,
  input: Partial<BudgetAllocationInput>,
) {
  const existing = await prisma.campaignBudgetAllocation.findUnique({ where: { id: allocationId } });
  if (!existing || existing.campaignId !== campaignId) throw new AuthorisationError("This budget allocation could not be found.");

  return prisma.campaignBudgetAllocation.update({
    where: { id: allocationId },
    data: { ...input, updatedById: identity.admin.id },
    include: { createdBy: { select: ADMIN_SELECT } },
  });
}

export async function deleteCampaignBudgetAllocation(campaignId: string, allocationId: string) {
  const existing = await prisma.campaignBudgetAllocation.findUnique({ where: { id: allocationId }, include: { _count: { select: { expenses: true } } } });
  if (!existing || existing.campaignId !== campaignId) throw new AuthorisationError("This budget allocation could not be found.");
  if (existing._count.expenses > 0) {
    throw new AuthorisationError("This allocation still has recorded expenses against it and cannot be deleted.");
  }
  await prisma.campaignBudgetAllocation.delete({ where: { id: allocationId } });
}

/** Called whenever Campaign.budget itself changes, so the change is
 *  permanently auditable — see lib/campaigns/server.ts#updateCampaign. */
export async function recordCampaignBudgetChange(
  campaignId: string,
  changedById: string,
  previousAmount: number | null,
  newAmount: number | null,
  currency: CurrencyCode,
  reason?: string | null,
) {
  if (previousAmount === newAmount) return;
  await prisma.campaignBudgetHistory.create({
    data: { campaignId, previousAmount, newAmount: newAmount ?? 0, currency, reason: reason ?? null, changedById },
  });
}

export async function listCampaignBudgetHistory(campaignId: string) {
  await getCampaignOrThrow(campaignId);
  return prisma.campaignBudgetHistory.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    include: { changedBy: { select: ADMIN_SELECT } },
  });
}

/* ============================================================================
   EXPENSES
============================================================================ */

export async function listCampaignExpenses(
  campaignId: string,
  filters: { category?: CampaignBudgetCategory | null; approvalStatus?: CampaignExpenseApprovalStatus | null; paymentStatus?: CampaignExpensePaymentStatus | null },
) {
  await getCampaignOrThrow(campaignId);
  return prisma.campaignExpense.findMany({
    where: {
      campaignId,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.approvalStatus ? { approvalStatus: filters.approvalStatus } : {}),
      ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
    },
    orderBy: { expenseDate: "desc" },
    include: { recordedBy: { select: ADMIN_SELECT }, approvedBy: { select: ADMIN_SELECT }, allocation: true },
  });
}

export type ExpenseInput = {
  description: string;
  category: CampaignBudgetCategory;
  amount: number;
  currency?: CurrencyCode;
  expenseDate: Date;
  vendor?: string | null;
  reference?: string | null;
  allocationId?: string | null;
  receiptUrl?: string | null;
  receiptCloudinaryPublicId?: string | null;
  notes?: string | null;
};

export async function createCampaignExpense(identity: ResolvedIdentity, campaignId: string, input: ExpenseInput) {
  const campaign = await getCampaignOrThrow(campaignId);
  const currency = input.currency ?? campaign.currency;

  if (input.allocationId) {
    const allocation = await prisma.campaignBudgetAllocation.findUnique({ where: { id: input.allocationId } });
    if (!allocation || allocation.campaignId !== campaignId) {
      throw new AuthorisationError("The selected budget allocation could not be found.");
    }
    if (allocation.currency !== currency) {
      throw new AuthorisationError(
        `This allocation is tracked in ${allocation.currency}. Record the expense in ${allocation.currency}, or leave the allocation unset.`,
      );
    }
  }

  const expense = await prisma.campaignExpense.create({
    data: { ...input, campaignId, currency, recordedById: identity.admin.id },
    include: { recordedBy: { select: ADMIN_SELECT }, approvedBy: { select: ADMIN_SELECT }, allocation: true },
  });

  await logCampaignActivity(campaignId, identity.admin.id, CampaignActivityType.EXPENSE_RECORDED, `Expense "${expense.description}" (${currency} ${input.amount}) recorded.`);

  return expense;
}

async function getExpenseOrThrow(campaignId: string, expenseId: string) {
  const expense = await prisma.campaignExpense.findUnique({ where: { id: expenseId } });
  if (!expense || expense.campaignId !== campaignId) throw new AuthorisationError("This expense could not be found.");
  return expense;
}

export async function updateCampaignExpense(campaignId: string, expenseId: string, input: Partial<ExpenseInput>) {
  const existing = await getExpenseOrThrow(campaignId, expenseId);
  if (existing.approvalStatus === "APPROVED") {
    throw new AuthorisationError("This expense has already been approved and can no longer be edited.");
  }

  return prisma.campaignExpense.update({
    where: { id: expenseId },
    data: input,
    include: { recordedBy: { select: ADMIN_SELECT }, approvedBy: { select: ADMIN_SELECT }, allocation: true },
  });
}

/** Approve/reject a recorded expense. Separation of duties: the person who
 *  recorded the expense can never also approve it, even a full-access
 *  admin — this is a business-integrity rule, not a permission tier, so
 *  it is enforced unconditionally. */
export async function decideCampaignExpense(
  identity: ResolvedIdentity,
  campaignId: string,
  expenseId: string,
  decision: "APPROVED" | "REJECTED",
) {
  const existing = await getExpenseOrThrow(campaignId, expenseId);

  if (existing.approvalStatus !== "PENDING") {
    throw new AuthorisationError("This expense has already been decided.");
  }
  if (existing.recordedById === identity.admin.id) {
    throw new AuthorisationError("You cannot approve or reject an expense you recorded yourself.");
  }

  // Atomic claim — see the identical reasoning in
  // lib/campaigns/approvals.ts#decideCampaignApproval.
  const claim = await prisma.campaignExpense.updateMany({
    where: { id: expenseId, approvalStatus: "PENDING" },
    data: { approvalStatus: decision, approvedById: identity.admin.id, approvedAt: new Date() },
  });
  if (claim.count === 0) {
    throw new AuthorisationError("This expense has already been decided.");
  }

  const expense = await prisma.campaignExpense.findUniqueOrThrow({
    where: { id: expenseId },
    include: { recordedBy: { select: ADMIN_SELECT }, approvedBy: { select: ADMIN_SELECT }, allocation: true },
  });

  if (decision === "APPROVED") {
    await logCampaignActivity(campaignId, identity.admin.id, CampaignActivityType.EXPENSE_APPROVED, `Expense "${expense.description}" approved.`);
  }

  return expense;
}

/** Reconciles an expense against a real bank transaction. Rejects a
 *  transaction that's already matched to anything else in the Finance
 *  system (a Client, Project, Invoice or another CampaignExpense) to
 *  prevent the same money being counted twice, and rejects a CREDIT
 *  transaction — an expense is money going out, never coming in. */
export async function matchCampaignExpenseToMonzoTransaction(campaignId: string, expenseId: string, monzoTransactionId: string) {
  const expense = await getExpenseOrThrow(campaignId, expenseId);
  if (expense.matchedMonzoTransactionId) {
    throw new AuthorisationError("This expense is already matched to a bank transaction.");
  }

  const transaction = await prisma.monzoTransaction.findUnique({ where: { id: monzoTransactionId } });
  if (!transaction) throw new AuthorisationError("That bank transaction could not be found.");
  if (transaction.direction !== "DEBIT") throw new AuthorisationError("An expense can only be matched to an outgoing (debit) transaction.");
  if (transaction.matchStatus !== "UNMATCHED") throw new AuthorisationError("That bank transaction is already matched elsewhere.");

  await prisma.$transaction([
    prisma.campaignExpense.update({ where: { id: expenseId }, data: { matchedMonzoTransactionId: monzoTransactionId } }),
    prisma.monzoTransaction.update({ where: { id: monzoTransactionId }, data: { matchStatus: "MATCHED" } }),
  ]);

  return getExpenseOrThrow(campaignId, expenseId);
}

/* ============================================================================
   SUMMARY — always grouped by currency, never blindly combined
============================================================================ */

export async function getCampaignBudgetSummary(campaignId: string) {
  const campaign = await getCampaignOrThrow(campaignId);

  const [allocations, expensesByCategory, expensesByChannel] = await Promise.all([
    prisma.campaignBudgetAllocation.findMany({ where: { campaignId } }),
    prisma.campaignExpense.groupBy({ by: ["category", "currency"], where: { campaignId }, _sum: { amount: true } }),
    prisma.campaignExpense.groupBy({
      by: ["currency"],
      where: { campaignId, allocation: { channel: { not: null } } },
      _sum: { amount: true },
    }),
  ]);

  const spentInBudgetCurrency = expensesByCategory
    .filter((row) => row.currency === campaign.currency)
    .reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);

  return {
    currency: campaign.currency,
    totalBudget: campaign.budget != null ? Number(campaign.budget) : null,
    totalSpent: spentInBudgetCurrency,
    remaining: campaign.budget != null ? Number(campaign.budget) - spentInBudgetCurrency : null,
    isOverBudget: campaign.budget != null && spentInBudgetCurrency > Number(campaign.budget),
    allocations: allocations.map((a) => ({ ...a, amount: Number(a.amount) })),
    byCategory: expensesByCategory.map((row) => ({ category: row.category, currency: row.currency, amount: Number(row._sum.amount ?? 0) })),
    otherCurrencyChannelSpend: expensesByChannel
      .filter((row) => row.currency !== campaign.currency)
      .map((row) => ({ currency: row.currency, amount: Number(row._sum.amount ?? 0) })),
  };
}
