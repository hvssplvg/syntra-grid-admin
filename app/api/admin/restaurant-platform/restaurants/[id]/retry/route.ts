import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import {
  AccessAction,
  assertRestaurantPlatformRowAccess,
  requireRestaurantPlatformPermission,
} from "@/lib/restaurant-platform/permissions";
import { attemptRemoteProvisioning, type ProvisioningPayload } from "@/lib/restaurant-platform/provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/restaurant-platform/restaurants/[id]/retry

   Re-attempts provisioning for a PENDING or FAILED RestaurantLink, reusing
   its existing provisioningRequestId and provisioningPayload exactly —
   never a new request id and never different data, which is what makes
   this safe to call more than once.
============================================================================ */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireRestaurantPlatformPermission(AccessAction.CREATE);
    const { id } = await params;

    const system = await prisma.managedSystem.findUnique({
      where: { id },
      include: { restaurantLink: true },
    });

    if (!system || system.systemType !== "RESTAURANT_TENANT" || !system.restaurantLink) {
      return NextResponse.json({ ok: false, error: "Restaurant not found." }, { status: 404 });
    }

    assertRestaurantPlatformRowAccess(identity, AccessAction.CREATE, system.clientId);

    if (system.restaurantLink.provisioningState === "PROVISIONED") {
      return NextResponse.json({ ok: false, error: "This restaurant has already been provisioned." }, { status: 409 });
    }

    const payload = system.restaurantLink.provisioningPayload as unknown as ProvisioningPayload | null;
    if (!payload) {
      return NextResponse.json({ ok: false, error: "No stored provisioning payload to retry." }, { status: 409 });
    }

    const outcome = await attemptRemoteProvisioning({
      linkId: system.restaurantLink.id,
      managedSystemId: system.id,
      requestId: system.restaurantLink.provisioningRequestId,
      payload,
      actorId: identity.admin.id,
    });

    if (!outcome.ok) {
      return NextResponse.json({ ok: false, error: outcome.error, code: outcome.code, retryable: outcome.retryable }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      restaurantId: outcome.restaurantId,
      restaurantName: outcome.restaurantName,
      restaurantSlug: outcome.restaurantSlug,
      inviteLink: outcome.inviteLink,
    });
  } catch (error) {
    console.error("[admin/restaurant-platform/restaurants/[id]/retry:POST]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
