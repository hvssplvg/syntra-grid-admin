// lib/messaging/attachments.ts
//
// Private (Cloudinary "authenticated" delivery type) file attachments for
// internal messages. Upload is its own step (POST /api/admin/chat/attachments)
// ahead of sending the message itself — see InternalMessageAttachment's
// nullable messageId in prisma/schema.prisma.

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import { destroyCloudinaryAsset, signedAuthenticatedAssetUrl, uploadBufferToCloudinary } from "@/lib/cloudinary-server";
import { assertConversationMembership, type ResolvedIdentity } from "@/lib/messaging/permissions";

export const MESSAGE_ATTACHMENTS_FOLDER = "syntragrid/messages/attachments";

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15MB

// Checked on BOTH the claimed MIME type and the filename's extension —
// a file is only accepted if both agree it's one of these, so a
// disguised executable (e.g. "invoice.pdf.exe", or a .exe relabelled
// with an image MIME type) is rejected either way.
const ALLOWED_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "text/csv": [".csv"],
  "text/plain": [".txt"],
};

const DENIED_EXTENSIONS = [".exe", ".bat", ".sh", ".cmd", ".com", ".js", ".msi", ".app", ".scr", ".ps1", ".jar"];

function extensionOf(filename: string): string {
  const match = /\.[a-z0-9]+$/i.exec(filename);
  return match ? match[0].toLowerCase() : "";
}

function assertFileAllowed(filename: string, mimeType: string, size: number) {
  const ext = extensionOf(filename);

  if (DENIED_EXTENSIONS.includes(ext)) {
    throw new AuthorisationError("That file type isn't allowed.");
  }

  const allowedExtensions = ALLOWED_TYPES[mimeType];
  if (!allowedExtensions || !allowedExtensions.includes(ext)) {
    throw new AuthorisationError("That file type isn't supported. Share images, PDFs, Office documents, or text/CSV files.");
  }

  if (size <= 0 || size > MAX_ATTACHMENT_BYTES) {
    throw new AuthorisationError("Files must be 15MB or smaller.");
  }
}

export async function uploadMessageAttachment(
  identity: ResolvedIdentity,
  file: { buffer: Buffer; filename: string; mimeType: string; size: number },
) {
  assertFileAllowed(file.filename, file.mimeType, file.size);

  const resourceType = file.mimeType.startsWith("image/") ? "image" : "raw";

  const uploaded = await uploadBufferToCloudinary(file.buffer, {
    folder: MESSAGE_ATTACHMENTS_FOLDER,
    resourceType,
    type: "authenticated",
  });

  return prisma.internalMessageAttachment.create({
    data: {
      uploadedById: identity.admin.id,
      cloudinaryPublicId: uploaded.public_id,
      resourceType,
      originalFilename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
    },
  });
}

/**
 * Resolves a short-lived signed delivery URL for an attachment — only
 * after confirming the caller is a member of the conversation the
 * attachment's message belongs to, and that the message itself hasn't
 * been deleted. Never cached; generate fresh on every request.
 */
export async function resolveAttachmentDownload(identity: ResolvedIdentity, attachmentId: string) {
  const attachment = await prisma.internalMessageAttachment.findUnique({
    where: { id: attachmentId },
    include: { message: { select: { conversationId: true, deletedAt: true } } },
  });

  if (!attachment || !attachment.message || attachment.message.deletedAt) {
    throw new AuthorisationError("Attachment could not be found.");
  }

  await assertConversationMembership(attachment.message.conversationId, identity.admin.id);

  return {
    url: signedAuthenticatedAssetUrl(attachment.cloudinaryPublicId, attachment.resourceType === "image" ? "image" : "raw"),
    filename: attachment.originalFilename,
    mimeType: attachment.mimeType,
  };
}

/** Only the uploader may discard their own not-yet-sent attachment. */
export async function discardPendingAttachment(identity: ResolvedIdentity, attachmentId: string) {
  const attachment = await prisma.internalMessageAttachment.findUnique({ where: { id: attachmentId } });

  if (!attachment || attachment.uploadedById !== identity.admin.id || attachment.messageId) {
    throw new AuthorisationError("Attachment could not be found.");
  }

  await destroyCloudinaryAsset(attachment.cloudinaryPublicId, attachment.resourceType === "image" ? "image" : "raw", "authenticated");
  await prisma.internalMessageAttachment.delete({ where: { id: attachmentId } });
}
