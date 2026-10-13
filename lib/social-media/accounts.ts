// lib/social-media/accounts.ts
//
// OAuth account-connection architecture for the 6 supported platforms,
// mirroring the existing Monzo integration's shape (lib/monzo.ts,
// app/api/monzo/connect+callback/route.ts): server-generated state,
// httpOnly-cookie CSRF protection, encrypted token storage via the
// existing lib/encryption.ts (already provider-agnostic).
//
// IMPORTANT — verify before going live: the exact OAuth endpoints, scope
// names and API versions below reflect each platform's OAuth 2.0
// documentation as of this codebase's training data. Providers revise
// scopes/versions over time — re-check each platform's current developer
// docs before registering a real app, this file's endpoints are a sound
// starting point, not a guarantee of today's exact values.
//
// Nothing here ever fabricates a successful connection. isPlatformConfigured()
// is false for every platform until its real env vars are set, and every
// caller of these helpers must check it first.

import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/encryption";
import { SocialAccountStatus, SocialPlatform } from "@/app/generated/prisma/enums";

export type OAuthFlow = "standard" | "pkce";

export type PlatformOAuthConfig = {
  label: string;
  authUrl: string;
  tokenUrl: string;
  /** Env var names — intentionally not hardcoded values, so missing
   *  configuration is detected rather than silently using a placeholder. */
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectUriEnv: string;
  /** TikTok's authorize endpoint uses "client_key" instead of "client_id". */
  clientIdParam: "client_id" | "client_key";
  scopes: string[];
  flow: OAuthFlow;
  /** Meta's OAuth dialogs (Facebook Login, and Instagram's own login
   *  dialog) document their `scope` param as comma-separated, not the
   *  space-separated list the OAuth2/OIDC spec uses elsewhere in this
   *  file — defaults to space when omitted. Getting this wrong doesn't
   *  always surface as an obvious error, so it's made explicit per
   *  platform rather than assumed. */
  scopeDelimiter?: "," | " ";
  /** How the token endpoint expects the confidential-client credential.
   *  Defaults to "body" (client_secret as a form field), which is what
   *  every platform here except X already works with. X's /2/oauth2/token
   *  documents HTTP Basic Auth as the expected way to authenticate a
   *  confidential client — sending the secret only in the body is a
   *  common cause of a silently-rejected token exchange for X
   *  specifically. Only set this where a platform's docs call for it;
   *  never change the default for a platform that already works. */
  tokenAuthMethod?: "basic" | "body";
};

export const PLATFORM_CONFIG: Record<SocialPlatform, PlatformOAuthConfig> = {
  FACEBOOK: {
    label: "Facebook",
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    redirectUriEnv: "META_REDIRECT_URI",
    clientIdParam: "client_id",
    // pages_show_list / pages_read_engagement / pages_manage_posts are
    // real, current Meta permissions — but Meta's OAuth dialog rejects a
    // scope with "Invalid Scopes" if the app doesn't have the Pages API
    // use case configured in the App Dashboard (App Review > Permissions
    // and Features / Use Cases), independent of whether the delimiter or
    // scope name is correct. See the task report for what to check there.
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
    flow: "standard",
    scopeDelimiter: ",",
  },
  INSTAGRAM: {
    label: "Instagram",
    // Instagram API WITH INSTAGRAM LOGIN — a separate product from
    // Facebook Login, with its own app (separate App ID/Secret from any
    // Meta/Facebook app), its own OAuth + token endpoints, and
    // Instagram-native permissions. This never goes through Facebook's
    // OAuth dialog and never requests a Facebook Page permission, so it
    // can't trip the Pages-API "Invalid Scopes" error Facebook can.
    authUrl: "https://www.instagram.com/oauth/authorize",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    clientIdEnv: "INSTAGRAM_APP_ID",
    clientSecretEnv: "INSTAGRAM_APP_SECRET",
    redirectUriEnv: "INSTAGRAM_REDIRECT_URI",
    clientIdParam: "client_id",
    // Start minimal: only what connecting an account and the (future)
    // publish adapter actually need. instagram_business_manage_comments /
    // _messages / _insights are deliberately not requested — nothing
    // built yet uses them, and each one needs its own Meta App Review
    // justification. Add one only when a real feature needs it.
    scopes: ["instagram_business_basic", "instagram_business_content_publish"],
    flow: "standard",
    scopeDelimiter: ",",
  },
  LINKEDIN: {
    label: "LinkedIn",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    redirectUriEnv: "LINKEDIN_REDIRECT_URI",
    clientIdParam: "client_id",
    scopes: ["openid", "profile", "w_member_social"],
    flow: "standard",
  },
  X: {
    label: "X",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
    redirectUriEnv: "X_REDIRECT_URI",
    clientIdParam: "client_id",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    flow: "pkce",
    tokenAuthMethod: "basic",
  },
  TIKTOK: {
    label: "TikTok",
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    redirectUriEnv: "TIKTOK_REDIRECT_URI",
    clientIdParam: "client_key",
    scopes: ["user.info.basic", "video.publish"],
    flow: "standard",
  },
  YOUTUBE: {
    label: "YouTube",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    redirectUriEnv: "GOOGLE_REDIRECT_URI",
    clientIdParam: "client_id",
    scopes: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"],
    flow: "standard",
  },
};

