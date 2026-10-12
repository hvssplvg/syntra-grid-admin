import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { cancelBrandRequest } from "@/lib/brand-assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.APPROVE);
    const { id } = await params;
    const request_ = await cancelBrandRequest(identity, id);
    return NextResponse.json({ ok: true, request: request_ });
  } catch (error) {
    console.error("[admin/brand-assets/requests/:id/cancel]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
