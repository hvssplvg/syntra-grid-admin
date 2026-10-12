import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, hasCampaignsPermission, isOwnEmployee, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { deleteCampaignContent, getCampaignContentOrThrow, updateCampaignContent } from "@/lib/campaigns/content";
import { CampaignContentStatus } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalId, parseOptionalString } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; contentId: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/content/:contentId]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id, contentId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.VIEW, { createdById: campaign.createdById, departmentId: campaign.departmentId });
    const content = await getCampaignContentOrThrow(id, contentId);
    return NextResponse.json({ ok: true, content });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    // A content item's own creator or reviewer may act on it (move it
    // through its own workflow) without campaign-level EDIT access —
    // anyone else needs real EDIT on the parent campaign.
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id, contentId } = await params;
    const campaign = await getCampaignOrThrow(id);
    const content = await getCampaignContentOrThrow(id, contentId);

    const isOwnContent = isOwnEmployee(identity, content.creatorId) || isOwnEmployee(identity, content.reviewerId);
    if (!isOwnContent) {
      if (!hasCampaignsPermission(identity, AccessAction.EDIT)) {
        return NextResponse.json({ ok: false, error: "You are not authorised to edit this content." }, { status: 403 });
      }
      assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: campaign.createdById, departmentId: campaign.departmentId });
    }

    const body = await request.json().catch(() => ({}));

    const status = body.status !== undefined ? parseEnumValue(body.status, Object.values(CampaignContentStatus)) : undefined;
    if (body.status !== undefined && status === null) {
      return NextResponse.json({ ok: false, error: "Invalid content status." }, { status: 400 });
    }

    const creatorId = parseOptionalId(body.creatorId);
    const reviewerId = parseOptionalId(body.reviewerId);
    if (creatorId === undefined && body.creatorId !== undefined) {
      return NextResponse.json({ ok: false, error: "The selected creator is invalid." }, { status: 400 });
    }
    if (reviewerId === undefined && body.reviewerId !== undefined) {
      return NextResponse.json({ ok: false, error: "The selected reviewer is invalid." }, { status: 400 });
    }

    const updated = await updateCampaignContent(identity, id, contentId, {
      ...(typeof body.title === "string" ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: parseOptionalString(body.description) } : {}),
      ...(body.body !== undefined ? { body: parseOptionalString(body.body) } : {}),
      ...(body.caption !== undefined ? { caption: parseOptionalString(body.caption) } : {}),
      ...(Array.isArray(body.hashtags) ? { hashtags: body.hashtags.filter((h: unknown) => typeof h === "string") } : {}),
      ...(body.callToAction !== undefined ? { callToAction: parseOptionalString(body.callToAction) } : {}),
      ...(body.channel !== undefined ? { channel: parseOptionalString(body.channel) } : {}),
      ...(creatorId !== undefined ? { creatorId } : {}),
      ...(reviewerId !== undefined ? { reviewerId } : {}),
      ...(status !== undefined && status !== null ? { status } : {}),
      ...(body.reviewNotes !== undefined ? { reviewNotes: parseOptionalString(body.reviewNotes) } : {}),
    });

    return NextResponse.json({ ok: true, content: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.MANAGE);
    const { id, contentId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.MANAGE, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    await deleteCampaignContent(id, contentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