export class PlatformNotConfiguredError extends Error {
  constructor(platform: SocialPlatform) {
    const config = PLATFORM_CONFIG[platform];
    super(
      `${config.label} is not configured. Set ${config.clientIdEnv}, ${config.clientSecretEnv} and ${config.redirectUriEnv}.`,
    );
    this.name = "PlatformNotConfiguredError";
  }
}

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function isPlatformConfigured(platform: SocialPlatform): boolean {
  const config = PLATFORM_CONFIG[platform];
  return Boolean(readEnv(config.clientIdEnv) && readEnv(config.clientSecretEnv) && readEnv(config.redirectUriEnv));
}

export function requiredEnvVarsFor(platform: SocialPlatform): string[] {
  const config = PLATFORM_CONFIG[platform];
  return [config.clientIdEnv, config.clientSecretEnv, config.redirectUriEnv];
}

function requireConfig(platform: SocialPlatform) {
  if (!isPlatformConfigured(platform)) {
    throw new PlatformNotConfiguredError(platform);
  }

  const config = PLATFORM_CONFIG[platform];
  return {
    config,
    clientId: readEnv(config.clientIdEnv) as string,
    clientSecret: readEnv(config.clientSecretEnv) as string,
    redirectUri: readEnv(config.redirectUriEnv) as string,
  };
}

/** PKCE verifier/challenge pair for platforms that mandate it (X). */
export function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createAuthorisationUrl(platform: SocialPlatform, state: string, pkceChallenge?: string): string {
  const { config, clientId, redirectUri } = requireConfig(platform);

  const url = new URL(config.authUrl);
  url.searchParams.set(config.clientIdParam, clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(config.scopeDelimiter ?? " "));
  url.searchParams.set("state", state);

  if (config.flow === "pkce") {
    if (!pkceChallenge) throw new Error(`${config.label} requires a PKCE code challenge.`);
    url.searchParams.set("code_challenge", pkceChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  return url.toString();
}

export type PlatformTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

/**
 * Shared by both the authorization_code exchange and the refresh_token
 * grant below — a confidential client authenticates the same way on
 * every call to the token endpoint, regardless of grant_type. Returns
 * the extra request headers, and whether client_secret should still be
 * included as a body field (never both places at once).
 */
function tokenEndpointAuth(
  config: PlatformOAuthConfig,
  clientId: string,
  clientSecret: string,
): { headers: Record<string, string>; includeSecretInBody: boolean } {
  if (config.tokenAuthMethod === "basic") {
    return {
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
      includeSecretInBody: false,
    };
  }

  return { headers: {}, includeSecretInBody: true };
}

export async function exchangeAuthorisationCode(
  platform: SocialPlatform,
  code: string,
  pkceVerifier?: string,
): Promise<PlatformTokenResponse> {
  const { config, clientId, clientSecret, redirectUri } = requireConfig(platform);

  const { headers: authHeaders, includeSecretInBody } = tokenEndpointAuth(config, clientId, clientSecret);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    [config.clientIdParam]: clientId,
    ...(includeSecretInBody ? { client_secret: clientSecret } : {}),
  });

  if (config.flow === "pkce") {
    if (!pkceVerifier) throw new Error(`${config.label} requires a PKCE code verifier.`);
    body.set("code_verifier", pkceVerifier);
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...authHeaders },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${config.label} token exchange failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const token = (await response.json()) as PlatformTokenResponse;

  // Instagram API with Instagram Login's authorization_code grant only
  // ever returns a short-lived token (~1 hour) — it must be exchanged
  // once more for a long-lived one (~60 days) before it's any use for
  // background publishing. No other platform here needs this extra hop.
  if (platform === SocialPlatform.INSTAGRAM) {
    return exchangeInstagramLongLivedToken(token.access_token, clientSecret);
  }

  return token;
}

