import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { generateAiVideoConcepts } from "@/lib/ai/generateAiVideoConcepts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/social-media/ai/ai-video-concepts

   AI Video's "3 concepts" planning step — text-only (the existing text
   provider), no video spend. Same permission boundary as every other
   Content Studio AI route.
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const result = await generateAiVideoConcepts(identity.admin.id, body);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, missingEnvVars: result.missingEnvVars }, { status: result.status });
    }

    return NextResponse.json({ ok: true, concepts: result.concepts });
  } catch (error) {
    console.error("[admin/social-media/ai/ai-video-concepts]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
