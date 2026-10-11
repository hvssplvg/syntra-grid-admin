import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { createCampaign, listCampaigns } from "@/lib/social-media/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/social-media/campaigns]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireSocialMediaPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;
    const page = params.get("page") ? Number(params.get("page")) : null;
    const pageSize = params.get("pageSize") ? Number(params.get("pageSize")) : null;

    const { campaigns, pagination } = await listCampaigns(page, pageSize);

    return NextResponse.json({ ok: true, campaigns, pagination });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);

    if (!body || typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "A campaign name is required." }, { status: 400 });
    }

    const campaign = await createCampaign(identity, {
      name: body.name,
      description: typeof body.description === "string" ? body.description : null,
      status: body.status,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
    });

    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
