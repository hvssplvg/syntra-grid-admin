import { NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireRestaurantPlatformPermission } from "@/lib/restaurant-platform/permissions";
import { listRemoteModules, RestaurantManagementUnavailableError } from "@/lib/restaurant-platform/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/restaurant-platform/modules

   Proxies Restaurant Admin's module registry so the New Restaurant
   onboarding flow's module-selection step can build its picker from the
   real, current set of modules instead of a second hand-maintained copy.
============================================================================ */
export async function GET() {
  try {
    await requireRestaurantPlatformPermission(AccessAction.VIEW);

    const result = await listRemoteModules();
    return NextResponse.json({ ok: true, items: result.items });
  } catch (error) {
    console.error("[admin/restaurant-platform/modules:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    if (error instanceof RestaurantManagementUnavailableError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "Could not load modules." }, { status: 502 });
  }
}
