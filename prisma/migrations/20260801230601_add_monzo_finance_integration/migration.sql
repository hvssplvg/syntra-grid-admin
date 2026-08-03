-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('UK_RETAIL', 'UK_BUSINESS', 'UK_BUSINESS_KYC', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BankTransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "BankTransactionStatus" AS ENUM ('PENDING', 'SETTLED', 'DECLINED', 'REVERSED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "BankTransactionMatchStatus" AS ENUM ('UNMATCHED', 'SUGGESTED', 'MATCHED', 'IGNORED');

-- CreateEnum
CREATE TYPE "BankSyncStatus" AS ENUM ('IDLE', 'SYNCING', 'SUCCESS', 'FAILED');

-- AlterEnum
ALTER TYPE "IntegrationProvider" ADD VALUE 'MONZO';

-- CreateTable
CREATE TABLE "MonzoConnection" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "monzoUserId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT,
    "accountType" "BankAccountType" NOT NULL DEFAULT 'UNKNOWN',
    "accountDescription" TEXT,
    "accountNumberLast4" TEXT,
    "sortCodeLast4" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "availableBalanceMinor" BIGINT,
    "totalBalanceMinor" BIGINT,
    "balanceUpdatedAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncStatus" "BankSyncStatus" NOT NULL DEFAULT 'IDLE',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSuccessfulAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonzoConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonzoTransaction" (
    "id" TEXT NOT NULL,
    "monzoConnectionId" TEXT NOT NULL,
    "monzoTransactionId" TEXT NOT NULL,
    "monzoAccountId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "localAmountMinor" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "localCurrency" TEXT,
    "direction" "BankTransactionDirection" NOT NULL,
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT,
    "merchantName" TEXT,
    "merchantLogoUrl" TEXT,
    "merchantCategory" TEXT,
    "category" TEXT,
    "notes" TEXT,
    "declineReason" TEXT,
    "scheme" TEXT,
    "paymentMethod" TEXT,
    "counterpartyName" TEXT,
    "counterpartyNumber" TEXT,
    "counterpartySortCode" TEXT,
    "isLoad" BOOLEAN NOT NULL DEFAULT false,
    "includeInSpending" BOOLEAN NOT NULL DEFAULT true,
    "matchStatus" "BankTransactionMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedClientId" TEXT,
    "matchedProjectId" TEXT,
    "matchedInvoiceId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchedBy" TEXT,
    "createdAtMonzo" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "rawData" JSONB,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonzoTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonzoPot" (
    "id" TEXT NOT NULL,
    "monzoConnectionId" TEXT NOT NULL,
    "monzoPotId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "style" TEXT,
    "balanceMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "rawData" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonzoPot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonzoConnection_adminUserId_key" ON "MonzoConnection"("adminUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MonzoConnection_accountId_key" ON "MonzoConnection"("accountId");

-- CreateIndex
CREATE INDEX "MonzoConnection_monzoUserId_idx" ON "MonzoConnection"("monzoUserId");

-- CreateIndex
CREATE INDEX "MonzoConnection_active_idx" ON "MonzoConnection"("active");

-- CreateIndex
CREATE INDEX "MonzoConnection_syncStatus_idx" ON "MonzoConnection"("syncStatus");

-- CreateIndex
CREATE INDEX "MonzoConnection_lastSyncedAt_idx" ON "MonzoConnection"("lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MonzoTransaction_monzoTransactionId_key" ON "MonzoTransaction"("monzoTransactionId");

-- CreateIndex
CREATE INDEX "MonzoTransaction_monzoConnectionId_idx" ON "MonzoTransaction"("monzoConnectionId");

-- CreateIndex
CREATE INDEX "MonzoTransaction_monzoAccountId_idx" ON "MonzoTransaction"("monzoAccountId");

-- CreateIndex
CREATE INDEX "MonzoTransaction_createdAtMonzo_idx" ON "MonzoTransaction"("createdAtMonzo");

-- CreateIndex
CREATE INDEX "MonzoTransaction_settledAt_idx" ON "MonzoTransaction"("settledAt");

-- CreateIndex
CREATE INDEX "MonzoTransaction_direction_idx" ON "MonzoTransaction"("direction");

-- CreateIndex
CREATE INDEX "MonzoTransaction_status_idx" ON "MonzoTransaction"("status");

-- CreateIndex
CREATE INDEX "MonzoTransaction_category_idx" ON "MonzoTransaction"("category");

-- CreateIndex
CREATE INDEX "MonzoTransaction_merchantName_idx" ON "MonzoTransaction"("merchantName");

-- CreateIndex
CREATE INDEX "MonzoTransaction_matchStatus_idx" ON "MonzoTransaction"("matchStatus");

-- CreateIndex
CREATE INDEX "MonzoTransaction_matchedClientId_idx" ON "MonzoTransaction"("matchedClientId");

-- CreateIndex
CREATE INDEX "MonzoTransaction_matchedProjectId_idx" ON "MonzoTransaction"("matchedProjectId");

-- CreateIndex
CREATE INDEX "MonzoTransaction_matchedInvoiceId_idx" ON "MonzoTransaction"("matchedInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "MonzoPot_monzoPotId_key" ON "MonzoPot"("monzoPotId");

-- CreateIndex
CREATE INDEX "MonzoPot_monzoConnectionId_idx" ON "MonzoPot"("monzoConnectionId");

-- CreateIndex
CREATE INDEX "MonzoPot_deleted_idx" ON "MonzoPot"("deleted");

-- CreateIndex
CREATE INDEX "MonzoPot_name_idx" ON "MonzoPot"("name");

-- AddForeignKey
ALTER TABLE "MonzoConnection" ADD CONSTRAINT "MonzoConnection_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonzoTransaction" ADD CONSTRAINT "MonzoTransaction_monzoConnectionId_fkey" FOREIGN KEY ("monzoConnectionId") REFERENCES "MonzoConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonzoTransaction" ADD CONSTRAINT "MonzoTransaction_matchedClientId_fkey" FOREIGN KEY ("matchedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonzoTransaction" ADD CONSTRAINT "MonzoTransaction_matchedProjectId_fkey" FOREIGN KEY ("matchedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonzoTransaction" ADD CONSTRAINT "MonzoTransaction_matchedInvoiceId_fkey" FOREIGN KEY ("matchedInvoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonzoPot" ADD CONSTRAINT "MonzoPot_monzoConnectionId_fkey" FOREIGN KEY ("monzoConnectionId") REFERENCES "MonzoConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
