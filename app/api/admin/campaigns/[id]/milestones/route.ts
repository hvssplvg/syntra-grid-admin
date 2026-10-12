import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { createCampaignMilestone, listCampaignMilestones } from "@/lib/campaigns/planner";
import { parseOptionalId, parseOptionalString } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/milestones]", error);
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
    const milestones = await listCampaignMilestones(id);
    return NextResponse.json({ ok: true, milestones });
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
    if (!title) return NextResponse.json({ ok: false, error: "A milestone title is required." }, { status: 400 });

    const dueAt = typeof body?.dueAt === "string" ? new Date(body.dueAt) : null;
    if (!dueAt || Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ ok: false, error: "A valid due date is required." }, { status: 400 });
    }

    const ownerId = parseOptionalId(body?.ownerId);
    if (ownerId === undefined) return NextResponse.json({ ok: false, error: "The selected owner is invalid." }, { status: 400 });

    const milestone = await createCampaignMilestone(identity, id, {
      title,
      description: parseOptionalString(body?.description),
      dueAt,
      ownerId,
    });

    return NextResponse.json({ ok: true, milestone }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
