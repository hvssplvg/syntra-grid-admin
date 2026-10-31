import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { generateGraphicDesign } from "@/lib/ai/generateGraphicDesign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/social-media/ai/generate-graphic-design

   "Mode B — AI-designed editable graphic" (Content Studio round 3).
   Same permission boundary as the other AI routes (AccessAction.CREATE)
   — see lib/ai/generateGraphicDesign.ts for the orchestration
   (validation, configuration check, rate limit, prompt, provider call,
   strict parsing/clamping of every element before it's ever returned).
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const result = await generateGraphicDesign(identity.admin.id, body);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, missingEnvVars: result.missingEnvVars },
        { status: result.status },
      );
    }

    return NextResponse.json({ ok: true, design: result.design });
  } catch (error) {
    console.error("[admin/social-media/ai/generate-graphic-design]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
