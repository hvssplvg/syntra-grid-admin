// lib/access/role-templates.ts
//
// Starter presets for the Grant Dashboard Access UI. These are plain
// constants, not database-seeded rows — selecting one just pre-fills the
// advanced permission matrix, which stays fully editable before submit.
// The backend only ever receives the final resolved grant list, never a
// template id, so these can change freely without any migration.

import type { AdminTab } from '@/app/components/admin/adminNav';
import { AccessAction, AccessScope } from '@/app/generated/prisma/enums';

export type RoleTemplateGrant = {
  module: AdminTab;
  action: AccessAction;
  scope: AccessScope;
};

export type RoleTemplate = {
  id: string;
  label: string;
  description: string;
  grants: RoleTemplateGrant[];
};

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: 'marketing-executive',
    label: 'Marketing Executive',
    description:
      'Full content control over Social Media, Campaigns and Brand Assets, read-only Analytics, department-scoped Team view, self-service leave. No publishing approval or management permissions.',
    grants: [
      { module: 'social_media', action: AccessAction.VIEW, scope: AccessScope.ALL },
      { module: 'social_media', action: AccessAction.CREATE, scope: AccessScope.ALL },
      { module: 'social_media', action: AccessAction.EDIT, scope: AccessScope.ALL },

      { module: 'campaigns', action: AccessAction.VIEW, scope: AccessScope.ALL },
      { module: 'campaigns', action: AccessAction.CREATE, scope: AccessScope.ALL },
      { module: 'campaigns', action: AccessAction.EDIT, scope: AccessScope.ALL },

      { module: 'brand_assets', action: AccessAction.VIEW, scope: AccessScope.ALL },
      { module: 'brand_assets', action: AccessAction.CREATE, scope: AccessScope.ALL },
      { module: 'brand_assets', action: AccessAction.EDIT, scope: AccessScope.ALL },

      { module: 'seo_analytics', action: AccessAction.VIEW, scope: AccessScope.ALL },

      { module: 'team', action: AccessAction.VIEW, scope: AccessScope.DEPARTMENT },

      { module: 'leave', action: AccessAction.VIEW, scope: AccessScope.OWN },
      { module: 'leave', action: AccessAction.CREATE, scope: AccessScope.OWN },
    ],
  },
  {
    id: 'department-viewer',
    label: 'Department Viewer',
    description:
      'Read-only department team view and self-service leave. No other modules.',
    grants: [
      { module: 'team', action: AccessAction.VIEW, scope: AccessScope.DEPARTMENT },
      { module: 'leave', action: AccessAction.VIEW, scope: AccessScope.OWN },
      { module: 'leave', action: AccessAction.CREATE, scope: AccessScope.OWN },
    ],
  },
];
