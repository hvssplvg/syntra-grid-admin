import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { requireMessagingIdentity } from "@/lib/messaging/permissions";
import { createGroupConversation, findOrCreateDirectConversation, listConversationsForUser } from "@/lib/messaging/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/chat/conversations]", error);

  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });

  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const identity = await requireMessagingIdentity();

    const params = request.nextUrl.searchParams;
    const cursor = params.get("cursor");
    const limit = params.get("limit") ? Number(params.get("limit")) : undefined;

    const { conversations, nextCursor } = await listConversationsForUser(identity, { cursor, limit });

    return NextResponse.json({ ok: true, conversations, nextCursor });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireMessagingIdentity();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    if (body.type === "GROUP") {
      if (typeof body.name !== "string" || !Array.isArray(body.memberIds)) {
        return NextResponse.json({ ok: false, error: "A group needs a name and at least one member." }, { status: 400 });
      }

      const memberIds = body.memberIds.filter((id: unknown): id is string => typeof id === "string");
      const conversation = await createGroupConversation(identity, { name: body.name, memberIds });

      return NextResponse.json({ ok: true, conversation }, { status: 201 });
    }

    if (body.type === "DIRECT") {
      if (typeof body.otherAdminUserId !== "string") {
        return NextResponse.json({ ok: false, error: "A recipient is required." }, { status: 400 });
      }

      const conversation = await findOrCreateDirectConversation(identity, body.otherAdminUserId);

      return NextResponse.json({ ok: true, conversation }, { status: 201 });
    }

    return NextResponse.json({ ok: false, error: "Unknown conversation type." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
