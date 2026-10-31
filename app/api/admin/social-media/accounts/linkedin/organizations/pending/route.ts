import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PendingOrgConnection = {
  organizations: { id: string; urn: string; name: string }[];
};

/* ============================================================================
   GET /api/admin/social-media/accounts/linkedin/organizations/pending

   Reads the short-lived httpOnly social_oauth_org_pending cookie set by
   the OAuth callback right after a successful LinkedIn Company Manager
   authorisation (see callback/route.ts). Only the discovered id/urn/name
   list is ever returned — the encrypted token inside that cookie never
   reaches the client.
============================================================================ */
export async function GET(request: NextRequest) {
  try {
    await requireSocialMediaPermission(AccessAction.MANAGE);

    const raw = request.cookies.get("social_oauth_org_pending")?.value;
    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "No pending LinkedIn company-page connection. Click \"Connect a company page\" again." },
        { status: 404 },
      );
    }

    const pending = JSON.parse(raw) as PendingOrgConnection;
    return NextResponse.json({ ok: true, organizations: pending.organizations });
  } catch (error) {
    console.error("[admin/social-media/accounts/linkedin/organizations/pending:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
