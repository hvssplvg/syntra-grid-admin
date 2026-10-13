// lib/notifications/server.ts
//
// Notifications are materialised lazily from existing real tables — never
// written to by other modules directly — so adding this feature never
// requires editing any other route. syncNotifications() looks at a short
// list of genuinely time-sensitive real records and upserts a
// Notification row for anything new, keyed by a stable sourceKey so
// re-running it is always idempotent (no duplicates).

import { prisma } from "@/lib/prisma";
import type { ResolvedIdentity } from "@/lib/auth/current-admin";
import { AccessAction } from "@/app/generated/prisma/enums";
import { NotificationType } from "@/app/generated/prisma/client";

const LOOKAHEAD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

type DraftNotification = {
  sourceKey: string;
  type: NotificationType;
  title: string;
  body: string | null;
  module: string;
  entityType: string;
  entityId: string;
};

async function collectFullAccessDrafts(): Promise<DraftNotification[]> {
  const now = new Date();
  const soon = new Date(now.getTime() + LOOKAHEAD_MS);
  const recently = new Date(now.getTime() - LOOKBACK_MS);

  const [
    pendingLeave,
    urgentTickets,
    overdueInvoices,
    expiringOffers,
    renewingContracts,
    pendingSocialPosts,
    changesRequestedPosts,
    publishedPosts,
    failedPosts,
    disconnectedAccounts,
    overdueCampaignTasks,
    campaignMilestonesDueSoon,
    pendingCampaignApprovals,
    pendingCampaignExpenseApprovals,
  ] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      take: 20,
      include: { employee: { select: { firstName: true, lastName: true } } },
    }),
    prisma.supportTicket.findMany({
      where: { priority: "URGENT", status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_CLIENT"] } },
      take: 20,
      include: { client: { select: { name: true } } },
    }),
    prisma.clientInvoice.findMany({
      where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] }, dueAt: { lt: now } },
      take: 20,
      include: { client: { select: { name: true } } },
    }),
    prisma.recruitmentOffer.findMany({
      where: { status: { in: ["SENT", "VIEWED"] }, expiresAt: { gte: now, lte: soon } },
      take: 20,
    }),
    prisma.contract.findMany({
      where: { status: "ACTIVE", renewalAt: { gte: now, lte: soon } },
      take: 20,
      include: { client: { select: { name: true } } },
    }),
    prisma.socialPost.findMany({
      where: { status: "PENDING_REVIEW" },
      take: 20,
      select: { id: true, title: true, caption: true },
    }),
    prisma.socialPost.findMany({
      where: { status: "CHANGES_REQUESTED" },
      take: 20,
      select: { id: true, title: true, caption: true, reviewNotes: true },
    }),
    prisma.socialPost.findMany({
      where: { status: { in: ["PUBLISHED", "PARTIALLY_PUBLISHED"] }, updatedAt: { gte: recently } },
      take: 20,
      select: { id: true, title: true, caption: true, status: true },
    }),
    prisma.socialPost.findMany({
      where: { status: "FAILED", updatedAt: { gte: recently } },
      take: 20,
      select: { id: true, title: true, caption: true },
    }),
    prisma.socialAccount.findMany({
      where: { status: { in: ["EXPIRED", "ERROR"] }, lastErrorAt: { gte: recently } },
      take: 20,
      select: { id: true, platform: true, accountName: true },
    }),
    prisma.campaignTask.findMany({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, dueAt: { lt: now } },
      take: 20,
      select: { id: true, title: true, campaign: { select: { name: true } } },
    }),
    prisma.campaignMilestone.findMany({
      where: { status: "PENDING", dueAt: { gte: now, lte: soon } },
      take: 20,
      select: { id: true, title: true, campaign: { select: { name: true } } },
    }),
    prisma.campaignApproval.findMany({
      where: { status: "PENDING" },
      take: 20,
      select: { id: true, type: true, campaign: { select: { name: true } } },
    }),
    prisma.campaignExpense.findMany({
      where: { approvalStatus: "PENDING" },
      take: 20,
      select: { id: true, description: true, amount: true, currency: true, campaign: { select: { name: true } } },
    }),
  ]);

  return [
    ...pendingLeave.map((row) => ({
      sourceKey: `leave_request:${row.id}`,
      type: NotificationType.LEAVE_REQUEST_PENDING,
      title: `Leave request from ${row.employee.firstName} ${row.employee.lastName}`.trim(),
      body: "Awaiting your approval.",
      module: "leave",
      entityType: "LeaveRequest",
      entityId: row.id,
    })),
    ...urgentTickets.map((row) => ({
      sourceKey: `ticket_urgent:${row.id}`,
      type: NotificationType.TICKET_URGENT,
      title: `Urgent ticket — ${row.client.name}`,
      body: row.title,
      module: "support",
      entityType: "SupportTicket",
      entityId: row.id,
    })),
    ...overdueInvoices.map((row) => ({
      sourceKey: `invoice_overdue:${row.id}`,
      type: NotificationType.INVOICE_OVERDUE,
      title: `Overdue invoice — ${row.client.name}`,
      body: row.invoiceRef,
      module: "invoices",
      entityType: "ClientInvoice",
      entityId: row.id,
    })),
    ...expiringOffers.map((row) => ({
      sourceKey: `offer_expiring:${row.id}`,
      type: NotificationType.OFFER_EXPIRING,
      title: `Offer expiring soon — ${row.jobTitle}`,
      body: "The candidate has not responded yet.",
      module: "recruitment",
      entityType: "RecruitmentOffer",
      entityId: row.id,
    })),
    ...renewingContracts.map((row) => ({
      sourceKey: `contract_renewal:${row.id}`,
      type: NotificationType.CONTRACT_RENEWAL_DUE,
      title: `Contract renewal due — ${row.client.name}`,
      body: row.title,
      module: "contracts",
      entityType: "Contract",
      entityId: row.id,
    })),
    ...pendingSocialPosts.map((row) => ({
      sourceKey: `social_post_pending:${row.id}`,
      type: NotificationType.SOCIAL_POST_PENDING_APPROVAL,
      title: `Post awaiting review — ${socialPostLabel(row)}`,
      body: "Submitted for approval.",
      module: "social_media",
      entityType: "SocialPost",
      entityId: row.id,
    })),
    ...changesRequestedPosts.map((row) => ({
      sourceKey: `social_post_changes:${row.id}`,
      type: NotificationType.SOCIAL_POST_CHANGES_REQUESTED,
      title: `Changes requested — ${socialPostLabel(row)}`,
      body: row.reviewNotes,
      module: "social_media",
      entityType: "SocialPost",
      entityId: row.id,
    })),
    ...publishedPosts.map((row) => ({
      sourceKey: `social_post_published:${row.id}`,
      type: NotificationType.SOCIAL_POST_PUBLISHED,
      title: `Post ${row.status === "PARTIALLY_PUBLISHED" ? "partially published" : "published"} — ${socialPostLabel(row)}`,
      body: null,
      module: "social_media",
      entityType: "SocialPost",
      entityId: row.id,
    })),
    ...failedPosts.map((row) => ({
      sourceKey: `social_post_failed:${row.id}`,
      type: NotificationType.SOCIAL_POST_FAILED,
      title: `Publishing failed — ${socialPostLabel(row)}`,
      body: "Check the post's platform targets for details.",
      module: "social_media",
      entityType: "SocialPost",
      entityId: row.id,
    })),
    ...disconnectedAccounts.map((row) => ({
      sourceKey: `social_account_disconnected:${row.id}`,
      type: NotificationType.SOCIAL_ACCOUNT_DISCONNECTED,
      title: `${row.platform} account disconnected — ${row.accountName}`,
      body: "Reconnect this account to resume publishing.",
      module: "social_media",
      entityType: "SocialAccount",
      entityId: row.id,
    })),
    ...overdueCampaignTasks.map((row) => ({
      sourceKey: `campaign_task_overdue:${row.id}`,
      type: NotificationType.CAMPAIGN_TASK_OVERDUE,
      title: `Overdue task — ${row.title}`,
      body: `Campaign: ${row.campaign.name}`,
      module: "campaigns",
      entityType: "CampaignTask",
      entityId: row.id,
    })),
    ...campaignMilestonesDueSoon.map((row) => ({
      sourceKey: `campaign_milestone_due_soon:${row.id}`,
      type: NotificationType.CAMPAIGN_MILESTONE_DUE_SOON,
      title: `Milestone due soon — ${row.title}`,
      body: `Campaign: ${row.campaign.name}`,
      module: "campaigns",
      entityType: "CampaignMilestone",
      entityId: row.id,
    })),
    ...pendingCampaignApprovals.map((row) => ({
      sourceKey: `campaign_approval_pending:${row.id}`,
      type: NotificationType.CAMPAIGN_APPROVAL_PENDING,
      title: `${row.type} approval pending — ${row.campaign.name}`,
      body: "Awaiting your decision.",
      module: "campaigns",
      entityType: "CampaignApproval",
      entityId: row.id,
    })),
    ...pendingCampaignExpenseApprovals.map((row) => ({
      sourceKey: `campaign_expense_approval_pending:${row.id}`,
      type: NotificationType.CAMPAIGN_EXPENSE_APPROVAL_PENDING,
      title: `Expense awaiting approval — ${row.campaign.name}`,
      body: `${row.description} (${row.currency} ${row.amount})`,
      module: "campaigns",
      entityType: "CampaignExpense",
      entityId: row.id,
    })),
  ];
}

