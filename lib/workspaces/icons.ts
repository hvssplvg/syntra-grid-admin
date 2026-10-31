// lib/workspaces/icons.ts
//
// Maps a Workspace row's plain `icon` string (DB-stored, not a Postgres
// enum — same reasoning as PermissionGrant.module in schema.prisma) to
// the LucideIcon component it names. Client-safe — no server imports.

import { Building2, CircleDollarSign, Code2, FolderKanban, Headphones, LayoutDashboard, Megaphone, Users, type LucideIcon } from "lucide-react";

const WORKSPACE_ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "code-2": Code2,
  headphones: Headphones,
  megaphone: Megaphone,
  "building-2": Building2,
  "circle-dollar-sign": CircleDollarSign,
  users: Users,
  "folder-kanban": FolderKanban,
};

export function resolveWorkspaceIcon(icon: string | null | undefined): LucideIcon {
  return (icon && WORKSPACE_ICONS[icon]) || LayoutDashboard;
}
