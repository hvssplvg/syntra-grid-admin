import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { requireMessagingIdentity } from "@/lib/messaging/permissions";
import { markConversationRead } from "@/lib/messaging/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireMessagingIdentity();
    const { id } = await params;

    await markConversationRead(identity, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/chat/conversations/:id/read]", error);

    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });

    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
