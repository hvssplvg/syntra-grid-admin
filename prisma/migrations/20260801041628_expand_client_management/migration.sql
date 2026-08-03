/*
  Warnings:

  - A unique constraint covering the columns `[clientRef]` on the table `Client` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('NGN', 'GBP', 'USD', 'EUR');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED');

-- AlterEnum
ALTER TYPE "IntegrationProvider" ADD VALUE 'RESEND';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "adminUrl" TEXT,
ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'ANNUAL',
ADD COLUMN     "clientRef" TEXT,
ADD COLUMN     "contactRole" TEXT,
ADD COLUMN     "contractValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "currency" "CurrencyCode" NOT NULL DEFAULT 'NGN',
ADD COLUMN     "domain" TEXT,
ADD COLUMN     "integrationKey" TEXT,
ADD COLUMN     "integrationLive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "liveSince" TIMESTAMP(3),
ADD COLUMN     "plan" TEXT,
ADD COLUMN     "productName" TEXT,
ADD COLUMN     "renewalAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'ONBOARDING';

-- CreateTable
CREATE TABLE "ClientBilling" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "lastInvoiceRef" TEXT,
    "lastInvoiceAt" TIMESTAMP(3),
    "lastInvoiceStatus" "InvoiceStatus",
    "outstandingAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBilling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInvoice" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "invoiceRef" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'NGN',
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientBilling_clientId_key" ON "ClientBilling"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_invoiceRef_key" ON "ClientInvoice"("invoiceRef");

-- CreateIndex
CREATE INDEX "ClientInvoice_clientId_idx" ON "ClientInvoice"("clientId");

-- CreateIndex
CREATE INDEX "ClientInvoice_status_idx" ON "ClientInvoice"("status");

-- CreateIndex
CREATE INDEX "ClientInvoice_dueAt_idx" ON "ClientInvoice"("dueAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_clientRef_key" ON "Client"("clientRef");

-- CreateIndex
CREATE INDEX "Client_status_idx" ON "Client"("status");

-- CreateIndex
CREATE INDEX "Client_renewalAt_idx" ON "Client"("renewalAt");

-- CreateIndex
CREATE INDEX "Client_integrationKey_idx" ON "Client"("integrationKey");

-- CreateIndex
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");

-- CreateIndex
CREATE INDEX "Deployment_status_idx" ON "Deployment"("status");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "Integration_provider_idx" ON "Integration"("provider");

-- CreateIndex
CREATE INDEX "Project_category_idx" ON "Project"("category");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToId_idx" ON "SupportTicket"("assignedToId");

-- CreateIndex
CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");

-- AddForeignKey
ALTER TABLE "ClientBilling" ADD CONSTRAINT "ClientBilling_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
