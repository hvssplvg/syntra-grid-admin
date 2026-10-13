// lib/messaging/server.ts
//
// Core CRUD for the internal employee messaging system. Every function
// takes the already-authenticated identity (lib/messaging/permissions.ts)
// and never trusts a client-supplied sender/actor id — the acting
// AdminUser always comes from identity.admin.id.

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import {
  InternalConversationMemberRole,
  InternalConversationType,
  NotificationType,
} from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";
import { assertConversationMembership, assertGroupManagementPermission, assertMessageOwnership, type ResolvedIdentity } from "@/lib/messaging/permissions";

const MAX_MESSAGE_LENGTH = 4000;
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

/* ============================================================================
   CONVERSATIONS
============================================================================ */

export async function findOrCreateDirectConversation(identity: ResolvedIdentity, otherAdminUserId: string) {
  if (otherAdminUserId === identity.admin.id) {
    throw new AuthorisationError("You can't start a conversation with yourself.");
  }

  const other = await prisma.adminUser.findUnique({ where: { id: otherAdminUserId } });
  if (!other || !other.active) {
    throw new AuthorisationError("That person could not be found.");
  }

  const existing = await prisma.internalConversation.findFirst({
    where: {
      type: InternalConversationType.DIRECT,
      members: { some: { adminUserId: identity.admin.id, leftAt: null } },
      AND: { members: { some: { adminUserId: otherAdminUserId, leftAt: null } } },
    },
    include: CONVERSATION_INCLUDE,
  });

  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    // Re-check inside the transaction: closes the window where two
    // concurrent requests both miss the findFirst above and both try to
    // create the same pair's first conversation.
    const raceCheck = await tx.internalConversation.findFirst({
      where: {
        type: InternalConversationType.DIRECT,
        members: { some: { adminUserId: identity.admin.id, leftAt: null } },
        AND: { members: { some: { adminUserId: otherAdminUserId, leftAt: null } } },
      },
      include: CONVERSATION_INCLUDE,
    });

    if (raceCheck) return raceCheck;

    return tx.internalConversation.create({
      data: {
        type: InternalConversationType.DIRECT,
        createdById: identity.admin.id,
        members: {
          create: [
            { adminUserId: identity.admin.id, role: InternalConversationMemberRole.ADMIN },
            { adminUserId: otherAdminUserId, role: InternalConversationMemberRole.ADMIN },
          ],
        },
      },
      include: CONVERSATION_INCLUDE,
    });
  });
}

export async function createGroupConversation(identity: ResolvedIdentity, input: { name: string; memberIds: string[] }) {
  const name = input.name.trim();
  if (!name) throw new AuthorisationError("Give the group a name.");

  const memberIds = Array.from(new Set(input.memberIds.filter((id) => id !== identity.admin.id)));
  if (memberIds.length === 0) {
    throw new AuthorisationError("Add at least one other person to the group.");
  }

  const activeCount = await prisma.adminUser.count({ where: { id: { in: memberIds }, active: true } });
  if (activeCount !== memberIds.length) {
    throw new AuthorisationError("One or more selected people could not be found.");
  }

  return prisma.internalConversation.create({
    data: {
      type: InternalConversationType.GROUP,
      name,
      createdById: identity.admin.id,
      members: {
        create: [
          { adminUserId: identity.admin.id, role: InternalConversationMemberRole.ADMIN },
          ...memberIds.map((adminUserId) => ({ adminUserId, role: InternalConversationMemberRole.MEMBER })),
        ],
      },
    },
    include: CONVERSATION_INCLUDE,
  });
}

// Employee.avatarUrl/jobTitle take precedence over AdminUser's own
// fields — same "real photo + professional title" source of truth as
// /api/admin/me and the header (see lib/employment.ts). department.name
// is the fallback label when there's no job title (e.g. no Employee
// record at all, such as the Owner).
const ADMIN_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  avatarUrl: true,
  employee: {
    select: {
      avatarUrl: true,
      jobTitle: true,
      department: { select: { name: true } },
    },
  },
} satisfies Prisma.AdminUserSelect;

const CONVERSATION_INCLUDE = {
  members: {
    where: { leftAt: null },
    include: { adminUser: { select: ADMIN_USER_SELECT } },
  },
} satisfies Prisma.InternalConversationInclude;

export type ConversationWithMembers = Prisma.InternalConversationGetPayload<{ include: typeof CONVERSATION_INCLUDE }>;

