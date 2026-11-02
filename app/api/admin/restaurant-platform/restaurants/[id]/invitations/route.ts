import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import {
  AccessAction,
  assertRestaurantPlatformRowAccess,
  requireRestaurantPlatformPermission,
} from "@/lib/restaurant-platform/permissions";
import { issueRemoteOwnerInvitation, listRemoteInvitations, RestaurantManagementApiError } from "@/lib/restaurant-platform/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadProvisionedSystem(id: string) {
  const system = await prisma.managedSystem.findUnique({ where: { id }, include: { restaurantLink: true } });
  if (!system || system.systemType !== "RESTAURANT_TENANT" || !system.restaurantLink?.externalRestaurantId) {
    return null;
  }
  return system;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireRestaurantPlatformPermission(AccessAction.VIEW);
    const { id } = await params;

    const system = await loadProvisionedSystem(id);
    if (!system) return NextResponse.json({ ok: false, error: "Restaurant not found or not yet provisioned." }, { status: 404 });

    assertRestaurantPlatformRowAccess(identity, AccessAction.VIEW, system.clientId);

    const result = await listRemoteInvitations(system.restaurantLink!.externalRestaurantId!);
    return NextResponse.json({ ok: true, items: result.items });
  } catch (error) {
    console.error("[admin/restaurant-platform/restaurants/[id]/invitations:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    if (error instanceof RestaurantManagementApiError) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}

/**
 * (Re)issues the restaurant's owner bootstrap invitation — not a general
 * staff-invitation endpoint. See lib/platform/service.ts#issueOwnerInvitation
 * on the Restaurant Admin side: it only succeeds while the restaurant has
 * no accepted staff yet. Inviting additional restaurant staff beyond the
 * owner stays Restaurant Admin's own in-product Staff Management module.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireRestaurantPlatformPermission(AccessAction.EDIT);
    const { id } = await params;

    const system = await loadProvisionedSystem(id);
    if (!system) return NextResponse.json({ ok: false, error: "Restaurant not found or not yet provisioned." }, { status: 404 });

    assertRestaurantPlatformRowAccess(identity, AccessAction.EDIT, system.clientId);

    const body = await request.json().catch(() => null);
    const ownerEmail = typeof body?.ownerEmail === "string" ? body.ownerEmail.trim() : "";
    if (!ownerEmail) return NextResponse.json({ ok: false, error: "ownerEmail is required." }, { status: 400 });

    const result = await issueRemoteOwnerInvitation(system.restaurantLink!.externalRestaurantId!, ownerEmail);

    await prisma.auditLog.create({
      data: {
        actorId: identity.admin.id,
        action: "RESTAURANT_PLATFORM_INVITATION_ISSUED",
        entityType: "ManagedSystem",
        entityId: system.id,
        clientId: system.clientId,
        metadata: { ownerEmail },
      },
    });

    return NextResponse.json({ ok: true, invitationId: result.invitationId, inviteLink: result.inviteLink }, { status: 201 });
  } catch (error) {
    console.error("[admin/restaurant-platform/restaurants/[id]/invitations:POST]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    if (error instanceof RestaurantManagementApiError) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
