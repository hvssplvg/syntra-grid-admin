import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { deleteCampaignMilestone, updateCampaignMilestone } from "@/lib/campaigns/planner";
import { CampaignMilestoneStatus } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalId, parseOptionalString } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; milestoneId: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/milestones/:milestoneId]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.EDIT);
    const { id, milestoneId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const body = await request.json().catch(() => ({}));

    const dueAt = typeof body.dueAt === "string" ? new Date(body.dueAt) : undefined;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid due date." }, { status: 400 });
    }

    const ownerId = parseOptionalId(body.ownerId);
    if (ownerId === undefined && body.ownerId !== undefined) {
      return NextResponse.json({ ok: false, error: "The selected owner is invalid." }, { status: 400 });
    }

    const status = body.status !== undefined ? parseEnumValue(body.status, Object.values(CampaignMilestoneStatus)) : undefined;
    if (body.status !== undefined && status === null) {
      return NextResponse.json({ ok: false, error: "Invalid milestone status." }, { status: 400 });
    }

    const milestone = await updateCampaignMilestone(identity, id, milestoneId, {
      ...(typeof body.title === "string" ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: parseOptionalString(body.description) } : {}),
      ...(dueAt !== undefined ? { dueAt } : {}),
      ...(ownerId !== undefined ? { ownerId } : {}),
      ...(status !== undefined && status !== null ? { status } : {}),
    });

    return NextResponse.json({ ok: true, milestone });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.MANAGE);
    const { id, milestoneId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.MANAGE, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    await deleteCampaignMilestone(identity, id, milestoneId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
