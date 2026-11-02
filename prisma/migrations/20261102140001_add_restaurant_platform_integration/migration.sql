-- PREPARED, NOT APPLIED to any database. Generated via
-- `prisma migrate diff --from-schema <before> --to-schema prisma/schema.prisma --script`
-- (purely local, no database connection) and validated against a disposable
-- local Postgres instance replaying the full existing migration history.
-- Additive only: a new enum value, a new table, no change to any existing
-- column, table, or constraint.

-- CreateEnum
CREATE TYPE "RestaurantLinkProvisioningState" AS ENUM ('PENDING', 'PROVISIONED', 'FAILED');

-- AlterEnum
ALTER TYPE "ManagedSystemType" ADD VALUE 'RESTAURANT_TENANT';

-- CreateTable
CREATE TABLE "RestaurantLink" (
    "id" TEXT NOT NULL,
    "managedSystemId" TEXT NOT NULL,
    "provisioningRequestId" TEXT NOT NULL,
    "provisioningState" "RestaurantLinkProvisioningState" NOT NULL DEFAULT 'PENDING',
    "provisioningError" TEXT,
    "provisioningPayload" JSONB,
    "externalRestaurantId" TEXT,
    "externalSlug" TEXT,
    "remoteStatus" TEXT,
    "remoteStatusSyncedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantLink_managedSystemId_key" ON "RestaurantLink"("managedSystemId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantLink_provisioningRequestId_key" ON "RestaurantLink"("provisioningRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantLink_externalRestaurantId_key" ON "RestaurantLink"("externalRestaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantLink_externalSlug_key" ON "RestaurantLink"("externalSlug");

-- CreateIndex
CREATE INDEX "RestaurantLink_provisioningState_idx" ON "RestaurantLink"("provisioningState");

-- AddForeignKey
ALTER TABLE "RestaurantLink" ADD CONSTRAINT "RestaurantLink_managedSystemId_fkey" FOREIGN KEY ("managedSystemId") REFERENCES "ManagedSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

