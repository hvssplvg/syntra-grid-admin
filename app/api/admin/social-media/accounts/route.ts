import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { isPlatformConfigured, PLATFORM_CONFIG, requiredEnvVarsFor } from "@/lib/social-media/accounts";
import { SocialPlatform } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCOUNT_SELECT = {
  id: true,
  platform: true,
  accountName: true,
  username: true,
  profileImageUrl: true,
  status: true,
  connectedAt: true,
  lastSyncedAt: true,
  lastError: true,
  disconnectedAt: true,
} as const;

/* ============================================================================
   GET /api/admin/social-media/accounts

   Returns every connected account, plus a row for every platform that
   has NO connected account yet — annotated with whether it's genuinely
   OAuth-configured on this server or needs setup. Never reports a
   platform as connected without a real SocialAccount row.
============================================================================ */

export async function GET() {
  try {
    await requireSocialMediaPermission(AccessAction.VIEW);

    const accounts = await prisma.socialAccount.findMany({
      select: ACCOUNT_SELECT,
      orderBy: { createdAt: "asc" },
    });

    const platforms = Object.values(SocialPlatform).map((platform) => ({
      platform,
      label: PLATFORM_CONFIG[platform].label,
      configured: isPlatformConfigured(platform),
      requiredEnvVars: isPlatformConfigured(platform) ? [] : requiredEnvVarsFor(platform),
      accounts: accounts.filter((account) => account.platform === platform),
    }));

    return NextResponse.json({ ok: true, platforms });
  } catch (error) {
    console.error("[admin/social-media/accounts]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
