import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertBrandAssetsRowAccess, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { deleteBrandAsset, getBrandAssetOrThrow, updateBrandAssetMetadata } from "@/lib/brand-assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/brand-assets/assets/:id]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.VIEW);
    const { id } = await params;
    const asset = await getBrandAssetOrThrow(id);
    assertBrandAssetsRowAccess(identity, AccessAction.VIEW, { ownerId: asset.uploadedById });
    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.EDIT);
    const { id } = await params;

    const existing = await getBrandAssetOrThrow(id);
    assertBrandAssetsRowAccess(identity, AccessAction.EDIT, { ownerId: existing.uploadedById });

    const body = await request.json().catch(() => ({}));

    const asset = await updateBrandAssetMetadata(id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.description === "string" || body.description === null ? { description: body.description } : {}),
      ...(typeof body.category === "string" || body.category === null ? { category: body.category } : {}),
      ...(Array.isArray(body.tags) ? { tags: body.tags.filter((tag: unknown): tag is string => typeof tag === "string") } : {}),
      ...(typeof body.usageRights === "string" ? { usageRights: body.usageRights } : {}),
      ...(typeof body.brandKitId === "string" || body.brandKitId === null ? { brandKitId: body.brandKitId } : {}),
    });

    return NextResponse.json({ ok: true, asset });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.MANAGE);
    const { id } = await params;
    const existing = await getBrandAssetOrThrow(id);
    assertBrandAssetsRowAccess(identity, AccessAction.MANAGE, { ownerId: existing.uploadedById });
    await deleteBrandAsset(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
