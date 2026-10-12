import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow, launchCampaign } from "@/lib/campaigns/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.EDIT);
    const { id } = await params;
    const existing = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: existing.createdById, departmentId: existing.departmentId });
    const campaign = await launchCampaign(identity, id);
    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    console.error("[admin/campaigns/:id/launch]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
