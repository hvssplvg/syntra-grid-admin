import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertSocialMediaRowAccess, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { getPostOrThrow, submitPost } from "@/lib/social-media/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.EDIT);
    const { id } = await params;

    const existing = await getPostOrThrow(id);
    assertSocialMediaRowAccess(identity, AccessAction.EDIT, { createdById: existing.createdById });

    const post = await submitPost(identity, id);

    return NextResponse.json({ ok: true, post });
  } catch (error) {
    console.error("[admin/social-media/posts/:id/submit]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
