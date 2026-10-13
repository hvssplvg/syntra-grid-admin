import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { assertConversationMembership, requireMessagingIdentity } from "@/lib/messaging/permissions";
import { getConversationOrThrow, renameGroup } from "@/lib/messaging/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/chat/conversations/:id]", error);

  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });

  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireMessagingIdentity();
    const { id } = await params;

    await assertConversationMembership(id, identity.admin.id);
    const conversation = await getConversationOrThrow(id);

    return NextResponse.json({ ok: true, conversation });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireMessagingIdentity();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body.name !== "string") {
      return NextResponse.json({ ok: false, error: "A name is required." }, { status: 400 });
    }

    const conversation = await renameGroup(identity, id, body.name);

    return NextResponse.json({ ok: true, conversation });
  } catch (error) {
    return errorResponse(error);
  }
}
