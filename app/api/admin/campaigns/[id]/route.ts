import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow, updateCampaign } from "@/lib/campaigns/server";
import { CampaignStatus } from "@/app/generated/prisma/enums";

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
    assertCampaignRowAccess(identity, AccessAction.VIEW, { createdById: campaign.createdById });
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
    assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: existing.createdById });

    const body = await request.json().catch(() => ({}));

    if (typeof body.name === "string" && body.name.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "The campaign name can't be empty." }, { status: 400 });
    }

    const startDate =
      typeof body.startDate === "string" ? new Date(body.startDate) : body.startDate === null ? null : undefined;
    if (startDate && Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid start date." }, { status: 400 });
    }

    const endDate = typeof body.endDate === "string" ? new Date(body.endDate) : body.endDate === null ? null : undefined;
    if (endDate && Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid end date." }, { status: 400 });
    }

    const nextStartDate = startDate !== undefined ? startDate : existing.startDate;
    const nextEndDate = endDate !== undefined ? endDate : existing.endDate;
    if (nextStartDate && nextEndDate && nextEndDate < nextStartDate) {
      return NextResponse.json({ ok: false, error: "The end date can't be before the start date." }, { status: 400 });
    }

    const status =
      typeof body.status === "string" && (Object.values(CampaignStatus) as string[]).includes(body.status)
        ? (body.status as CampaignStatus)
        : undefined;

    const campaign = await updateCampaign(identity, id, {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(typeof body.description === "string" || body.description === null
        ? { description: typeof body.description === "string" ? body.description.trim() || null : null }
        : {}),
      ...(status !== undefined ? { status } : {}),
      ...(startDate !== undefined ? { startDate } : {}),
      ...(endDate !== undefined ? { endDate } : {}),
    });

    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    return errorResponse(error);
  }
}
