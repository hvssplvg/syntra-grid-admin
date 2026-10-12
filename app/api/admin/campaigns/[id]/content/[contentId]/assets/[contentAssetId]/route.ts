import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { removeBrandAssetFromContent } from "@/lib/campaigns/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; contentId: string; contentAssetId: string }> },
) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.EDIT);
    const { id, contentId, contentAssetId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    await removeBrandAssetFromContent(id, contentId, contentAssetId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/campaigns/:id/content/:contentId/assets/:contentAssetId]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
