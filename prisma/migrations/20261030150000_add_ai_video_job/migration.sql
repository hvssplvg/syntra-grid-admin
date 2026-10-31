-- CreateEnum
CREATE TYPE "AiVideoJobStatus" AS ENUM ('DRAFT', 'AWAITING_CONFIRMATION', 'QUEUED', 'GENERATING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AiVideoJob" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "contentProjectId" TEXT,
    "sceneId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "startFrameUrl" TEXT,
    "endFrameUrl" TEXT,
    "providerJobId" TEXT,
    "status" "AiVideoJobStatus" NOT NULL DEFAULT 'DRAFT',
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL,
    "actualCostUsd" DOUBLE PRECISION,
    "outputVideoUrl" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiVideoJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiVideoJob_adminUserId_idx" ON "AiVideoJob"("adminUserId");

-- CreateIndex
CREATE INDEX "AiVideoJob_status_idx" ON "AiVideoJob"("status");

-- CreateIndex
CREATE INDEX "AiVideoJob_contentProjectId_idx" ON "AiVideoJob"("contentProjectId");

-- AddForeignKey
ALTER TABLE "AiVideoJob" ADD CONSTRAINT "AiVideoJob_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiVideoJob" ADD CONSTRAINT "AiVideoJob_contentProjectId_fkey" FOREIGN KEY ("contentProjectId") REFERENCES "ContentProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