/** Instagram's long-lived-token exchange: a GET keyed by client_secret
 *  alone (no client_id), distinct from the generic authorization_code
 *  POST grant above. Returns an access_token with no refresh_token —
 *  Instagram has no separate refresh token; the same access token is
 *  refreshed in place later (see refreshInstagramAccessToken). */
async function exchangeInstagramLongLivedToken(shortLivedToken: string, clientSecret: string): Promise<PlatformTokenResponse> {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Instagram long-lived token exchange failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as { access_token: string; token_type?: string; expires_in: number };
  return { access_token: data.access_token, expires_in: data.expires_in };
}

export type FetchedProfile = {
  platformAccountId: string;
  accountName: string;
  username: string | null;
  profileImageUrl: string | null;
};

/**
 * Fetches basic account identity right after a successful token exchange,
 * so a connected account has a real name/handle instead of a blank row.
 * One REST call per platform's own "who am I" endpoint — correct per each
 * platform's OAuth docs for a BASIC profile.
 */
export async function fetchAccountProfile(platform: SocialPlatform, accessToken: string): Promise<FetchedProfile> {
  switch (platform) {
    case SocialPlatform.FACEBOOK: {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=id,name,picture&access_token=${encodeURIComponent(accessToken)}`,
      );
      if (!response.ok) throw new Error(`Failed to fetch Facebook profile (${response.status}).`);
      const data = (await response.json()) as { id: string; name: string; picture?: { data?: { url?: string } } };
      return { platformAccountId: data.id, accountName: data.name, username: null, profileImageUrl: data.picture?.data?.url ?? null };
    }

    case SocialPlatform.INSTAGRAM: {
      // graph.instagram.com's own "me" node (Instagram API with
      // Instagram Login) — resolves the authorising Instagram
      // professional (business/creator) account directly, by its own
      // Instagram-scoped id. Not the linked-Facebook-identity lookup the
      // old Facebook-Login-based flow needed.
      const response = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=id,username,account_type,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`,
      );
      if (!response.ok) throw new Error(`Failed to fetch Instagram profile (${response.status}).`);
      const data = (await response.json()) as {
        id: string;
        username: string;
        account_type?: string;
        profile_picture_url?: string;
      };
      return {
        platformAccountId: data.id,
        accountName: data.username,
        username: data.username,
        profileImageUrl: data.profile_picture_url ?? null,
      };
    }

    case SocialPlatform.LINKEDIN: {
      const response = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(`Failed to fetch LinkedIn profile (${response.status}).`);
      const data = (await response.json()) as { sub: string; name: string; picture?: string };
      return { platformAccountId: data.sub, accountName: data.name, username: null, profileImageUrl: data.picture ?? null };
    }

    case SocialPlatform.X: {
      const response = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(`Failed to fetch X profile (${response.status}).`);
      const data = (await response.json()) as { data: { id: string; name: string; username: string } };
      return { platformAccountId: data.data.id, accountName: data.data.name, username: data.data.username, profileImageUrl: null };
    }

    case SocialPlatform.TIKTOK: {
      const response = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(`Failed to fetch TikTok profile (${response.status}).`);
      const data = (await response.json()) as { data: { user: { open_id: string; display_name: string; avatar_url?: string } } };
      return {
        platformAccountId: data.data.user.open_id,
        accountName: data.data.user.display_name,
        username: null,
        profileImageUrl: data.data.user.avatar_url ?? null,
      };
    }

    case SocialPlatform.YOUTUBE: {
      const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error(`Failed to fetch YouTube channel (${response.status}).`);
      const data = (await response.json()) as {
        items: { id: string; snippet: { title: string; thumbnails?: { default?: { url?: string } } } }[];
      };
      const channel = data.items[0];
      if (!channel) throw new Error("No YouTube channel found for this Google account.");
      return {
        platformAccountId: channel.id,
        accountName: channel.snippet.title,
        username: null,
        profileImageUrl: channel.snippet.thumbnails?.default?.url ?? null,
      };
    }

    default:
      throw new Error(`Profile lookup is not implemented for ${platform}.`);
  }
}

