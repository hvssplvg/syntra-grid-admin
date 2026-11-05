-- Technology Operations Phase 1: systems inventory on top of the existing
-- Client Health monitoring architecture. Purely additive — one new enum
-- pair, one new table (ManagedSystem), and one new nullable column on the
-- existing MonitoredEndpoint table. Nothing existing is dropped, renamed,
-- or made non-nullable. ManagedSystem.clientId is nullable by design (null
-- = Syntra Grid's own internal system — same precedent as
-- SocialAccount.clientId / BrandKit.clientId), so no fake Client row is
-- created and no existing Client row is touched.

-- CreateEnum
CREATE TYPE "ManagedSystemType" AS ENUM ('WEBSITE', 'WEB_APP', 'MOBILE_APP', 'API', 'BACKEND_SERVICE', 'INFRASTRUCTURE');

-- CreateEnum
CREATE TYPE "ManagedSystemLifecycleStatus" AS ENUM ('PLANNED', 'ACTIVE', 'MAINTENANCE', 'DEPRECATED', 'RETIRED');

-- AlterTable
ALTER TABLE "MonitoredEndpoint" ADD COLUMN     "managedSystemId" TEXT;

-- CreateTable
CREATE TABLE "ManagedSystem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemType" "ManagedSystemType" NOT NULL,
    "lifecycleStatus" "ManagedSystemLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "hostingProvider" TEXT,
    "repositoryUrl" TEXT,
    "techStack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "productionUrl" TEXT,
    "stagingUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedSystem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagedSystem_clientId_idx" ON "ManagedSystem"("clientId");

-- CreateIndex
CREATE INDEX "ManagedSystem_projectId_idx" ON "ManagedSystem"("projectId");

-- CreateIndex
CREATE INDEX "ManagedSystem_systemType_idx" ON "ManagedSystem"("systemType");

-- CreateIndex
CREATE INDEX "ManagedSystem_lifecycleStatus_idx" ON "ManagedSystem"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "MonitoredEndpoint_managedSystemId_idx" ON "MonitoredEndpoint"("managedSystemId");

-- AddForeignKey
ALTER TABLE "MonitoredEndpoint" ADD CONSTRAINT "MonitoredEndpoint_managedSystemId_fkey" FOREIGN KEY ("managedSystemId") REFERENCES "ManagedSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSystem" ADD CONSTRAINT "ManagedSystem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSystem" ADD CONSTRAINT "ManagedSystem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSystem" ADD CONSTRAINT "ManagedSystem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
