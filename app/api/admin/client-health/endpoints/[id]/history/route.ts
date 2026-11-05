import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertClientHealthRowAccess, requireClientHealthPermission } from "@/lib/client-health/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGE_MS: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function parseRange(value: string | null): keyof typeof RANGE_MS {
  if (value === "7d" || value === "30d") return value;
  return "24h";
}

/* ============================================================================
   GET /api/admin/client-health/endpoints/[id]/history?range=24h|7d|30d

   Read-only view over existing HealthCheck rows — no new table. Uptime is
   computed strictly from the checks that actually ran in the requested
   window (never fabricated, null when there are none), and insufficientData
   flags when there isn't enough real history yet to make that number
   meaningful — the UI must caption it as observed-only, never a guarantee
   of continuous uptime (the cron that produces these rows is, at best,
   daily — see app/api/cron/health-check/route.ts).
============================================================================ */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireClientHealthPermission(AccessAction.VIEW);
    const { id } = await params;

    const endpoint = await prisma.monitoredEndpoint.findUnique({
      where: { id },
      select: { id: true, clientId: true, label: true, url: true, checkIntervalMinutes: true },
    });

    if (!endpoint) {
      return NextResponse.json({ ok: false, error: "That monitored endpoint could not be found." }, { status: 404 });
    }

    assertClientHealthRowAccess(identity, AccessAction.VIEW, endpoint.clientId);

    const range = parseRange(request.nextUrl.searchParams.get("range"));
    const since = new Date(Date.now() - RANGE_MS[range]);

    const checks = await prisma.healthCheck.findMany({
      where: { monitoredEndpointId: endpoint.id, checkedAt: { gte: since } },
      orderBy: { checkedAt: "asc" },
      select: { status: true, healthy: true, responseTimeMs: true, statusCode: true, checkedAt: true },
    });

    const totalChecks = checks.length;
    const healthyCount = checks.filter((check) => check.healthy).length;
    const uptimePercent = totalChecks > 0 ? (healthyCount / totalChecks) * 100 : null;

    // Not enough samples, or the samples we have don't even span half the
    // requested window (e.g. the endpoint was only just added) — either way
    // a percentage here would overstate how much was actually observed.
    const earliestAgeMs = totalChecks > 0 ? Date.now() - checks[0].checkedAt.getTime() : 0;
    const insufficientData = totalChecks < 3 || earliestAgeMs < RANGE_MS[range] / 2;

    return NextResponse.json({
      ok: true,
      endpoint: { id: endpoint.id, label: endpoint.label, url: endpoint.url, checkIntervalMinutes: endpoint.checkIntervalMinutes },
      range,
      checks: checks.map((check) => ({
        status: check.status,
        healthy: check.healthy,
        responseTimeMs: check.responseTimeMs,
        statusCode: check.statusCode,
        checkedAt: check.checkedAt.toISOString(),
      })),
      totalChecks,
      uptimePercent,
      insufficientData,
    });
  } catch (error) {
    console.error("[admin/client-health/endpoints/:id/history:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
