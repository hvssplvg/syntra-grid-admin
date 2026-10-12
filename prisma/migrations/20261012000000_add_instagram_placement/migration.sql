-- CreateEnum
CREATE TYPE "SocialMediaPlacement" AS ENUM ('FEED', 'REELS', 'STORY');

-- AlterTable
ALTER TABLE "SocialPostPlatform" ADD COLUMN     "placement" "SocialMediaPlacement" NOT NULL DEFAULT 'FEED';
