// lib/campaigns/approvals.ts
//
// A single assigned-approver + status model (no multi-step chain — no
// concrete multi-stage requirement was specified, and this keeps the
// workflow fully auditable without inventing an approval-chain product
// nobody asked for). snapshot freezes the related entity's state at
// request time, and supersedeApprovalsForEntity marks any still-open
// approval SUPERSEDED the moment that entity is substantively edited
// again — a stale approval can never authorise changed content.
//
// Separation of duties is enforced as a hard business rule, not a
// permission tier: the requester can never decide their own request,
// full access included. If an approver was explicitly assigned, only
// they may decide — full-access accounts may override that assignment
// (they're the ultimate authority), but never the self-approval rule.

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import { CampaignActivityType, CampaignApprovalStatus, CampaignApprovalType } from "@/app/generated/prisma/enums";
import { isOwnAdminUser, type ResolvedIdentity } from "@/lib/campaigns/permissions";
import { logCampaignActivity } from "@/lib/campaigns/activity";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { Prisma } from "@/app/generated/prisma/client";

const ADMIN_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

const APPROVAL_INCLUDE = {
  requestedBy: { select: ADMIN_SELECT },
  assignedApprover: { select: ADMIN_SELECT },
  decidedBy: { select: ADMIN_SELECT },
  comments: { include: { author: { select: ADMIN_SELECT } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.CampaignApprovalInclude;

export async function listCampaignApprovals(
  campaignId: string,
  filters: { status?: CampaignApprovalStatus | null; type?: CampaignApprovalType | null; assignedApproverId?: string | null },
) {
  await getCampaignOrThrow(campaignId);
  return prisma.campaignApproval.findMany({
    where: {
      campaignId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.assignedApproverId ? { assignedApproverId: filters.assignedApproverId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: APPROVAL_INCLUDE,
  });
}

export async function getCampaignApprovalOrThrow(campaignId: string, approvalId: string) {
  const approval = await prisma.campaignApproval.findUnique({ where: { id: approvalId }, include: APPROVAL_INCLUDE });
  if (!approval || approval.campaignId !== campaignId) throw new AuthorisationError("This approval could not be found.");
  return approval;
}

async function snapshotEntity(relatedEntityType: string | null, relatedEntityId: string | null): Promise<Prisma.InputJsonValue | undefined> {
  if (!relatedEntityType || !relatedEntityId) return undefined;

  switch (relatedEntityType) {
    case "Campaign": {
      const row = await prisma.campaign.findUnique({ where: { id: relatedEntityId } });
      return row ? JSON.parse(JSON.stringify(row)) : undefined;
    }
    case "CampaignContent": {
      const row = await prisma.campaignContent.findUnique({ where: { id: relatedEntityId } });
      return row ? JSON.parse(JSON.stringify(row)) : undefined;
    }
    case "CampaignExpense": {
      const row = await prisma.campaignExpense.findUnique({ where: { id: relatedEntityId } });
      return row ? JSON.parse(JSON.stringify(row)) : undefined;
    }
    default:
      return undefined;
  }
}

export type RequestApprovalInput = {
  type: CampaignApprovalType;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  assignedApproverId?: string | null;
};

export async function requestCampaignApproval(identity: ResolvedIdentity, campaignId: string, input: RequestApprovalInput) {
  await getCampaignOrThrow(campaignId);

  if (input.assignedApproverId) {
    const approver = await prisma.adminUser.findUnique({ where: { id: input.assignedApproverId }, select: { id: true } });
    if (!approver) throw new AuthorisationError("The selected approver could not be found.");
    if (approver.id === identity.admin.id) {
      throw new AuthorisationError("You cannot assign yourself as the approver for your own request.");
    }
  }

  const snapshot = await snapshotEntity(input.relatedEntityType ?? null, input.relatedEntityId ?? null);

  const approval = await prisma.campaignApproval.create({
    data: {
      campaignId,
      type: input.type,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      snapshot,
      requestedById: identity.admin.id,
      assignedApproverId: input.assignedApproverId ?? null,
    },
    include: APPROVAL_INCLUDE,
  });

  await logCampaignActivity(campaignId, identity.admin.id, CampaignActivityType.APPROVAL_REQUESTED, `${input.type} approval requested.`);

  return approval;
}

export async function decideCampaignApproval(
  identity: ResolvedIdentity,
  campaignId: string,
  approvalId: string,
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
  comment?: string | null,
) {
  const approval = await getCampaignApprovalOrThrow(campaignId, approvalId);

  if (approval.status !== "PENDING") {
    throw new AuthorisationError("This approval has already been decided or is no longer open.");
  }
  if (isOwnAdminUser(identity, approval.requestedById)) {
    throw new AuthorisationError("You cannot decide an approval you requested yourself.");
  }
  if (approval.assignedApproverId && !identity.isFullAccess && !isOwnAdminUser(identity, approval.assignedApproverId)) {
    throw new AuthorisationError("Only the assigned approver can decide this request.");
  }

  // Atomic claim: the WHERE clause re-checks status = PENDING at the
  // database level, so two concurrent decisions on the same approval
  // can't both succeed — the second one affects zero rows instead of
  // silently overwriting the first's decision.
  const claim = await prisma.campaignApproval.updateMany({
    where: { id: approvalId, status: "PENDING" },
    data: { status: decision, decidedById: identity.admin.id, decidedAt: new Date() },
  });
  if (claim.count === 0) {
    throw new AuthorisationError("This approval has already been decided or is no longer open.");
  }

  const updated = await prisma.campaignApproval.findUniqueOrThrow({ where: { id: approvalId }, include: APPROVAL_INCLUDE });

  if (comment?.trim()) {
    await prisma.campaignApprovalComment.create({ data: { approvalId, authorId: identity.admin.id, body: comment.trim() } });
  }

  const activityType =
    decision === "APPROVED"
      ? CampaignActivityType.APPROVAL_APPROVED
      : decision === "REJECTED"
        ? CampaignActivityType.APPROVAL_REJECTED
        : CampaignActivityType.APPROVAL_CHANGES_REQUESTED;

  await logCampaignActivity(campaignId, identity.admin.id, activityType, `${approval.type} approval ${decision.toLowerCase().replace("_", " ")}.`);

  return updated;
}

export async function cancelCampaignApproval(identity: ResolvedIdentity, campaignId: string, approvalId: string) {
  const approval = await getCampaignApprovalOrThrow(campaignId, approvalId);
  if (approval.status !== "PENDING") {
    throw new AuthorisationError("Only a pending approval can be cancelled.");
  }

  return prisma.campaignApproval.update({ where: { id: approvalId }, data: { status: "CANCELLED" }, include: APPROVAL_INCLUDE });
}

export async function addCampaignApprovalComment(identity: ResolvedIdentity, campaignId: string, approvalId: string, body: string) {
  await getCampaignApprovalOrThrow(campaignId, approvalId);
  return prisma.campaignApprovalComment.create({
    data: { approvalId, authorId: identity.admin.id, body },
    include: { author: { select: ADMIN_SELECT } },
  });
}

/** Marks every still-open (PENDING/APPROVED) approval referencing this
 *  entity as SUPERSEDED — called by server.ts/content.ts whenever that
 *  entity is substantively edited after being requested or approved, so a
 *  stale approval can never authorise content that has since changed. */
export async function supersedeApprovalsForEntity(relatedEntityType: string, relatedEntityId: string) {
  await prisma.campaignApproval.updateMany({
    where: { relatedEntityType, relatedEntityId, status: { in: ["PENDING", "APPROVED"] } },
    data: { status: "SUPERSEDED" },
  });
}
