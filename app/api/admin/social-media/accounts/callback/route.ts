import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/encryption";
import {
  exchangeAuthorisationCode,
  fetchAccountProfile,
  fetchLinkedInOrganizationDetails,
  fetchLinkedInOrganizations,
  hasLinkedInScopes,
  OAuthAppKey,
} from "@/lib/social-media/accounts";
import { SocialAccountStatus, SocialPlatform } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";

const OAUTH_COOKIES = [
  "social_oauth_state",
  "social_oauth_admin",
  "social_oauth_platform",
  "social_oauth_pkce_verifier",
  "social_oauth_linkedin_app",
];

const ORG_PENDING_COOKIE = "social_oauth_org_pending";

const PENDING_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 10 * 60,
  path: "/",
};

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
  const linkedInAppCookie = request.cookies.get("social_oauth_linkedin_app")?.value;

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

  // Set only by the connect route when it started a LinkedIn
  // company-page authorisation — tells us to use the SEPARATE Company
  // Manager app's credentials, and to skip the personal-profile
  // identity lookup below (that app has no openid/profile scope, so
  // /v2/userinfo would simply fail for it).
  const useLinkedInOrgApp = platform === SocialPlatform.LINKEDIN && linkedInAppCookie === "organization";
  const oauthKey: OAuthAppKey = useLinkedInOrgApp ? "LINKEDIN_ORGANIZATION" : platform;

  try {
    const admin = await prisma.adminUser.findUnique({ where: { id: adminUserId }, select: { id: true, active: true } });
    logStage(correlationId, platform, "admin_lookup", { found: Boolean(admin), active: admin?.active ?? false });

    if (!admin?.active) {
      logFailure(correlationId, platform, "admin_lookup", "invalid_session");
      return finish(socialMediaUrl, "invalid_session");
    }

    let token;
    try {
      token = await exchangeAuthorisationCode(oauthKey, code, pkceVerifier);
    } catch (error) {
      logFailure(correlationId, platform, "token_exchange", "token_exchange_failed", {
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      });
      throw error;
    }
    logStage(correlationId, platform, "token_exchange", { ok: true, hasRefreshToken: Boolean(token.refresh_token) });

    if (useLinkedInOrgApp) {
      // No identity scope on this app — never call fetchAccountProfile.
      // Verify the grant actually came back with the one scope
      // discovery needs before calling LinkedIn again with it.
      if (!hasLinkedInScopes(token.scope ?? null, ["rw_organization_admin"])) {
        logFailure(correlationId, platform, "org_scope_check", "missing_scope");
        return finish(socialMediaUrl, "linkedin_org_scope_missing");
      }

      let organizations;
      try {
        const discovered = await fetchLinkedInOrganizations(token.access_token);
        organizations = await Promise.all(
          discovered.map(async (org) => {
            const details = await fetchLinkedInOrganizationDetails(token.access_token, org.id).catch(() => null);
            return { id: org.id, urn: org.urn, name: details?.name ?? `LinkedIn organisation ${org.id}` };
          }),
        );
      } catch (error) {
        logFailure(correlationId, platform, "org_discovery", "org_discovery_failed", {
          message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
        });
        return finish(socialMediaUrl, "connection_failed");
      }
      logStage(correlationId, platform, "org_discovery", { ok: true, count: organizations.length });

      if (organizations.length === 0) {
        return finish(socialMediaUrl, "linkedin_no_organizations");
      }

      // Nothing is persisted to the database yet — the token lives only
      // in this short-lived httpOnly cookie (mirroring how
      // social_oauth_state already holds sensitive short-lived material
      // outside the DB) until the admin picks which page(s) to connect
      // via POST .../accounts/linkedin/organizations.
      const pending = {
        encryptedAccessToken: encryptSecret(token.access_token),
        encryptedRefreshToken: token.refresh_token ? encryptSecret(token.refresh_token) : null,
        tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
        scopes: token.scope ?? null,
        organizations,
      };

      const response = finish(socialMediaUrl, "select_organization");
      response.cookies.set(ORG_PENDING_COOKIE, JSON.stringify(pending), PENDING_COOKIE_OPTS);
      return response;
    }

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
