import { NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError, getCurrentIdentity, hasPermission } from "@/lib/auth/current-admin";
import { AccessAction } from "@/app/generated/prisma/enums";
import { getAnalyticsSeries } from "@/lib/overview/server";

export const runtime = "nodejs";

/* ============================================================================
   GET /api/admin/overview/analytics

   Monthly new-Client + new-Project counts. This is an aggregate company
   total with no per-employee ownership to scope by (unlike leave or
   timesheets), so a restricted caller who holds VIEW on "analytics" sees
   the exact same real totals a full-access caller does — the permission
   grant itself is the gate, same as every other Command module.
============================================================================ */

export async function GET() {
  try {
    const identity = await getCurrentIdentity();

    if (!identity.isFullAccess && !hasPermission(identity, "analytics", AccessAction.VIEW)) {
      throw new AuthorisationError("You are not authorised to view analytics.");
    }

    const series = await getAnalyticsSeries(12);

    return NextResponse.json({ ok: true, series });
  } catch (error) {
    console.error("[admin/overview/analytics]", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    if (error instanceof AuthorisationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json({ ok: false, error: "Unable to load analytics right now." }, { status: 500 });
  }
}
