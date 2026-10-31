import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireClientHealthPermission } from "@/lib/client-health/permissions";
import { assertSafeMonitoringUrl, UnsafeUrlError } from "@/lib/monitoring/safeFetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_CHECK_INTERVAL_MINUTES = 5;
const MAX_LABEL_LENGTH = 120;

/* ============================================================================
   GET /api/admin/client-health/endpoints?clientId=...

   Lists the monitored endpoints for one client (used by the client
   detail view's "manage endpoints" panel).
============================================================================ */
export async function GET(request: NextRequest) {
  try {
    await requireClientHealthPermission(AccessAction.VIEW);

    const clientId = request.nextUrl.searchParams.get("clientId");
    if (!clientId) {
      return NextResponse.json({ ok: false, error: "clientId is required." }, { status: 400 });
    }

    const endpoints = await prisma.monitoredEndpoint.findMany({
      where: { clientId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ ok: true, endpoints });
  } catch (error) {
    console.error("[admin/client-health/endpoints:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}

/* ============================================================================
   POST /api/admin/client-health/endpoints
   body: { clientId, projectId?, label, url, method?, checkIntervalMinutes? }

   This IS the authorisation step for monitoring a URL — see
   lib/monitoring/safeFetch.ts's own doc comment and MonitoredEndpoint's
   in prisma/schema.prisma. Nothing elsewhere auto-discovers or sweeps in
   Project.productionUrl / Client.websiteUrl; a row only ever exists here
   because an authorised admin explicitly added it, and the URL is
   validated (SSRF/private-network guard) before it's ever stored.
============================================================================ */
export async function POST(request: NextRequest) {
  try {
    const identity = await requireClientHealthPermission(AccessAction.MANAGE);

    const body = await request.json().catch(() => null);
    const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : null;
    const label = typeof body?.label === "string" ? body.label.trim() : null;
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : null;
    const projectId = typeof body?.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;
    const method = body?.method === "HEAD" ? "HEAD" : "GET";

    if (!clientId || !label || !rawUrl) {
      return NextResponse.json({ ok: false, error: "clientId, label and url are required." }, { status: 400 });
    }
    if (label.length > MAX_LABEL_LENGTH) {
      return NextResponse.json({ ok: false, error: "Label is too long." }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) {
      return NextResponse.json({ ok: false, error: "That client could not be found." }, { status: 404 });
    }

    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, clientId: true } });
      if (!project || project.clientId !== clientId) {
        return NextResponse.json({ ok: false, error: "That project does not belong to this client." }, { status: 400 });
      }
    }

    let validatedUrl: URL;
    try {
      validatedUrl = await assertSafeMonitoringUrl(rawUrl);
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
      throw error;
    }

    const requestedInterval = typeof body?.checkIntervalMinutes === "number" ? body.checkIntervalMinutes : 15;
    const checkIntervalMinutes = Math.max(Math.floor(requestedInterval) || MIN_CHECK_INTERVAL_MINUTES, MIN_CHECK_INTERVAL_MINUTES);

    const endpoint = await prisma.monitoredEndpoint.create({
      data: {
        clientId,
        projectId,
        label,
        url: validatedUrl.toString(),
        method,
        checkIntervalMinutes,
        createdById: identity.admin.id,
      },
    });

    return NextResponse.json({ ok: true, endpoint }, { status: 201 });
  } catch (error) {
    console.error("[admin/client-health/endpoints:POST]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
