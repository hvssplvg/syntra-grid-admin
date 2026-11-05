import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertClientHealthRowAccess, requireClientHealthPermission } from "@/lib/client-health/permissions";
import { performMonitoringCheck } from "@/lib/monitoring/safeFetch";
import { applyHealthCheckResult } from "@/lib/monitoring/applyHealthCheckResult";
import { checkNowRateLimit } from "@/lib/monitoring/checkNowRateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Longer than safeFetch's own request timeout (10s) plus margin — mirrors
 *  runDueHealthChecks.ts's STALE_LOCK_MS so the cron and this route agree
 *  on when a lock is stale rather than genuinely in-flight. */
const STALE_LOCK_MS = 20_000;

/** A manual re-check sooner than this since the endpoint's last recorded
 *  result is rejected — prevents several admins/tabs from hammering one
 *  third-party target. Deliberately short: this is a human-triggered
 *  action, not the scheduled poller, so it doesn't need the same 5-minute
 *  floor as checkIntervalMinutes. */
const MIN_SECONDS_SINCE_LAST_CHECK = 30;

/* ============================================================================
   POST /api/admin/client-health/endpoints/[id]/check-now

   Manual, on-demand version of what runDueHealthChecks.ts does for one
   endpoint — same SSRF-safe checker, same shared incident logic, same
   checkInProgressAt lock (so this and the daily cron can never race the
   same endpoint), plus its own rate limiting since a human can click it
   repeatedly in a way a cron schedule never would.
============================================================================ */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let lockHeld = false;
  let endpointId: string | null = null;

  try {
    const identity = await requireClientHealthPermission(AccessAction.MANAGE);
    const { id } = await params;
    endpointId = id;

    const endpoint = await prisma.monitoredEndpoint.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        projectId: true,
        label: true,
        url: true,
        method: true,
        consecutiveFailureCount: true,
        consecutiveFailureThreshold: true,
        checkInProgressAt: true,
        healthChecks: { orderBy: { checkedAt: "desc" }, take: 1, select: { checkedAt: true } },
      },
    });

    if (!endpoint) {
      return NextResponse.json({ ok: false, error: "That monitored endpoint could not be found." }, { status: 404 });
    }

    assertClientHealthRowAccess(identity, AccessAction.MANAGE, endpoint.clientId);

    const rateLimit = checkNowRateLimit(identity.admin.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many manual checks requested. Please wait a moment and try again." },
        { status: 429 },
      );
    }

    const lastCheckedAt = endpoint.healthChecks[0]?.checkedAt ?? null;
    if (lastCheckedAt && Date.now() - lastCheckedAt.getTime() < MIN_SECONDS_SINCE_LAST_CHECK * 1000) {
      return NextResponse.json(
        { ok: false, error: `This endpoint was checked less than ${MIN_SECONDS_SINCE_LAST_CHECK} seconds ago. Please wait before checking again.` },
        { status: 429 },
      );
    }

    const lock = await prisma.monitoredEndpoint.updateMany({
      where: {
        id: endpoint.id,
        OR: [{ checkInProgressAt: null }, { checkInProgressAt: { lt: new Date(Date.now() - STALE_LOCK_MS) } }],
      },
      data: { checkInProgressAt: new Date() },
    });

    if (lock.count === 0) {
      return NextResponse.json({ ok: false, error: "A check is already in progress for this endpoint." }, { status: 409 });
    }
    lockHeld = true;

    const check = await performMonitoringCheck(endpoint.url, {
      method: endpoint.method === "HEAD" ? "HEAD" : "GET",
    });

    const outcome = await applyHealthCheckResult(
      {
        id: endpoint.id,
        clientId: endpoint.clientId,
        projectId: endpoint.projectId,
        label: endpoint.label,
        consecutiveFailureCount: endpoint.consecutiveFailureCount,
        consecutiveFailureThreshold: endpoint.consecutiveFailureThreshold,
      },
      check,
      { trigger: "manual", triggeredBy: identity.admin.id },
    );

    return NextResponse.json({ ok: true, check, incidentAction: outcome.incidentAction });
  } catch (error) {
    console.error("[admin/client-health/endpoints/:id/check-now:POST]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  } finally {
    if (lockHeld && endpointId) {
      await prisma.monitoredEndpoint.update({ where: { id: endpointId }, data: { checkInProgressAt: null } }).catch((error) => {
        console.error("[admin/client-health/endpoints/:id/check-now:POST] failed to release lock", error);
      });
    }
  }
}
