-- CreateEnum
CREATE TYPE "TrendPlatform" AS ENUM ('TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'LINKEDIN', 'REDDIT', 'X', 'OTHER');

-- CreateEnum
CREATE TYPE "TrendType" AS ENUM ('AUDIO', 'MEME', 'VIDEO_FORMAT', 'HOOK', 'GENERAL');

-- CreateEnum
CREATE TYPE "TrendSource" AS ENUM ('AUTOMATED', 'MANUAL');

-- CreateEnum
CREATE TYPE "TrendStatus" AS ENUM ('NEW', 'SAVED', 'DISMISSED', 'USED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrendLicensingStatus" AS ENUM ('ORIGINAL_SAFE_TO_ADAPT', 'REQUIRES_LICENSE', 'RESTRICTED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Trend" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platform" "TrendPlatform" NOT NULL,
    "type" "TrendType" NOT NULL DEFAULT 'GENERAL',
    "category" TEXT,
    "description" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "source" "TrendSource" NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),
    "popularityIndicators" JSONB,
    "audioInfo" JSONB,
    "licensingStatus" "TrendLicensingStatus" NOT NULL DEFAULT 'UNKNOWN',
    "status" "TrendStatus" NOT NULL DEFAULT 'NEW',
    "suitableIndustries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suitableAudiences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedFormats" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestedCaptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relevanceScore" INTEGER,
    "aiAnalysis" JSONB,
    "aiAnalyzedAt" TIMESTAMP(3),
    "contentProjectId" TEXT,
    "createdById" TEXT,
    "savedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trend_sourceUrl_key" ON "Trend"("sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Trend_contentProjectId_key" ON "Trend"("contentProjectId");

-- CreateIndex
CREATE INDEX "Trend_status_idx" ON "Trend"("status");

-- CreateIndex
CREATE INDEX "Trend_platform_idx" ON "Trend"("platform");

-- CreateIndex
CREATE INDEX "Trend_type_idx" ON "Trend"("type");

-- CreateIndex
CREATE INDEX "Trend_relevanceScore_idx" ON "Trend"("relevanceScore");

-- AddForeignKey
ALTER TABLE "Trend" ADD CONSTRAINT "Trend_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trend" ADD CONSTRAINT "Trend_savedById_fkey" FOREIGN KEY ("savedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trend" ADD CONSTRAINT "Trend_contentProjectId_fkey" FOREIGN KEY ("contentProjectId") REFERENCES "ContentProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
