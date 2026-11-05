import { NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireRestaurantPlatformPermission } from "@/lib/restaurant-platform/permissions";
import { listRemoteThemes, RestaurantManagementUnavailableError } from "@/lib/restaurant-platform/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/restaurant-platform/themes

   Proxies Restaurant Admin's dashboard theme registry so the New
   Restaurant onboarding flow's theme step, and the restaurant Dashboard
   Appearance picker, build from the real, current set of themes instead
   of a second hand-maintained copy.
============================================================================ */
export async function GET() {
  try {
    await requireRestaurantPlatformPermission(AccessAction.VIEW);

    const result = await listRemoteThemes();
    return NextResponse.json({ ok: true, items: result.items });
  } catch (error) {
    console.error("[admin/restaurant-platform/themes:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    if (error instanceof RestaurantManagementUnavailableError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "Could not load themes." }, { status: 502 });
  }
}
