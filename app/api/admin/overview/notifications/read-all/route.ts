import { NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError, getCurrentAdmin } from "@/lib/auth/current-admin";
import { markAllNotificationsRead } from "@/lib/notifications/server";

export const runtime = "nodejs";

/* ============================================================================
   POST /api/admin/overview/notifications/read-all
============================================================================ */

export async function POST() {
  try {
    const admin = await getCurrentAdmin();

    await markAllNotificationsRead(admin.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/overview/notifications/read-all]", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    if (error instanceof AuthorisationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json({ ok: false, error: "Unable to update notifications." }, { status: 500 });
  }
}
