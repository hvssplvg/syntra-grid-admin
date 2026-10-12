import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { createCampaignAudience, listCampaignAudiences } from "@/lib/campaigns/audiences";
import { CampaignAudienceCategory, CampaignRecordStatus } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalString } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/audiences]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireCampaignsPermission(AccessAction.VIEW);
    const sp = request.nextUrl.searchParams;
    const audiences = await listCampaignAudiences({
      status: parseEnumValue(sp.get("status"), Object.values(CampaignRecordStatus)),
      category: parseEnumValue(sp.get("category"), Object.values(CampaignAudienceCategory)),
      search: sp.get("search"),
    });
    return NextResponse.json({ ok: true, audiences });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.CREATE);
    const body = await request.json().catch(() => null);

    const name = parseOptionalString(body?.name);
    if (!name) return NextResponse.json({ ok: false, error: "An audience name is required." }, { status: 400 });

    const ageRangeMin = typeof body?.ageRangeMin === "number" ? body.ageRangeMin : null;
    const ageRangeMax = typeof body?.ageRangeMax === "number" ? body.ageRangeMax : null;

    const audience = await createCampaignAudience(identity, {
      name,
      description: parseOptionalString(body?.description),
      category: parseEnumValue(body?.category, Object.values(CampaignAudienceCategory)) ?? undefined,
      country: parseOptionalString(body?.country),
      region: parseOptionalString(body?.region),
      city: parseOptionalString(body?.city),
      ageRangeMin,
      ageRangeMax,
      interests: Array.isArray(body?.interests) ? body.interests.filter((v: unknown) => typeof v === "string") : [],
      industry: parseOptionalString(body?.industry),
      jobTitles: Array.isArray(body?.jobTitles) ? body.jobTitles.filter((v: unknown) => typeof v === "string") : [],
      customerSegment: parseOptionalString(body?.customerSegment),
      source: parseOptionalString(body?.source),
      estimatedSize: typeof body?.estimatedSize === "number" ? body.estimatedSize : null,
      isEstimate: body?.isEstimate !== false,
      notes: parseOptionalString(body?.notes),
    });

    return NextResponse.json({ ok: true, audience }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
