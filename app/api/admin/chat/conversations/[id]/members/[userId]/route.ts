import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { requireMessagingIdentity } from "@/lib/messaging/permissions";
import { leaveGroup, removeGroupMember } from "@/lib/messaging/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireMessagingIdentity();
    const { id, userId } = await params;

    // Leaving yourself needs no group-admin role; removing someone else
    // does — removeGroupMember() enforces that distinction.
    if (userId === identity.admin.id) {
      await leaveGroup(identity, id);
      return NextResponse.json({ ok: true });
    }

    const conversation = await removeGroupMember(identity, id, userId);
    return NextResponse.json({ ok: true, conversation });
  } catch (error) {
    console.error("[admin/chat/conversations/:id/members/:userId]", error);

    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });

    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
