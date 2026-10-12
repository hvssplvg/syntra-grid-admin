import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { addCampaignApprovalComment } from "@/lib/campaigns/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; approvalId: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id, approvalId } = await params;

    const body = await request.json().catch(() => ({}));
    if (typeof body.body !== "string" || !body.body.trim()) {
      return NextResponse.json({ ok: false, error: "A comment body is required." }, { status: 400 });
    }

    const comment = await addCampaignApprovalComment(identity, id, approvalId, body.body.trim());
    return NextResponse.json({ ok: true, comment }, { status: 201 });
  } catch (error) {
    console.error("[admin/campaigns/:id/approvals/:approvalId/comments]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
