import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { decideCampaignApproval } from "@/lib/campaigns/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; approvalId: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.APPROVE);
    const { id, approvalId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.APPROVE, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const body = await request.json().catch(() => ({}));
    if (typeof body?.comment !== "string" || !body.comment.trim()) {
      return NextResponse.json({ ok: false, error: "A comment explaining what needs to change is required." }, { status: 400 });
    }

    const approval = await decideCampaignApproval(identity, id, approvalId, "CHANGES_REQUESTED", body.comment);
    return NextResponse.json({ ok: true, approval });
  } catch (error) {
    console.error("[admin/campaigns/:id/approvals/:approvalId/request-changes]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
