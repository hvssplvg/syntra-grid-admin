import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/encryption";
import { exchangeAuthorisationCode, fetchAccountProfile } from "@/lib/social-media/accounts";
import { SocialAccountStatus, SocialPlatform } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";

const OAUTH_COOKIES = ["social_oauth_state", "social_oauth_admin", "social_oauth_platform", "social_oauth_pkce_verifier"];

function finish(socialMediaUrl: URL, status: string) {
  socialMediaUrl.searchParams.set("social", status);

  const response = NextResponse.redirect(socialMediaUrl);
  for (const name of OAUTH_COOKIES) response.cookies.delete(name);

  return response;
}

/* ============================================================================
   GET /api/admin/social-media/accounts/callback

   Mirrors app/api/monzo/callback/route.ts exactly: strict CSRF-state
   equality, the initiating admin re-verified active, tokens encrypted at
   rest with the shared lib/encryption.ts helper, one-time cookies always
   deleted on the way out (success or failure).
============================================================================ */

export async function GET(request: NextRequest) {
  const callbackUrl = new URL(request.url);
  const socialMediaUrl = new URL("/admin?tab=social_media", request.url);

  const code = callbackUrl.searchParams.get("code");
  const providerError = callbackUrl.searchParams.get("error");
  const returnedState = callbackUrl.searchParams.get("state");

  const storedState = request.cookies.get("social_oauth_state")?.value;
  const adminUserId = request.cookies.get("social_oauth_admin")?.value;
  const platformCookie = request.cookies.get("social_oauth_platform")?.value;
  const pkceVerifier = request.cookies.get("social_oauth_pkce_verifier")?.value;

  if (providerError) {
    return finish(socialMediaUrl, "access_denied");
  }

  if (!code || !returnedState || !storedState || returnedState !== storedState) {
    return finish(socialMediaUrl, "invalid_state");
  }

  if (!adminUserId) {
    return finish(socialMediaUrl, "invalid_session");
  }

  const platform = Object.values(SocialPlatform).find((value) => value === platformCookie);
  if (!platform) {
    return finish(socialMediaUrl, "invalid_state");
  }

  try {
    const admin = await prisma.adminUser.findUnique({ where: { id: adminUserId }, select: { id: true, active: true } });

    if (!admin?.active) {
      return finish(socialMediaUrl, "invalid_session");
    }

    const token = await exchangeAuthorisationCode(platform, code, pkceVerifier);
    const profile = await fetchAccountProfile(platform, token.access_token);

    await prisma.socialAccount.upsert({
      where: { platform_platformAccountId: { platform, platformAccountId: profile.platformAccountId } },
      update: {
        accountName: profile.accountName,
        username: profile.username,
        profileImageUrl: profile.profileImageUrl,
        status: SocialAccountStatus.CONNECTED,
        encryptedAccessToken: encryptSecret(token.access_token),
        encryptedRefreshToken: token.refresh_token ? encryptSecret(token.refresh_token) : null,
        tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
        scopes: token.scope ?? null,
        connectedAt: new Date(),
        connectedById: admin.id,
        disconnectedAt: null,
        lastError: null,
        lastErrorAt: null,
      },
      create: {
        platform,
        platformAccountId: profile.platformAccountId,
        accountName: profile.accountName,
        username: profile.username,
        profileImageUrl: profile.profileImageUrl,
        status: SocialAccountStatus.CONNECTED,
        encryptedAccessToken: encryptSecret(token.access_token),
        encryptedRefreshToken: token.refresh_token ? encryptSecret(token.refresh_token) : null,
        tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
        scopes: token.scope ?? null,
        connectedAt: new Date(),
        connectedById: admin.id,
      },
    });

    return finish(socialMediaUrl, "connected");
  } catch (error) {
    console.error("Social media OAuth callback error:", error);
    return finish(socialMediaUrl, "connection_failed");
  }
}
