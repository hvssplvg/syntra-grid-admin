import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertBrandRequestRowAccess, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { getBrandRequestOrThrow, updateBrandRequestDetails } from "@/lib/brand-assets/server";
import { BrandRequestPriority } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/brand-assets/requests/:id]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.VIEW);
    const { id } = await params;
    const existing = await getBrandRequestOrThrow(id);
    assertBrandRequestRowAccess(identity, AccessAction.VIEW, { requestedById: existing.requestedById, assignedToId: existing.assignedToId });
    return NextResponse.json({ ok: true, request: existing });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.EDIT);
    const { id } = await params;

    const existing = await getBrandRequestOrThrow(id);
    assertBrandRequestRowAccess(identity, AccessAction.EDIT, { requestedById: existing.requestedById, assignedToId: existing.assignedToId });

    const body = await request.json().catch(() => ({}));
    const dueDate = typeof body.dueDate === "string" ? new Date(body.dueDate) : body.dueDate === null ? null : undefined;

    const request_ = await updateBrandRequestDetails(id, {
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(typeof body.description === "string" ? { description: body.description } : {}),
      ...(typeof body.priority === "string" && (Object.values(BrandRequestPriority) as string[]).includes(body.priority)
        ? { priority: body.priority as BrandRequestPriority }
        : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      ...(typeof body.brandKitId === "string" || body.brandKitId === null ? { brandKitId: body.brandKitId } : {}),
    });

    return NextResponse.json({ ok: true, request: request_ });
  } catch (error) {
    return errorResponse(error);
  }
}
