-- AlterTable
ALTER TABLE "InternalMessageAttachment" ADD COLUMN     "uploadedById" TEXT NOT NULL,
ALTER COLUMN "messageId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "InternalMessageAttachment_uploadedById_idx" ON "InternalMessageAttachment"("uploadedById");

-- AddForeignKey
ALTER TABLE "InternalMessageAttachment" ADD CONSTRAINT "InternalMessageAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
