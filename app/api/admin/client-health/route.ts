import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireClientHealthPermission } from "@/lib/client-health/permissions";
import { listClientHealth } from "@/lib/client-health/server";
import { ClientPriority } from "@/app/generated/prisma/enums";
import type { ClientHealthStatus, HealthDimension } from "@/lib/client-health/compute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ClientHealthStatus[] = ["HEALTHY", "NEEDS_ATTENTION", "AT_RISK", "UNKNOWN"];
const DIMENSIONS: HealthDimension[] = ["monitoring", "support", "delivery", "commercial"];

/* ============================================================================
   GET /api/admin/client-health?status=&search=&dimension=&priority=&clientId=

   Feeds the Client Health overview. Health is computed fresh from real
   rows on every call (lib/client-health/compute.ts) — never a stored,
   potentially-stale value. clientId is an optional convenience narrow
   (e.g. the header's client-context switcher) — never a security
   boundary; see listClientHealth's own doc comment.
============================================================================ */
export async function GET(request: NextRequest) {
  try {
    await requireClientHealthPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;
    const statusParam = params.get("status");
    const dimensionParam = params.get("dimension");
    const priorityParam = params.get("priority");

    const items = await listClientHealth({
      status: statusParam && STATUSES.includes(statusParam as ClientHealthStatus) ? (statusParam as ClientHealthStatus) : undefined,
      dimension: dimensionParam && DIMENSIONS.includes(dimensionParam as HealthDimension) ? (dimensionParam as HealthDimension) : undefined,
      priority: priorityParam && Object.values(ClientPriority).includes(priorityParam as ClientPriority) ? (priorityParam as ClientPriority) : undefined,
      search: params.get("search")?.trim() || undefined,
      clientId: params.get("clientId")?.trim() || undefined,
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[admin/client-health]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
