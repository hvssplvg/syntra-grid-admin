import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { rankCampaignsByMetric } from "@/lib/campaigns/analytics";
import { CampaignMetricType } from "@/app/generated/prisma/enums";
import { parseEnumValue } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const sp = request.nextUrl.searchParams;

    const metricType = parseEnumValue(sp.get("metricType"), Object.values(CampaignMetricType));
    if (!metricType) return NextResponse.json({ ok: false, error: "A valid metric type is required." }, { status: 400 });

    const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid date range." }, { status: 400 });
    }

    const limit = sp.get("limit") ? Math.min(50, Math.max(1, Number(sp.get("limit")))) : 10;
    const order = sp.get("order") === "underperforming" ? "asc" : "desc";

    const ranking = await rankCampaignsByMetric(identity, metricType, from, to, limit);
    const sorted = order === "asc" ? [...ranking].sort((a, b) => a.value - b.value) : ranking;

    return NextResponse.json({ ok: true, ranking: sorted });
  } catch (error) {
    console.error("[admin/campaigns/analytics/ranking]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
