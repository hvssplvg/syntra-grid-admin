import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import {
  AccessAction,
  assertRestaurantPlatformRowAccess,
  requireRestaurantPlatformPermission,
} from "@/lib/restaurant-platform/permissions";
import { setRemoteModuleEnabled, RestaurantManagementApiError } from "@/lib/restaurant-platform/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; moduleKey: string }> }) {
  try {
    const identity = await requireRestaurantPlatformPermission(AccessAction.EDIT);
    const { id, moduleKey } = await params;

    const system = await prisma.managedSystem.findUnique({ where: { id }, include: { restaurantLink: true } });
    if (!system || system.systemType !== "RESTAURANT_TENANT" || !system.restaurantLink?.externalRestaurantId) {
      return NextResponse.json({ ok: false, error: "Restaurant not found or not yet provisioned." }, { status: 404 });
    }

    assertRestaurantPlatformRowAccess(identity, AccessAction.EDIT, system.clientId);

    const body = await request.json().catch(() => null);
    const enabled = body?.enabled;
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ ok: false, error: "`enabled` must be a boolean." }, { status: 400 });
    }

    await setRemoteModuleEnabled(system.restaurantLink.externalRestaurantId, moduleKey, enabled);

    await prisma.auditLog.create({
      data: {
        actorId: identity.admin.id,
        action: "RESTAURANT_PLATFORM_MODULE_TOGGLED",
        entityType: "ManagedSystem",
        entityId: system.id,
        clientId: system.clientId,
        metadata: { moduleKey, enabled },
      },
    });

    return NextResponse.json({ ok: true, moduleKey, enabled });
  } catch (error) {
    console.error("[admin/restaurant-platform/restaurants/[id]/modules/[moduleKey]:PATCH]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    if (error instanceof RestaurantManagementApiError) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
