import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { reviseGraphicImage } from "@/lib/ai/generateGraphicImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/social-media/ai/revise-graphic-image

   "Request revisions" on an image the admin has already generated but
   not yet added to the canvas (see GraphicWorkspace.tsx — the current
   preview's base64 is kept in memory and sent back here, never
   re-fetched from a URL). Calls OpenAI's /v1/images/edits. Same
   configured-check/rate-limit/daily-cap enforcement as generation,
   against the separate "revisions per day" limit.
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);
    const result = await reviseGraphicImage(identity.admin.id, body);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, missingEnvVars: result.missingEnvVars }, { status: result.status });
    }

    return NextResponse.json({ ok: true, base64: result.base64, mimeType: result.mimeType, usage: result.usage });
  } catch (error) {
    console.error("[admin/social-media/ai/revise-graphic-image]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
