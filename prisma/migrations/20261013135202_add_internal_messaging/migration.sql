-- CreateEnum
CREATE TYPE "InternalConversationType" AS ENUM ('DIRECT', 'GROUP');

-- CreateEnum
CREATE TYPE "InternalConversationMemberRole" AS ENUM ('MEMBER', 'ADMIN');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MESSAGE_RECEIVED';

-- CreateTable
CREATE TABLE "InternalConversation" (
    "id" TEXT NOT NULL,
    "type" "InternalConversationType" NOT NULL,
    "name" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "InternalConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "role" "InternalConversationMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "InternalConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InternalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternalMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternalConversation_lastMessageAt_idx" ON "InternalConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "InternalConversationMember_adminUserId_idx" ON "InternalConversationMember"("adminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "InternalConversationMember_conversationId_adminUserId_key" ON "InternalConversationMember"("conversationId", "adminUserId");

-- CreateIndex
CREATE INDEX "InternalMessage_conversationId_createdAt_idx" ON "InternalMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "InternalMessageAttachment_messageId_idx" ON "InternalMessageAttachment"("messageId");

-- AddForeignKey
ALTER TABLE "InternalConversation" ADD CONSTRAINT "InternalConversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalConversationMember" ADD CONSTRAINT "InternalConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "InternalConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalConversationMember" ADD CONSTRAINT "InternalConversationMember_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "InternalConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessage" ADD CONSTRAINT "InternalMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalMessageAttachment" ADD CONSTRAINT "InternalMessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "InternalMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
