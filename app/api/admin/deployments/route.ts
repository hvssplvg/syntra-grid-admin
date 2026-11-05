import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertDeploymentsRowAccess, deploymentsClientScopeFilter, requireDeploymentsPermission } from "@/lib/deployments/permissions";
import { DEPLOYMENT_STATUSES, listDeployments, recordDeployment, type DeploymentStatus } from "@/lib/deployments/server";
import { cleanDisplayUrl, InvalidDisplayUrlError } from "@/lib/validation/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/* ============================================================================
   GET /api/admin/deployments?projectId=&clientId=&status=&environment=
============================================================================ */
export async function GET(request: NextRequest) {
  try {
    const identity = await requireDeploymentsPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;
    const clientIdIn = deploymentsClientScopeFilter(identity, AccessAction.VIEW);

    const items = await listDeployments({
      projectId: params.get("projectId")?.trim() || undefined,
      clientId: params.get("clientId")?.trim() || undefined,
      allowedClientIds: clientIdIn?.in,
      status: params.get("status")?.trim() || undefined,
      environment: params.get("environment")?.trim() || undefined,
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[admin/deployments:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}

/* ============================================================================
   POST /api/admin/deployments
   body: { projectId, provider?, environment?, status, branch?, commitHash?,
           commitTitle?, deploymentUrl?, startedAt?, finishedAt? }

   The first-ever write call site for this model, confirmed unused for
   writes anywhere in the app before this. Pure record-keeping — this
   route has no ability to trigger a real deployment, it only records
   that an admin is telling it one happened. On status === "FAILED",
   opens exactly one Incident (dedupeKey keyed to this deployment row).
============================================================================ */
export async function POST(request: NextRequest) {
  try {
    const identity = await requireDeploymentsPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const projectId = cleanString(body?.projectId);
    const status = typeof body?.status === "string" ? body.status : null;

    if (!projectId) {
      return NextResponse.json({ ok: false, error: "projectId is required." }, { status: 400 });
    }
    if (!status || !DEPLOYMENT_STATUSES.includes(status as DeploymentStatus)) {
      return NextResponse.json({ ok: false, error: `status must be one of: ${DEPLOYMENT_STATUSES.join(", ")}.` }, { status: 400 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, clientId: true } });
    if (!project) {
      return NextResponse.json({ ok: false, error: "That project could not be found." }, { status: 404 });
    }

    assertDeploymentsRowAccess(identity, AccessAction.CREATE, project.clientId);

    let deploymentUrl: string | null;
    try {
      deploymentUrl = cleanDisplayUrl(body?.deploymentUrl, "deploymentUrl");
    } catch (error) {
      if (error instanceof InvalidDisplayUrlError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
      throw error;
    }

    const deployment = await recordDeployment(
      {
        projectId,
        provider: cleanString(body?.provider),
        environment: cleanString(body?.environment),
        status: status as DeploymentStatus,
        branch: cleanString(body?.branch),
        commitHash: cleanString(body?.commitHash),
        commitTitle: cleanString(body?.commitTitle),
        deploymentUrl,
        startedAt: parseOptionalDate(body?.startedAt),
        finishedAt: parseOptionalDate(body?.finishedAt),
      },
      project.clientId,
    );

    return NextResponse.json({ ok: true, deployment }, { status: 201 });
  } catch (error) {
    console.error("[admin/deployments:POST]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