export async function listConversationsForUser(
  identity: ResolvedIdentity,
  options?: { cursor?: string | null; limit?: number },
) {
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, options?.limit ?? DEFAULT_PAGE_SIZE));

  const conversations = await prisma.internalConversation.findMany({
    where: { members: { some: { adminUserId: identity.admin.id, leftAt: null } } },
    include: {
      ...CONVERSATION_INCLUDE,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, body: true, senderId: true, createdAt: true, deletedAt: true },
      },
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
    ...(options?.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
  });

  const hasMore = conversations.length > limit;
  const page = hasMore ? conversations.slice(0, limit) : conversations;

  const unread = await getUnreadByConversation(identity, page.map((conversation) => conversation.id));

  return {
    conversations: page.map((conversation) => ({
      ...conversation,
      unreadCount: unread.get(conversation.id) ?? 0,
    })),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}

export async function getConversationOrThrow(conversationId: string) {
  const conversation = await prisma.internalConversation.findUnique({
    where: { id: conversationId },
    include: CONVERSATION_INCLUDE,
  });

  if (!conversation) throw new AuthorisationError("Conversation could not be found.");
  return conversation;
}

/* ============================================================================
   UNREAD TRACKING

   Derived from InternalConversationMember.lastReadAt — never from a
   per-message read-state table. Only the unread messages themselves are
   fetched (bounded by how far behind the member is), not the full
   history, so this stays cheap even for a long-lived conversation.
============================================================================ */

async function getUnreadByConversation(identity: ResolvedIdentity, conversationIds: string[]): Promise<Map<string, number>> {
  if (conversationIds.length === 0) return new Map();

  const memberships = await prisma.internalConversationMember.findMany({
    where: { adminUserId: identity.admin.id, conversationId: { in: conversationIds }, leftAt: null },
    select: { conversationId: true, lastReadAt: true },
  });

  if (memberships.length === 0) return new Map();

  const unreadMessages = await prisma.internalMessage.findMany({
    where: {
      senderId: { not: identity.admin.id },
      deletedAt: null,
      OR: memberships.map((membership) => ({
        conversationId: membership.conversationId,
        createdAt: { gt: membership.lastReadAt ?? new Date(0) },
      })),
    },
    select: { conversationId: true },
  });

  const counts = new Map<string, number>();
  for (const message of unreadMessages) {
    counts.set(message.conversationId, (counts.get(message.conversationId) ?? 0) + 1);
  }
  return counts;
}

export async function getUnreadSummary(identity: ResolvedIdentity): Promise<{ unreadConversations: number; unreadMessages: number }> {
  const memberships = await prisma.internalConversationMember.findMany({
    where: { adminUserId: identity.admin.id, leftAt: null },
    select: { conversationId: true },
  });

  const counts = await getUnreadByConversation(identity, memberships.map((membership) => membership.conversationId));

  let unreadMessages = 0;
  for (const count of counts.values()) unreadMessages += count;

  return { unreadConversations: counts.size, unreadMessages };
}

export async function markConversationRead(identity: ResolvedIdentity, conversationId: string) {
  await assertConversationMembership(conversationId, identity.admin.id);

  await prisma.internalConversationMember.update({
    where: { conversationId_adminUserId: { conversationId, adminUserId: identity.admin.id } },
    data: { lastReadAt: new Date() },
  });
}

/* ============================================================================
   MESSAGES
============================================================================ */

const MESSAGE_INCLUDE = {
  sender: { select: ADMIN_USER_SELECT },
  attachments: true,
} satisfies Prisma.InternalMessageInclude;

export async function listMessages(
  identity: ResolvedIdentity,
  conversationId: string,
  options?: { cursor?: string | null; limit?: number },
) {
  await assertConversationMembership(conversationId, identity.admin.id);

  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, options?.limit ?? DEFAULT_PAGE_SIZE));

  const messages = await prisma.internalMessage.findMany({
    where: { conversationId },
    include: MESSAGE_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(options?.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
  });

  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;

  return { messages: page.reverse(), nextCursor: hasMore ? page[0]?.id ?? null : null };
}

