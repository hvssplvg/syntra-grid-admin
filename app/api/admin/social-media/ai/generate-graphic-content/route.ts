import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { generateGraphicContent } from "@/lib/ai/generateGraphicContent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/social-media/ai/generate-graphic-content

   Same permission boundary as the caption generator (AccessAction.CREATE)
   — see lib/ai/generateGraphicContent.ts for the orchestration
   (validation, configuration check, rate limit, brand+platform-aware
   prompt, provider call, strict JSON parsing/validation).
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const result = await generateGraphicContent(identity.admin.id, body);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, missingEnvVars: result.missingEnvVars },
        { status: result.status },
      );
    }

    return NextResponse.json({ ok: true, content: result.content });
  } catch (error) {
    console.error("[admin/social-media/ai/generate-graphic-content]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
