import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { listCampaignApprovals, requestCampaignApproval } from "@/lib/campaigns/approvals";
import { CampaignApprovalStatus, CampaignApprovalType } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalId, parseOptionalString } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/approvals]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.VIEW, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const sp = request.nextUrl.searchParams;
    const approvals = await listCampaignApprovals(id, {
      status: parseEnumValue(sp.get("status"), Object.values(CampaignApprovalStatus)),
      type: parseEnumValue(sp.get("type"), Object.values(CampaignApprovalType)),
      assignedApproverId: sp.get("assignedApproverId"),
    });

    return NextResponse.json({ ok: true, approvals });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.CREATE);
    const { id } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.CREATE, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const body = await request.json().catch(() => null);
    const type = parseEnumValue(body?.type, Object.values(CampaignApprovalType));
    if (!type) return NextResponse.json({ ok: false, error: "A valid approval type is required." }, { status: 400 });

    const assignedApproverId = parseOptionalId(body?.assignedApproverId);
    if (assignedApproverId === undefined) return NextResponse.json({ ok: false, error: "The selected approver is invalid." }, { status: 400 });

    const approval = await requestCampaignApproval(identity, id, {
      type,
      relatedEntityType: parseOptionalString(body?.relatedEntityType),
      relatedEntityId: parseOptionalId(body?.relatedEntityId) ?? null,
      assignedApproverId,
    });

    return NextResponse.json({ ok: true, approval }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
