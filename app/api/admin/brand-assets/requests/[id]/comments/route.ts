import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertBrandRequestRowAccess, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { addBrandRequestComment, getBrandRequestOrThrow } from "@/lib/brand-assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.CREATE);
    const { id } = await params;

    const existing = await getBrandRequestOrThrow(id);
    assertBrandRequestRowAccess(identity, AccessAction.CREATE, { requestedById: existing.requestedById, assignedToId: existing.assignedToId });

    const body = await request.json().catch(() => ({}));
    if (typeof body.body !== "string" || !body.body.trim()) {
      return NextResponse.json({ ok: false, error: "A comment body is required." }, { status: 400 });
    }

    const request_ = await addBrandRequestComment(identity, id, body.body.trim());
    return NextResponse.json({ ok: true, request: request_ }, { status: 201 });
  } catch (error) {
    console.error("[admin/brand-assets/requests/:id/comments]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
