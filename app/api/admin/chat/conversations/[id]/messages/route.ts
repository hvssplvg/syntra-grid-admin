import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { requireMessagingIdentity } from "@/lib/messaging/permissions";
import { listMessages, sendMessage } from "@/lib/messaging/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/chat/conversations/:id/messages]", error);

  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });

  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireMessagingIdentity();
    const { id } = await params;

    const searchParams = request.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

    const { messages, nextCursor } = await listMessages(identity, id, { cursor, limit });

    return NextResponse.json({ ok: true, messages, nextCursor });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireMessagingIdentity();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const attachmentIds = Array.isArray(body.attachmentIds)
      ? body.attachmentIds.filter((attachmentId: unknown): attachmentId is string => typeof attachmentId === "string")
      : [];

    const message = await sendMessage(identity, id, {
      body: typeof body.body === "string" ? body.body : null,
      attachmentIds,
    });

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
