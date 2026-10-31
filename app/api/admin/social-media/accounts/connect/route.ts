import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import {
  createAuthorisationUrl,
  createPkcePair,
  isPlatformConfigured,
  LINKEDIN_ORGANIZATION_OAUTH_CONFIG,
  OAuthAppKey,
  PLATFORM_CONFIG,
  requiredEnvVarsFor,
} from "@/lib/social-media/accounts";
import { SocialPlatform } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 10 * 60,
  path: "/",
};

/* ============================================================================
   GET /api/admin/social-media/accounts/connect?platform=INSTAGRAM

   Mirrors app/api/monzo/connect/route.ts's shape exactly: server-generated
   CSRF state in an httpOnly cookie, the initiating admin recorded in a
   second cookie (the callback has no session context of its own), both
   expiring in 10 minutes. Never redirects to a provider that isn't
   actually configured — returns an honest error instead.
============================================================================ */

export async function GET(request: NextRequest) {
  const socialMediaUrl = new URL("/dashboard?tab=social_media", request.url);
  const loginUrl = new URL("/login", request.url);

  try {
    const identity = await requireSocialMediaPermission(AccessAction.MANAGE);

    const platformParam = request.nextUrl.searchParams.get("platform");
    const platform = Object.values(SocialPlatform).find((value) => value === platformParam);

    if (!platform) {
      socialMediaUrl.searchParams.set("social", "invalid_platform");
      return NextResponse.redirect(socialMediaUrl);
    }

    // LinkedIn company-page connections use a SEPARATE LinkedIn developer
    // app ("Syntra Grid Company Manager") — LinkedIn won't allow the
    // Community Management API product on the original personal-profile
    // app. Selected only via this explicit query flag, never inferred —
    // every other platform (and a plain LinkedIn connect) is unaffected.
    const useLinkedInOrgApp = platform === SocialPlatform.LINKEDIN && request.nextUrl.searchParams.get("linkedinApp") === "organization";
    const oauthKey: OAuthAppKey = useLinkedInOrgApp ? "LINKEDIN_ORGANIZATION" : platform;
    const config = useLinkedInOrgApp ? LINKEDIN_ORGANIZATION_OAUTH_CONFIG : PLATFORM_CONFIG[platform];

    if (!isPlatformConfigured(oauthKey)) {
      socialMediaUrl.searchParams.set("social", "not_configured");
      socialMediaUrl.searchParams.set("platform", platform);
      socialMediaUrl.searchParams.set("missing", requiredEnvVarsFor(oauthKey).join(","));
      return NextResponse.redirect(socialMediaUrl);
    }

    const state = crypto.randomBytes(32).toString("hex");
    const pkce = config.flow === "pkce" ? createPkcePair() : null;

    const authorisationUrl = createAuthorisationUrl(oauthKey, state, pkce?.challenge);

    const response = NextResponse.redirect(authorisationUrl);

    response.cookies.set("social_oauth_state", state, COOKIE_OPTS);
    response.cookies.set("social_oauth_admin", identity.admin.id, COOKIE_OPTS);
    response.cookies.set("social_oauth_platform", platform, COOKIE_OPTS);

    if (useLinkedInOrgApp) {
      response.cookies.set("social_oauth_linkedin_app", "organization", COOKIE_OPTS);
    }

    if (pkce) {
      response.cookies.set("social_oauth_pkce_verifier", pkce.verifier, COOKIE_OPTS);
    }

    return response;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      loginUrl.searchParams.set("returnTo", "/dashboard?tab=social_media");
      return NextResponse.redirect(loginUrl);
    }

    if (error instanceof AuthorisationError) {
      socialMediaUrl.searchParams.set("social", "not_authorised");
      return NextResponse.redirect(socialMediaUrl);
    }

    console.error("Unable to start social media OAuth:", error);
    socialMediaUrl.searchParams.set("social", "connection_failed");
    return NextResponse.redirect(socialMediaUrl);
  }
}
