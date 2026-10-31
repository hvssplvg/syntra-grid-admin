import { NextResponse } from "next/server";

import { AccessAction } from "@/app/generated/prisma/enums";
import { AuthenticationError, AuthorisationError, getCurrentIdentity, hasPermission } from "@/lib/auth/current-admin";
import { listWorkspaces } from "@/lib/workspaces/server";
import { filterSectionsByPermission, type AdminTab } from "@/app/components/admin/adminNav";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/workspaces

   Full access: every workspace, unfiltered — unchanged from before this
   system existed, and the behaviour the Owner keeps forever.

   Restricted: narrowed to the workspaces whose sectionKeys overlap a
   section the caller can actually reach — computed via the exact same
   filterSectionsByPermission the nav sidebar itself uses (adminNav.ts),
   never a separately-maintained rule that could drift out of sync with
   what's actually in the sidebar. This is the real boundary; the
   frontend workspace switcher just renders whatever this returns —
   hiding a workspace client-side was never the security boundary on its
   own (see Workspace's own doc comment in schema.prisma).

   The Executive workspace's deliberately empty sectionKeys ("no specific
   focus", the full company-wide view) is excluded for every restricted
   caller — it's never a meaningful selection for an account whose whole
   point is a narrower view.
============================================================================ */
export async function GET() {
  try {
    const identity = await getCurrentIdentity();
    const workspaces = await listWorkspaces();

    if (identity.isFullAccess) {
      return NextResponse.json({ ok: true, workspaces });
    }

    const hasModuleAccess = (tab: AdminTab) => hasPermission(identity, tab, AccessAction.VIEW);
    const accessibleSectionIds = new Set<string>(
      filterSectionsByPermission(false, hasModuleAccess).map((section) => section.id),
    );

    const allowed = workspaces.filter(
      (workspace) =>
        workspace.sectionKeys.length > 0 &&
        workspace.sectionKeys.some((sectionId) => accessibleSectionIds.has(sectionId)),
    );

    return NextResponse.json({ ok: true, workspaces: allowed });
  } catch (error) {
    console.error("[admin/workspaces]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
