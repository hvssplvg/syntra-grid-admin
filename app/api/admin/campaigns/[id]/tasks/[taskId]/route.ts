import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, hasCampaignsPermission, isOwnEmployee, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { deleteCampaignTask, updateCampaignTask } from "@/lib/campaigns/planner";
import { CampaignPriority, CampaignTaskStatus } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalId, parseOptionalString } from "@/lib/campaigns/validation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; taskId: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/tasks/:taskId]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    // A task's own assignee may update it (most commonly: move its status)
    // even without campaign-level EDIT access — that only requires VIEW
    // plus being the named assignee. Anyone else needs real EDIT access
    // to the parent campaign.
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id, taskId } = await params;
    const campaign = await getCampaignOrThrow(id);
    const task = await prisma.campaignTask.findUnique({ where: { id: taskId } });
    if (!task || task.campaignId !== id) {
      return NextResponse.json({ ok: false, error: "This task could not be found." }, { status: 404 });
    }

    const isAssignee = isOwnEmployee(identity, task.assigneeId);
    if (!isAssignee) {
      if (!hasCampaignsPermission(identity, AccessAction.EDIT)) {
        return NextResponse.json({ ok: false, error: "You are not authorised to edit this task." }, { status: 403 });
      }
      assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: campaign.createdById, departmentId: campaign.departmentId });
    }

    const body = await request.json().catch(() => ({}));

    const milestoneId = parseOptionalId(body.milestoneId);
    const assigneeId = parseOptionalId(body.assigneeId);
    const dependsOnTaskId = parseOptionalId(body.dependsOnTaskId);

    const dueAt = typeof body.dueAt === "string" ? new Date(body.dueAt) : undefined;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid due date." }, { status: 400 });
    }

    const status = body.status !== undefined ? parseEnumValue(body.status, Object.values(CampaignTaskStatus)) : undefined;
    if (body.status !== undefined && status === null) {
      return NextResponse.json({ ok: false, error: "Invalid task status." }, { status: 400 });
    }

    // An assignee acting under the VIEW-only exemption may only move the
    // task's own status/description, never reassign it or change its
    // campaign-level scheduling — that still requires real EDIT access.
    if (isAssignee && !hasCampaignsPermission(identity, AccessAction.EDIT)) {
      if (milestoneId !== undefined || assigneeId !== undefined || dependsOnTaskId !== undefined || body.priority !== undefined) {
        return NextResponse.json({ ok: false, error: "You can only update this task's status and notes." }, { status: 403 });
      }
    }

    const updatedTask = await updateCampaignTask(identity, id, taskId, {
      ...(typeof body.title === "string" ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: parseOptionalString(body.description) } : {}),
      ...(milestoneId !== undefined ? { milestoneId } : {}),
      ...(body.priority !== undefined ? { priority: parseEnumValue(body.priority, Object.values(CampaignPriority)) ?? undefined } : {}),
      ...(assigneeId !== undefined ? { assigneeId } : {}),
      ...(dueAt !== undefined ? { dueAt } : {}),
      ...(dependsOnTaskId !== undefined ? { dependsOnTaskId } : {}),
      ...(status !== undefined && status !== null ? { status } : {}),
    });

    return NextResponse.json({ ok: true, task: updatedTask });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.MANAGE);
    const { id, taskId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.MANAGE, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    await deleteCampaignTask(id, taskId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
