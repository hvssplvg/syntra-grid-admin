-- CreateEnum
CREATE TYPE "CampaignObjective" AS ENUM ('BRAND_AWARENESS', 'LEAD_GENERATION', 'WEBSITE_TRAFFIC', 'ENGAGEMENT', 'CONVERSIONS', 'PRODUCT_LAUNCH', 'CUSTOMER_ACQUISITION', 'CUSTOMER_RETENTION', 'EVENT_PROMOTION', 'RECRUITMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CampaignMemberRole" AS ENUM ('OWNER', 'MANAGER', 'CONTRIBUTOR', 'REVIEWER', 'STAKEHOLDER');

-- CreateEnum
CREATE TYPE "CampaignMilestoneStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignActivityType" AS ENUM ('CREATED', 'EDITED', 'STATUS_CHANGED', 'ARCHIVED', 'RESTORED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'MILESTONE_CREATED', 'MILESTONE_COMPLETED', 'TASK_CREATED', 'TASK_COMPLETED', 'CONTENT_SUBMITTED', 'CONTENT_APPROVED', 'CONTENT_CHANGES_REQUESTED', 'CONTENT_PUBLISHED', 'BUDGET_CHANGED', 'EXPENSE_RECORDED', 'EXPENSE_APPROVED', 'APPROVAL_REQUESTED', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED', 'APPROVAL_CHANGES_REQUESTED', 'METRIC_IMPORTED', 'AUDIENCE_ASSIGNED', 'AUDIENCE_REMOVED');

-- CreateEnum
CREATE TYPE "CampaignContentType" AS ENUM ('SOCIAL_POST', 'IMAGE', 'VIDEO', 'REEL', 'STORY', 'CAROUSEL', 'BLOG_ARTICLE', 'EMAIL', 'WEBSITE_BANNER', 'LANDING_PAGE', 'ADVERTISEMENT', 'PROMOTIONAL_GRAPHIC', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignContentStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CampaignAudienceCategory" AS ENUM ('GENERAL_CONSUMERS', 'EXISTING_CUSTOMERS', 'POTENTIAL_CUSTOMERS', 'BUSINESS_OWNERS', 'CORPORATE_CLIENTS', 'STUDENTS', 'PROFESSIONALS', 'TECHNOLOGY_ENTHUSIASTS', 'PROPERTY_SEEKERS', 'RECRUITMENT_CANDIDATES', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CampaignRecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CampaignChannelType" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'X', 'TIKTOK', 'YOUTUBE', 'EMAIL', 'WEBSITE', 'PRINT', 'EVENTS', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignBudgetCategory" AS ENUM ('PAID_ADVERTISING', 'CONTENT_PRODUCTION', 'GRAPHIC_DESIGN', 'VIDEO_PRODUCTION', 'INFLUENCER_MARKETING', 'EVENTS', 'SOFTWARE_AND_TOOLS', 'PHOTOGRAPHY', 'PRINTING', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignExpensePaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REIMBURSED');

-- CreateEnum
CREATE TYPE "CampaignExpenseApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignMetricType" AS ENUM ('IMPRESSIONS', 'REACH', 'ENGAGEMENT', 'ENGAGEMENT_RATE', 'CLICKS', 'CTR', 'LEADS', 'CONVERSIONS', 'CONVERSION_RATE', 'CPC', 'CPL', 'CPA', 'REVENUE_ATTRIBUTED', 'ROAS', 'ROI', 'BUDGET_UTILISATION');

-- CreateEnum
CREATE TYPE "CampaignMetricSource" AS ENUM ('SOCIAL_MEDIA_INTEGRATION', 'MANUAL_ENTRY', 'CSV_IMPORT', 'EXTERNAL_API');

-- CreateEnum
CREATE TYPE "CampaignKpiStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'ACHIEVED', 'MISSED');

-- CreateEnum
CREATE TYPE "CampaignApprovalType" AS ENUM ('LAUNCH', 'BUDGET', 'CONTENT', 'EXPENSE', 'CHANGE', 'COMPLETION');

-- CreateEnum
CREATE TYPE "CampaignApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "budget" DECIMAL(18,2),
ADD COLUMN     "category" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "currency" "CurrencyCode" NOT NULL DEFAULT 'GBP',
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "goals" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "objective" "CampaignObjective",
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "priority" "CampaignPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "CampaignMember" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" "CampaignMemberRole" NOT NULL DEFAULT 'CONTRIBUTOR',
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMilestone" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "status" "CampaignMilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "ownerId" TEXT,
    "calendarEventId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTask" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "CampaignPriority" NOT NULL DEFAULT 'NORMAL',
    "assigneeId" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dependsOnTaskId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignTaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignActivity" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "CampaignActivityType" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignContent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CampaignContentType" NOT NULL,
    "body" TEXT,
    "caption" TEXT,
    "hashtags" TEXT[],
    "callToAction" TEXT,
    "channel" TEXT,
    "status" "CampaignContentStatus" NOT NULL DEFAULT 'DRAFT',
    "creatorId" TEXT,
    "reviewerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "notes" TEXT,
    "socialPostId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignContentAsset" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "brandAssetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignContentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAudience" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "CampaignAudienceCategory" NOT NULL DEFAULT 'CUSTOM',
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "ageRangeMin" INTEGER,
    "ageRangeMax" INTEGER,
    "interests" TEXT[],
    "industry" TEXT,
    "jobTitles" TEXT[],
    "customerSegment" TEXT,
    "source" TEXT,
    "estimatedSize" INTEGER,
    "isEstimate" BOOLEAN NOT NULL DEFAULT true,
    "status" "CampaignRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignAudienceAssignment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignAudienceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignChannel" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channel" "CampaignChannelType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignBudgetAllocation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "category" "CampaignBudgetCategory" NOT NULL,
    "channel" "CampaignChannelType",
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'GBP',
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignBudgetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignExpense" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "allocationId" TEXT,
    "description" TEXT NOT NULL,
    "category" "CampaignBudgetCategory" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'GBP',
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "vendor" TEXT,
    "reference" TEXT,
    "paymentStatus" "CampaignExpensePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "approvalStatus" "CampaignExpenseApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "receiptUrl" TEXT,
    "receiptCloudinaryPublicId" TEXT,
    "matchedMonzoTransactionId" TEXT,
    "recordedById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignBudgetHistory" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "previousAmount" DECIMAL(18,2),
    "newAmount" DECIMAL(18,2) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'GBP',
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignBudgetHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignKpi" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metric" "CampaignMetricType" NOT NULL,
    "targetValue" DECIMAL(18,2) NOT NULL,
    "actualValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3),
    "status" "CampaignKpiStatus" NOT NULL DEFAULT 'ON_TRACK',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignKpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMetric" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channel" "CampaignChannelType",
    "metricType" "CampaignMetricType" NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "source" "CampaignMetricSource" NOT NULL,
    "sourcePostId" TEXT,
    "externalReference" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignMetricImport" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "importedById" TEXT,
    "filename" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignMetricImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignApproval" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "type" "CampaignApprovalType" NOT NULL,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "snapshot" JSONB,
    "status" "CampaignApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "assignedApproverId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignApprovalComment" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignApprovalComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignMember_campaignId_idx" ON "CampaignMember"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignMember_employeeId_idx" ON "CampaignMember"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMember_campaignId_employeeId_key" ON "CampaignMember"("campaignId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMilestone_calendarEventId_key" ON "CampaignMilestone"("calendarEventId");

-- CreateIndex
CREATE INDEX "CampaignMilestone_campaignId_idx" ON "CampaignMilestone"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignMilestone_dueAt_idx" ON "CampaignMilestone"("dueAt");

-- CreateIndex
CREATE INDEX "CampaignMilestone_status_idx" ON "CampaignMilestone"("status");

-- CreateIndex
CREATE INDEX "CampaignMilestone_ownerId_idx" ON "CampaignMilestone"("ownerId");

-- CreateIndex
CREATE INDEX "CampaignTask_campaignId_idx" ON "CampaignTask"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignTask_milestoneId_idx" ON "CampaignTask"("milestoneId");

-- CreateIndex
CREATE INDEX "CampaignTask_assigneeId_idx" ON "CampaignTask"("assigneeId");

-- CreateIndex
CREATE INDEX "CampaignTask_status_idx" ON "CampaignTask"("status");

-- CreateIndex
CREATE INDEX "CampaignTask_dueAt_idx" ON "CampaignTask"("dueAt");

-- CreateIndex
CREATE INDEX "CampaignTask_dependsOnTaskId_idx" ON "CampaignTask"("dependsOnTaskId");

-- CreateIndex
CREATE INDEX "CampaignTaskComment_taskId_idx" ON "CampaignTaskComment"("taskId");

-- CreateIndex
CREATE INDEX "CampaignActivity_campaignId_idx" ON "CampaignActivity"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignActivity_createdAt_idx" ON "CampaignActivity"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignContent_socialPostId_key" ON "CampaignContent"("socialPostId");

-- CreateIndex
CREATE INDEX "CampaignContent_campaignId_idx" ON "CampaignContent"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignContent_status_idx" ON "CampaignContent"("status");

-- CreateIndex
CREATE INDEX "CampaignContent_type_idx" ON "CampaignContent"("type");

-- CreateIndex
CREATE INDEX "CampaignContent_dueAt_idx" ON "CampaignContent"("dueAt");

-- CreateIndex
CREATE INDEX "CampaignContentAsset_contentId_idx" ON "CampaignContentAsset"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignContentAsset_contentId_brandAssetId_key" ON "CampaignContentAsset"("contentId", "brandAssetId");

-- CreateIndex
CREATE INDEX "CampaignAudience_status_idx" ON "CampaignAudience"("status");

-- CreateIndex
CREATE INDEX "CampaignAudience_category_idx" ON "CampaignAudience"("category");

-- CreateIndex
CREATE INDEX "CampaignAudienceAssignment_campaignId_idx" ON "CampaignAudienceAssignment"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignAudienceAssignment_audienceId_idx" ON "CampaignAudienceAssignment"("audienceId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignAudienceAssignment_campaignId_audienceId_key" ON "CampaignAudienceAssignment"("campaignId", "audienceId");

-- CreateIndex
CREATE INDEX "CampaignChannel_campaignId_idx" ON "CampaignChannel"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignChannel_campaignId_channel_key" ON "CampaignChannel"("campaignId", "channel");

-- CreateIndex
CREATE INDEX "CampaignBudgetAllocation_campaignId_idx" ON "CampaignBudgetAllocation"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignBudgetAllocation_category_idx" ON "CampaignBudgetAllocation"("category");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignExpense_matchedMonzoTransactionId_key" ON "CampaignExpense"("matchedMonzoTransactionId");

-- CreateIndex
CREATE INDEX "CampaignExpense_campaignId_idx" ON "CampaignExpense"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignExpense_category_idx" ON "CampaignExpense"("category");

-- CreateIndex
CREATE INDEX "CampaignExpense_approvalStatus_idx" ON "CampaignExpense"("approvalStatus");

-- CreateIndex
CREATE INDEX "CampaignExpense_expenseDate_idx" ON "CampaignExpense"("expenseDate");

-- CreateIndex
CREATE INDEX "CampaignBudgetHistory_campaignId_idx" ON "CampaignBudgetHistory"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignKpi_campaignId_idx" ON "CampaignKpi"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignKpi_status_idx" ON "CampaignKpi"("status");

-- CreateIndex
CREATE INDEX "CampaignMetric_campaignId_idx" ON "CampaignMetric"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignMetric_metricType_idx" ON "CampaignMetric"("metricType");

-- CreateIndex
CREATE INDEX "CampaignMetric_periodStart_periodEnd_idx" ON "CampaignMetric"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "CampaignMetricImport_campaignId_idx" ON "CampaignMetricImport"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignApproval_campaignId_idx" ON "CampaignApproval"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignApproval_status_idx" ON "CampaignApproval"("status");

-- CreateIndex
CREATE INDEX "CampaignApproval_type_idx" ON "CampaignApproval"("type");

-- CreateIndex
CREATE INDEX "CampaignApproval_assignedApproverId_idx" ON "CampaignApproval"("assignedApproverId");

-- CreateIndex
CREATE INDEX "CampaignApprovalComment_approvalId_idx" ON "CampaignApprovalComment"("approvalId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_code_key" ON "Campaign"("code");

-- CreateIndex
CREATE INDEX "Campaign_clientId_idx" ON "Campaign"("clientId");

-- CreateIndex
CREATE INDEX "Campaign_projectId_idx" ON "Campaign"("projectId");

-- CreateIndex
CREATE INDEX "Campaign_departmentId_idx" ON "Campaign"("departmentId");

-- CreateIndex
CREATE INDEX "Campaign_ownerId_idx" ON "Campaign"("ownerId");

-- CreateIndex
CREATE INDEX "Campaign_managerId_idx" ON "Campaign"("managerId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMilestone" ADD CONSTRAINT "CampaignMilestone_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMilestone" ADD CONSTRAINT "CampaignMilestone_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMilestone" ADD CONSTRAINT "CampaignMilestone_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "CalendarEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMilestone" ADD CONSTRAINT "CampaignMilestone_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMilestone" ADD CONSTRAINT "CampaignMilestone_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTask" ADD CONSTRAINT "CampaignTask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTask" ADD CONSTRAINT "CampaignTask_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "CampaignMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTask" ADD CONSTRAINT "CampaignTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTask" ADD CONSTRAINT "CampaignTask_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "CampaignTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTask" ADD CONSTRAINT "CampaignTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTask" ADD CONSTRAINT "CampaignTask_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTaskComment" ADD CONSTRAINT "CampaignTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "CampaignTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTaskComment" ADD CONSTRAINT "CampaignTaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignActivity" ADD CONSTRAINT "CampaignActivity_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignActivity" ADD CONSTRAINT "CampaignActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContent" ADD CONSTRAINT "CampaignContent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContent" ADD CONSTRAINT "CampaignContent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContent" ADD CONSTRAINT "CampaignContent_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContent" ADD CONSTRAINT "CampaignContent_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContent" ADD CONSTRAINT "CampaignContent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContent" ADD CONSTRAINT "CampaignContent_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContentAsset" ADD CONSTRAINT "CampaignContentAsset_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CampaignContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContentAsset" ADD CONSTRAINT "CampaignContentAsset_brandAssetId_fkey" FOREIGN KEY ("brandAssetId") REFERENCES "BrandAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAudience" ADD CONSTRAINT "CampaignAudience_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAudience" ADD CONSTRAINT "CampaignAudience_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAudienceAssignment" ADD CONSTRAINT "CampaignAudienceAssignment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignAudienceAssignment" ADD CONSTRAINT "CampaignAudienceAssignment_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "CampaignAudience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignChannel" ADD CONSTRAINT "CampaignChannel_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBudgetAllocation" ADD CONSTRAINT "CampaignBudgetAllocation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBudgetAllocation" ADD CONSTRAINT "CampaignBudgetAllocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBudgetAllocation" ADD CONSTRAINT "CampaignBudgetAllocation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignExpense" ADD CONSTRAINT "CampaignExpense_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignExpense" ADD CONSTRAINT "CampaignExpense_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "CampaignBudgetAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignExpense" ADD CONSTRAINT "CampaignExpense_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignExpense" ADD CONSTRAINT "CampaignExpense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignExpense" ADD CONSTRAINT "CampaignExpense_matchedMonzoTransactionId_fkey" FOREIGN KEY ("matchedMonzoTransactionId") REFERENCES "MonzoTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBudgetHistory" ADD CONSTRAINT "CampaignBudgetHistory_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBudgetHistory" ADD CONSTRAINT "CampaignBudgetHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignKpi" ADD CONSTRAINT "CampaignKpi_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignKpi" ADD CONSTRAINT "CampaignKpi_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignKpi" ADD CONSTRAINT "CampaignKpi_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMetric" ADD CONSTRAINT "CampaignMetric_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMetric" ADD CONSTRAINT "CampaignMetric_sourcePostId_fkey" FOREIGN KEY ("sourcePostId") REFERENCES "SocialPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMetric" ADD CONSTRAINT "CampaignMetric_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMetricImport" ADD CONSTRAINT "CampaignMetricImport_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMetricImport" ADD CONSTRAINT "CampaignMetricImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignApproval" ADD CONSTRAINT "CampaignApproval_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignApproval" ADD CONSTRAINT "CampaignApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignApproval" ADD CONSTRAINT "CampaignApproval_assignedApproverId_fkey" FOREIGN KEY ("assignedApproverId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignApproval" ADD CONSTRAINT "CampaignApproval_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignApprovalComment" ADD CONSTRAINT "CampaignApprovalComment_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "CampaignApproval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignApprovalComment" ADD CONSTRAINT "CampaignApprovalComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

