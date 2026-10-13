import { NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError, getCurrentAdmin } from "@/lib/auth/current-admin";
import { getUnreadNotificationCount } from "@/lib/notifications/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/overview/notifications/unread-count

   Cheap polling target for the header bell — deliberately does not run
   syncNotifications(), just counts what's already materialised, so
   15-30s polling never re-triggers a full sync scan.
============================================================================ */

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    const unreadCount = await getUnreadNotificationCount(admin.id);

    return NextResponse.json({ ok: true, unreadCount });
  } catch (error) {
    console.error("[admin/overview/notifications/unread-count]", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    if (error instanceof AuthorisationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json({ ok: false, error: "Unable to load the unread count." }, { status: 500 });
  }
}
