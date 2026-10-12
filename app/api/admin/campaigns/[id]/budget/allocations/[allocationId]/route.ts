import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { deleteCampaignBudgetAllocation, updateCampaignBudgetAllocation } from "@/lib/campaigns/budget";
import { CampaignBudgetCategory, CampaignChannelType, CurrencyCode } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalString } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; allocationId: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/budget/allocations/:allocationId]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.EDIT);
    const { id, allocationId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const body = await request.json().catch(() => ({}));

    const allocation = await updateCampaignBudgetAllocation(identity, id, allocationId, {
      ...(body.category !== undefined ? { category: parseEnumValue(body.category, Object.values(CampaignBudgetCategory)) ?? undefined } : {}),
      ...(body.channel !== undefined ? { channel: parseEnumValue(body.channel, Object.values(CampaignChannelType)) } : {}),
      ...(typeof body.amount === "number" && body.amount >= 0 ? { amount: body.amount } : {}),
      ...(body.currency !== undefined ? { currency: parseEnumValue(body.currency, Object.values(CurrencyCode)) ?? undefined } : {}),
      ...(body.notes !== undefined ? { notes: parseOptionalString(body.notes) } : {}),
    });

    return NextResponse.json({ ok: true, allocation });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.MANAGE);
    const { id, allocationId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.MANAGE, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    await deleteCampaignBudgetAllocation(id, allocationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
