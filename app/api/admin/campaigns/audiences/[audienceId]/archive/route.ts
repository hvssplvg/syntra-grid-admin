import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { archiveCampaignAudience } from "@/lib/campaigns/audiences";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ audienceId: string }> }) {
  try {
    await requireCampaignsPermission(AccessAction.MANAGE);
    const { audienceId } = await params;
    const audience = await archiveCampaignAudience(audienceId);
    return NextResponse.json({ ok: true, audience });
  } catch (error) {
    console.error("[admin/campaigns/audiences/:audienceId/archive]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
