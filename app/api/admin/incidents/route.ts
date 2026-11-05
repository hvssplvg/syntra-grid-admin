import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertIncidentsRowAccess, incidentsClientScopeFilter, requireIncidentsPermission } from "@/lib/incidents/permissions";
import { createManualTechnicalIncident, listTechnicalIncidents, TECHNICAL_INCIDENT_CATEGORIES, type TechnicalIncidentCategory } from "@/lib/incidents/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANUAL_CATEGORIES: TechnicalIncidentCategory[] = ["INFRASTRUCTURE_INCIDENT", "DEPLOYMENT_FAILURE"];

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/* ============================================================================
   GET /api/admin/incidents?clientId=&category=&severity=&resolved=

   Read-only filter over the EXISTING Incident model, scoped to technical
   categories (TECHNICAL_INCIDENT_CATEGORIES) — never a second write path.
   Acknowledge/resolve still go through the existing
   app/api/admin/client-health/incidents/[id]/{acknowledge,resolve} routes,
   unchanged, so one incident keeps one lifecycle everywhere it's shown.
============================================================================ */
export async function GET(request: NextRequest) {
  try {
    const identity = await requireIncidentsPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;
    const categoryParam = params.get("category");
    const resolvedParam = params.get("resolved");

    const clientIdIn = incidentsClientScopeFilter(identity, AccessAction.VIEW);

    const items = await listTechnicalIncidents({
      clientId: params.get("clientId")?.trim() || undefined,
      allowedClientIds: clientIdIn?.in,
      category: categoryParam && TECHNICAL_INCIDENT_CATEGORIES.includes(categoryParam as TechnicalIncidentCategory) ? categoryParam : undefined,
      severity: params.get("severity")?.trim() || undefined,
      resolved: resolvedParam === "true" ? true : resolvedParam === "false" ? false : undefined,
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[admin/incidents:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}

/* ============================================================================
   POST /api/admin/incidents
   body: { title, description?, severity, category, clientId?, projectId? }

   For ad hoc infra issues with no monitored endpoint behind them.
   Monitoring-triggered incidents still only ever come from
   lib/monitoring/applyHealthCheckResult.ts — this is a separate, manual
   path, not a second way to create the same kind of incident.
============================================================================ */
export async function POST(request: NextRequest) {
  try {
    const identity = await requireIncidentsPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const title = cleanString(body?.title);
    const severity = cleanString(body?.severity);
    const category = typeof body?.category === "string" ? body.category : null;
    const clientId = cleanString(body?.clientId);
    const projectId = cleanString(body?.projectId);

    if (!title || !severity) {
      return NextResponse.json({ ok: false, error: "title and severity are required." }, { status: 400 });
    }
    if (!category || !MANUAL_CATEGORIES.includes(category as TechnicalIncidentCategory)) {
      return NextResponse.json({ ok: false, error: `category must be one of: ${MANUAL_CATEGORIES.join(", ")}.` }, { status: 400 });
    }

    assertIncidentsRowAccess(identity, AccessAction.CREATE, clientId);

    const incident = await createManualTechnicalIncident({
      title,
      description: cleanString(body?.description),
      severity,
      category: category as "INFRASTRUCTURE_INCIDENT" | "DEPLOYMENT_FAILURE",
      clientId,
      projectId,
    });

    return NextResponse.json({ ok: true, incident }, { status: 201 });
  } catch (error) {
    console.error("[admin/incidents:POST]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
