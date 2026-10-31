import { NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError, requireAdmin } from "@/lib/auth/current-admin";
import { listWorkspaces } from "@/lib/workspaces/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/workspaces

   Full-access only for now (requireAdmin()) — no restricted employee
   accounts exist yet to test role-scoped workspace visibility against
   (see the Workspace model's doc comment in schema.prisma). Returning
   the full list unfiltered here is correct for today's only real caller,
   the Owner, who sees every workspace regardless of selection.
============================================================================ */
export async function GET() {
  try {
    await requireAdmin();

    const workspaces = await listWorkspaces();
    return NextResponse.json({ ok: true, workspaces });
  } catch (error) {
    console.error("[admin/workspaces]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
