import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { createCampaignContent, listCampaignContent } from "@/lib/campaigns/content";
import { CampaignContentStatus, CampaignContentType } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalId, parseOptionalString } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/content]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.VIEW, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const sp = request.nextUrl.searchParams;
    const content = await listCampaignContent(id, {
      status: parseEnumValue(sp.get("status"), Object.values(CampaignContentStatus)),
      type: parseEnumValue(sp.get("type"), Object.values(CampaignContentType)),
    });

    return NextResponse.json({ ok: true, content });
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
    const title = parseOptionalString(body?.title);
    if (!title) return NextResponse.json({ ok: false, error: "A title is required." }, { status: 400 });

    const type = parseEnumValue(body?.type, Object.values(CampaignContentType));
    if (!type) return NextResponse.json({ ok: false, error: "A valid content type is required." }, { status: 400 });

    const creatorId = parseOptionalId(body?.creatorId);
    const reviewerId = parseOptionalId(body?.reviewerId);
    if (creatorId === undefined || reviewerId === undefined) {
      return NextResponse.json({ ok: false, error: "The selected creator or reviewer is invalid." }, { status: 400 });
    }

    const dueAt = typeof body?.dueAt === "string" ? new Date(body.dueAt) : null;
    const scheduledAt = typeof body?.scheduledAt === "string" ? new Date(body.scheduledAt) : null;

    const content = await createCampaignContent(identity, id, {
      title,
      type,
      description: parseOptionalString(body?.description),
      body: parseOptionalString(body?.body),
      caption: parseOptionalString(body?.caption),
      hashtags: Array.isArray(body?.hashtags) ? body.hashtags.filter((h: unknown) => typeof h === "string") : [],
      callToAction: parseOptionalString(body?.callToAction),
      channel: parseOptionalString(body?.channel),
      creatorId,
      reviewerId,
      dueAt,
      scheduledAt,
    });

    return NextResponse.json({ ok: true, content }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
