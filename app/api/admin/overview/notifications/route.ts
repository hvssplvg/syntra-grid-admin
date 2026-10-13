import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError, getCurrentIdentity } from "@/lib/auth/current-admin";
import { syncAndListNotifications } from "@/lib/notifications/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/overview/notifications

   Any authenticated admin — full-access or restricted — gets her own
   materialised notifications. See lib/notifications/server.ts for how
   restricted callers are scoped (currently: pending leave approvals she
   is actually a manager for; expands safely as more modules are added
   there, never by editing this route).

   ?limit=&cursor=&filter=unread — used by both the header dropdown
   (small limit, no filter) and the dedicated "View all notifications"
   workspace (paginated, optional unread-only filter).
============================================================================ */

export async function GET(request: NextRequest) {
  try {
    const identity = await getCurrentIdentity();

    const params = request.nextUrl.searchParams;
    const limit = params.get("limit") ? Number(params.get("limit")) : undefined;
    const cursor = params.get("cursor");
    const filter = params.get("filter") === "unread" ? "unread" : "all";

    const { items, unreadCount, nextCursor } = await syncAndListNotifications(identity, { limit, cursor, filter });

    return NextResponse.json({ ok: true, items, unreadCount, nextCursor });
  } catch (error) {
    console.error("[admin/overview/notifications]", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    if (error instanceof AuthorisationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json({ ok: false, error: "Unable to load notifications right now." }, { status: 500 });
  }
}
