import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { SocialAccountStatus, SocialAccountType, SocialPlatform } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PendingOrgConnection = {
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  tokenExpiresAt: string | null;
  scopes: string | null;
  organizations: { id: string; urn: string; name: string }[];
};

/* ============================================================================
   POST /api/admin/social-media/accounts/linkedin/organizations
   body: { organizationId: string }

   Connects one company page using the LinkedIn Company Manager app's
   token captured moments earlier by the OAuth callback into the
   short-lived social_oauth_org_pending cookie (see callback/route.ts).
   The organizationId the client submits is NEVER trusted on its own: it
   must appear in that cookie's own organizations list — which itself
   came from a real, fresh LinkedIn discovery call tied to this exact
   token — so a client can only ever select from a server-verified set,
   never supply an arbitrary organisation id.

   The connected row holds ITS OWN token (this app's grant), never a
   token borrowed from the personal-profile app (lib/social-media/accounts.ts's
   LINKEDIN_ORGANIZATION_OAUTH_CONFIG is a wholly separate LinkedIn
   developer app from PLATFORM_CONFIG.LINKEDIN).
============================================================================ */
export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.MANAGE);

    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : null;
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: "organizationId is required." }, { status: 400 });
    }

    const raw = request.cookies.get("social_oauth_org_pending")?.value;
    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "This connection attempt has expired. Click \"Connect a company page\" again." },
        { status: 409 },
      );
    }

    const pending = JSON.parse(raw) as PendingOrgConnection;
    const match = pending.organizations.find((org) => org.id === organizationId);
    if (!match) {
      return NextResponse.json(
        { ok: false, error: "That organisation wasn't in the list from the authorisation you just completed." },
        { status: 403 },
      );
    }

    const account = await prisma.socialAccount.upsert({
      where: { platform_platformAccountId: { platform: SocialPlatform.LINKEDIN, platformAccountId: match.id } },
      update: {
        accountName: match.name,
        accountType: SocialAccountType.ORGANIZATION,
        sharesAuthWithId: null,
        status: SocialAccountStatus.CONNECTED,
        encryptedAccessToken: pending.encryptedAccessToken,
        encryptedRefreshToken: pending.encryptedRefreshToken,
        tokenExpiresAt: pending.tokenExpiresAt ? new Date(pending.tokenExpiresAt) : null,
        scopes: pending.scopes,
        connectedAt: new Date(),
        connectedById: identity.admin.id,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
      },
      create: {
        platform: SocialPlatform.LINKEDIN,
        platformAccountId: match.id,
        accountName: match.name,
        accountType: SocialAccountType.ORGANIZATION,
        sharesAuthWithId: null,
        status: SocialAccountStatus.CONNECTED,
        encryptedAccessToken: pending.encryptedAccessToken,
        encryptedRefreshToken: pending.encryptedRefreshToken,
        tokenExpiresAt: pending.tokenExpiresAt ? new Date(pending.tokenExpiresAt) : null,
        scopes: pending.scopes,
        connectedAt: new Date(),
        connectedById: identity.admin.id,
      },
      select: {
        id: true,
        platform: true,
        accountName: true,
        username: true,
        profileImageUrl: true,
        status: true,
        accountType: true,
        sharesAuthWithId: true,
        connectedAt: true,
        lastSyncedAt: true,
        lastError: true,
        disconnectedAt: true,
      },
    });

    return NextResponse.json({ ok: true, account });
  } catch (error) {
    console.error("[admin/social-media/accounts/linkedin/organizations:POST]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
