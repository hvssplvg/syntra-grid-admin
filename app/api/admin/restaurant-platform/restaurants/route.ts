import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import {
  AccessAction,
  assertRestaurantPlatformRowAccess,
  requireRestaurantPlatformPermission,
  restaurantPlatformClientScopeFilter,
} from "@/lib/restaurant-platform/permissions";
import { attemptRemoteProvisioning, type ProvisioningPayload } from "@/lib/restaurant-platform/provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
  return cleaned.length > 0 ? cleaned : undefined;
}

/* ============================================================================
   GET /api/admin/restaurant-platform/restaurants?clientId=

   Local-only listing — name, client, and provisioning state come from
   this database. Live remote status (ACTIVE/SUSPENDED/ARCHIVED) is not
   re-fetched per row here (that would be one HTTP call per restaurant on
   every render); restaurantLink.remoteStatus is a cache refreshed on
   Detail view and on any status change, so it may be briefly stale here.
============================================================================ */
export async function GET(request: NextRequest) {
  try {
    const identity = await requireRestaurantPlatformPermission(AccessAction.VIEW);
    const clientIdIn = restaurantPlatformClientScopeFilter(identity, AccessAction.VIEW);

    const params = request.nextUrl.searchParams;
    const requestedClientId = params.get("clientId")?.trim() || undefined;

    const systems = await prisma.managedSystem.findMany({
      where: {
        systemType: "RESTAURANT_TENANT",
        ...(requestedClientId ? { clientId: requestedClientId } : {}),
        ...(clientIdIn ?? {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, displayName: true, logoUrl: true } },
        restaurantLink: true,
      },
    });

    const items = systems.map((system) => ({
      id: system.id,
      name: system.name,
      createdAt: system.createdAt,
      client: system.client,
      provisioningState: system.restaurantLink?.provisioningState ?? "PENDING",
      provisioningError: system.restaurantLink?.provisioningError ?? null,
      remoteStatus: system.restaurantLink?.remoteStatus ?? null,
      externalSlug: system.restaurantLink?.externalSlug ?? null,
    }));

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[admin/restaurant-platform/restaurants:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}

/* ============================================================================
   POST /api/admin/restaurant-platform/restaurants
   body: { name, ownerEmail, contactEmail?, phone?, address?, city?,
           country?, currency, timezone, logoUrl?, coverImageUrl?,
           primaryColor?, secondaryColor?, disabledModuleKeys?: string[],
           clientId?, newClient?: { name, slug? } }

   The local Client (if new) + ManagedSystem + RestaurantLink are created
   in one transaction and committed BEFORE the remote call — so a crash
   or a rejected/ambiguous remote response never loses the local record
   of "a provisioning attempt with this requestId was started"; it is
   simply left PENDING or FAILED (see
   lib/restaurant-platform/provisioning.ts) for the retry endpoint.
============================================================================ */
export async function POST(request: NextRequest) {
  try {
    const identity = await requireRestaurantPlatformPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const name = cleanString(body?.name);
    const ownerEmail = cleanString(body?.ownerEmail);
    const currency = cleanString(body?.currency);
    const timezone = cleanString(body?.timezone);

    if (!name) return NextResponse.json({ ok: false, error: "name is required." }, { status: 400 });
    if (!ownerEmail) return NextResponse.json({ ok: false, error: "ownerEmail is required." }, { status: 400 });
    if (!currency) return NextResponse.json({ ok: false, error: "currency is required." }, { status: 400 });
    if (!timezone) return NextResponse.json({ ok: false, error: "timezone is required." }, { status: 400 });

    const existingClientId = cleanString(body?.clientId);
    const newClientName = cleanString(body?.newClient?.name);

    if (existingClientId) {
      const client = await prisma.client.findUnique({ where: { id: existingClientId }, select: { id: true } });
      if (!client) return NextResponse.json({ ok: false, error: "That client could not be found." }, { status: 404 });
      assertRestaurantPlatformRowAccess(identity, AccessAction.CREATE, existingClientId);
    } else if (newClientName) {
      assertRestaurantPlatformRowAccess(identity, AccessAction.CREATE, null);
    }

    const payload: ProvisioningPayload = {
      name,
      ownerEmail,
      currency,
      timezone,
      contactEmail: cleanString(body?.contactEmail) ?? undefined,
      phone: cleanString(body?.phone) ?? undefined,
      address: cleanString(body?.address) ?? undefined,
      city: cleanString(body?.city) ?? undefined,
      country: cleanString(body?.country) ?? undefined,
      logoUrl: cleanString(body?.logoUrl) ?? undefined,
      coverImageUrl: cleanString(body?.coverImageUrl) ?? undefined,
      primaryColor: cleanString(body?.primaryColor) ?? undefined,
      secondaryColor: cleanString(body?.secondaryColor) ?? undefined,
      disabledModuleKeys: cleanStringArray(body?.disabledModuleKeys),
      dashboardTheme: cleanString(body?.dashboardTheme) ?? undefined,
    };

    const requestId = crypto.randomUUID();

    const { system, link, clientId } = await prisma.$transaction(async (tx) => {
      let clientId: string | null = existingClientId;

      if (!clientId && newClientName) {
        const slugBase = newClientName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const client = await tx.client.create({
          data: { name: newClientName, slug: slugBase || crypto.randomUUID() },
        });
        clientId = client.id;
      }

      const system = await tx.managedSystem.create({
        data: {
          clientId,
          name: `${name} (Restaurant)`,
          systemType: "RESTAURANT_TENANT",
          createdById: identity.admin.id,
        },
      });

      const link = await tx.restaurantLink.create({
        data: {
          managedSystemId: system.id,
          provisioningRequestId: requestId,
          provisioningPayload: payload,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: identity.admin.id,
          action: "RESTAURANT_PLATFORM_CREATE_STARTED",
          entityType: "ManagedSystem",
          entityId: system.id,
          clientId,
          metadata: { requestId, name },
        },
      });

      return { system, link, clientId };
    });

    const outcome = await attemptRemoteProvisioning({
      linkId: link.id,
      managedSystemId: system.id,
      requestId,
      payload,
      actorId: identity.admin.id,
    });

    if (!outcome.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: outcome.error,
          code: outcome.code,
          retryable: outcome.retryable,
          managedSystemId: system.id,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        managedSystemId: system.id,
        clientId,
        restaurantId: outcome.restaurantId,
        restaurantName: outcome.restaurantName,
        restaurantSlug: outcome.restaurantSlug,
        inviteLink: outcome.inviteLink,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[admin/restaurant-platform/restaurants:POST]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
