import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import {
  AccessAction,
  assertRestaurantPlatformRowAccess,
  requireRestaurantPlatformPermission,
} from "@/lib/restaurant-platform/permissions";
import { getRemoteRestaurantDetail, listRemoteInvitations, RestaurantManagementApiError } from "@/lib/restaurant-platform/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/restaurant-platform/restaurants/[id]

   [id] is the local ManagedSystem id. For a PROVISIONED link this makes a
   live call to Restaurant Admin for current status/modules/invitations
   (and opportunistically refreshes the local remoteStatus cache) — unlike
   the list endpoint, Detail is always live, never the cache alone.
============================================================================ */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireRestaurantPlatformPermission(AccessAction.VIEW);
    const { id } = await params;

    const system = await prisma.managedSystem.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, displayName: true, logoUrl: true } },
        restaurantLink: true,
      },
    });

    if (!system || system.systemType !== "RESTAURANT_TENANT" || !system.restaurantLink) {
      return NextResponse.json({ ok: false, error: "Restaurant not found." }, { status: 404 });
    }

    assertRestaurantPlatformRowAccess(identity, AccessAction.VIEW, system.clientId);

    const link = system.restaurantLink;

    if (link.provisioningState !== "PROVISIONED" || !link.externalRestaurantId) {
      return NextResponse.json({
        ok: true,
        managedSystemId: system.id,
        client: system.client,
        provisioningState: link.provisioningState,
        provisioningError: link.provisioningError,
        remote: null,
        invitations: [],
      });
    }

    try {
      const [remote, invitationsResult] = await Promise.all([
        getRemoteRestaurantDetail(link.externalRestaurantId),
        listRemoteInvitations(link.externalRestaurantId),
      ]);

      if (remote.status !== link.remoteStatus) {
        await prisma.restaurantLink.update({
          where: { id: link.id },
          data: { remoteStatus: remote.status, remoteStatusSyncedAt: new Date() },
        });
      }

      return NextResponse.json({
        ok: true,
        managedSystemId: system.id,
        client: system.client,
        provisioningState: link.provisioningState,
        provisioningError: null,
        remote,
        invitations: invitationsResult.items,
      });
    } catch (error) {
      const message = error instanceof RestaurantManagementApiError ? error.message : "Could not reach the Restaurant Management API.";
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  } catch (error) {
    console.error("[admin/restaurant-platform/restaurants/[id]:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
