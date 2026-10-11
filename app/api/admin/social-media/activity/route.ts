import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { getRecentPostActivity } from "@/lib/social-media/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireSocialMediaPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;
    const postId = params.get("postId");
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 30) || 30));

    const activity = await getRecentPostActivity(postId, limit);

    return NextResponse.json({ ok: true, activity });
  } catch (error) {
    console.error("[admin/social-media/activity]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
