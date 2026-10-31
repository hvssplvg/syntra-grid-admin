import { NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { getCompanyBrandKit } from "@/lib/social-media/brandKit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/social-media/brand-kit

   Read-only — same permission boundary as viewing Content Studio.
   Returns null (not an error) when no company BrandKit exists yet; the
   panel shows an honest empty state rather than inventing one.
============================================================================ */

export async function GET() {
  try {
    await requireSocialMediaPermission(AccessAction.VIEW);
    const brandKit = await getCompanyBrandKit();
    return NextResponse.json({ ok: true, brandKit });
  } catch (error) {
    console.error("[admin/social-media/brand-kit]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
