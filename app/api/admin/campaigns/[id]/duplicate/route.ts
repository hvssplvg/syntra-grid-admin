import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { duplicateCampaign, getCampaignOrThrow } from "@/lib/campaigns/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.CREATE);
    const { id } = await params;
    const existing = await getCampaignOrThrow(id);
    // Duplicating reads the source campaign, so VIEW-level row access on it
    // is what actually matters here — the new copy is owned by the caller.
    assertCampaignRowAccess(identity, AccessAction.VIEW, { createdById: existing.createdById, departmentId: existing.departmentId });
    const campaign = await duplicateCampaign(identity, id);
    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (error) {
    console.error("[admin/campaigns/:id/duplicate]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
