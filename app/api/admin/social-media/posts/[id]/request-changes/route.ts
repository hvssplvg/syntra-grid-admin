import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { requestPostChanges } from "@/lib/social-media/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.APPROVE);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

    if (!notes) {
      return NextResponse.json({ ok: false, error: "Review notes are required when requesting changes." }, { status: 400 });
    }

    const post = await requestPostChanges(identity, id, notes);

    return NextResponse.json({ ok: true, post });
  } catch (error) {
    console.error("[admin/social-media/posts/:id/request-changes]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
