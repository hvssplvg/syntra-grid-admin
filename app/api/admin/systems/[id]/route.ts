import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertSystemsRowAccess, requireSystemsPermission } from "@/lib/systems/permissions";
import { getManagedSystemDetail } from "@/lib/systems/server";
import { cleanDisplayUrl, InvalidDisplayUrlError } from "@/lib/validation/url";
import { ManagedSystemLifecycleStatus, ManagedSystemType } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireSystemsPermission(AccessAction.VIEW);
    const { id } = await params;

    const system = await getManagedSystemDetail(id);
    if (!system) {
      return NextResponse.json({ ok: false, error: "That system could not be found." }, { status: 404 });
    }

    assertSystemsRowAccess(identity, AccessAction.VIEW, system.clientId);

    return NextResponse.json({ ok: true, system });
  } catch (error) {
    console.error("[admin/systems/:id:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireSystemsPermission(AccessAction.EDIT);
    const { id } = await params;

    const existing = await prisma.managedSystem.findUnique({ where: { id }, select: { id: true, clientId: true } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "That system could not be found." }, { status: 404 });
    }

    assertSystemsRowAccess(identity, AccessAction.EDIT, existing.clientId);

    const body = await request.json().catch(() => null);

    let productionUrl: string | null | undefined;
    let stagingUrl: string | null | undefined;
    let repositoryUrl: string | null | undefined;
    try {
      if (body && "productionUrl" in body) productionUrl = cleanDisplayUrl(body.productionUrl, "productionUrl");
      if (body && "stagingUrl" in body) stagingUrl = cleanDisplayUrl(body.stagingUrl, "stagingUrl");
      if (body && "repositoryUrl" in body) repositoryUrl = cleanDisplayUrl(body.repositoryUrl, "repositoryUrl");
    } catch (error) {
      if (error instanceof InvalidDisplayUrlError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
      throw error;
    }

    const lifecycleStatusRaw = typeof body?.lifecycleStatus === "string" ? body.lifecycleStatus : null;
    const systemTypeRaw = typeof body?.systemType === "string" ? body.systemType : null;

    const system = await prisma.managedSystem.update({
      where: { id },
      data: {
        ...(cleanString(body?.name) ? { name: cleanString(body.name)! } : {}),
        ...(body && "description" in body ? { description: cleanString(body.description) } : {}),
        ...(systemTypeRaw && Object.values(ManagedSystemType).includes(systemTypeRaw as ManagedSystemType) ? { systemType: systemTypeRaw as ManagedSystemType } : {}),
        ...(lifecycleStatusRaw && Object.values(ManagedSystemLifecycleStatus).includes(lifecycleStatusRaw as ManagedSystemLifecycleStatus)
          ? { lifecycleStatus: lifecycleStatusRaw as ManagedSystemLifecycleStatus }
          : {}),
        ...(body && "hostingProvider" in body ? { hostingProvider: cleanString(body.hostingProvider) } : {}),
        ...(productionUrl !== undefined ? { productionUrl } : {}),
        ...(stagingUrl !== undefined ? { stagingUrl } : {}),
        ...(repositoryUrl !== undefined ? { repositoryUrl } : {}),
        ...(Array.isArray(body?.techStack)
          ? { techStack: body.techStack.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0).map((item: string) => item.trim()) }
          : {}),
      },
    });

    return NextResponse.json({ ok: true, system });
  } catch (error) {
    console.error("[admin/systems/:id:PATCH]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireSystemsPermission(AccessAction.DELETE);
    const { id } = await params;

    const existing = await prisma.managedSystem.findUnique({ where: { id }, select: { id: true, clientId: true } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "That system could not be found." }, { status: 404 });
    }

    assertSystemsRowAccess(identity, AccessAction.DELETE, existing.clientId);

    await prisma.managedSystem.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/systems/:id:DELETE]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
