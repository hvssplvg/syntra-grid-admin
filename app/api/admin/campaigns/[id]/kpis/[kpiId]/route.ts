import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { deleteCampaignKpi, updateCampaignKpi } from "@/lib/campaigns/analytics";
import { CampaignMetricType } from "@/app/generated/prisma/enums";
import { parseEnumValue } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; kpiId: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/kpis/:kpiId]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.EDIT);
    const { id, kpiId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const body = await request.json().catch(() => ({}));

    const kpi = await updateCampaignKpi(identity, id, kpiId, {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(body.metric !== undefined ? { metric: parseEnumValue(body.metric, Object.values(CampaignMetricType)) ?? undefined } : {}),
      ...(typeof body.targetValue === "number" && body.targetValue >= 0 ? { targetValue: body.targetValue } : {}),
      ...(typeof body.actualValue === "number" && body.actualValue >= 0 ? { actualValue: body.actualValue } : {}),
      ...(body.deadline !== undefined ? { deadline: typeof body.deadline === "string" ? new Date(body.deadline) : null } : {}),
    });

    return NextResponse.json({ ok: true, kpi });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.MANAGE);
    const { id, kpiId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.MANAGE, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    await deleteCampaignKpi(id, kpiId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
