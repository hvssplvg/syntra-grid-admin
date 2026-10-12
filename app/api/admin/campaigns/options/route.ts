import { NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A dedicated, campaigns:VIEW-gated reference-data endpoint. The existing
// /api/admin/client-options and /api/admin/departments/options both
// require full (non-restricted) admin access via requireAdmin(), which
// would block a restricted Marketing Executive — exactly this module's
// intended primary user — from even listing clients to assign to a
// campaign. This mirrors their shape but with the right gate for who
// actually needs it.
export async function GET() {
  try {
    await requireCampaignsPermission(AccessAction.VIEW);

    const [clients, projects, departments, employees] = await Promise.all([
      prisma.client.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } }),
      prisma.project.findMany({ select: { id: true, name: true, clientId: true }, orderBy: { name: "asc" } }),
      prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.employee.findMany({
        where: { status: { in: ["ACTIVE", "ONBOARDING"] } },
        select: { id: true, firstName: true, lastName: true, jobTitle: true, departmentId: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
    ]);

    return NextResponse.json({ ok: true, clients, projects, departments, employees });
  } catch (error) {
    console.error("[admin/campaigns/options]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
