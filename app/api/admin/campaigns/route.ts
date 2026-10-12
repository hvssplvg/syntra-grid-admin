import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { createCampaign, listCampaigns } from "@/lib/campaigns/server";
import { CampaignObjective, CampaignPriority, CampaignStatus, CurrencyCode } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalAmount, parseOptionalDate, parseOptionalId, parseOptionalString } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/campaigns]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;

    const { campaigns, pagination } = await listCampaigns(identity, {
      status: parseEnumValue(params.get("status"), Object.values(CampaignStatus)),
      clientId: params.get("clientId"),
      projectId: params.get("projectId"),
      objective: parseEnumValue(params.get("objective"), Object.values(CampaignObjective)),
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

    const startDate = parseOptionalDate(body.startDate);
    if (startDate === undefined && body.startDate !== undefined) {
      return NextResponse.json({ ok: false, error: "Invalid start date." }, { status: 400 });
    }

    const endDate = parseOptionalDate(body.endDate);
    if (endDate === undefined && body.endDate !== undefined) {
      return NextResponse.json({ ok: false, error: "Invalid end date." }, { status: 400 });
    }

    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ ok: false, error: "The end date can't be before the start date." }, { status: 400 });
    }

    const budget = parseOptionalAmount(body.budget);
    if (budget === undefined && body.budget !== undefined) {
      return NextResponse.json({ ok: false, error: "The budget must be a non-negative number." }, { status: 400 });
    }

    const clientId = parseOptionalId(body.clientId);
    const projectId = parseOptionalId(body.projectId);
    const departmentId = parseOptionalId(body.departmentId);
    const ownerId = parseOptionalId(body.ownerId);
    const managerId = parseOptionalId(body.managerId);

    if ([clientId, projectId, departmentId, ownerId, managerId].some((value) => value === undefined)) {
      return NextResponse.json({ ok: false, error: "One of the selected related records is invalid." }, { status: 400 });
    }

    const campaign = await createCampaign(identity, {
      name: body.name.trim(),
      code: parseOptionalString(body.code),
      description: parseOptionalString(body.description),
      objective: parseEnumValue(body.objective, Object.values(CampaignObjective)),
      category: parseOptionalString(body.category),
      priority: parseEnumValue(body.priority, Object.values(CampaignPriority)) ?? undefined,
      status: parseEnumValue(body.status, Object.values(CampaignStatus)) ?? undefined,
      startDate,
      endDate,
      clientId,
      projectId,
      departmentId,
      ownerId,
      managerId,
      currency: parseEnumValue(body.currency, Object.values(CurrencyCode)) ?? undefined,
      budget,
      goals: parseOptionalString(body.goals),
      notes: parseOptionalString(body.notes),
    });

    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
