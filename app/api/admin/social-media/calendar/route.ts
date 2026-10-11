import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { getCalendarPosts } from "@/lib/social-media/server";
import { SocialPlatform, SocialPostStatus } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseEnum<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  if (!value) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/* ============================================================================
   GET /api/admin/social-media/calendar?from=ISO&to=ISO

   Scheduled timestamps are stored and compared in UTC (Prisma DateTime);
   the client is responsible for converting its local month/week range to
   UTC `from`/`to` bounds and for rendering the returned UTC timestamps in
   whichever timezone it displays.
============================================================================ */

export async function GET(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;
    const fromRaw = params.get("from");
    const toRaw = params.get("to");

    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;

    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ ok: false, error: "Valid 'from' and 'to' query parameters are required." }, { status: 400 });
    }

    const status = parseEnum(params.get("status"), Object.values(SocialPostStatus));
    const platform = parseEnum(params.get("platform"), Object.values(SocialPlatform));
    const campaignId = params.get("campaignId");

    const posts = await getCalendarPosts(identity, { from, to, status, platform, campaignId });

    return NextResponse.json({ ok: true, posts });
  } catch (error) {
    console.error("[admin/social-media/calendar]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
