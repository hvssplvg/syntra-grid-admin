import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { discoverYoutubeTrends } from "@/lib/trends/discoverYoutubeTrends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/social-media/trends/discover

   Admin-triggered only — no cron job. YouTube Data API v3 is the only
   automated-discovery source in v1 (see
   lib/trends/youtubeDiscovery.ts's header comment for why).
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    await requireSocialMediaPermission(AccessAction.CREATE);
    const body = await request.json().catch(() => null);
    const result = await discoverYoutubeTrends(body);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, missingEnvVars: result.missingEnvVars }, { status: result.status });
    }

    return NextResponse.json({ ok: true, discovered: result.discovered, created: result.created, updated: result.updated });
  } catch (error) {
    console.error("[admin/social-media/trends/discover]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
