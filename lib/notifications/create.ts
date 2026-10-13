// lib/notifications/create.ts
//
// Direct "push at write-time" notification creation — for the handful of
// events that are genuine point-in-time decisions with no later "pending"
// state lib/notifications/server.ts's lazy sync could re-derive from
// (a task being assigned, an approval being decided, a leave request
// being approved/rejected, a calendar event being cancelled). Mirrors the
// pattern lib/messaging/server.ts's notifyOtherMembers() already
// established for MESSAGE_RECEIVED.
//
// Every function here swallows its own errors (logs, never throws) — a
// notification failing to write must never fail the real business action
// it's attached to. Call these AFTER the real transaction has committed.

import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/app/generated/prisma/enums";

export type NotificationInput = {
  recipientAdminUserId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  // Unique per (recipient, event) — e.g. "campaign_task_assigned:<taskId>:<recipientId>".
  // Reused on retry via upsert/skipDuplicates so a retried request never
  // creates a second notification for the same event.
  sourceKey: string;
};

export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    await prisma.notification.upsert({
      where: {
        recipientAdminUserId_sourceKey: {
          recipientAdminUserId: input.recipientAdminUserId,
          sourceKey: input.sourceKey,
        },
      },
      create: {
        recipientAdminUserId: input.recipientAdminUserId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        module: input.module,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        sourceKey: input.sourceKey,
      },
      // Already exists (a retried request hit the same event) — never
      // touch read/dismissedAt on an existing row.
      update: {},
    });
  } catch (error) {
    console.error("[notifications] createNotification failed:", error);
  }
}

export async function createNotificationsForRecipients(inputs: NotificationInput[]): Promise<void> {
  if (inputs.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: inputs.map((input) => ({
        recipientAdminUserId: input.recipientAdminUserId,
        actorId: input.actorId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        module: input.module,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        sourceKey: input.sourceKey,
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    console.error("[notifications] createNotificationsForRecipients failed:", error);
  }
}

export { NotificationType };
