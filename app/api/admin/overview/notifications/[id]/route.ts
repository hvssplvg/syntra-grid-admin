import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError, getCurrentAdmin } from "@/lib/auth/current-admin";
import { dismissNotification, markNotificationRead } from "@/lib/notifications/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   PATCH /api/admin/overview/notifications/[id]

   Marks one notification read. Ownership-checked: markNotificationRead
   only ever updates a row whose recipientAdminUserId matches the caller,
   so one admin can never mark another's notification read.
============================================================================ */

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentAdmin();
    const { id } = await params;

    const updated = await markNotificationRead(admin.id, id);

    if (!updated) {
      return NextResponse.json({ ok: false, error: "Notification not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/overview/notifications/:id]", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    if (error instanceof AuthorisationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json({ ok: false, error: "Unable to update the notification." }, { status: 500 });
  }
}

/* ============================================================================
   DELETE /api/admin/overview/notifications/[id]

   Dismisses (soft-hides) a notification — sets dismissedAt rather than
   deleting the row, same ownership-checked shape as markNotificationRead.
============================================================================ */

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentAdmin();
    const { id } = await params;

    const dismissed = await dismissNotification(admin.id, id);

    if (!dismissed) {
      return NextResponse.json({ ok: false, error: "Notification not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/overview/notifications/:id]", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    if (error instanceof AuthorisationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json({ ok: false, error: "Unable to dismiss the notification." }, { status: 500 });
  }
}
