import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { createCampaignBudgetAllocation, listCampaignBudgetAllocations } from "@/lib/campaigns/budget";
import { CampaignBudgetCategory, CampaignChannelType, CurrencyCode } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalString, parseRequiredAmount } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/budget/allocations]", error);
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
    const allocations = await listCampaignBudgetAllocations(id);
    return NextResponse.json({ ok: true, allocations });
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
    const category = parseEnumValue(body?.category, Object.values(CampaignBudgetCategory));
    if (!category) return NextResponse.json({ ok: false, error: "A valid budget category is required." }, { status: 400 });

    const amount = parseRequiredAmount(body?.amount);
    if (amount === null) return NextResponse.json({ ok: false, error: "A non-negative amount is required." }, { status: 400 });

    const allocation = await createCampaignBudgetAllocation(identity, id, {
      category,
      channel: parseEnumValue(body?.channel, Object.values(CampaignChannelType)),
      amount,
      currency: parseEnumValue(body?.currency, Object.values(CurrencyCode)) ?? undefined,
      notes: parseOptionalString(body?.notes),
    });

    return NextResponse.json({ ok: true, allocation }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
