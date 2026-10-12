-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_TASK_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_TASK_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_MILESTONE_DUE_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_APPROVAL_PENDING';
ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_APPROVAL_DECIDED';
ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_CONTENT_CHANGES_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_LAUNCHED';
ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_BUDGET_EXCEEDED';
ALTER TYPE "NotificationType" ADD VALUE 'CAMPAIGN_EXPENSE_APPROVAL_PENDING';

