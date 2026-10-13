-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_REQUEST_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'LEAVE_REQUEST_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'CALENDAR_EVENT_INVITATION';
ALTER TYPE "NotificationType" ADD VALUE 'CALENDAR_EVENT_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'CALENDAR_EVENT_RESCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'BRAND_REQUEST_DECIDED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "dismissedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AdminNotificationPreference" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "messagesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tasksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "approvalsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "campaignsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "socialMediaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "leaveEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminNotificationPreference_adminUserId_key" ON "AdminNotificationPreference"("adminUserId");

-- CreateIndex
CREATE INDEX "Notification_recipientAdminUserId_dismissedAt_idx" ON "Notification"("recipientAdminUserId", "dismissedAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotificationPreference" ADD CONSTRAINT "AdminNotificationPreference_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
