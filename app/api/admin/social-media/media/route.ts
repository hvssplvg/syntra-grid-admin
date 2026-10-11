import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { listSocialMediaAssets } from "@/lib/social-media/media";
import { SocialAssetType } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireSocialMediaPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 30) || 30));
    const typeParam = params.get("type");
    const type = typeParam === "IMAGE" || typeParam === "VIDEO" ? (typeParam as SocialAssetType) : null;

    const { assets, total } = await listSocialMediaAssets(page, pageSize, type);

    return NextResponse.json({ ok: true, assets, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
  } catch (error) {
    console.error("[admin/social-media/media]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
