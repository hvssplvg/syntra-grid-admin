import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { requireMessagingIdentity } from "@/lib/messaging/permissions";
import { addGroupMember } from "@/lib/messaging/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireMessagingIdentity();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body.adminUserId !== "string") {
      return NextResponse.json({ ok: false, error: "A person to add is required." }, { status: 400 });
    }

    const conversation = await addGroupMember(identity, id, body.adminUserId);

    return NextResponse.json({ ok: true, conversation });
  } catch (error) {
    console.error("[admin/chat/conversations/:id/members]", error);

    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });

    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
