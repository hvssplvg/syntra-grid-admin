import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { requestBrandRequestChanges } from "@/lib/brand-assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.APPROVE);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    if (typeof body.notes !== "string" || !body.notes.trim()) {
      return NextResponse.json({ ok: false, error: "Notes are required when requesting changes." }, { status: 400 });
    }

    const request_ = await requestBrandRequestChanges(identity, id, body.notes.trim());
    return NextResponse.json({ ok: true, request: request_ });
  } catch (error) {
    console.error("[admin/brand-assets/requests/:id/request-changes]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
