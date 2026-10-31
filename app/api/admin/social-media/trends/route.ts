import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { createTrend, listTrends, parseTrendListFilters, validateCreateTrendInput } from "@/lib/trends/trends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/social-media/trends]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

/* ============================================================================
   GET /api/admin/social-media/trends?platform=&type=&status=&industry=&since=
   POST /api/admin/social-media/trends

   Trends aren't owner-scoped (see lib/trends/trends.ts) — any admin
   with social_media VIEW/CREATE can list/add them, same boundary as
   SocialAccount. Manual-import is the fallback for every platform
   without a free, commercial-use-safe trending API (see
   lib/trends/youtubeDiscovery.ts's header comment).
============================================================================ */

export async function GET(request: NextRequest) {
  try {
    await requireSocialMediaPermission(AccessAction.VIEW);
    const filters = parseTrendListFilters(request.nextUrl.searchParams);
    const trends = await listTrends(filters);
    return NextResponse.json({ ok: true, trends });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);
    const body = await request.json().catch(() => null);

    const validated = validateCreateTrendInput(body);
    if ("error" in validated) return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });

    const trend = await createTrend(identity.admin.id, validated.input);
    return NextResponse.json({ ok: true, trend });
  } catch (error) {
    return errorResponse(error);
  }
}
