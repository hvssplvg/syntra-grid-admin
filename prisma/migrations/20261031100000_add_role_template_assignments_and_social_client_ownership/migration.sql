-- Phase 4: Team Management, Roles, Permissions & Client Assignments.
-- Purely additive: two new nullable columns, one new join table, and seed
-- data for the RoleTemplate/RoleTemplateGrant rows the task's own spec
-- names. Nothing existing is altered or dropped. No existing AdminUser,
-- Client, Employee or SocialAccount row is touched by this migration.

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "defaultClientId" TEXT;

-- AlterTable
-- Null means "Syntra Grid's own" — every existing SocialAccount row keeps
-- this unset; nothing is backfilled or auto-assigned.
ALTER TABLE "SocialAccount" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "AdminUserRoleTemplate" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "roleTemplateId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUserRoleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminUser_defaultClientId_idx" ON "AdminUser"("defaultClientId");

-- CreateIndex
CREATE INDEX "SocialAccount_clientId_idx" ON "SocialAccount"("clientId");

-- CreateIndex
CREATE INDEX "AdminUserRoleTemplate_adminUserId_idx" ON "AdminUserRoleTemplate"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminUserRoleTemplate_roleTemplateId_idx" ON "AdminUserRoleTemplate"("roleTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUserRoleTemplate_adminUserId_roleTemplateId_key" ON "AdminUserRoleTemplate"("adminUserId", "roleTemplateId");

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_defaultClientId_fkey" FOREIGN KEY ("defaultClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRoleTemplate" ADD CONSTRAINT "AdminUserRoleTemplate_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRoleTemplate" ADD CONSTRAINT "AdminUserRoleTemplate_roleTemplateId_fkey" FOREIGN KEY ("roleTemplateId") REFERENCES "RoleTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRoleTemplate" ADD CONSTRAINT "AdminUserRoleTemplate_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed data: the named example role templates from the task spec,
-- replacing lib/access/role-templates.ts's old hardcoded, non-persisted
-- ROLE_TEMPLATES presets. defaultWorkspaceId references the workspace
-- rows seeded by 20261031080000. Every grant here targets a module whose
-- backend already consults the fine-grained permission system
-- (SECURED_MODULE_KEYS in adminNav.ts) or is secured as part of this same
-- migration's application code (contracts, contacts, projects, clients)
-- — nothing here is a grant on a module with no real enforcement behind
-- it yet. CLIENT scope is used wherever the role's whole point is "scoped
-- to specific clients"; an administrator still has to create the
-- matching ClientAssignment rows separately for that to resolve to
-- anything — see ClientAssignment. Team management mutations
-- (CREATE/EDIT/MANAGE/DELETE on "team") are deliberately never granted
-- here: canManageTeam remains full-access-only (see
-- app/api/admin/team/options/route.ts), so such a grant would be stored
-- but inert — not something this seed data claims to deliver.
INSERT INTO "RoleTemplate" ("id", "key", "name", "description", "defaultWorkspaceId", "updatedAt") VALUES
  ('role_department_manager',    'department-manager',    'Department Manager',    'Read-only oversight of their own department''s team, leave and calendar.', NULL, CURRENT_TIMESTAMP),
  ('role_developer',             'developer',              'Developer',              'Engineering work on assigned clients'' projects and systems, plus self-service leave and calendar.', 'workspace_technology', CURRENT_TIMESTAMP),
  ('role_technology_lead',       'technology-lead',        'Technology Lead',        'Full project and client-health management across the Technology department.', 'workspace_technology', CURRENT_TIMESTAMP),
  ('role_support_agent',         'support-agent',          'Support Agent',          'Client health and support visibility for assigned clients.', 'workspace_support', CURRENT_TIMESTAMP),
  ('role_support_manager',       'support-manager',        'Support Manager',        'Client health and support management across Client Success.', 'workspace_support', CURRENT_TIMESTAMP),
  ('role_project_manager',       'project-manager',        'Project Manager',        'Full project, contract and client-health visibility for assigned clients.', 'workspace_projects', CURRENT_TIMESTAMP),
  ('role_sales_representative',  'sales-representative',   'Sales Representative',  'Contacts, contracts and client records for assigned clients.', 'workspace_sales_crm', CURRENT_TIMESTAMP),
  ('role_finance_officer',       'finance-officer',        'Finance Officer',        'Contract and billing visibility for assigned clients.', 'workspace_finance', CURRENT_TIMESTAMP),
  ('role_social_media_manager',  'social-media-manager',   'Social Media Manager',  'Full social media, campaign and brand-asset control for assigned clients, including publishing.', 'workspace_growth', CURRENT_TIMESTAMP),
  ('role_content_creator',       'content-creator',        'Content Creator',       'Social media and brand-asset content creation for assigned clients, without publishing.', 'workspace_growth', CURRENT_TIMESTAMP),
  ('role_hr_manager',            'hr-manager',             'HR Manager',            'Company-wide team visibility and leave management.', 'workspace_people_hr', CURRENT_TIMESTAMP),
  ('role_viewer',                'viewer',                 'Viewer',                'Read-only access to their own department''s team, leave and calendar.', NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RoleTemplateGrant" ("id", "roleTemplateId", "module", "action", "scope") VALUES
  -- Department Manager
  ('rtg_dept_mgr_team_view',       'role_department_manager', 'team',     'VIEW',   'DEPARTMENT'),
  ('rtg_dept_mgr_leave_view',      'role_department_manager', 'leave',    'VIEW',   'DEPARTMENT'),
  ('rtg_dept_mgr_calendar_view',   'role_department_manager', 'calendar', 'VIEW',   'DEPARTMENT'),

  -- Developer
  ('rtg_dev_projects_view',        'role_developer', 'projects',      'VIEW',   'CLIENT'),
  ('rtg_dev_projects_edit',        'role_developer', 'projects',      'EDIT',   'CLIENT'),
  ('rtg_dev_client_health_view',   'role_developer', 'client_health', 'VIEW',   'CLIENT'),
  ('rtg_dev_leave_view',           'role_developer', 'leave',         'VIEW',   'OWN'),
  ('rtg_dev_leave_create',         'role_developer', 'leave',         'CREATE', 'OWN'),
  ('rtg_dev_calendar_view',        'role_developer', 'calendar',      'VIEW',   'OWN'),
  ('rtg_dev_calendar_create',      'role_developer', 'calendar',      'CREATE', 'OWN'),

  -- Technology Lead
  ('rtg_tech_lead_projects_view',    'role_technology_lead', 'projects',      'VIEW',   'DEPARTMENT'),
  ('rtg_tech_lead_projects_create',  'role_technology_lead', 'projects',      'CREATE', 'DEPARTMENT'),
  ('rtg_tech_lead_projects_edit',    'role_technology_lead', 'projects',      'EDIT',   'DEPARTMENT'),
  ('rtg_tech_lead_client_health_v',  'role_technology_lead', 'client_health', 'VIEW',   'DEPARTMENT'),
  ('rtg_tech_lead_client_health_e',  'role_technology_lead', 'client_health', 'EDIT',   'DEPARTMENT'),
  ('rtg_tech_lead_team_view',        'role_technology_lead', 'team',          'VIEW',   'DEPARTMENT'),
  ('rtg_tech_lead_leave_view',       'role_technology_lead', 'leave',         'VIEW',   'OWN'),
  ('rtg_tech_lead_leave_create',     'role_technology_lead', 'leave',         'CREATE', 'OWN'),
  ('rtg_tech_lead_calendar_view',    'role_technology_lead', 'calendar',      'VIEW',   'OWN'),
  ('rtg_tech_lead_calendar_create',  'role_technology_lead', 'calendar',      'CREATE', 'OWN'),

  -- Support Agent
  ('rtg_support_agent_ch_view',    'role_support_agent', 'client_health', 'VIEW',   'CLIENT'),
  ('rtg_support_agent_leave_view', 'role_support_agent', 'leave',         'VIEW',   'OWN'),
  ('rtg_support_agent_leave_crt',  'role_support_agent', 'leave',         'CREATE', 'OWN'),
  ('rtg_support_agent_cal_view',   'role_support_agent', 'calendar',      'VIEW',   'OWN'),
  ('rtg_support_agent_cal_crt',    'role_support_agent', 'calendar',      'CREATE', 'OWN'),

  -- Support Manager
  ('rtg_support_mgr_ch_view',   'role_support_manager', 'client_health', 'VIEW',   'DEPARTMENT'),
  ('rtg_support_mgr_ch_edit',   'role_support_manager', 'client_health', 'EDIT',   'DEPARTMENT'),
  ('rtg_support_mgr_ch_manage', 'role_support_manager', 'client_health', 'MANAGE', 'DEPARTMENT'),
  ('rtg_support_mgr_team_view', 'role_support_manager', 'team',          'VIEW',   'DEPARTMENT'),
  ('rtg_support_mgr_leave_v',   'role_support_manager', 'leave',         'VIEW',   'OWN'),
  ('rtg_support_mgr_cal_v',     'role_support_manager', 'calendar',      'VIEW',   'OWN'),

  -- Project Manager
  ('rtg_pm_projects_view',      'role_project_manager', 'projects',      'VIEW',   'CLIENT'),
  ('rtg_pm_projects_create',    'role_project_manager', 'projects',      'CREATE', 'CLIENT'),
  ('rtg_pm_projects_edit',      'role_project_manager', 'projects',      'EDIT',   'CLIENT'),
  ('rtg_pm_projects_manage',    'role_project_manager', 'projects',      'MANAGE', 'CLIENT'),
  ('rtg_pm_contracts_view',     'role_project_manager', 'contracts',     'VIEW',   'CLIENT'),
  ('rtg_pm_client_health_view', 'role_project_manager', 'client_health', 'VIEW',   'CLIENT'),
  ('rtg_pm_leave_view',         'role_project_manager', 'leave',         'VIEW',   'OWN'),
  ('rtg_pm_calendar_view',      'role_project_manager', 'calendar',      'VIEW',   'OWN'),

  -- Sales Representative
  ('rtg_sales_clients_view',    'role_sales_representative', 'clients',   'VIEW',   'CLIENT'),
  ('rtg_sales_contacts_view',   'role_sales_representative', 'contacts',  'VIEW',   'CLIENT'),
  ('rtg_sales_contacts_create', 'role_sales_representative', 'contacts',  'CREATE', 'CLIENT'),
  ('rtg_sales_contacts_edit',   'role_sales_representative', 'contacts',  'EDIT',   'CLIENT'),
  ('rtg_sales_contracts_view',  'role_sales_representative', 'contracts', 'VIEW',   'CLIENT'),
  ('rtg_sales_campaigns_view',  'role_sales_representative', 'campaigns', 'VIEW',   'CLIENT'),
  ('rtg_sales_leave_view',      'role_sales_representative', 'leave',     'VIEW',   'OWN'),
  ('rtg_sales_calendar_view',   'role_sales_representative', 'calendar',  'VIEW',   'OWN'),

  -- Finance Officer
  ('rtg_finance_contracts_view', 'role_finance_officer', 'contracts', 'VIEW', 'CLIENT'),
  ('rtg_finance_contracts_edit', 'role_finance_officer', 'contracts', 'EDIT', 'CLIENT'),
  ('rtg_finance_leave_view',     'role_finance_officer', 'leave',     'VIEW', 'OWN'),
  ('rtg_finance_calendar_view',  'role_finance_officer', 'calendar',  'VIEW', 'OWN'),

  -- Social Media Manager
  ('rtg_smm_social_view',    'role_social_media_manager', 'social_media', 'VIEW',    'CLIENT'),
  ('rtg_smm_social_create',  'role_social_media_manager', 'social_media', 'CREATE',  'CLIENT'),
  ('rtg_smm_social_edit',    'role_social_media_manager', 'social_media', 'EDIT',    'CLIENT'),
  ('rtg_smm_social_publish', 'role_social_media_manager', 'social_media', 'PUBLISH', 'CLIENT'),
  ('rtg_smm_campaigns_view', 'role_social_media_manager', 'campaigns',    'VIEW',    'CLIENT'),
  ('rtg_smm_campaigns_crt',  'role_social_media_manager', 'campaigns',    'CREATE',  'CLIENT'),
  ('rtg_smm_campaigns_edit', 'role_social_media_manager', 'campaigns',    'EDIT',    'CLIENT'),
  ('rtg_smm_brand_view',     'role_social_media_manager', 'brand_assets', 'VIEW',    'CLIENT'),
  ('rtg_smm_brand_create',   'role_social_media_manager', 'brand_assets', 'CREATE',  'CLIENT'),
  ('rtg_smm_leave_view',     'role_social_media_manager', 'leave',        'VIEW',    'OWN'),
  ('rtg_smm_calendar_view',  'role_social_media_manager', 'calendar',     'VIEW',    'OWN'),

  -- Content Creator
  ('rtg_cc_social_view',    'role_content_creator', 'social_media', 'VIEW',   'CLIENT'),
  ('rtg_cc_social_create',  'role_content_creator', 'social_media', 'CREATE', 'CLIENT'),
  ('rtg_cc_social_edit',    'role_content_creator', 'social_media', 'EDIT',   'CLIENT'),
  ('rtg_cc_campaigns_view', 'role_content_creator', 'campaigns',    'VIEW',   'CLIENT'),
  ('rtg_cc_brand_view',     'role_content_creator', 'brand_assets', 'VIEW',   'CLIENT'),
  ('rtg_cc_brand_create',   'role_content_creator', 'brand_assets', 'CREATE', 'CLIENT'),
  ('rtg_cc_leave_view',     'role_content_creator', 'leave',        'VIEW',   'OWN'),
  ('rtg_cc_calendar_view',  'role_content_creator', 'calendar',     'VIEW',   'OWN'),

  -- HR Manager
  ('rtg_hr_team_view',      'role_hr_manager', 'team',     'VIEW',   'ALL'),
  ('rtg_hr_leave_view',     'role_hr_manager', 'leave',    'VIEW',   'ALL'),
  ('rtg_hr_leave_create',   'role_hr_manager', 'leave',    'CREATE', 'ALL'),
  ('rtg_hr_leave_edit',     'role_hr_manager', 'leave',    'EDIT',   'ALL'),
  ('rtg_hr_leave_manage',   'role_hr_manager', 'leave',    'MANAGE', 'ALL'),
  ('rtg_hr_calendar_view',  'role_hr_manager', 'calendar', 'VIEW',   'ALL'),

  -- Viewer
  ('rtg_viewer_team_view',     'role_viewer', 'team',     'VIEW', 'DEPARTMENT'),
  ('rtg_viewer_leave_view',    'role_viewer', 'leave',    'VIEW', 'OWN'),
  ('rtg_viewer_calendar_view', 'role_viewer', 'calendar', 'VIEW', 'OWN')
ON CONFLICT ("roleTemplateId", "module", "action") DO NOTHING;
