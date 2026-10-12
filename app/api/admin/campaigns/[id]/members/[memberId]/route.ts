import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { removeCampaignMember, updateCampaignMemberRole } from "@/lib/campaigns/team";
import { CampaignMemberRole } from "@/app/generated/prisma/enums";
import { parseEnumValue } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; memberId: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/members/:memberId]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.MANAGE);
    const { id, memberId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.MANAGE, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const body = await request.json().catch(() => null);
    const role = parseEnumValue(body?.role, Object.values(CampaignMemberRole));
    if (!role) return NextResponse.json({ ok: false, error: "A valid role is required." }, { status: 400 });

    const member = await updateCampaignMemberRole(identity, id, memberId, role);
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.MANAGE);
    const { id, memberId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.MANAGE, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    await removeCampaignMember(identity, id, memberId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
