// lib/campaigns/planner.ts
//
// Milestones and tasks for the Campaign Planner. Milestones with an owner
// get a real linked CalendarEvent (type MILESTONE) kept in sync on every
// edit/reschedule/completion/deletion — never a duplicate, never a
// frontend-only event. A milestone with no owner has nothing to attribute
// a calendar event to, so it simply has no calendar representation
// (documented, not silently faked).

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import { CampaignActivityType, CampaignMilestoneStatus, CampaignTaskStatus } from "@/app/generated/prisma/enums";
import type { ResolvedIdentity } from "@/lib/campaigns/permissions";
import { logCampaignActivity } from "@/lib/campaigns/activity";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { createNotification, NotificationType } from "@/lib/notifications/create";

const EMPLOYEE_SELECT = { id: true, firstName: true, lastName: true, jobTitle: true, avatarUrl: true } as const;
const ADMIN_SELECT = { id: true, firstName: true, lastName: true, email: true } as const;

/* ============================================================================
   MILESTONES
============================================================================ */

export async function listCampaignMilestones(campaignId: string) {
  await getCampaignOrThrow(campaignId);
  return prisma.campaignMilestone.findMany({
    where: { campaignId },
    orderBy: { dueAt: "asc" },
    include: { owner: { select: EMPLOYEE_SELECT } },
  });
}

async function syncMilestoneCalendarEvent(
  identity: ResolvedIdentity,
  campaignId: string,
  campaignName: string,
  milestone: { id: string; title: string; description: string | null; dueAt: Date; ownerId: string | null; status: CampaignMilestoneStatus; calendarEventId: string | null },
): Promise<string | null> {
  if (!milestone.ownerId) return milestone.calendarEventId;

  const eventStatus = milestone.status === "COMPLETED" ? "COMPLETED" : milestone.status === "CANCELLED" ? "CANCELLED" : "SCHEDULED";

  if (milestone.calendarEventId) {
    await prisma.calendarEvent.update({
      where: { id: milestone.calendarEventId },
      data: {
        title: `Milestone: ${milestone.title}`,
        description: milestone.description ?? `Campaign: ${campaignName}`,
        startAt: milestone.dueAt,
        endAt: milestone.dueAt,
        ownerId: milestone.ownerId,
        status: eventStatus,
        updatedById: identity.admin.id,
      },
    });
    return milestone.calendarEventId;
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title: `Milestone: ${milestone.title}`,
      description: milestone.description ?? `Campaign: ${campaignName}`,
      type: "MILESTONE",
      scope: "TEAM",
      status: eventStatus,
      startAt: milestone.dueAt,
      endAt: milestone.dueAt,
      ownerId: milestone.ownerId,
      createdById: identity.admin.id,
    },
  });

  return event.id;
}

export type MilestoneInput = {
  title: string;
  description?: string | null;
  dueAt: Date;
  ownerId?: string | null;
};

export async function createCampaignMilestone(identity: ResolvedIdentity, campaignId: string, input: MilestoneInput) {
  const campaign = await getCampaignOrThrow(campaignId);

  if (input.ownerId) {
    const owner = await prisma.employee.findUnique({ where: { id: input.ownerId }, select: { id: true } });
    if (!owner) throw new AuthorisationError("The selected owner could not be found.");
  }

  const milestone = await prisma.campaignMilestone.create({
    data: {
      campaignId,
      title: input.title,
      description: input.description ?? null,
      dueAt: input.dueAt,
      ownerId: input.ownerId ?? null,
      createdById: identity.admin.id,
      updatedById: identity.admin.id,
    },
  });

  const calendarEventId = await syncMilestoneCalendarEvent(identity, campaignId, campaign.name, milestone);
  const final = calendarEventId
    ? await prisma.campaignMilestone.update({ where: { id: milestone.id }, data: { calendarEventId }, include: { owner: { select: EMPLOYEE_SELECT } } })
    : await prisma.campaignMilestone.findUniqueOrThrow({ where: { id: milestone.id }, include: { owner: { select: EMPLOYEE_SELECT } } });

  await logCampaignActivity(campaignId, identity.admin.id, CampaignActivityType.MILESTONE_CREATED, `Milestone "${milestone.title}" created.`);

  return final;
}

async function getMilestoneOrThrow(campaignId: string, milestoneId: string) {
  const milestone = await prisma.campaignMilestone.findUnique({ where: { id: milestoneId } });
  if (!milestone || milestone.campaignId !== campaignId) throw new AuthorisationError("This milestone could not be found.");
  return milestone;
}