export async function sendMessage(
  identity: ResolvedIdentity,
  conversationId: string,
  input: { body?: string | null; attachmentIds?: string[] },
) {
  await assertConversationMembership(conversationId, identity.admin.id);

  const body = input.body?.trim() ?? "";
  const attachmentIds = input.attachmentIds ?? [];

  if (!body && attachmentIds.length === 0) {
    throw new AuthorisationError("Write a message or attach a file before sending.");
  }
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new AuthorisationError(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`);
  }

  if (attachmentIds.length > 0) {
    // Only the uploader may claim their own pending (messageId: null)
    // attachment, and only once — this is the IDOR boundary for
    // attachments, since the upload step and the send step are separate
    // requests.
    const claimable = await prisma.internalMessageAttachment.count({
      where: { id: { in: attachmentIds }, uploadedById: identity.admin.id, messageId: null },
    });
    if (claimable !== attachmentIds.length) {
      throw new AuthorisationError("One or more attachments are invalid or have already been used.");
    }
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.internalMessage.create({
      data: {
        conversationId,
        senderId: identity.admin.id,
        body: body || null,
        ...(attachmentIds.length > 0 ? { attachments: { connect: attachmentIds.map((id) => ({ id })) } } : {}),
      },
      include: MESSAGE_INCLUDE,
    });

    await tx.internalConversation.update({ where: { id: conversationId }, data: { lastMessageAt: created.createdAt } });

    // The sender's own lastReadAt also advances — sending a message
    // implies having seen everything up to that point.
    await tx.internalConversationMember.update({
      where: { conversationId_adminUserId: { conversationId, adminUserId: identity.admin.id } },
      data: { lastReadAt: created.createdAt },
    });

    return created;
  });

  await notifyOtherMembers(conversationId, identity.admin.id, message.id, body);

  return message;
}

/**
 * Written directly at send-time rather than derived on read, unlike
 * every other lib/notifications/server.ts source (AuditLog rows,
 * domain Activity tables, etc.) — a deliberate, documented exception:
 * a message is the one thing that is genuinely pushed, not a fact
 * re-derivable later from some other table. sourceKey is unique per
 * (message, recipient), so this can never double-notify.
 */
async function notifyOtherMembers(conversationId: string, senderId: string, messageId: string, body: string) {
  const [sender, recipients] = await Promise.all([
    prisma.adminUser.findUnique({ where: { id: senderId }, select: { firstName: true, lastName: true, email: true } }),
    prisma.internalConversationMember.findMany({
      where: { conversationId, leftAt: null, adminUserId: { not: senderId } },
      select: { adminUserId: true },
    }),
  ]);

  if (recipients.length === 0) return;

  const senderName = [sender?.firstName, sender?.lastName].filter(Boolean).join(" ") || sender?.email || "Someone";

  await prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      recipientAdminUserId: recipient.adminUserId,
      type: NotificationType.MESSAGE_RECEIVED,
      title: `New message from ${senderName}`,
      body: body ? (body.length > 140 ? `${body.slice(0, 140)}…` : body) : "Sent an attachment",
      module: "messaging",
      entityType: "InternalConversation",
      entityId: conversationId,
      sourceKey: `internal_message:${messageId}:${recipient.adminUserId}`,
    })),
    skipDuplicates: true,
  });
}

export async function editMessage(identity: ResolvedIdentity, messageId: string, body: string) {
  const message = await prisma.internalMessage.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt) throw new AuthorisationError("Message could not be found.");

  await assertConversationMembership(message.conversationId, identity.admin.id);
  assertMessageOwnership(message, identity.admin.id);

  const trimmed = body.trim();
  if (!trimmed) throw new AuthorisationError("A message can't be edited to be empty.");
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new AuthorisationError(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`);
  }

  return prisma.internalMessage.update({
    where: { id: messageId },
    data: { body: trimmed, editedAt: new Date() },
    include: MESSAGE_INCLUDE,
  });
}

export async function deleteMessage(identity: ResolvedIdentity, messageId: string) {
  const message = await prisma.internalMessage.findUnique({ where: { id: messageId } });
  if (!message || message.deletedAt) throw new AuthorisationError("Message could not be found.");

  await assertConversationMembership(message.conversationId, identity.admin.id);
  assertMessageOwnership(message, identity.admin.id);

  return prisma.internalMessage.update({
    where: { id: messageId },
    data: { body: null, deletedAt: new Date() },
    include: MESSAGE_INCLUDE,
  });
}

/* ============================================================================
   GROUP MANAGEMENT
============================================================================ */

