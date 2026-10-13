-- AlterEnum
ALTER TYPE "SocialPostStatus" ADD VALUE 'DELIVERED_TO_INBOX';

-- AlterEnum
ALTER TYPE "SocialPostTargetStatus" ADD VALUE 'DELIVERED_TO_INBOX';

-- AlterTable
ALTER TABLE "SocialPostPlatform" ADD COLUMN     "lastPolledAt" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB;
