import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { attachBrandAssetToContent } from "@/lib/campaigns/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; contentId: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.EDIT);
    const { id, contentId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const body = await request.json().catch(() => null);
    const brandAssetId = typeof body?.brandAssetId === "string" ? body.brandAssetId : null;
    if (!brandAssetId) return NextResponse.json({ ok: false, error: "A brand asset is required." }, { status: 400 });

    const attachment = await attachBrandAssetToContent(id, contentId, brandAssetId);
    return NextResponse.json({ ok: true, attachment }, { status: 201 });
  } catch (error) {
    console.error("[admin/campaigns/:id/content/:contentId/assets]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
