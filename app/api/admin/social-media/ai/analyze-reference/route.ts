import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { analyzeReferenceImage } from "@/lib/ai/analyzeReferenceImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/social-media/ai/analyze-reference

   Describes an admin-uploaded, authorised reference image (layout,
   colour treatment, subject arrangement, typography, creative/meme
   format) so Generate Graphic/Video can be grounded in a real visual
   reference rather than title/description guesswork alone. Text-tier
   cost (no image-generation spend here) — same permission boundary as
   every other Content Studio AI route.
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const result = await analyzeReferenceImage(identity.admin.id, body);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, missingEnvVars: result.missingEnvVars }, { status: result.status });
    }

    return NextResponse.json({ ok: true, analysis: result.analysis });
  } catch (error) {
    console.error("[admin/social-media/ai/analyze-reference]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
