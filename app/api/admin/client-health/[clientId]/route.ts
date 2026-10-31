import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertClientHealthRowAccess, requireClientHealthPermission } from "@/lib/client-health/permissions";
import { getClientHealthDetail } from "@/lib/client-health/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/client-health/[clientId]

   Feeds the per-client detail view — every HealthReason alongside the
   real rows it came from (monitored endpoints + recent checks,
   incidents, tickets, projects, contracts, invoices).
============================================================================ */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const identity = await requireClientHealthPermission(AccessAction.VIEW);
    const { clientId } = await params;

    assertClientHealthRowAccess(identity, AccessAction.VIEW, clientId);

    const detail = await getClientHealthDetail(clientId);
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Client not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, detail });
  } catch (error) {
    console.error("[admin/client-health/:clientId]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
