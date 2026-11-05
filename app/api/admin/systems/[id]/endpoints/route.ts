import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertSystemsRowAccess, requireSystemsPermission } from "@/lib/systems/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/systems/[id]/endpoints
   body: { monitoredEndpointId }

   Links an EXISTING MonitoredEndpoint (created the normal way, through
   Client Health's own endpoint-add flow — this route never creates one)
   to a system. Enforces endpoint.clientId === system.clientId: cross-
   client linking is rejected outright, and MonitoredEndpoint.clientId is
   a required (non-nullable) column, so linking any endpoint to a
   clientId: null (Syntra-Grid-internal) system is also rejected — a
   known, documented limitation (see the plan/schema doc comment), not a
   silent mismatch.
============================================================================ */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireSystemsPermission(AccessAction.EDIT);
    const { id } = await params;

    const system = await prisma.managedSystem.findUnique({ where: { id }, select: { id: true, clientId: true } });
    if (!system) {
      return NextResponse.json({ ok: false, error: "That system could not be found." }, { status: 404 });
    }

    assertSystemsRowAccess(identity, AccessAction.EDIT, system.clientId);

    const body = await request.json().catch(() => null);
    const monitoredEndpointId = typeof body?.monitoredEndpointId === "string" ? body.monitoredEndpointId.trim() : null;
    if (!monitoredEndpointId) {
      return NextResponse.json({ ok: false, error: "monitoredEndpointId is required." }, { status: 400 });
    }

    if (!system.clientId) {
      return NextResponse.json(
        { ok: false, error: "This system has no client owner, and MonitoredEndpoint.clientId is required — linking an endpoint to a Syntra-Grid-internal system isn't supported yet." },
        { status: 400 },
      );
    }

    const endpoint = await prisma.monitoredEndpoint.findUnique({ where: { id: monitoredEndpointId }, select: { id: true, clientId: true } });
    if (!endpoint) {
      return NextResponse.json({ ok: false, error: "That monitored endpoint could not be found." }, { status: 404 });
    }
    if (endpoint.clientId !== system.clientId) {
      return NextResponse.json({ ok: false, error: "That endpoint belongs to a different client than this system." }, { status: 400 });
    }

    await prisma.monitoredEndpoint.update({ where: { id: monitoredEndpointId }, data: { managedSystemId: id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/systems/:id/endpoints:POST]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
