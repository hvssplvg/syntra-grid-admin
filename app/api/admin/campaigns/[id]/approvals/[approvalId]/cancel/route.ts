import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, hasCampaignsPermission, isOwnAdminUser, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { cancelCampaignApproval, getCampaignApprovalOrThrow } from "@/lib/campaigns/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; approvalId: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id, approvalId } = await params;
    const campaign = await getCampaignOrThrow(id);
    const approval = await getCampaignApprovalOrThrow(id, approvalId);

    if (!isOwnAdminUser(identity, approval.requestedById)) {
      if (!hasCampaignsPermission(identity, AccessAction.MANAGE)) {
        return NextResponse.json({ ok: false, error: "You are not authorised to cancel this approval." }, { status: 403 });
      }
      assertCampaignRowAccess(identity, AccessAction.MANAGE, { createdById: campaign.createdById, departmentId: campaign.departmentId });
    }

    const cancelled = await cancelCampaignApproval(identity, id, approvalId);
    return NextResponse.json({ ok: true, approval: cancelled });
  } catch (error) {
    console.error("[admin/campaigns/:id/approvals/:approvalId/cancel]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
