import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import {
  AccessAction,
  assertRestaurantPlatformRowAccess,
  requireRestaurantPlatformPermission,
} from "@/lib/restaurant-platform/permissions";
import { setRemoteDashboardTheme, RestaurantManagementApiError } from "@/lib/restaurant-platform/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   PATCH /api/admin/restaurant-platform/restaurants/[id]/theme

   "Change it later" — Restaurant Platform's Dashboard Appearance picker.
   Mirrors the sibling /status route's shape exactly.
============================================================================ */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireRestaurantPlatformPermission(AccessAction.EDIT);
    const { id } = await params;

    const system = await prisma.managedSystem.findUnique({ where: { id }, include: { restaurantLink: true } });
    if (!system || system.systemType !== "RESTAURANT_TENANT" || !system.restaurantLink?.externalRestaurantId) {
      return NextResponse.json({ ok: false, error: "Restaurant not found or not yet provisioned." }, { status: 404 });
    }

    assertRestaurantPlatformRowAccess(identity, AccessAction.EDIT, system.clientId);

    const body = await request.json().catch(() => null);
    const theme = typeof body?.theme === "string" ? body.theme.trim() : "";

    if (!theme) {
      return NextResponse.json({ ok: false, error: "A theme id is required." }, { status: 400 });
    }

    await setRemoteDashboardTheme(system.restaurantLink.externalRestaurantId, theme);

    await prisma.auditLog.create({
      data: {
        actorId: identity.admin.id,
        action: "RESTAURANT_PLATFORM_THEME_CHANGED",
        entityType: "ManagedSystem",
        entityId: system.id,
        clientId: system.clientId,
        metadata: { theme },
      },
    });

    return NextResponse.json({ ok: true, theme });
  } catch (error) {
    console.error("[admin/restaurant-platform/restaurants/[id]/theme:PATCH]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    if (error instanceof RestaurantManagementApiError) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
