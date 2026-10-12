import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { createCampaign, listCampaigns } from "@/lib/campaigns/server";
import { CampaignStatus } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/campaigns]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

function parseStatus(value: string | null): CampaignStatus | null {
  if (!value) return null;
  return (Object.values(CampaignStatus) as string[]).includes(value) ? (value as CampaignStatus) : null;
}

export async function GET(request: NextRequest) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;

    const { campaigns, pagination } = await listCampaigns(identity, {
      status: parseStatus(params.get("status")),
      search: params.get("search"),
      page: params.get("page") ? Number(params.get("page")) : null,
      pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : null,
    });

    return NextResponse.json({ ok: true, campaigns, pagination });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);

    if (!body || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "A campaign name is required." }, { status: 400 });
    }

    const startDate = typeof body.startDate === "string" ? new Date(body.startDate) : null;
    if (startDate && Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid start date." }, { status: 400 });
    }

    const endDate = typeof body.endDate === "string" ? new Date(body.endDate) : null;
    if (endDate && Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid end date." }, { status: 400 });
    }

    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ ok: false, error: "The end date can't be before the start date." }, { status: 400 });
    }

    const status = parseStatus(typeof body.status === "string" ? body.status : null);

    const campaign = await createCampaign(identity, {
      name: body.name.trim(),
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      status: status ?? undefined,
      startDate,
      endDate,
    });

    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
