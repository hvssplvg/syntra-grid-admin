import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import {
  AccessAction,
  hasSocialMediaPermission,
  requireSocialMediaPermission,
  socialMediaClientScopeFilter,
} from "@/lib/social-media/permissions";
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
  accountType: true,
  sharesAuthWithId: true,
  connectedAt: true,
  lastSyncedAt: true,
  lastError: true,
  disconnectedAt: true,
  // Null means "Syntra Grid's own" — see SocialAccount.clientId's doc
  // comment in prisma/schema.prisma.
  clientId: true,
  client: { select: { id: true, name: true, displayName: true } },
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
    const identity = await requireSocialMediaPermission(AccessAction.VIEW);

    // A CLIENT-scoped restricted caller never sees Syntra Grid's own
    // (null-owned) accounts or another client's — only their assigned
    // clients'. `{ in: [...] }` naturally excludes null clientIds.
    const clientIdIn = socialMediaClientScopeFilter(identity, AccessAction.VIEW);

    const accounts = await prisma.socialAccount.findMany({
      where: clientIdIn ? { clientId: clientIdIn } : undefined,
      select: ACCOUNT_SELECT,
      orderBy: { createdAt: "asc" },
    });

    const platforms = Object.values(SocialPlatform).map((platform) => ({
      platform,
      label: PLATFORM_CONFIG[platform].label,
      configured: isPlatformConfigured(platform),
      requiredEnvVars: isPlatformConfigured(platform) ? [] : requiredEnvVarsFor(platform),
      accounts: accounts.filter((account) => account.platform === platform),
      // LinkedIn company-page connections use a separate developer app
      // (see LINKEDIN_ORGANIZATION_OAUTH_CONFIG) with its own
      // configuration state, independent of the personal app above.
      ...(platform === SocialPlatform.LINKEDIN
        ? {
            organizationAppConfigured: isPlatformConfigured("LINKEDIN_ORGANIZATION"),
            organizationAppRequiredEnvVars: isPlatformConfigured("LINKEDIN_ORGANIZATION") ? [] : requiredEnvVarsFor("LINKEDIN_ORGANIZATION"),
          }
        : {}),
    }));

    // Lets the UI decide which workflow actions to even show (e.g.
    // "Publish Now") without guessing — the server call each of those
    // actions makes re-checks the same permission regardless, so this is
    // purely about not showing a button that would just 403.
    const permissions = {
      canCreate: hasSocialMediaPermission(identity, AccessAction.CREATE),
      canEdit: hasSocialMediaPermission(identity, AccessAction.EDIT),
      canApprove: hasSocialMediaPermission(identity, AccessAction.APPROVE),
      canManage: hasSocialMediaPermission(identity, AccessAction.MANAGE),
    };

    return NextResponse.json({ ok: true, platforms, permissions });
  } catch (error) {
    console.error("[admin/social-media/accounts]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
