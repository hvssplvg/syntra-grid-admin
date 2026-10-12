import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { addCampaignMember, listCampaignMembers } from "@/lib/campaigns/team";
import { CampaignMemberRole } from "@/app/generated/prisma/enums";
import { parseEnumValue } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/members]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.VIEW, { createdById: campaign.createdById, departmentId: campaign.departmentId });
    const members = await listCampaignMembers(id);
    return NextResponse.json({ ok: true, members });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.MANAGE);
    const { id } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.MANAGE, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const body = await request.json().catch(() => null);
    const employeeId = typeof body?.employeeId === "string" ? body.employeeId : null;
    if (!employeeId) return NextResponse.json({ ok: false, error: "An employee is required." }, { status: 400 });

    const role = parseEnumValue(body?.role, Object.values(CampaignMemberRole)) ?? CampaignMemberRole.CONTRIBUTOR;

    const member = await addCampaignMember(identity, id, employeeId, role);
    return NextResponse.json({ ok: true, member }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
