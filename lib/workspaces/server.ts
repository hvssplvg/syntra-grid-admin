// lib/workspaces/server.ts
//
// Server-side access to the Workspace table (see WORKSPACES & ROLE
// TEMPLATES in prisma/schema.prisma). A Workspace is a named grouping of
// existing app/components/admin/adminNav.ts sections — purely a
// navigation/UX focus layer. It is never consulted by any permission
// check: PermissionGrant alone decides what an account can see or do.

import { prisma } from "@/lib/prisma";

export type WorkspaceSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  colour: string | null;
  sectionKeys: string[];
};

export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      icon: true,
      colour: true,
      sectionKeys: true,
    },
  });

  return workspaces;
}
