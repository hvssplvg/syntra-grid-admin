-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LEAVE_REQUEST_PENDING', 'TICKET_URGENT', 'INVOICE_OVERDUE', 'INTERVIEW_UPCOMING', 'OFFER_EXPIRING', 'CONTRACT_RENEWAL_DUE', 'ACTIVITY');

-- CreateTable
CREATE TABLE "AdminOverviewPreference" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "preferences" JSONB NOT NULL,
    "wallpaperUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminOverviewPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientAdminUserId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "module" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminOverviewPreference_adminUserId_key" ON "AdminOverviewPreference"("adminUserId");

-- CreateIndex
CREATE INDEX "Notification_recipientAdminUserId_read_idx" ON "Notification"("recipientAdminUserId", "read");

-- CreateIndex
CREATE INDEX "Notification_recipientAdminUserId_createdAt_idx" ON "Notification"("recipientAdminUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_recipientAdminUserId_sourceKey_key" ON "Notification"("recipientAdminUserId", "sourceKey");

-- AddForeignKey
ALTER TABLE "AdminOverviewPreference" ADD CONSTRAINT "AdminOverviewPreference_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientAdminUserId_fkey" FOREIGN KEY ("recipientAdminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
