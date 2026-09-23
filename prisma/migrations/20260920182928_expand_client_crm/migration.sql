-- CreateEnum
CREATE TYPE "ClientPriority" AS ENUM ('STANDARD', 'IMPORTANT', 'STRATEGIC');

-- CreateEnum
CREATE TYPE "ClientRelationshipType" AS ENUM ('CLIENT', 'PARTNER', 'STRATEGIC_PARTNER');

-- CreateEnum
CREATE TYPE "ClientContactRole" AS ENUM ('GENERAL', 'DECISION_MAKER', 'EXECUTIVE', 'OPERATIONS', 'FINANCE', 'TECHNICAL', 'PRODUCT', 'SUPPORT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IntegrationProvider" ADD VALUE 'MONNIFY';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PAYSTACK';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "accountOwnerId" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "priority" "ClientPriority" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "relationshipStartedAt" TIMESTAMP(3),
ADD COLUMN     "relationshipType" "ClientRelationshipType" NOT NULL DEFAULT 'CLIENT',
ADD COLUMN     "websiteUrl" TEXT;

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "role" "ClientContactRole" NOT NULL DEFAULT 'GENERAL',
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");

-- CreateIndex
CREATE INDEX "ClientContact_email_idx" ON "ClientContact"("email");

-- CreateIndex
CREATE INDEX "ClientContact_role_idx" ON "ClientContact"("role");

-- CreateIndex
CREATE INDEX "ClientContact_active_idx" ON "ClientContact"("active");

-- CreateIndex
CREATE INDEX "ClientContact_clientId_primary_idx" ON "ClientContact"("clientId", "primary");

-- CreateIndex
CREATE INDEX "Client_priority_idx" ON "Client"("priority");

-- CreateIndex
CREATE INDEX "Client_relationshipType_idx" ON "Client"("relationshipType");

-- CreateIndex
CREATE INDEX "Client_accountOwnerId_idx" ON "Client"("accountOwnerId");

-- CreateIndex
CREATE INDEX "Integration_projectId_provider_idx" ON "Integration"("projectId", "provider");

-- CreateIndex
CREATE INDEX "SupportTicket_clientId_status_idx" ON "SupportTicket"("clientId", "status");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_accountOwnerId_fkey" FOREIGN KEY ("accountOwnerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
