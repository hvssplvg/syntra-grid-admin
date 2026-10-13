import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/encryption";
import { exchangeAuthorisationCode, fetchAccountProfile } from "@/lib/social-media/accounts";
import { SocialAccountStatus, SocialPlatform } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";

const OAUTH_COOKIES = ["social_oauth_state", "social_oauth_admin", "social_oauth_platform", "social_oauth_pkce_verifier"];

/**
 * Safe, stage-by-stage diagnostics for Vercel logs — a correlation id
 * ties every line for one callback request together. Never pass a raw
 * secret/token/code/verifier/state/cookie value here; only booleans,
 * enums, counts, HTTP status codes and platform/stage names.
 */
function logStage(correlationId: string, platform: string | null, stage: string, detail?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      scope: "social_oauth_callback",
      correlationId,
      platform,
      stage,
      ...detail,
    }),
  );
}

function logFailure(correlationId: string, platform: string | null, stage: string, errorCategory: string, detail?: Record<string, unknown>) {
  console.error(
    JSON.stringify({
      scope: "social_oauth_callback",
      correlationId,
      platform,
      stage,
      errorCategory,
      ...detail,
    }),
  );
}

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

   This route never reads or writes Neon Auth's session cookie — the
   initiating admin is tracked entirely via the social_oauth_admin cookie
   set by the connect route, independent of the dashboard's own session
   handling. If the admin appears logged out after this flow, it isn't
   this route clearing anything; see lib/auth/server.ts's cookies.sameSite
   for the actual historical cause (defaulted to "strict", which withholds
   the session cookie on the cross-site redirect back from the provider).
============================================================================ */

export async function GET(request: NextRequest) {
  const correlationId = crypto.randomUUID();
  const callbackUrl = new URL(request.url);
  const socialMediaUrl = new URL("/dashboard?tab=social_media", request.url);

  const code = callbackUrl.searchParams.get("code");
  const providerError = callbackUrl.searchParams.get("error");
  const returnedState = callbackUrl.searchParams.get("state");

  const storedState = request.cookies.get("social_oauth_state")?.value;
  const adminUserId = request.cookies.get("social_oauth_admin")?.value;
  const platformCookie = request.cookies.get("social_oauth_platform")?.value;
  const pkceVerifier = request.cookies.get("social_oauth_pkce_verifier")?.value;

  logStage(correlationId, platformCookie ?? null, "received", {
    hasCode: Boolean(code),
    hasProviderError: Boolean(providerError),
    hasReturnedState: Boolean(returnedState),
    hasStateCookie: Boolean(storedState),
    hasAdminCookie: Boolean(adminUserId),
    hasPkceCookie: Boolean(pkceVerifier),
  });

  if (providerError) {
    logFailure(correlationId, platformCookie ?? null, "provider_denied", "access_denied");
    return finish(socialMediaUrl, "access_denied");
  }

  const stateValid = Boolean(code && returnedState && storedState && returnedState === storedState);
  logStage(correlationId, platformCookie ?? null, "state_validated", { passed: stateValid });

  if (!code || !stateValid) {
    logFailure(correlationId, platformCookie ?? null, "state_validation", "invalid_state");
    return finish(socialMediaUrl, "invalid_state");
  }

  if (!adminUserId) {
    logFailure(correlationId, platformCookie ?? null, "admin_cookie_check", "invalid_session");
    return finish(socialMediaUrl, "invalid_session");
  }

  const platform = Object.values(SocialPlatform).find((value) => value === platformCookie);
  if (!platform) {
    logFailure(correlationId, platformCookie ?? null, "platform_resolution", "invalid_state");
    return finish(socialMediaUrl, "invalid_state");
  }

  try {
    const admin = await prisma.adminUser.findUnique({ where: { id: adminUserId }, select: { id: true, active: true } });
    logStage(correlationId, platform, "admin_lookup", { found: Boolean(admin), active: admin?.active ?? false });

    if (!admin?.active) {
      logFailure(correlationId, platform, "admin_lookup", "invalid_session");
      return finish(socialMediaUrl, "invalid_session");
    }

    let token;
    try {
      token = await exchangeAuthorisationCode(platform, code, pkceVerifier);
    } catch (error) {
      logFailure(correlationId, platform, "token_exchange", "token_exchange_failed", {
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });
      throw error;
    }
    logStage(correlationId, platform, "token_exchange", { ok: true, hasRefreshToken: Boolean(token.refresh_token) });

    let profile;
    try {
      profile = await fetchAccountProfile(platform, token.access_token);
    } catch (error) {
      logFailure(correlationId, platform, "profile_fetch", "profile_fetch_failed", {
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });
      throw error;
    }
    logStage(correlationId, platform, "profile_fetch", { ok: true });

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

    logStage(correlationId, platform, "persisted", { ok: true });

    const successUrl = new URL(socialMediaUrl);
    // Safe to expose — a public handle, never a token/secret.
    if (profile.username) successUrl.searchParams.set("handle", profile.username);
    return finish(successUrl, "connected");
  } catch (error) {
    logFailure(correlationId, platform, "unhandled", "connection_failed", {
      message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    return finish(socialMediaUrl, "connection_failed");
  }
}
