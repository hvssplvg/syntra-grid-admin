-- CreateEnum
CREATE TYPE "SocialAccountType" AS ENUM ('PERSONAL', 'ORGANIZATION');

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "accountType" "SocialAccountType" NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN     "sharesAuthWithId" TEXT;

-- CreateIndex
CREATE INDEX "SocialAccount_sharesAuthWithId_idx" ON "SocialAccount"("sharesAuthWithId");

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_sharesAuthWithId_fkey" FOREIGN KEY ("sharesAuthWithId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
