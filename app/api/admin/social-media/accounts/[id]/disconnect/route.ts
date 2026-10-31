import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertSocialMediaRowAccess, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { SocialAccountStatus } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   POST /api/admin/social-media/accounts/[id]/disconnect

   Clears the stored tokens (never leave a revoked/disconnected account
   holding a usable credential) and marks the row DISCONNECTED. Real
   provider-side token revocation is platform-specific (e.g. Meta's
   DELETE /me/permissions, Google's revoke endpoint) and is not yet
   implemented here — flagged as a follow-up, not silently skipped.
============================================================================ */

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.MANAGE);
    const { id } = await params;

    const account = await prisma.socialAccount.findUnique({
      where: { id },
      select: { id: true, clientId: true },
    });
    if (!account) {
      return NextResponse.json({ ok: false, error: "Account could not be found." }, { status: 404 });
    }

    assertSocialMediaRowAccess(identity, AccessAction.MANAGE, { createdById: null, clientId: account.clientId });

    await prisma.socialAccount.update({
      where: { id },
      data: {
        status: SocialAccountStatus.DISCONNECTED,
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
        disconnectedAt: new Date(),
      },
    });

    // An account that shares this one's OAuth grant (e.g. a LinkedIn
    // company page sharing a personal connection's token — see
    // sharesAuthWithId) can't function once its credential source is
    // gone. Disconnecting it here too keeps its CONNECTED status honest
    // rather than leaving it looking usable when it silently isn't.
    const dependents = await prisma.socialAccount.findMany({
      where: { sharesAuthWithId: id, status: SocialAccountStatus.CONNECTED },
      select: { id: true },
    });
    if (dependents.length > 0) {
      await prisma.socialAccount.updateMany({
        where: { id: { in: dependents.map((dependent) => dependent.id) } },
        data: { status: SocialAccountStatus.DISCONNECTED, disconnectedAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true, disconnectedDependentIds: dependents.map((dependent) => dependent.id) });
  } catch (error) {
    console.error("[admin/social-media/accounts/:id/disconnect]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