/** Refresh-before-expiry, mirroring lib/monzo/connection.ts's
 *  getValidAccessToken(). Facebook's long-lived-token exchange uses a
 *  different grant (fb_exchange_token) than the generic refresh_token
 *  grant used here — flagged as a known gap for that one platform.
 *  Instagram is handled separately below (refreshInstagramAccessToken)
 *  since it has no refresh_token concept at all. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export class SocialAccountNotConnectedError extends Error {
  constructor() {
    super("This social account is not connected.");
    this.name = "SocialAccountNotConnectedError";
  }
}

export class SocialAccountReauthorisationRequiredError extends Error {
  constructor(platform: SocialPlatform) {
    super(`The connection to ${PLATFORM_CONFIG[platform].label} has expired and must be reconnected.`);
    this.name = "SocialAccountReauthorisationRequiredError";
  }
}

export async function getValidSocialAccessToken(accountId: string): Promise<string> {
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });

  if (!account || account.status !== SocialAccountStatus.CONNECTED || !account.encryptedAccessToken) {
    throw new SocialAccountNotConnectedError();
  }

  const expiresSoon = account.tokenExpiresAt ? account.tokenExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS : false;

  if (!expiresSoon) {
    return decryptSecret(account.encryptedAccessToken);
  }

  if (account.platform === SocialPlatform.INSTAGRAM) {
    return refreshInstagramAccessToken(accountId, decryptSecret(account.encryptedAccessToken));
  }

  if (!account.encryptedRefreshToken) {
    await markAccountError(accountId, "Access token expired and no refresh token is available.");
    throw new SocialAccountReauthorisationRequiredError(account.platform);
  }

  try {
    const config = PLATFORM_CONFIG[account.platform];
    const { clientId, clientSecret } = requireConfig(account.platform);
    const { headers: authHeaders, includeSecretInBody } = tokenEndpointAuth(config, clientId, clientSecret);

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: decryptSecret(account.encryptedRefreshToken),
      [config.clientIdParam]: clientId,
      ...(includeSecretInBody ? { client_secret: clientSecret } : {}),
    });

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...authHeaders },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Refresh failed with status ${response.status}: ${text.slice(0, 200)}`);
    }

    const token = (await response.json()) as PlatformTokenResponse;

    await prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        encryptedAccessToken: encryptSecret(token.access_token),
        encryptedRefreshToken: token.refresh_token ? encryptSecret(token.refresh_token) : account.encryptedRefreshToken,
        tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
        lastError: null,
        lastErrorAt: null,
      },
    });

    return token.access_token;
  } catch (error) {
    await markAccountError(accountId, error instanceof Error ? error.message : "Token refresh failed.");
    throw new SocialAccountReauthorisationRequiredError(account.platform);
  }
}

/** Instagram's long-lived access token refreshes itself in place — there
 *  is no separate refresh_token to store or send. Meta requires the
 *  token be at least 24 hours old before this call will succeed; a
 *  token refreshed too soon (or already expired past the point Meta
 *  will renew it) fails here and is treated the same as any other
 *  refresh failure — reconnect required, never silently retried. */
async function refreshInstagramAccessToken(accountId: string, currentAccessToken: string): Promise<string> {
  try {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", currentAccessToken);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Instagram token refresh failed with status ${response.status}`);
    }

    const data = (await response.json()) as { access_token: string; token_type?: string; expires_in: number };

    await prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        encryptedAccessToken: encryptSecret(data.access_token),
        tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
        lastError: null,
        lastErrorAt: null,
      },
    });

    return data.access_token;
  } catch (error) {
    await markAccountError(accountId, error instanceof Error ? error.message : "Instagram token refresh failed.");
    throw new SocialAccountReauthorisationRequiredError(SocialPlatform.INSTAGRAM);
  }
}

export async function markAccountError(accountId: string, message: string) {
  await prisma.socialAccount
    .update({
      where: { id: accountId },
      data: { status: SocialAccountStatus.EXPIRED, lastError: message, lastErrorAt: new Date() },
    })
    .catch(() => undefined);
}
