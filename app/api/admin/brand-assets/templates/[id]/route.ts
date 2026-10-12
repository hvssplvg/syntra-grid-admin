import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { getBrandTemplateOrThrow, updateBrandTemplate } from "@/lib/brand-assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/brand-assets/templates/:id]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireBrandAssetsPermission(AccessAction.VIEW);
    const { id } = await params;
    const template = await getBrandTemplateOrThrow(id);
    return NextResponse.json({ ok: true, template });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireBrandAssetsPermission(AccessAction.MANAGE);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));

    const template = await updateBrandTemplate(id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.description === "string" || body.description === null ? { description: body.description } : {}),
      ...(typeof body.category === "string" ? { category: body.category } : {}),
      ...(Array.isArray(body.tags) ? { tags: body.tags.filter((tag: unknown): tag is string => typeof tag === "string") } : {}),
      ...(typeof body.brandKitId === "string" || body.brandKitId === null ? { brandKitId: body.brandKitId } : {}),
    });

    return NextResponse.json({ ok: true, template });
  } catch (error) {
    return errorResponse(error);
  }
}
