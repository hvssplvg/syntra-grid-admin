-- Client Health reliability pass: manual "Check Now" concurrency lock plus
-- a consecutive-failure debounce before opening a new monitoring incident.
-- Purely additive — all three columns are nullable or have a server-side
-- default, so every existing MonitoredEndpoint row stays valid as-is.
-- See lib/monitoring/applyHealthCheckResult.ts and
-- app/api/admin/client-health/endpoints/[id]/check-now/route.ts.

-- AlterTable
ALTER TABLE "MonitoredEndpoint" ADD COLUMN     "checkInProgressAt" TIMESTAMP(3),
ADD COLUMN     "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "consecutiveFailureThreshold" INTEGER;
