import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { schedulePost } from "@/lib/social-media/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.APPROVE);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const scheduledAtRaw = typeof body?.scheduledAt === "string" ? body.scheduledAt : null;
    const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;

    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ ok: false, error: "A valid scheduledAt date/time is required." }, { status: 400 });
    }

    const post = await schedulePost(identity, id, scheduledAt);

    return NextResponse.json({ ok: true, post });
  } catch (error) {
    console.error("[admin/social-media/posts/:id/schedule]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
