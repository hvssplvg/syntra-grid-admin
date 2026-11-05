import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertDeploymentsRowAccess, requireDeploymentsPermission } from "@/lib/deployments/permissions";
import { getDeploymentDetail } from "@/lib/deployments/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireDeploymentsPermission(AccessAction.VIEW);
    const { id } = await params;

    const deployment = await getDeploymentDetail(id);
    if (!deployment) {
      return NextResponse.json({ ok: false, error: "That deployment could not be found." }, { status: 404 });
    }

    assertDeploymentsRowAccess(identity, AccessAction.VIEW, deployment.client?.id ?? null);

    return NextResponse.json({ ok: true, deployment });
  } catch (error) {
    console.error("[admin/deployments/:id:GET]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
