import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { createCampaignKpi, listCampaignKpis } from "@/lib/campaigns/analytics";
import { CampaignMetricType } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalString, parseRequiredAmount } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/kpis]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.VIEW, { createdById: campaign.createdById, departmentId: campaign.departmentId });
    const kpis = await listCampaignKpis(id);
    return NextResponse.json({ ok: true, kpis });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.CREATE);
    const { id } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.CREATE, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const body = await request.json().catch(() => null);
    const name = parseOptionalString(body?.name);
    if (!name) return NextResponse.json({ ok: false, error: "A KPI name is required." }, { status: 400 });

    const metric = parseEnumValue(body?.metric, Object.values(CampaignMetricType));
    if (!metric) return NextResponse.json({ ok: false, error: "A valid metric is required." }, { status: 400 });

    const targetValue = parseRequiredAmount(body?.targetValue);
    if (targetValue === null) return NextResponse.json({ ok: false, error: "A non-negative target value is required." }, { status: 400 });

    const deadline = typeof body?.deadline === "string" ? new Date(body.deadline) : null;

    const kpi = await createCampaignKpi(identity, id, { name, metric, targetValue, deadline });
    return NextResponse.json({ ok: true, kpi }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
