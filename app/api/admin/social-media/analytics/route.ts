import { NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { getAnalyticsSummary } from "@/lib/social-media/server";
import { prisma } from "@/lib/prisma";
import { SocialAccountStatus } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/social-media/analytics

   Real aggregates only. hasMetrics is false until a real provider sync
   writes at least one SocialPostMetric row — the UI must show "No
   analytics available yet" in that case, never a fabricated number.
============================================================================ */

export async function GET() {
  try {
    await requireSocialMediaPermission(AccessAction.VIEW);

    const [summary, connectedAccounts] = await Promise.all([
      getAnalyticsSummary(),
      prisma.socialAccount.count({ where: { status: SocialAccountStatus.CONNECTED } }),
    ]);

    return NextResponse.json({ ok: true, ...summary, connectedAccounts });
  } catch (error) {
    console.error("[admin/social-media/analytics]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
