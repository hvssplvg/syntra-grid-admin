import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireClientHealthPermission } from "@/lib/client-health/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/client-health/incidents/[id]/acknowledge

   Records that an authorised admin has seen this incident — distinct
   from resolving it (the underlying problem may still be ongoing).
============================================================================ */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireClientHealthPermission(AccessAction.MANAGE);
    const { id } = await params;

    const incident = await prisma.incident.findUnique({ where: { id }, select: { id: true, resolved: true } });
    if (!incident) {
      return NextResponse.json({ ok: false, error: "That incident could not be found." }, { status: 404 });
    }
    if (incident.resolved) {
      return NextResponse.json({ ok: false, error: "This incident is already resolved." }, { status: 400 });
    }

    const updated = await prisma.incident.update({
      where: { id },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), acknowledgedById: identity.admin.id },
    });

    return NextResponse.json({ ok: true, incident: updated });
  } catch (error) {
    console.error("[admin/client-health/incidents/:id/acknowledge]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
