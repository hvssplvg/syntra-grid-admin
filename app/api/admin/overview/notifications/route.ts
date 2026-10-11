import { NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError, getCurrentIdentity } from "@/lib/auth/current-admin";
import { syncAndListNotifications } from "@/lib/notifications/server";

export const runtime = "nodejs";

/* ============================================================================
   GET /api/admin/overview/notifications

   Any authenticated admin — full-access or restricted — gets her own
   materialised notifications. See lib/notifications/server.ts for how
   restricted callers are scoped (currently: pending leave approvals she
   is actually a manager for; expands safely as more modules are added
   there, never by editing this route).
============================================================================ */

export async function GET() {
  try {
    const identity = await getCurrentIdentity();
    const { items, unreadCount } = await syncAndListNotifications(identity, 20);

    return NextResponse.json({ ok: true, items, unreadCount });
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
