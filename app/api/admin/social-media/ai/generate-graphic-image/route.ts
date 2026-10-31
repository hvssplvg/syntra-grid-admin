import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { generateGraphicImage } from "@/lib/ai/generateGraphicImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/social-media/ai/generate-graphic-image

   "Mode A — complete AI-generated image" (Content Studio Phase D).
   Same permission boundary as every other AI route (AccessAction.
   CREATE). This is the one route in Content Studio that spends real
   money — see lib/ai/generateGraphicImage.ts / imageUsage.ts for the
   configuration check, rate limit, and per-admin daily generation/
   spend-cap enforcement that all run BEFORE the provider is ever
   called.
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const result = await generateGraphicImage(identity.admin.id, body);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, missingEnvVars: result.missingEnvVars }, { status: result.status });
    }

    return NextResponse.json({ ok: true, base64: result.base64, mimeType: result.mimeType, usage: result.usage });
  } catch (error) {
    console.error("[admin/social-media/ai/generate-graphic-image]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
