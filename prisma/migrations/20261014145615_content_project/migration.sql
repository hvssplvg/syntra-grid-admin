-- CreateEnum
CREATE TYPE "ContentProjectType" AS ENUM ('GRAPHIC');

-- CreateTable
CREATE TABLE "ContentProject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ContentProjectType" NOT NULL DEFAULT 'GRAPHIC',
    "canvasData" JSONB NOT NULL,
    "ownerId" TEXT NOT NULL,
    "socialPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentProject_socialPostId_key" ON "ContentProject"("socialPostId");

-- CreateIndex
CREATE INDEX "ContentProject_ownerId_idx" ON "ContentProject"("ownerId");

-- AddForeignKey
ALTER TABLE "ContentProject" ADD CONSTRAINT "ContentProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentProject" ADD CONSTRAINT "ContentProject_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
