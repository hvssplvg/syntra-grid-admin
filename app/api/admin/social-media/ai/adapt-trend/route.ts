import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { generateTrendAdaptation } from "@/lib/ai/generateTrendAdaptation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/social-media/ai/adapt-trend

   The Trend Adaptation Engine — same permission boundary as the other
   Content Studio AI routes. Requires the trend to already carry an AI
   analysis (409 otherwise); the client runs analyze-trend first if
   needed. Not cached — this is business-specific and already cheap,
   see lib/ai/generateTrendAdaptation.ts.
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const result = await generateTrendAdaptation(identity.admin.id, body);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, missingEnvVars: result.missingEnvVars },
        { status: result.status },
      );
    }

    return NextResponse.json({ ok: true, adaptation: result.adaptation });
  } catch (error) {
    console.error("[admin/social-media/ai/adapt-trend]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
