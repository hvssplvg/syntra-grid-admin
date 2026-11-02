import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import {
  AccessAction,
  assertRestaurantPlatformRowAccess,
  requireRestaurantPlatformPermission,
} from "@/lib/restaurant-platform/permissions";
import { setRemoteRestaurantStatus, RestaurantManagementApiError, type RemoteRestaurantStatus } from "@/lib/restaurant-platform/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: RemoteRestaurantStatus[] = ["ACTIVE", "SUSPENDED", "ARCHIVED"];

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
    const status = typeof body?.status === "string" ? body.status : null;

    if (!status || !VALID_STATUSES.includes(status as RemoteRestaurantStatus)) {
      return NextResponse.json({ ok: false, error: "A valid status (ACTIVE, SUSPENDED, ARCHIVED) is required." }, { status: 400 });
    }

    await setRemoteRestaurantStatus(system.restaurantLink.externalRestaurantId, status as RemoteRestaurantStatus);

    await prisma.$transaction([
      prisma.restaurantLink.update({
        where: { id: system.restaurantLink.id },
        data: { remoteStatus: status, remoteStatusSyncedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          actorId: identity.admin.id,
          action: "RESTAURANT_PLATFORM_STATUS_CHANGED",
          entityType: "ManagedSystem",
          entityId: system.id,
          clientId: system.clientId,
          metadata: { status },
        },
      }),
    ]);

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("[admin/restaurant-platform/restaurants/[id]/status:PATCH]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    if (error instanceof RestaurantManagementApiError) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
