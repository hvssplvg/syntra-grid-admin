import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertSocialMediaRowAccess, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { duplicatePost, getPostOrThrow } from "@/lib/social-media/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);
    const { id } = await params;

    const existing = await getPostOrThrow(id);
    assertSocialMediaRowAccess(identity, AccessAction.VIEW, { createdById: existing.createdById });

    const post = await duplicatePost(identity, id);

    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (error) {
    console.error("[admin/social-media/posts/:id/duplicate]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
