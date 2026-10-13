import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { requireMessagingIdentity } from "@/lib/messaging/permissions";
import { deleteMessage, editMessage } from "@/lib/messaging/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/chat/messages/:id]", error);

  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });

  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireMessagingIdentity();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body.body !== "string") {
      return NextResponse.json({ ok: false, error: "A message body is required." }, { status: 400 });
    }

    const message = await editMessage(identity, id, body.body);

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireMessagingIdentity();
    const { id } = await params;

    const message = await deleteMessage(identity, id);

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    return errorResponse(error);
  }
}
