import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertClientHealthRowAccess, requireClientHealthPermission } from "@/lib/client-health/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/client-health/incidents/[id]/resolve

   Manual resolution by staff — distinct from the monitoring poller's own
   auto-resolve-on-next-healthy-check (lib/monitoring/runDueHealthChecks.ts),
   needed for incidents that were never monitoring-driven in the first
   place (e.g. none exist from that category in this pass, but the
   action is generic) and for closing out a monitoring incident early.
============================================================================ */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireClientHealthPermission(AccessAction.MANAGE);
    const { id } = await params;

    const incident = await prisma.incident.findUnique({ where: { id }, select: { id: true, resolved: true, clientId: true } });
    if (!incident) {
      return NextResponse.json({ ok: false, error: "That incident could not be found." }, { status: 404 });
    }

    assertClientHealthRowAccess(identity, AccessAction.MANAGE, incident.clientId);

    if (incident.resolved) {
      return NextResponse.json({ ok: false, error: "This incident is already resolved." }, { status: 400 });
    }

    const updated = await prisma.incident.update({
      where: { id },
      data: { resolved: true, resolvedAt: new Date(), status: "RESOLVED" },
    });

    return NextResponse.json({ ok: true, incident: updated });
  } catch (error) {
    console.error("[admin/client-health/incidents/:id/resolve]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
