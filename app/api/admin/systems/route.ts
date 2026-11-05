import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertSystemsRowAccess, requireSystemsPermission, systemsClientScopeFilter } from "@/lib/systems/permissions";
import { listManagedSystems } from "@/lib/systems/server";
import { cleanDisplayUrl, InvalidDisplayUrlError } from "@/lib/validation/url";
import { ManagedSystemLifecycleStatus, ManagedSystemType } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 160;

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/* ============================================================================
   GET /api/admin/systems?clientId=&systemType=&lifecycleStatus=&search=

   Company-wide (no clientId) shows every system this identity may see —
   for a CLIENT-scoped restricted employee that's exactly their assigned
   clients' systems, never Syntra Grid's own (clientId: null) ones, and
   never another client's. clientId here is a convenience narrow, same as
   Client Health's own list route — the real boundary is
   systemsClientScopeFilter/assertSystemsRowAccess below.
============================================================================ */
export async function GET(request: NextRequest) {
  try {
    const identity = await requireSystemsPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;
    const systemTypeParam = params.get("systemType");
    const lifecycleStatusParam = params.get("lifecycleStatus");

    const clientIdIn = systemsClientScopeFilter(identity, AccessAction.VIEW);

    const items = await listManagedSystems({
      clientId: params.get("clientId")?.trim() || undefined,
      allowedClientIds: clientIdIn?.in,
      systemType: systemTypeParam && Object.values(ManagedSystemType).includes(systemTypeParam as ManagedSystemType) ? (systemTypeParam as ManagedSystemType) : undefined,
      lifecycleStatus:
        lifecycleStatusParam && Object.values(ManagedSystemLifecycleStatus).includes(lifecycleStatusParam as ManagedSystemLifecycleStatus)
          ? (lifecycleStatusParam as ManagedSystemLifecycleStatus)
          : undefined,
      search: params.get("search")?.trim() || undefined,
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[admin/systems:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}

/* ============================================================================
   POST /api/admin/systems
   body: { clientId: string|null, projectId?, name, description?, systemType,
           lifecycleStatus?, hostingProvider?, repositoryUrl?, techStack?,
           productionUrl?, stagingUrl? }

   clientId: null means this is Syntra Grid's own internal system (see
   ManagedSystem's doc comment in prisma/schema.prisma) — not a fake
   Client row. A restricted CLIENT-scoped admin can never create one
   (assertSystemsRowAccess denies null clientId for CLIENT scope, same as
   every other row-ownership check in this app).
============================================================================ */
export async function POST(request: NextRequest) {
  try {
    const identity = await requireSystemsPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const clientId = body && "clientId" in body && body.clientId !== null ? cleanString(body.clientId) : null;
    const projectId = cleanString(body?.projectId);
    const name = cleanString(body?.name);
    const systemType = typeof body?.systemType === "string" ? body.systemType : null;

    if (!name) {
      return NextResponse.json({ ok: false, error: "name is required." }, { status: 400 });
    }
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ ok: false, error: "name is too long." }, { status: 400 });
    }
    if (!systemType || !Object.values(ManagedSystemType).includes(systemType as ManagedSystemType)) {
      return NextResponse.json({ ok: false, error: "A valid systemType is required." }, { status: 400 });
    }

    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) {
        return NextResponse.json({ ok: false, error: "That client could not be found." }, { status: 404 });
      }
    }

    assertSystemsRowAccess(identity, AccessAction.CREATE, clientId);

    if (projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, clientId: true } });
      if (!project || project.clientId !== clientId) {
        return NextResponse.json({ ok: false, error: "That project does not belong to this client." }, { status: 400 });
      }
    }

    const lifecycleStatusRaw = typeof body?.lifecycleStatus === "string" ? body.lifecycleStatus : null;
    const lifecycleStatus =
      lifecycleStatusRaw && Object.values(ManagedSystemLifecycleStatus).includes(lifecycleStatusRaw as ManagedSystemLifecycleStatus)
        ? (lifecycleStatusRaw as ManagedSystemLifecycleStatus)
        : undefined;

    let productionUrl: string | null;
    let stagingUrl: string | null;
    let repositoryUrl: string | null;
    try {
      productionUrl = cleanDisplayUrl(body?.productionUrl, "productionUrl");
      stagingUrl = cleanDisplayUrl(body?.stagingUrl, "stagingUrl");
      repositoryUrl = cleanDisplayUrl(body?.repositoryUrl, "repositoryUrl");
    } catch (error) {
      if (error instanceof InvalidDisplayUrlError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
      throw error;
    }

    const techStack = Array.isArray(body?.techStack) ? body.techStack.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0).map((item: string) => item.trim()) : [];

    const system = await prisma.managedSystem.create({
      data: {
        clientId,
        projectId,
        name,
        description: cleanString(body?.description),
        systemType: systemType as ManagedSystemType,
        lifecycleStatus,
        hostingProvider: cleanString(body?.hostingProvider),
        repositoryUrl,
        techStack,
        productionUrl,
        stagingUrl,
        createdById: identity.admin.id,
      },
    });

    return NextResponse.json({ ok: true, system }, { status: 201 });
  } catch (error) {
    console.error("[admin/systems:POST]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
