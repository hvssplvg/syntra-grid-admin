import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignAudienceOrThrow, updateCampaignAudience } from "@/lib/campaigns/audiences";
import { CampaignAudienceCategory } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalString } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ audienceId: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/audiences/:audienceId]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireCampaignsPermission(AccessAction.VIEW);
    const { audienceId } = await params;
    const audience = await getCampaignAudienceOrThrow(audienceId);
    return NextResponse.json({ ok: true, audience });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.EDIT);
    const { audienceId } = await params;
    const body = await request.json().catch(() => ({}));

    const ageRangeMin = body.ageRangeMin !== undefined ? (typeof body.ageRangeMin === "number" ? body.ageRangeMin : null) : undefined;
    const ageRangeMax = body.ageRangeMax !== undefined ? (typeof body.ageRangeMax === "number" ? body.ageRangeMax : null) : undefined;

    const audience = await updateCampaignAudience(identity, audienceId, {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: parseOptionalString(body.description) } : {}),
      ...(body.category !== undefined ? { category: parseEnumValue(body.category, Object.values(CampaignAudienceCategory)) ?? undefined } : {}),
      ...(body.country !== undefined ? { country: parseOptionalString(body.country) } : {}),
      ...(body.region !== undefined ? { region: parseOptionalString(body.region) } : {}),
      ...(body.city !== undefined ? { city: parseOptionalString(body.city) } : {}),
      ...(ageRangeMin !== undefined ? { ageRangeMin } : {}),
      ...(ageRangeMax !== undefined ? { ageRangeMax } : {}),
      ...(Array.isArray(body.interests) ? { interests: body.interests.filter((v: unknown) => typeof v === "string") } : {}),
      ...(body.industry !== undefined ? { industry: parseOptionalString(body.industry) } : {}),
      ...(Array.isArray(body.jobTitles) ? { jobTitles: body.jobTitles.filter((v: unknown) => typeof v === "string") } : {}),
      ...(body.customerSegment !== undefined ? { customerSegment: parseOptionalString(body.customerSegment) } : {}),
      ...(body.source !== undefined ? { source: parseOptionalString(body.source) } : {}),
      ...(body.estimatedSize !== undefined ? { estimatedSize: typeof body.estimatedSize === "number" ? body.estimatedSize : null } : {}),
      ...(body.isEstimate !== undefined ? { isEstimate: Boolean(body.isEstimate) } : {}),
      ...(body.notes !== undefined ? { notes: parseOptionalString(body.notes) } : {}),
    });

    return NextResponse.json({ ok: true, audience });
  } catch (error) {
    return errorResponse(error);
  }
}
