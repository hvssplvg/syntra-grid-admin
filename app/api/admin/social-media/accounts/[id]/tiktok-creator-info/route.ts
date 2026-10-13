import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { getValidSocialAccessToken } from "@/lib/social-media/accounts";
import { fetchTikTokCreatorInfo, TikTokApiError } from "@/lib/social-media/publishing";
import { SocialPlatform } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/social-media/accounts/[id]/tiktok-creator-info

   Live, per-creator publish options (privacy_level_options, disabled
   interaction defaults, max video duration) — these are never hardcoded
   in the composer; they're fetched fresh here every time a TikTok
   account/video is selected, per TikTok's own Content Posting API
   requirements. An unaudited (sandbox) app's own creator_info is itself
   restricted — this route surfaces whatever TikTok actually returns,
   never a guessed/full option set.
============================================================================ */

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSocialMediaPermission(AccessAction.VIEW);
    const { id } = await params;

    const account = await prisma.socialAccount.findUnique({ where: { id } });
    if (!account) {
      return NextResponse.json({ ok: false, error: "Account could not be found." }, { status: 404 });
    }
    if (account.platform !== SocialPlatform.TIKTOK) {
      return NextResponse.json({ ok: false, error: "This account is not a TikTok account." }, { status: 400 });
    }

    let token: string;
    try {
      token = await getValidSocialAccessToken(account.id);
    } catch (error) {
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : "This TikTok account is not connected." },
        { status: 400 },
      );
    }

    const creatorInfo = await fetchTikTokCreatorInfo(token);

    return NextResponse.json({ ok: true, creatorInfo });
  } catch (error) {
    console.error("[admin/social-media/accounts/:id/tiktok-creator-info]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    if (error instanceof TikTokApiError) {
      return NextResponse.json({ ok: false, error: `TikTok rejected this request: ${error.message}` }, { status: 502 });
    }
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