export async function updateCampaignMilestone(
  identity: ResolvedIdentity,
  campaignId: string,
  milestoneId: string,
  input: Partial<MilestoneInput> & { status?: CampaignMilestoneStatus },
) {
  const campaign = await getCampaignOrThrow(campaignId);
  const existing = await getMilestoneOrThrow(campaignId, milestoneId);

  if (input.ownerId) {
    const owner = await prisma.employee.findUnique({ where: { id: input.ownerId }, select: { id: true } });
    if (!owner) throw new AuthorisationError("The selected owner could not be found.");
  }

  const updated = await prisma.campaignMilestone.update({
    where: { id: milestoneId },
    data: {
      ...input,
      completedAt: input.status === "COMPLETED" ? new Date() : input.status ? null : undefined,
      updatedById: identity.admin.id,
    },
  });

  const calendarEventId = await syncMilestoneCalendarEvent(identity, campaignId, campaign.name, updated);
  const final = await prisma.campaignMilestone.update({
    where: { id: milestoneId },
    data: { calendarEventId },
    include: { owner: { select: EMPLOYEE_SELECT } },
  });

  if (input.status === "COMPLETED" && existing.status !== "COMPLETED") {
    await logCampaignActivity(campaignId, identity.admin.id, CampaignActivityType.MILESTONE_COMPLETED, `Milestone "${updated.title}" completed.`);
  }

  return final;
}

export async function deleteCampaignMilestone(identity: ResolvedIdentity, campaignId: string, milestoneId: string) {
  const existing = await getMilestoneOrThrow(campaignId, milestoneId);

  await prisma.$transaction(async (tx) => {
    await tx.campaignMilestone.delete({ where: { id: milestoneId } });
    if (existing.calendarEventId) {
      await tx.calendarEvent.delete({ where: { id: existing.calendarEventId } }).catch(() => undefined);
    }
  });
}

/* ============================================================================
   TASKS

   Dependency cycle prevention: dependsOnTaskId forms a single-parent chain
   (not a general DAG), so a cycle can only happen if walking from the
   proposed predecessor ever reaches the task being saved. That walk is
   bounded by the number of tasks in the campaign, so it always terminates.
============================================================================ */

/** Pure cycle-walk, injectable with a fake lookup for unit testing
 *  without a database — assertNoDependencyCycle below supplies the real
 *  Prisma-backed lookup in production. */
export async function walkForDependencyCycle(
  taskId: string | null,
  dependsOnTaskId: string | null,
  lookupDependsOnTaskId: (id: string) => Promise<string | null>,
) {
  if (!dependsOnTaskId) return;
  if (taskId && dependsOnTaskId === taskId) {
    throw new AuthorisationError("A task cannot depend on itself.");
  }

  let cursor: string | null = dependsOnTaskId;
  const visited = new Set<string>();

  while (cursor) {
    if (taskId && cursor === taskId) {
      throw new AuthorisationError("That dependency would create a circular chain of tasks.");
    }
    if (visited.has(cursor)) break; // already-corrupt chain elsewhere — don't loop forever
    visited.add(cursor);
    cursor = await lookupDependsOnTaskId(cursor);
  }
}

async function assertNoDependencyCycle(taskId: string | null, dependsOnTaskId: string | null) {
  await walkForDependencyCycle(taskId, dependsOnTaskId, async (id) => {
    const next = await prisma.campaignTask.findUnique({ where: { id }, select: { dependsOnTaskId: true } });
    return next?.dependsOnTaskId ?? null;
  });
}

