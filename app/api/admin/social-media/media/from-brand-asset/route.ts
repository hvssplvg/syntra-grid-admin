import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { AccessAction as BrandAccessAction, hasBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { reuseBrandAssetAsSocialMediaAsset } from "@/lib/social-media/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/social-media/media/from-brand-asset

   Lets the composer's media picker reuse an approved Brand Asset as post
   media without re-uploading it — see
   lib/social-media/media.ts#reuseBrandAssetAsSocialMediaAsset. Requires
   the caller to hold VIEW on brand_assets (to browse it) and CREATE on
   social_media (the same bar a direct upload already requires).
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    if (!hasBrandAssetsPermission(identity, BrandAccessAction.VIEW)) {
      throw new AuthorisationError("You are not authorised to view brand assets.");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.brandAssetId !== "string" || !body.brandAssetId) {
      return NextResponse.json({ ok: false, error: "A brandAssetId is required." }, { status: 400 });
    }

    const asset = await reuseBrandAssetAsSocialMediaAsset(body.brandAssetId, identity.admin.id);

    return NextResponse.json({ ok: true, asset }, { status: 201 });
  } catch (error) {
    console.error("[admin/social-media/media/from-brand-asset]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
