import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { getBrandKitOrThrow, updateBrandKit } from "@/lib/brand-assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/brand-assets/kits/:id]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireBrandAssetsPermission(AccessAction.VIEW);
    const { id } = await params;
    const kit = await getBrandKitOrThrow(id);
    return NextResponse.json({ ok: true, kit });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireBrandAssetsPermission(AccessAction.MANAGE);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));

    const kit = await updateBrandKit(id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.description === "string" || body.description === null ? { description: body.description } : {}),
      ...(typeof body.clientId === "string" || body.clientId === null ? { clientId: body.clientId } : {}),
      ...(Array.isArray(body.primaryColors) ? { primaryColors: body.primaryColors } : {}),
      ...(Array.isArray(body.secondaryColors) ? { secondaryColors: body.secondaryColors } : {}),
      ...(body.typography && typeof body.typography === "object" ? { typography: body.typography } : {}),
      ...(typeof body.logoAssetId === "string" || body.logoAssetId === null ? { logoAssetId: body.logoAssetId } : {}),
    });

    return NextResponse.json({ ok: true, kit });
  } catch (error) {
    return errorResponse(error);
  }
}
