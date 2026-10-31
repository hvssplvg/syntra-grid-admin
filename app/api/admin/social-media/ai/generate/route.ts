import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { generateAiText } from "@/lib/ai/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/social-media/ai/generate

   Same permission boundary as creating a post (AccessAction.CREATE) —
   generating/improving a caption is part of the content-creation
   workflow, not a separate concept. See lib/ai/generate.ts for the
   actual orchestration (validation, configuration check, rate limit,
   brand+platform-aware prompt, provider call).
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const result = await generateAiText(identity.admin.id, body);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, missingEnvVars: result.missingEnvVars },
        { status: result.status },
      );
    }

    return NextResponse.json({ ok: true, text: result.text });
  } catch (error) {
    console.error("[admin/social-media/ai/generate]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
