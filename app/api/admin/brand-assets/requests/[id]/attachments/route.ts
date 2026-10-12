import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertBrandRequestRowAccess, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { addBrandRequestAttachment, getBrandRequestOrThrow } from "@/lib/brand-assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.CREATE);
    const { id } = await params;

    const existing = await getBrandRequestOrThrow(id);
    assertBrandRequestRowAccess(identity, AccessAction.CREATE, { requestedById: existing.requestedById, assignedToId: existing.assignedToId });

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file was provided." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const request_ = await addBrandRequestAttachment(identity, id, { buffer, mimeType: file.type, filename: file.name });

    return NextResponse.json({ ok: true, request: request_ }, { status: 201 });
  } catch (error) {
    console.error("[admin/brand-assets/requests/:id/attachments]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
