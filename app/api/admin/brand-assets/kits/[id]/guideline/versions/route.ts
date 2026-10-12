import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { listBrandGuidelineVersions } from "@/lib/brand-assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireBrandAssetsPermission(AccessAction.VIEW);
    const { id } = await params;
    const versions = await listBrandGuidelineVersions(id);
    return NextResponse.json({ ok: true, versions });
  } catch (error) {
    console.error("[admin/brand-assets/kits/:id/guideline/versions]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
