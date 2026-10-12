import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { getBrandGuideline, upsertBrandGuideline } from "@/lib/brand-assets/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/brand-assets/kits/:id/guideline]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

const TEXT_FIELDS = [
  "tagline",
  "mission",
  "vision",
  "personality",
  "toneOfVoice",
  "logoSpacingNotes",
  "minLogoSizeNotes",
  "approvedUsageNotes",
  "incorrectUsageNotes",
  "fontUsageNotes",
  "socialMediaGuidelines",
  "photographyGuidelines",
  "videoGuidelines",
  "marketingStandards",
  "emailSignatureGuidelines",
] as const;

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireBrandAssetsPermission(AccessAction.VIEW);
    const { id } = await params;
    const guideline = await getBrandGuideline(id);
    return NextResponse.json({ ok: true, guideline });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.MANAGE);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const input: Record<string, string | string[] | null> = {};

    for (const field of TEXT_FIELDS) {
      if (typeof body[field] === "string" || body[field] === null) {
        input[field] = body[field];
      }
    }

    if (Array.isArray(body.values)) {
      input.values = body.values.filter((value: unknown): value is string => typeof value === "string");
    }

    const guideline = await upsertBrandGuideline(identity, id, input);

    return NextResponse.json({ ok: true, guideline });
  } catch (error) {
    return errorResponse(error);
  }
}
