-- Workspaces / Role Templates / Client Assignment foundation.
-- Purely additive: two new enum values, one new nullable column on
-- AdminUser, four new tables. Nothing existing is altered or dropped.

-- AlterEnum
-- Adding both values here is safe because neither is used by any INSERT
-- or UPDATE later in this same migration/transaction.
ALTER TYPE "AccessAction" ADD VALUE 'PUBLISH';
ALTER TYPE "AccessAction" ADD VALUE 'DELETE';

-- AlterEnum
ALTER TYPE "AccessScope" ADD VALUE 'CLIENT';

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "defaultWorkspaceId" TEXT;

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "colour" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "sectionKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultWorkspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleTemplateGrant" (
    "id" TEXT NOT NULL,
    "roleTemplateId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" "AccessAction" NOT NULL,
    "scope" "AccessScope" NOT NULL DEFAULT 'ALL',

    CONSTRAINT "RoleTemplateGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAssignment" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_key_key" ON "Workspace"("key");

-- CreateIndex
CREATE INDEX "Workspace_displayOrder_idx" ON "Workspace"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RoleTemplate_key_key" ON "RoleTemplate"("key");

-- CreateIndex
CREATE INDEX "RoleTemplate_defaultWorkspaceId_idx" ON "RoleTemplate"("defaultWorkspaceId");

-- CreateIndex
CREATE INDEX "RoleTemplateGrant_roleTemplateId_idx" ON "RoleTemplateGrant"("roleTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleTemplateGrant_roleTemplateId_module_action_key" ON "RoleTemplateGrant"("roleTemplateId", "module", "action");

-- CreateIndex
CREATE INDEX "ClientAssignment_adminUserId_idx" ON "ClientAssignment"("adminUserId");

-- CreateIndex
CREATE INDEX "ClientAssignment_clientId_idx" ON "ClientAssignment"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAssignment_adminUserId_clientId_key" ON "ClientAssignment"("adminUserId", "clientId");

-- CreateIndex
CREATE INDEX "AdminUser_defaultWorkspaceId_idx" ON "AdminUser"("defaultWorkspaceId");

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_defaultWorkspaceId_fkey" FOREIGN KEY ("defaultWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleTemplate" ADD CONSTRAINT "RoleTemplate_defaultWorkspaceId_fkey" FOREIGN KEY ("defaultWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleTemplateGrant" ADD CONSTRAINT "RoleTemplateGrant_roleTemplateId_fkey" FOREIGN KEY ("roleTemplateId") REFERENCES "RoleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAssignment" ADD CONSTRAINT "ClientAssignment_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAssignment" ADD CONSTRAINT "ClientAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAssignment" ADD CONSTRAINT "ClientAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed data: the 8 workspaces requested, each mapping onto AdminSectionId
-- values that already exist in app/components/admin/adminNav.ts — no new
-- sections or dashboards, just a named grouping over what's there.
-- Executive's sectionKeys is deliberately empty: it represents "no
-- specific focus", i.e. the default, unfiltered view.
INSERT INTO "Workspace" ("id", "key", "name", "description", "icon", "colour", "displayOrder", "sectionKeys", "updatedAt") VALUES
  ('workspace_executive',  'executive',  'Executive',             'Company-wide overview across every department.',            'layout-dashboard',   '#1f2937', 0, ARRAY[]::TEXT[],                               CURRENT_TIMESTAMP),
  ('workspace_technology', 'technology', 'Technology',            'Development, infrastructure and client systems.',           'code-2',             '#2563eb', 1, ARRAY['engineering','products'],               CURRENT_TIMESTAMP),
  ('workspace_support',    'support',    'Customer Support',      'Support tickets, client health and escalations.',           'headphones',         '#059669', 2, ARRAY['client-success'],                       CURRENT_TIMESTAMP),
  ('workspace_growth',     'growth',     'Growth',                'Social media, campaigns, content and marketing.',           'megaphone',          '#db2777', 3, ARRAY['growth'],                               CURRENT_TIMESTAMP),
  ('workspace_sales_crm',  'sales_crm',  'Sales / CRM',           'Clients, contacts and commercial relationships.',           'building-2',         '#d97706', 4, ARRAY['crm'],                                  CURRENT_TIMESTAMP),
  ('workspace_finance',    'finance',    'Finance',               'Contracts, invoices, billing and company finances.',        'circle-dollar-sign', '#0891b2', 5, ARRAY['commercial'],                           CURRENT_TIMESTAMP),
  ('workspace_people_hr',  'people_hr',  'People / HR',           'Team, departments, recruitment, leave and workload.',        'users',              '#7c3aed', 6, ARRAY['company'],                              CURRENT_TIMESTAMP),
  ('workspace_projects',   'projects_operations', 'Projects / Operations', 'Delivery, tasks, milestones and operational work.', 'folder-kanban',      '#4f46e5', 7, ARRAY['delivery'],                             CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