export async function listCampaignTasks(
  campaignId: string,
  filters: { milestoneId?: string | null; assigneeId?: string | null; status?: CampaignTaskStatus | null },
) {
  await getCampaignOrThrow(campaignId);
  return prisma.campaignTask.findMany({
    where: {
      campaignId,
      ...(filters.milestoneId ? { milestoneId: filters.milestoneId } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
    include: {
      assignee: { select: EMPLOYEE_SELECT },
      milestone: { select: { id: true, title: true } },
      dependsOnTask: { select: { id: true, title: true, status: true } },
      _count: { select: { comments: true } },
    },
  });
}

export type TaskInput = {
  title: string;
  description?: string | null;
  milestoneId?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  assigneeId?: string | null;
  dueAt?: Date | null;
  dependsOnTaskId?: string | null;
};

export async function createCampaignTask(identity: ResolvedIdentity, campaignId: string, input: TaskInput) {
  await getCampaignOrThrow(campaignId);

  if (input.milestoneId) await getMilestoneOrThrow(campaignId, input.milestoneId);

  if (input.assigneeId) {
    const assignee = await prisma.employee.findUnique({ where: { id: input.assigneeId }, select: { id: true } });
    if (!assignee) throw new AuthorisationError("The selected assignee could not be found.");
  }

  if (input.dependsOnTaskId) {
    const dependsOn = await prisma.campaignTask.findUnique({ where: { id: input.dependsOnTaskId } });
    if (!dependsOn || dependsOn.campaignId !== campaignId) {
      throw new AuthorisationError("The selected dependency could not be found in this campaign.");
    }
    await assertNoDependencyCycle(null, input.dependsOnTaskId);
  }

  const task = await prisma.campaignTask.create({
    data: {
      campaignId,
      title: input.title,
      description: input.description ?? null,
      milestoneId: input.milestoneId ?? null,
      priority: input.priority,
      assigneeId: input.assigneeId ?? null,
      dueAt: input.dueAt ?? null,
      dependsOnTaskId: input.dependsOnTaskId ?? null,
      createdById: identity.admin.id,
      updatedById: identity.admin.id,
    },
    include: { assignee: { select: EMPLOYEE_SELECT }, milestone: { select: { id: true, title: true } } },
  });

  await logCampaignActivity(campaignId, identity.admin.id, CampaignActivityType.TASK_CREATED, `Task "${task.title}" created.`);

  if (task.assigneeId) {
    await notifyCampaignTaskAssigned(identity.admin.id, task.id, task.title, task.campaignId, task.assigneeId);
  }

  return task;
}

/** Notification failure must never fail task creation/assignment — this
 *  is called after the real write has already committed. Skipped
 *  silently if the assignee has no linked dashboard account. */
async function notifyCampaignTaskAssigned(
  actorId: string,
  taskId: string,
  taskTitle: string,
  campaignId: string,
  assigneeEmployeeId: string,
) {
  const [employee, campaign] = await Promise.all([
    prisma.employee.findUnique({ where: { id: assigneeEmployeeId }, select: { adminUserId: true } }),
    prisma.campaign.findUnique({ where: { id: campaignId }, select: { name: true } }),
  ]);

  if (!employee?.adminUserId) return;

  await createNotification({
    recipientAdminUserId: employee.adminUserId,
    actorId,
    type: NotificationType.CAMPAIGN_TASK_ASSIGNED,
    title: `You were assigned a task — ${taskTitle}`,
    body: campaign ? `Campaign: ${campaign.name}` : null,
    module: "campaigns",
    entityType: "CampaignTask",
    entityId: taskId,
    sourceKey: `campaign_task_assigned:${taskId}:${employee.adminUserId}`,
  });
}

async function getTaskOrThrow(campaignId: string, taskId: string) {
  const task = await prisma.campaignTask.findUnique({ where: { id: taskId } });
  if (!task || task.campaignId !== campaignId) throw new AuthorisationError("This task could not be found.");
  return task;
}

export async function updateCampaignTask(
  identity: ResolvedIdentity,
  campaignId: string,
  taskId: string,
  input: Partial<TaskInput> & { status?: CampaignTaskStatus },
) {
  const existing = await getTaskOrThrow(campaignId, taskId);

  if (input.milestoneId) await getMilestoneOrThrow(campaignId, input.milestoneId);

  if (input.assigneeId) {
    const assignee = await prisma.employee.findUnique({ where: { id: input.assigneeId }, select: { id: true } });
    if (!assignee) throw new AuthorisationError("The selected assignee could not be found.");
  }

  if (input.dependsOnTaskId !== undefined && input.dependsOnTaskId !== null) {
    const dependsOn = await prisma.campaignTask.findUnique({ where: { id: input.dependsOnTaskId } });
    if (!dependsOn || dependsOn.campaignId !== campaignId) {
      throw new AuthorisationError("The selected dependency could not be found in this campaign.");
    }
    await assertNoDependencyCycle(taskId, input.dependsOnTaskId);
  }

  const task = await prisma.campaignTask.update({
    where: { id: taskId },
    data: {
      ...input,
      completedAt: input.status === "COMPLETED" ? new Date() : input.status ? null : undefined,
      updatedById: identity.admin.id,
    },
    include: { assignee: { select: EMPLOYEE_SELECT }, milestone: { select: { id: true, title: true } } },
  });

  if (input.status === "COMPLETED" && existing.status !== "COMPLETED") {
    await logCampaignActivity(campaignId, identity.admin.id, CampaignActivityType.TASK_COMPLETED, `Task "${task.title}" completed.`);
  }

  if (input.assigneeId && input.assigneeId !== existing.assigneeId) {
    await notifyCampaignTaskAssigned(identity.admin.id, task.id, task.title, task.campaignId, input.assigneeId);
  }

  return task;
}

export async function deleteCampaignTask(campaignId: string, taskId: string) {
  await getTaskOrThrow(campaignId, taskId);
  // Dependent tasks are freed rather than cascade-deleted — losing one
  // task should never silently delete others that depended on it.
  await prisma.campaignTask.updateMany({ where: { dependsOnTaskId: taskId }, data: { dependsOnTaskId: null } });
  await prisma.campaignTask.delete({ where: { id: taskId } });
}

export async function addCampaignTaskComment(identity: ResolvedIdentity, campaignId: string, taskId: string, body: string) {
  await getTaskOrThrow(campaignId, taskId);
  return prisma.campaignTaskComment.create({
    data: { taskId, authorId: identity.admin.id, body },
    include: { author: { select: ADMIN_SELECT } },
  });
}

export async function listCampaignTaskComments(campaignId: string, taskId: string) {
  await getTaskOrThrow(campaignId, taskId);
  return prisma.campaignTaskComment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: ADMIN_SELECT } },
  });
}
