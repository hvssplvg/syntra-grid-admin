-- CreateEnum
CREATE TYPE "BrandAssetType" AS ENUM ('IMAGE', 'SVG', 'VIDEO', 'DOCUMENT', 'PRESENTATION', 'DESIGN_FILE', 'FONT', 'OTHER');

-- CreateEnum
CREATE TYPE "BrandAssetStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BrandAssetUsageRights" AS ENUM ('INTERNAL_ONLY', 'CLIENT_APPROVED', 'PUBLIC', 'UNRESTRICTED');

-- CreateEnum
CREATE TYPE "BrandKitStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BrandGuidelineStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "BrandTemplateCategory" AS ENUM ('INSTAGRAM_POST', 'INSTAGRAM_STORY', 'LINKEDIN_GRAPHIC', 'SOCIAL_COVER', 'MARKETING_BANNER', 'PRESENTATION', 'BUSINESS_CARD', 'LETTERHEAD', 'PROPOSAL', 'EMAIL_SIGNATURE', 'OTHER');

-- CreateEnum
CREATE TYPE "BrandTemplateStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BrandRequestType" AS ENUM ('LOGO', 'SOCIAL_GRAPHIC', 'MARKETING_MATERIAL', 'PRESENTATION', 'GUIDELINE_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "BrandRequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "BrandRequestStatus" AS ENUM ('SUBMITTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BrandRequestActivityType" AS ENUM ('CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'COMMENTED', 'ATTACHMENT_ADDED', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "SocialMediaAsset" ADD COLUMN     "brandAssetId" TEXT;

-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "BrandKitStatus" NOT NULL DEFAULT 'ACTIVE',
    "clientId" TEXT,
    "logoAssetId" TEXT,
    "primaryColors" JSONB,
    "secondaryColors" JSONB,
    "typography" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "BrandAssetType" NOT NULL,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "url" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" DOUBLE PRECISION,
    "usageRights" "BrandAssetUsageRights" NOT NULL DEFAULT 'INTERNAL_ONLY',
    "status" "BrandAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "brandKitId" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandAssetVersion" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandAssetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandGuideline" (
    "id" TEXT NOT NULL,
    "brandKitId" TEXT NOT NULL,
    "tagline" TEXT,
    "mission" TEXT,
    "vision" TEXT,
    "values" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "personality" TEXT,
    "toneOfVoice" TEXT,
    "logoSpacingNotes" TEXT,
    "minLogoSizeNotes" TEXT,
    "approvedUsageNotes" TEXT,
    "incorrectUsageNotes" TEXT,
    "fontUsageNotes" TEXT,
    "socialMediaGuidelines" TEXT,
    "photographyGuidelines" TEXT,
    "videoGuidelines" TEXT,
    "marketingStandards" TEXT,
    "emailSignatureGuidelines" TEXT,
    "status" "BrandGuidelineStatus" NOT NULL DEFAULT 'DRAFT',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandGuideline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandGuidelineVersion" (
    "id" TEXT NOT NULL,
    "guidelineId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandGuidelineVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "BrandTemplateCategory" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "url" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "status" "BrandTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "brandKitId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "BrandRequestType" NOT NULL,
    "priority" "BrandRequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "BrandRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "brandKitId" TEXT,
    "dueDate" TIMESTAMP(3),
    "requestedById" TEXT,
    "assignedToId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRequestAttachment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandRequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRequestComment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRequestActivity" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "BrandRequestActivityType" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandRequestActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandKit_slug_key" ON "BrandKit"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BrandKit_logoAssetId_key" ON "BrandKit"("logoAssetId");

-- CreateIndex
CREATE INDEX "BrandKit_status_idx" ON "BrandKit"("status");

-- CreateIndex
CREATE INDEX "BrandKit_clientId_idx" ON "BrandKit"("clientId");

-- CreateIndex
CREATE INDEX "BrandAsset_type_idx" ON "BrandAsset"("type");

-- CreateIndex
CREATE INDEX "BrandAsset_status_idx" ON "BrandAsset"("status");

-- CreateIndex
CREATE INDEX "BrandAsset_brandKitId_idx" ON "BrandAsset"("brandKitId");

-- CreateIndex
CREATE INDEX "BrandAsset_category_idx" ON "BrandAsset"("category");

-- CreateIndex
CREATE INDEX "BrandAssetVersion_assetId_idx" ON "BrandAssetVersion"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandAssetVersion_assetId_versionNumber_key" ON "BrandAssetVersion"("assetId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BrandGuideline_brandKitId_key" ON "BrandGuideline"("brandKitId");

-- CreateIndex
CREATE INDEX "BrandGuidelineVersion_guidelineId_idx" ON "BrandGuidelineVersion"("guidelineId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandGuidelineVersion_guidelineId_versionNumber_key" ON "BrandGuidelineVersion"("guidelineId", "versionNumber");

-- CreateIndex
CREATE INDEX "BrandTemplate_category_idx" ON "BrandTemplate"("category");

-- CreateIndex
CREATE INDEX "BrandTemplate_status_idx" ON "BrandTemplate"("status");

-- CreateIndex
CREATE INDEX "BrandTemplate_brandKitId_idx" ON "BrandTemplate"("brandKitId");

-- CreateIndex
CREATE INDEX "BrandRequest_status_idx" ON "BrandRequest"("status");

-- CreateIndex
CREATE INDEX "BrandRequest_assignedToId_idx" ON "BrandRequest"("assignedToId");

-- CreateIndex
CREATE INDEX "BrandRequest_requestedById_idx" ON "BrandRequest"("requestedById");

-- CreateIndex
CREATE INDEX "BrandRequest_brandKitId_idx" ON "BrandRequest"("brandKitId");

-- CreateIndex
CREATE INDEX "BrandRequestAttachment_requestId_idx" ON "BrandRequestAttachment"("requestId");

-- CreateIndex
CREATE INDEX "BrandRequestComment_requestId_idx" ON "BrandRequestComment"("requestId");

-- CreateIndex
CREATE INDEX "BrandRequestActivity_requestId_idx" ON "BrandRequestActivity"("requestId");

-- CreateIndex
CREATE INDEX "BrandRequestActivity_createdAt_idx" ON "BrandRequestActivity"("createdAt");

-- CreateIndex
CREATE INDEX "SocialMediaAsset_brandAssetId_idx" ON "SocialMediaAsset"("brandAssetId");

-- AddForeignKey
ALTER TABLE "SocialMediaAsset" ADD CONSTRAINT "SocialMediaAsset_brandAssetId_fkey" FOREIGN KEY ("brandAssetId") REFERENCES "BrandAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "BrandAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "BrandKit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAsset" ADD CONSTRAINT "BrandAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAssetVersion" ADD CONSTRAINT "BrandAssetVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "BrandAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandAssetVersion" ADD CONSTRAINT "BrandAssetVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandGuideline" ADD CONSTRAINT "BrandGuideline_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "BrandKit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandGuideline" ADD CONSTRAINT "BrandGuideline_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandGuidelineVersion" ADD CONSTRAINT "BrandGuidelineVersion_guidelineId_fkey" FOREIGN KEY ("guidelineId") REFERENCES "BrandGuideline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandGuidelineVersion" ADD CONSTRAINT "BrandGuidelineVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandTemplate" ADD CONSTRAINT "BrandTemplate_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "BrandKit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandTemplate" ADD CONSTRAINT "BrandTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRequest" ADD CONSTRAINT "BrandRequest_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "BrandKit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRequest" ADD CONSTRAINT "BrandRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRequest" ADD CONSTRAINT "BrandRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRequestAttachment" ADD CONSTRAINT "BrandRequestAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BrandRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRequestAttachment" ADD CONSTRAINT "BrandRequestAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRequestComment" ADD CONSTRAINT "BrandRequestComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BrandRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRequestComment" ADD CONSTRAINT "BrandRequestComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRequestActivity" ADD CONSTRAINT "BrandRequestActivity_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BrandRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRequestActivity" ADD CONSTRAINT "BrandRequestActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

