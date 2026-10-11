-- Department.leadId used to reference AdminUser (a dashboard login), which
-- meant only people with dashboard access could ever appear as a department
-- lead. Leads should be chosen from Employee records instead, since most
-- staff never get a dashboard account.
--
-- Where an existing lead's AdminUser has a linked Employee profile, carry
-- the assignment over to that Employee so no existing lead assignment is
-- lost. Any lead that cannot be mapped to an Employee is cleared rather than
-- left dangling, since the column is about to start referencing Employee.

UPDATE "Department" d
SET "leadId" = e."id"
FROM "Employee" e
WHERE e."adminUserId" = d."leadId";

UPDATE "Department" d
SET "leadId" = NULL
WHERE d."leadId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Employee" e WHERE e."id" = d."leadId"
  );

-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_leadId_fkey";

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
