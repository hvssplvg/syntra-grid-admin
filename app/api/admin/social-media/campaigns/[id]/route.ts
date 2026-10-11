import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { deleteCampaign, updateCampaign } from "@/lib/social-media/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/social-media/campaigns/:id]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    await requireSocialMediaPermission(AccessAction.EDIT);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));

    const campaign = await updateCampaign(id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.description === "string" || body.description === null ? { description: body.description } : {}),
      ...(typeof body.status === "string" ? { status: body.status } : {}),
      ...(body.startDate !== undefined ? { startDate: body.startDate ? new Date(body.startDate) : null } : {}),
      ...(body.endDate !== undefined ? { endDate: body.endDate ? new Date(body.endDate) : null } : {}),
    });

    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireSocialMediaPermission(AccessAction.MANAGE);
    const { id } = await params;

    await deleteCampaign(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
