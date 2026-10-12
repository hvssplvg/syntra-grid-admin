import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { createCampaignTask, listCampaignTasks } from "@/lib/campaigns/planner";
import { CampaignPriority, CampaignTaskStatus } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalId, parseOptionalString } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/tasks]", error);
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
    const tasks = await listCampaignTasks(id, {
      milestoneId: sp.get("milestoneId"),
      assigneeId: sp.get("assigneeId"),
      status: parseEnumValue(sp.get("status"), Object.values(CampaignTaskStatus)),
    });

    return NextResponse.json({ ok: true, tasks });
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
    if (!title) return NextResponse.json({ ok: false, error: "A task title is required." }, { status: 400 });

    const milestoneId = parseOptionalId(body?.milestoneId);
    const assigneeId = parseOptionalId(body?.assigneeId);
    const dependsOnTaskId = parseOptionalId(body?.dependsOnTaskId);
    if ([milestoneId, assigneeId, dependsOnTaskId].some((v) => v === undefined)) {
      return NextResponse.json({ ok: false, error: "One of the selected related records is invalid." }, { status: 400 });
    }

    const dueAt = typeof body?.dueAt === "string" ? new Date(body.dueAt) : null;
    if (body?.dueAt && Number.isNaN(dueAt?.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid due date." }, { status: 400 });
    }

    const task = await createCampaignTask(identity, id, {
      title,
      description: parseOptionalString(body?.description),
      milestoneId,
      priority: parseEnumValue(body?.priority, Object.values(CampaignPriority)) ?? undefined,
      assigneeId,
      dueAt,
      dependsOnTaskId,
    });

    return NextResponse.json({ ok: true, task }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
