import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { generateTrendAnalysis } from "@/lib/ai/generateTrendAnalysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/social-media/ai/analyze-trend

   Same permission boundary as the other Content Studio AI routes
   (AccessAction.CREATE) — see lib/ai/generateTrendAnalysis.ts for the
   orchestration. Re-running analysis for an already-analyzed trend is
   a no-op (returns the stored analysis) unless the body sets
   force:true — this IS the cache, no separate TTL store needed.
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const result = await generateTrendAnalysis(identity.admin.id, body);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, missingEnvVars: result.missingEnvVars },
        { status: result.status },
      );
    }

    return NextResponse.json({ ok: true, trend: result.trend });
  } catch (error) {
    console.error("[admin/social-media/ai/analyze-trend]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
