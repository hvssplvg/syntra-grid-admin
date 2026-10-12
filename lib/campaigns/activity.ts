// lib/campaigns/activity.ts
//
// CampaignActivity is both the activity feed AND the audit trail for the
// whole Campaigns module (see the schema's CAMPAIGNS MANAGEMENT doc
// comment) — every mutation across every sub-module calls logActivity so
// there is one real, queryable history instead of scattered ad-hoc logs.

import { prisma } from "@/lib/prisma";
import { CampaignActivityType, Prisma } from "@/app/generated/prisma/client";

export async function logCampaignActivity(
  campaignId: string,
  actorId: string | null,
  type: CampaignActivityType,
  description?: string | null,
  metadata?: Prisma.InputJsonValue,
) {
  await prisma.campaignActivity.create({
    data: {
      campaignId,
      actorId,
      type,
      description: description ?? null,
      metadata: metadata ?? undefined,
    },
  });
}

const ADMIN_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

export async function listCampaignActivity(campaignId: string, limit = 50) {
  return prisma.campaignActivity.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: ADMIN_SELECT } },
  });
}
