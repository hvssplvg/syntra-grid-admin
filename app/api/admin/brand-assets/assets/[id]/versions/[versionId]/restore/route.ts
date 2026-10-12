import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertBrandAssetsRowAccess, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { getBrandAssetOrThrow, restoreBrandAssetVersion } from "@/lib/brand-assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.MANAGE);
    const { id, versionId } = await params;
    const existing = await getBrandAssetOrThrow(id);
    assertBrandAssetsRowAccess(identity, AccessAction.MANAGE, { ownerId: existing.uploadedById });
    const asset = await restoreBrandAssetVersion(identity, id, versionId);
    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    console.error("[admin/brand-assets/assets/:id/versions/:versionId/restore]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
