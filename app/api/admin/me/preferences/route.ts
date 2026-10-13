import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, getCurrentAdmin } from "@/lib/auth/current-admin";
import { getUserNotificationPreferences, updateUserNotificationPreferences } from "@/lib/notifications/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET/PATCH /api/admin/me/preferences

   Notification preferences — self-service only, derived entirely from
   the session. PATCH allow-lists exactly the 8 known boolean fields
   (see lib/notifications/server.ts's updateUserNotificationPreferences);
   anything else in the body is silently ignored.
============================================================================ */

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    const preferences = await getUserNotificationPreferences(admin.id);

    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    console.error("[admin/me/preferences]", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    return NextResponse.json({ ok: false, error: "Unable to load your notification preferences." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const preferences = await updateUserNotificationPreferences(admin.id, body as Record<string, unknown>);

    return NextResponse.json({ ok: true, preferences });
  } catch (error) {
    console.error("[admin/me/preferences]", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    return NextResponse.json({ ok: false, error: "Unable to update your notification preferences." }, { status: 500 });
  }
}
