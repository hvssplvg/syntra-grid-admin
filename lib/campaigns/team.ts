// lib/campaigns/team.ts
//
// Campaign team assignment — CampaignMember links a real Employee record
// to a campaign with a role. Adding/removing members is gated under
// campaigns:MANAGE (a staffing decision, not routine content editing),
// checked against the PARENT campaign's row access.

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import { CampaignActivityType, CampaignMemberRole } from "@/app/generated/prisma/enums";
import type { ResolvedIdentity } from "@/lib/campaigns/permissions";
import { logCampaignActivity } from "@/lib/campaigns/activity";
import { getCampaignOrThrow } from "@/lib/campaigns/server";

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, jobTitle: true, avatarUrl: true, departmentId: true } as const;
const ADMIN_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

export async function listCampaignMembers(campaignId: string) {
  await getCampaignOrThrow(campaignId);
  return prisma.campaignMember.findMany({
    where: { campaignId },
    orderBy: { createdAt: "asc" },
    include: { employee: { select: EMPLOYEE_SELECT }, addedBy: { select: ADMIN_SELECT } },
  });
}

export async function addCampaignMember(
  identity: ResolvedIdentity,
  campaignId: string,
  employeeId: string,
  role: CampaignMemberRole,
) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, firstName: true, lastName: true } });
  if (!employee) throw new AuthorisationError("The selected employee could not be found.");

  const existing = await prisma.campaignMember.findUnique({ where: { campaignId_employeeId: { campaignId, employeeId } } });
  if (existing) throw new AuthorisationError("This employee is already a member of this campaign.");

  const member = await prisma.campaignMember.create({
    data: { campaignId, employeeId, role, addedById: identity.admin.id },
    include: { employee: { select: EMPLOYEE_SELECT }, addedBy: { select: ADMIN_SELECT } },
  });

  await logCampaignActivity(
    campaignId,
    identity.admin.id,
    CampaignActivityType.MEMBER_ADDED,
    `${employee.firstName} ${employee.lastName} added as ${role.toLowerCase()}.`,
  );

  return member;
}

export async function updateCampaignMemberRole(identity: ResolvedIdentity, campaignId: string, memberId: string, role: CampaignMemberRole) {
  const existing = await prisma.campaignMember.findUnique({ where: { id: memberId } });
  if (!existing || existing.campaignId !== campaignId) throw new AuthorisationError("This member could not be found.");

  return prisma.campaignMember.update({
    where: { id: memberId },
    data: { role },
    include: { employee: { select: EMPLOYEE_SELECT }, addedBy: { select: ADMIN_SELECT } },
  });
}

export async function removeCampaignMember(identity: ResolvedIdentity, campaignId: string, memberId: string) {
  const existing = await prisma.campaignMember.findUnique({
    where: { id: memberId },
    include: { employee: { select: { firstName: true, lastName: true } } },
  });
  if (!existing || existing.campaignId !== campaignId) throw new AuthorisationError("This member could not be found.");

  await prisma.campaignMember.delete({ where: { id: memberId } });

  await logCampaignActivity(
    campaignId,
    identity.admin.id,
    CampaignActivityType.MEMBER_REMOVED,
    `${existing.employee.firstName} ${existing.employee.lastName} removed from the campaign.`,
  );
}
