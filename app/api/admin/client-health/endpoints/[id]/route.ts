import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireClientHealthPermission } from "@/lib/client-health/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   DELETE /api/admin/client-health/endpoints/[id]

   Stops monitoring a URL. Cascades to its HealthCheck/Incident rows
   (onDelete: Cascade on both relations — see MonitoredEndpoint in
   prisma/schema.prisma) so no orphaned check history is left behind.
============================================================================ */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireClientHealthPermission(AccessAction.MANAGE);
    const { id } = await params;

    const endpoint = await prisma.monitoredEndpoint.findUnique({ where: { id }, select: { id: true } });
    if (!endpoint) {
      return NextResponse.json({ ok: false, error: "That monitored endpoint could not be found." }, { status: 404 });
    }

    await prisma.monitoredEndpoint.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/client-health/endpoints/:id:DELETE]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
