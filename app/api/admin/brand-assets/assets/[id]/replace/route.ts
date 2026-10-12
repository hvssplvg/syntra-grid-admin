import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertBrandAssetsRowAccess, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { getBrandAssetOrThrow, replaceBrandAsset } from "@/lib/brand-assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.MANAGE);
    const { id } = await params;

    const existing = await getBrandAssetOrThrow(id);
    assertBrandAssetsRowAccess(identity, AccessAction.MANAGE, { ownerId: existing.uploadedById });

    const formData = await request.formData();
    const file = formData.get("file");
    const note = formData.get("note");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file was provided." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const asset = await replaceBrandAsset(identity, id, {
      buffer,
      mimeType: file.type,
      filename: file.name,
      note: typeof note === "string" && note ? note : null,
    });

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    console.error("[admin/brand-assets/assets/:id/replace]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
