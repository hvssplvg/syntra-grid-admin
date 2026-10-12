import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { listCampaignMetrics, recordCampaignMetric } from "@/lib/campaigns/analytics";
import { CampaignChannelType, CampaignMetricType } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalString } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/metrics]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.VIEW, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const sp = request.nextUrl.searchParams;
    const metrics = await listCampaignMetrics(id, {
      metricType: parseEnumValue(sp.get("metricType"), Object.values(CampaignMetricType)),
      channel: sp.get("channel"),
    });

    return NextResponse.json({ ok: true, metrics });
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
    const metricType = parseEnumValue(body?.metricType, Object.values(CampaignMetricType));
    if (!metricType) return NextResponse.json({ ok: false, error: "A valid metric type is required." }, { status: 400 });

    const value = typeof body?.value === "number" && Number.isFinite(body.value) ? body.value : null;
    if (value === null) return NextResponse.json({ ok: false, error: "A numeric value is required." }, { status: 400 });

    const periodStart = typeof body?.periodStart === "string" ? new Date(body.periodStart) : null;
    const periodEnd = typeof body?.periodEnd === "string" ? new Date(body.periodEnd) : null;
    if (!periodStart || !periodEnd || Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      return NextResponse.json({ ok: false, error: "A valid period start and end are required." }, { status: 400 });
    }

    const metric = await recordCampaignMetric(identity, id, {
      channel: parseEnumValue(body?.channel, Object.values(CampaignChannelType)),
      metricType,
      value,
      periodStart,
      periodEnd,
      source: "MANUAL_ENTRY",
      externalReference: parseOptionalString(body?.externalReference),
    });

    return NextResponse.json({ ok: true, metric }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
