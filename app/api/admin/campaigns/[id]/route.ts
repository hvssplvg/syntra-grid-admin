import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow, updateCampaign } from "@/lib/campaigns/server";
import { CampaignObjective, CampaignPriority, CampaignStatus, CurrencyCode } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalAmount, parseOptionalDate, parseOptionalId, parseOptionalString } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.VIEW, { createdById: campaign.createdById, departmentId: campaign.departmentId });
    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.EDIT);
    const { id } = await params;

    const existing = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: existing.createdById, departmentId: existing.departmentId });

    const body = await request.json().catch(() => ({}));

    if (typeof body.name === "string" && body.name.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "The campaign name can't be empty." }, { status: 400 });
    }

    const startDate = parseOptionalDate(body.startDate);
    if (startDate === undefined && body.startDate !== undefined) {
      return NextResponse.json({ ok: false, error: "Invalid start date." }, { status: 400 });
    }

    const endDate = parseOptionalDate(body.endDate);
    if (endDate === undefined && body.endDate !== undefined) {
      return NextResponse.json({ ok: false, error: "Invalid end date." }, { status: 400 });
    }

    const nextStartDate = startDate !== undefined ? startDate : existing.startDate;
    const nextEndDate = endDate !== undefined ? endDate : existing.endDate;
    if (nextStartDate && nextEndDate && nextEndDate < nextStartDate) {
      return NextResponse.json({ ok: false, error: "The end date can't be before the start date." }, { status: 400 });
    }

    const budget = parseOptionalAmount(body.budget);
    if (budget === undefined && body.budget !== undefined) {
      return NextResponse.json({ ok: false, error: "The budget must be a non-negative number." }, { status: 400 });
    }

    let status: CampaignStatus | undefined;
    if (body.status !== undefined) {
      const parsed = parseEnumValue(body.status, Object.values(CampaignStatus));
      if (parsed === null) {
        return NextResponse.json({ ok: false, error: "Invalid campaign status." }, { status: 400 });
      }
      status = parsed;
    }

    const clientId = parseOptionalId(body.clientId);
    const projectId = parseOptionalId(body.projectId);
    const departmentId = parseOptionalId(body.departmentId);
    const ownerId = parseOptionalId(body.ownerId);
    const managerId = parseOptionalId(body.managerId);

    if ([clientId, projectId, departmentId, ownerId, managerId].some((value) => value === undefined)) {
      return NextResponse.json({ ok: false, error: "One of the selected related records is invalid." }, { status: 400 });
    }

    const campaign = await updateCampaign(identity, id, {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(body.code !== undefined ? { code: parseOptionalString(body.code) } : {}),
      ...(body.description !== undefined ? { description: parseOptionalString(body.description) } : {}),
      ...(body.objective !== undefined ? { objective: parseEnumValue(body.objective, Object.values(CampaignObjective)) } : {}),
      ...(body.category !== undefined ? { category: parseOptionalString(body.category) } : {}),
      ...(body.priority !== undefined ? { priority: parseEnumValue(body.priority, Object.values(CampaignPriority)) ?? undefined } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(startDate !== undefined ? { startDate } : {}),
      ...(endDate !== undefined ? { endDate } : {}),
      ...(clientId !== undefined ? { clientId } : {}),
      ...(projectId !== undefined ? { projectId } : {}),
      ...(departmentId !== undefined ? { departmentId } : {}),
      ...(ownerId !== undefined ? { ownerId } : {}),
      ...(managerId !== undefined ? { managerId } : {}),
      ...(body.currency !== undefined ? { currency: parseEnumValue(body.currency, Object.values(CurrencyCode)) ?? undefined } : {}),
      ...(budget !== undefined ? { budget } : {}),
      ...(body.goals !== undefined ? { goals: parseOptionalString(body.goals) } : {}),
      ...(body.notes !== undefined ? { notes: parseOptionalString(body.notes) } : {}),
    });

    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    return errorResponse(error);
  }
}