export async function renameGroup(identity: ResolvedIdentity, conversationId: string, name: string) {
  const member = await assertConversationMembership(conversationId, identity.admin.id);
  assertGroupManagementPermission(member);

  const trimmed = name.trim();
  if (!trimmed) throw new AuthorisationError("Give the group a name.");

  const conversation = await prisma.internalConversation.findUniqueOrThrow({ where: { id: conversationId } });
  if (conversation.type !== InternalConversationType.GROUP) {
    throw new AuthorisationError("Only group conversations can be renamed.");
  }

  await prisma.internalConversation.update({ where: { id: conversationId }, data: { name: trimmed } });

  await prisma.auditLog.create({
    data: {
      actorId: identity.admin.id,
      action: "INTERNAL_CONVERSATION_RENAMED",
      entityType: "INTERNAL_CONVERSATION",
      entityId: conversationId,
      metadata: { previousName: conversation.name, newName: trimmed },
    },
  });

  return getConversationOrThrow(conversationId);
}

export async function addGroupMember(identity: ResolvedIdentity, conversationId: string, newAdminUserId: string) {
  const member = await assertConversationMembership(conversationId, identity.admin.id);
  assertGroupManagementPermission(member);

  const conversation = await prisma.internalConversation.findUniqueOrThrow({ where: { id: conversationId } });
  if (conversation.type !== InternalConversationType.GROUP) {
    throw new AuthorisationError("Only group conversations can have members added.");
  }

  const target = await prisma.adminUser.findUnique({ where: { id: newAdminUserId } });
  if (!target || !target.active) throw new AuthorisationError("That person could not be found.");

  const existing = await prisma.internalConversationMember.findUnique({
    where: { conversationId_adminUserId: { conversationId, adminUserId: newAdminUserId } },
  });

  if (existing && !existing.leftAt) {
    throw new AuthorisationError("That person is already in the group.");
  }

  if (existing) {
    await prisma.internalConversationMember.update({
      where: { id: existing.id },
      data: { leftAt: null, joinedAt: new Date(), role: InternalConversationMemberRole.MEMBER },
    });
  } else {
    await prisma.internalConversationMember.create({
      data: { conversationId, adminUserId: newAdminUserId, role: InternalConversationMemberRole.MEMBER },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: identity.admin.id,
      action: "INTERNAL_CONVERSATION_MEMBER_ADDED",
      entityType: "INTERNAL_CONVERSATION",
      entityId: conversationId,
      metadata: { addedAdminUserId: newAdminUserId },
    },
  });

  return getConversationOrThrow(conversationId);
}

export async function removeGroupMember(identity: ResolvedIdentity, conversationId: string, targetAdminUserId: string) {
  const member = await assertConversationMembership(conversationId, identity.admin.id);
  assertGroupManagementPermission(member);

  const conversation = await prisma.internalConversation.findUniqueOrThrow({ where: { id: conversationId } });
  if (conversation.type !== InternalConversationType.GROUP) {
    throw new AuthorisationError("Only group conversations can have members removed.");
  }

  const target = await assertConversationMembership(conversationId, targetAdminUserId).catch(() => null);
  if (!target) throw new AuthorisationError("That person is not in this group.");

  await prisma.internalConversationMember.update({
    where: { conversationId_adminUserId: { conversationId, adminUserId: targetAdminUserId } },
    data: { leftAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: identity.admin.id,
      action: "INTERNAL_CONVERSATION_MEMBER_REMOVED",
      entityType: "INTERNAL_CONVERSATION",
      entityId: conversationId,
      metadata: { removedAdminUserId: targetAdminUserId },
    },
  });

  return getConversationOrThrow(conversationId);
}

export async function leaveGroup(identity: ResolvedIdentity, conversationId: string) {
  await assertConversationMembership(conversationId, identity.admin.id);

  const conversation = await prisma.internalConversation.findUniqueOrThrow({ where: { id: conversationId } });
  if (conversation.type !== InternalConversationType.GROUP) {
    throw new AuthorisationError("You can't leave a direct conversation.");
  }

  await prisma.internalConversationMember.update({
    where: { conversationId_adminUserId: { conversationId, adminUserId: identity.admin.id } },
    data: { leftAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: identity.admin.id,
      action: "INTERNAL_CONVERSATION_MEMBER_LEFT",
      entityType: "INTERNAL_CONVERSATION",
      entityId: conversationId,
      metadata: {},
    },
  });
}

/* ============================================================================
   PEOPLE SEARCH
============================================================================ */

export async function searchMessageableUsers(identity: ResolvedIdentity, query: string) {
  const trimmed = query.trim();

  return prisma.adminUser.findMany({
    where: {
      active: true,
      id: { not: identity.admin.id },
      ...(trimmed
        ? {
            OR: [
              { firstName: { contains: trimmed, mode: "insensitive" } },
              { lastName: { contains: trimmed, mode: "insensitive" } },
              { email: { contains: trimmed, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: ADMIN_USER_SELECT,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 25,
  });
}
