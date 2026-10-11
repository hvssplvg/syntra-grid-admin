import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { approvePost } from "@/lib/social-media/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** APPROVE permission required — deliberately separate from CREATE/EDIT.
 *  The marketing-executive role template grants VIEW/CREATE/EDIT but
 *  explicitly withholds APPROVE, so a content creator can never approve
 *  her own submission by calling this route directly. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.APPROVE);
    const { id } = await params;

    const post = await approvePost(identity, id);

    return NextResponse.json({ ok: true, post });
  } catch (error) {
    console.error("[admin/social-media/posts/:id/approve]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
