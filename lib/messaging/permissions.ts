// lib/messaging/permissions.ts
//
// Deliberately NOT a PermissionGrant/AccessAction-gated module like
// lib/social-media/permissions.ts or lib/campaigns/permissions.ts.
// Internal messaging is available to every active AdminUser by design
// (confirmed explicitly, not assumed) — it is a basic internal-comms
// utility for "employees who have accounts", not a business module that
// restricted employee accounts need a grant for. The only access boundary
// is conversation membership, enforced here and nowhere else, so every
// IDOR-sensitive check for this feature lives in one reviewable file.

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError, getCurrentIdentity, type ResolvedIdentity } from "@/lib/auth/current-admin";
import { InternalConversationMemberRole } from "@/app/generated/prisma/enums";
import type { InternalMessage } from "@/app/generated/prisma/client";

export { getCurrentIdentity, type ResolvedIdentity };

/** Any signed-in, active AdminUser may use messaging — no module grant. */
export async function requireMessagingIdentity(): Promise<ResolvedIdentity> {
  const identity = await getCurrentIdentity();

  if (!identity.admin.active) {
    throw new AuthenticationError("Your account is not active.");
  }

  return identity;
}

/**
 * Throws a generic "not found" rather than "forbidden" when the caller is
 * not a member — a real conversation id should look indistinguishable
 * from a made-up one to someone who isn't in it, to avoid confirming the
 * conversation exists via an IDOR probe.
 */
export async function assertConversationMembership(conversationId: string, adminUserId: string) {
  const member = await prisma.internalConversationMember.findUnique({
    where: { conversationId_adminUserId: { conversationId, adminUserId } },
  });

  if (!member || member.leftAt) {
    throw new AuthorisationError("Conversation could not be found.");
  }

  return member;
}

export function assertGroupManagementPermission(member: { role: InternalConversationMemberRole }) {
  if (member.role !== InternalConversationMemberRole.ADMIN) {
    throw new AuthorisationError("Only a group admin can manage this conversation's membership.");
  }
}

/** No admin override, by design — see spec: edit/delete is sender-only. */
export function assertMessageOwnership(message: Pick<InternalMessage, "senderId">, adminUserId: string) {
  if (message.senderId !== adminUserId) {
    throw new AuthorisationError("You can only edit or delete your own messages.");
  }
}