function socialPostLabel(post: { title: string | null; caption: string }): string {
  return post.title?.trim() || post.caption.slice(0, 60);
}

/** A restricted employee's own pending leave request approvals (gated on
 *  leave:APPROVE), plus her own social media content notifications —
 *  each gated by the exact permission that action actually requires, the
 *  same principle as the leave precedent. */
async function collectRestrictedDrafts(identity: ResolvedIdentity): Promise<DraftNotification[]> {
  const now = new Date();
  const recently = new Date(now.getTime() - LOOKBACK_MS);

  const canApproveLeave = identity.permissions.get("leave")?.has(AccessAction.APPROVE);
  const canApproveSocial = identity.permissions.get("social_media")?.has(AccessAction.APPROVE);
  const canManageSocial = identity.permissions.get("social_media")?.has(AccessAction.MANAGE);
  const canSeeSocial = Boolean(identity.permissions.get("social_media"));
  const canApproveCampaigns = identity.permissions.get("campaigns")?.has(AccessAction.APPROVE);
  const employeeId = identity.employee?.id;

  const [
    pendingLeave,
    pendingSocialPosts,
    ownChangesRequested,
    ownPublished,
    ownFailed,
    disconnectedAccounts,
    ownOverdueCampaignTasks,
    pendingCampaignApprovals,
    assignedCampaignApprovals,
    pendingCampaignExpenseApprovals,
  ] = await Promise.all([
      canApproveLeave
        ? prisma.leaveRequest.findMany({
            where: { status: "PENDING" },
            take: 20,
            include: { employee: { select: { firstName: true, lastName: true } } },
          })
        : Promise.resolve([]),
      canApproveSocial
        ? prisma.socialPost.findMany({ where: { status: "PENDING_REVIEW" }, take: 20, select: { id: true, title: true, caption: true } })
        : Promise.resolve([]),
      canSeeSocial
        ? prisma.socialPost.findMany({
            where: { status: "CHANGES_REQUESTED", createdById: identity.admin.id },
            take: 20,
            select: { id: true, title: true, caption: true, reviewNotes: true },
          })
        : Promise.resolve([]),
      canSeeSocial
        ? prisma.socialPost.findMany({
            where: { status: { in: ["PUBLISHED", "PARTIALLY_PUBLISHED"] }, createdById: identity.admin.id, updatedAt: { gte: recently } },
            take: 20,
            select: { id: true, title: true, caption: true, status: true },
          })
        : Promise.resolve([]),
      canSeeSocial
        ? prisma.socialPost.findMany({
            where: { status: "FAILED", createdById: identity.admin.id, updatedAt: { gte: recently } },
            take: 20,
            select: { id: true, title: true, caption: true },
          })
        : Promise.resolve([]),
      canManageSocial
        ? prisma.socialAccount.findMany({
            where: { status: { in: ["EXPIRED", "ERROR"] }, lastErrorAt: { gte: recently } },
            take: 20,
            select: { id: true, platform: true, accountName: true },
          })
        : Promise.resolve([]),
      employeeId
        ? prisma.campaignTask.findMany({
            where: { assigneeId: employeeId, status: { notIn: ["COMPLETED", "CANCELLED"] }, dueAt: { lt: now } },
            take: 20,
            select: { id: true, title: true, campaign: { select: { name: true } } },
          })
        : Promise.resolve([]),
      canApproveCampaigns
        ? prisma.campaignApproval.findMany({
            where: { status: "PENDING", assignedApproverId: null },
            take: 20,
            select: { id: true, type: true, campaign: { select: { name: true } } },
          })
        : Promise.resolve([]),
      prisma.campaignApproval.findMany({
        where: { status: "PENDING", assignedApproverId: identity.admin.id },
        take: 20,
        select: { id: true, type: true, campaign: { select: { name: true } } },
      }),
      canApproveCampaigns
        ? prisma.campaignExpense.findMany({
            where: { approvalStatus: "PENDING" },
            take: 20,
            select: { id: true, description: true, amount: true, currency: true, campaign: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);

  return [
    ...pendingLeave.map((row) => ({
      sourceKey: `leave_request:${row.id}`,
      type: NotificationType.LEAVE_REQUEST_PENDING,
      title: `Leave request from ${row.employee.firstName} ${row.employee.lastName}`.trim(),
      body: "Awaiting your approval.",
      module: "leave",
      entityType: "LeaveRequest",
      entityId: row.id,
    })),
    ...pendingSocialPosts.map((row) => ({
      sourceKey: `social_post_pending:${row.id}`,
      type: NotificationType.SOCIAL_POST_PENDING_APPROVAL,
      title: `Post awaiting review — ${socialPostLabel(row)}`,
      body: "Submitted for approval.",
      module: "social_media",
      entityType: "SocialPost",
      entityId: row.id,
    })),
    ...ownChangesRequested.map((row) => ({
      sourceKey: `social_post_changes:${row.id}`,
      type: NotificationType.SOCIAL_POST_CHANGES_REQUESTED,
      title: `Changes requested — ${socialPostLabel(row)}`,
      body: row.reviewNotes,
      module: "social_media",
      entityType: "SocialPost",
      entityId: row.id,
    })),
    ...ownPublished.map((row) => ({
      sourceKey: `social_post_published:${row.id}`,
      type: NotificationType.SOCIAL_POST_PUBLISHED,
      title: `Post ${row.status === "PARTIALLY_PUBLISHED" ? "partially published" : "published"} — ${socialPostLabel(row)}`,
      body: null,
      module: "social_media",
      entityType: "SocialPost",
      entityId: row.id,
    })),
    ...ownFailed.map((row) => ({
      sourceKey: `social_post_failed:${row.id}`,
      type: NotificationType.SOCIAL_POST_FAILED,
      title: `Publishing failed — ${socialPostLabel(row)}`,
      body: "Check the post's platform targets for details.",
      module: "social_media",
      entityType: "SocialPost",
      entityId: row.id,
    })),
    ...disconnectedAccounts.map((row) => ({
      sourceKey: `social_account_disconnected:${row.id}`,
      type: NotificationType.SOCIAL_ACCOUNT_DISCONNECTED,
      title: `${row.platform} account disconnected — ${row.accountName}`,
      body: "Reconnect this account to resume publishing.",
      module: "social_media",
      entityType: "SocialAccount",
      entityId: row.id,
    })),
    ...ownOverdueCampaignTasks.map((row) => ({
      sourceKey: `campaign_task_overdue:${row.id}`,
      type: NotificationType.CAMPAIGN_TASK_OVERDUE,
      title: `Overdue task — ${row.title}`,
      body: `Campaign: ${row.campaign.name}`,
      module: "campaigns",
      entityType: "CampaignTask",
      entityId: row.id,
    })),
    ...pendingCampaignApprovals.map((row) => ({
      sourceKey: `campaign_approval_pending:${row.id}`,
      type: NotificationType.CAMPAIGN_APPROVAL_PENDING,
      title: `${row.type} approval pending — ${row.campaign.name}`,
      body: "Awaiting a decision.",
      module: "campaigns",
      entityType: "CampaignApproval",
      entityId: row.id,
    })),
    ...assignedCampaignApprovals.map((row) => ({
      sourceKey: `campaign_approval_pending:${row.id}`,
      type: NotificationType.CAMPAIGN_APPROVAL_PENDING,
      title: `${row.type} approval pending — ${row.campaign.name}`,
      body: "Awaiting your decision.",
      module: "campaigns",
      entityType: "CampaignApproval",
      entityId: row.id,
    })),
    ...pendingCampaignExpenseApprovals.map((row) => ({
      sourceKey: `campaign_expense_approval_pending:${row.id}`,
      type: NotificationType.CAMPAIGN_EXPENSE_APPROVAL_PENDING,
      title: `Expense awaiting approval — ${row.campaign.name}`,
      body: `${row.description} (${row.currency} ${row.amount})`,
      module: "campaigns",
      entityType: "CampaignExpense",
      entityId: row.id,
    })),
  ];
}

async function syncNotifications(identity: ResolvedIdentity): Promise<void> {
  const drafts = identity.isFullAccess
    ? await collectFullAccessDrafts()
    : await collectRestrictedDrafts(identity);

  if (drafts.length === 0) return;

  await prisma.$transaction(
    drafts.map((draft) =>
      prisma.notification.upsert({
        where: { recipientAdminUserId_sourceKey: { recipientAdminUserId: identity.admin.id, sourceKey: draft.sourceKey } },
        create: {
          recipientAdminUserId: identity.admin.id,
          sourceKey: draft.sourceKey,
          type: draft.type,
          title: draft.title,
          body: draft.body,
          module: draft.module,
          entityType: draft.entityType,
          entityId: draft.entityId,
        },
        // Already-read notifications stay read even if the underlying
        // record is still open next time this runs — only metadata that
        // could have changed (e.g. the title) is refreshed.
        update: {
          title: draft.title,
          body: draft.body,
        },
      }),
    ),
  );
}

/* ============================================================================
   PREFERENCES

   One row per AdminUser, created lazily. Absence of a row means every
   default below applies — callers never need a separate "does a row
   exist" branch.
============================================================================ */

export type NotificationPreferences = {
  soundEnabled: boolean;
  inAppEnabled: boolean;
  messagesEnabled: boolean;
  tasksEnabled: boolean;
  approvalsEnabled: boolean;
  campaignsEnabled: boolean;
  socialMediaEnabled: boolean;
  leaveEnabled: boolean;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  soundEnabled: false,
  inAppEnabled: true,
  messagesEnabled: true,
  tasksEnabled: true,
  approvalsEnabled: true,
  campaignsEnabled: true,
  socialMediaEnabled: true,
  leaveEnabled: true,
};

export async function getUserNotificationPreferences(adminUserId: string): Promise<NotificationPreferences> {
  const row = await prisma.adminNotificationPreference.findUnique({ where: { adminUserId } });
  if (!row) return DEFAULT_NOTIFICATION_PREFERENCES;

  return {
    soundEnabled: row.soundEnabled,
    inAppEnabled: row.inAppEnabled,
    messagesEnabled: row.messagesEnabled,
    tasksEnabled: row.tasksEnabled,
    approvalsEnabled: row.approvalsEnabled,
    campaignsEnabled: row.campaignsEnabled,
    socialMediaEnabled: row.socialMediaEnabled,
    leaveEnabled: row.leaveEnabled,
  };
}

const PREFERENCE_KEYS = [
  "soundEnabled",
  "inAppEnabled",
  "messagesEnabled",
  "tasksEnabled",
  "approvalsEnabled",
  "campaignsEnabled",
  "socialMediaEnabled",
  "leaveEnabled",
] as const satisfies readonly (keyof NotificationPreferences)[];

/** Allow-lists exactly the 8 known boolean fields — any other key present
 *  on the input (role, id, anything) is silently ignored, never trusted. */
export async function updateUserNotificationPreferences(
  adminUserId: string,
  patch: Partial<Record<keyof NotificationPreferences, unknown>>,
): Promise<NotificationPreferences> {
  const sanitised: Partial<NotificationPreferences> = {};

  for (const key of PREFERENCE_KEYS) {
    if (typeof patch[key] === "boolean") {
      sanitised[key] = patch[key];
    }
  }

  const current = await getUserNotificationPreferences(adminUserId);
  const merged = { ...current, ...sanitised };

  await prisma.adminNotificationPreference.upsert({
    where: { adminUserId },
    create: { adminUserId, ...merged },
    update: sanitised,
  });

  return merged;
}

/** NotificationTypes gated by a category toggle. Anything not listed here
 *  (operational alerts like invoice/contract/offer, calendar events) is
 *  always delivered regardless of preferences. */
const CATEGORY_TYPES: Record<Exclude<keyof NotificationPreferences, "soundEnabled" | "inAppEnabled">, NotificationType[]> = {
  messagesEnabled: [NotificationType.MESSAGE_RECEIVED],
  tasksEnabled: [NotificationType.CAMPAIGN_TASK_ASSIGNED, NotificationType.CAMPAIGN_TASK_OVERDUE],
  approvalsEnabled: [
    NotificationType.CAMPAIGN_APPROVAL_PENDING,
    NotificationType.CAMPAIGN_APPROVAL_DECIDED,
    NotificationType.CAMPAIGN_EXPENSE_APPROVAL_PENDING,
    NotificationType.SOCIAL_POST_PENDING_APPROVAL,
    NotificationType.BRAND_REQUEST_DECIDED,
  ],
  campaignsEnabled: [NotificationType.CAMPAIGN_MILESTONE_DUE_SOON],
  socialMediaEnabled: [
    NotificationType.SOCIAL_POST_CHANGES_REQUESTED,
    NotificationType.SOCIAL_POST_PUBLISHED,
    NotificationType.SOCIAL_POST_FAILED,
    NotificationType.SOCIAL_ACCOUNT_DISCONNECTED,
  ],
  leaveEnabled: [
    NotificationType.LEAVE_REQUEST_PENDING,
    NotificationType.LEAVE_REQUEST_APPROVED,
    NotificationType.LEAVE_REQUEST_REJECTED,
  ],
};

function disabledTypesFor(preferences: NotificationPreferences): NotificationType[] {
  const disabled: NotificationType[] = [];

  for (const [key, types] of Object.entries(CATEGORY_TYPES) as [keyof typeof CATEGORY_TYPES, NotificationType[]][]) {
    if (!preferences[key]) disabled.push(...types);
  }

  return disabled;
}

/* ============================================================================
   READ / LIST
============================================================================ */

export async function syncAndListNotifications(
  identity: ResolvedIdentity,
  options?: { limit?: number; cursor?: string | null; filter?: "all" | "unread" },
) {
  // Sync best-effort: if materialising new notifications fails (e.g. one
  // source table is temporarily unavailable), still return whatever is
  // already stored rather than failing the whole notifications panel.
  try {
    await syncNotifications(identity);
  } catch (error) {
    console.error("[notifications] sync failed, returning existing notifications only:", error);
  }

  const preferences = await getUserNotificationPreferences(identity.admin.id);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));

  if (!preferences.inAppEnabled) {
    return { items: [], unreadCount: 0, nextCursor: null };
  }

  const disabledTypes = disabledTypesFor(preferences);

  const baseWhere = {
    recipientAdminUserId: identity.admin.id,
    dismissedAt: null,
    ...(disabledTypes.length > 0 ? { type: { notIn: disabledTypes } } : {}),
  };

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { ...baseWhere, ...(options?.filter === "unread" ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(options?.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
    }),
    prisma.notification.count({ where: { ...baseWhere, read: false } }),
  ]);

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;

  return { items: page, unreadCount, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
}

export async function getUnreadNotificationCount(adminUserId: string): Promise<number> {
  const preferences = await getUserNotificationPreferences(adminUserId);
  if (!preferences.inAppEnabled) return 0;

  const disabledTypes = disabledTypesFor(preferences);

  return prisma.notification.count({
    where: {
      recipientAdminUserId: adminUserId,
      read: false,
      dismissedAt: null,
      ...(disabledTypes.length > 0 ? { type: { notIn: disabledTypes } } : {}),
    },
  });
}

export async function markNotificationRead(adminUserId: string, id: string) {
  const result = await prisma.notification.updateMany({
    where: { id, recipientAdminUserId: adminUserId },
    data: { read: true, readAt: new Date() },
  });

  return result.count > 0;
}

export async function markAllNotificationsRead(adminUserId: string) {
  await prisma.notification.updateMany({
    where: { recipientAdminUserId: adminUserId, read: false },
    data: { read: true, readAt: new Date() },
  });
}

export async function dismissNotification(adminUserId: string, id: string) {
  const result = await prisma.notification.updateMany({
    where: { id, recipientAdminUserId: adminUserId },
    data: { dismissedAt: new Date() },
  });

  return result.count > 0;
}
