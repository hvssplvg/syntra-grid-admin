-- Client Health foundation: real website/API uptime monitoring plus
-- client-level incidents. Purely additive — HealthCheck and Incident had
-- zero rows and zero write-paths before this (verified), so loosening
-- their one required FK (projectId) to nullable is risk-free. One new
-- table (MonitoredEndpoint). Nothing existing is dropped or altered
-- beyond that one nullability change.

-- AlterTable
ALTER TABLE "HealthCheck" ADD COLUMN     "monitoredEndpointId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "acknowledgedById" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "monitoredEndpointId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MonitoredEndpoint" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "checkIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoredEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonitoredEndpoint_clientId_idx" ON "MonitoredEndpoint"("clientId");

-- CreateIndex
CREATE INDEX "MonitoredEndpoint_projectId_idx" ON "MonitoredEndpoint"("projectId");

-- CreateIndex
CREATE INDEX "MonitoredEndpoint_enabled_idx" ON "MonitoredEndpoint"("enabled");

-- CreateIndex
CREATE INDEX "HealthCheck_monitoredEndpointId_checkedAt_idx" ON "HealthCheck"("monitoredEndpointId", "checkedAt");

-- CreateIndex
CREATE INDEX "Incident_clientId_startedAt_idx" ON "Incident"("clientId", "startedAt");

-- CreateIndex
CREATE INDEX "Incident_monitoredEndpointId_idx" ON "Incident"("monitoredEndpointId");

-- CreateIndex
CREATE INDEX "Incident_dedupeKey_idx" ON "Incident"("dedupeKey");

-- AddForeignKey
ALTER TABLE "HealthCheck" ADD CONSTRAINT "HealthCheck_monitoredEndpointId_fkey" FOREIGN KEY ("monitoredEndpointId") REFERENCES "MonitoredEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_monitoredEndpointId_fkey" FOREIGN KEY ("monitoredEndpointId") REFERENCES "MonitoredEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoredEndpoint" ADD CONSTRAINT "MonitoredEndpoint_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoredEndpoint" ADD CONSTRAINT "MonitoredEndpoint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitoredEndpoint" ADD CONSTRAINT "MonitoredEndpoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
