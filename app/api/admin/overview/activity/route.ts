import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  AuthenticationError,
  AuthorisationError,
  getCurrentIdentity,
} from "@/lib/auth/current-admin";
import { AccessAction, AccessScope } from "@/app/generated/prisma/enums";
import { getRecentActivity, type ActivityItem } from "@/lib/overview/server";

export const runtime = "nodejs";

/* ============================================================================
   GET /api/admin/overview/activity

   Full access: the company-wide merged feed (contracts, recruitment,
   leave, timesheets, audit log).

   Restricted: requires VIEW on the "activity" module (same module key as
   the Command Activity tab — see adminNav.ts SECURED_MODULE_KEYS). Only
   LeaveActivity/TimesheetActivity are ever shown to a restricted caller —
   ContractActivity/RecruitmentActivity/AuditLog have no per-employee
   ownership to scope by, so they are never exposed here regardless of
   scope. The granted scope (OWN/DEPARTMENT/ALL) on "activity" further
   narrows which employees' rows are visible.
============================================================================ */

export async function GET() {
  try {
    const identity = await getCurrentIdentity();

    if (identity.isFullAccess) {
      const items = await getRecentActivity(20);
      return NextResponse.json({ ok: true, items });
    }

    const grantedScope = identity.permissions.get("activity")?.get(AccessAction.VIEW);

    if (!grantedScope) {
      throw new AuthorisationError("You are not authorised to view activity.");
    }

    const employeeId = identity.employee?.id ?? null;
    const departmentId = identity.employee?.departmentId ?? null;

    let employeeFilter: { in: string[] } | undefined;

    if (grantedScope === AccessScope.OWN) {
      employeeFilter = { in: employeeId ? [employeeId] : [] };
    } else if (grantedScope === AccessScope.DEPARTMENT) {
      const departmentEmployees = departmentId
        ? await prisma.employee.findMany({ where: { departmentId }, select: { id: true } })
        : [];
      employeeFilter = { in: departmentEmployees.map((row) => row.id) };
    }
    // AccessScope.ALL: employeeFilter stays undefined (no restriction).

    const [leaveResult, timesheetResult] = await Promise.allSettled([
      prisma.leaveActivity.findMany({
        where: employeeFilter ? { employeeId: employeeFilter } : undefined,
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { actor: { select: { firstName: true, lastName: true } } },
      }),
      prisma.timesheetActivity.findMany({
        where: employeeFilter ? { employeeId: employeeFilter } : undefined,
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { actor: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    const leaveRows = leaveResult.status === "fulfilled" ? leaveResult.value : [];
    const timesheetRows = timesheetResult.status === "fulfilled" ? timesheetResult.value : [];

    if (leaveResult.status === "rejected") console.error("[admin/overview/activity] leave query failed:", leaveResult.reason);
    if (timesheetResult.status === "rejected") console.error("[admin/overview/activity] timesheet query failed:", timesheetResult.reason);

    const humanize = (type: string) =>
      type
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    const actorName = (actor: { firstName: string | null; lastName: string | null } | null) => {
      if (!actor) return null;
      const name = `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim();
      return name.length > 0 ? name : null;
    };

    const items: ActivityItem[] = [
      ...leaveRows.map((row) => ({
        id: `leave:${row.id}`,
        module: "leave" as const,
        title: row.description?.trim() || humanize(row.type),
        description: row.description?.trim() ? humanize(row.type) : null,
        actorName: actorName(row.actor),
        createdAt: row.createdAt,
      })),
      ...timesheetRows.map((row) => ({
        id: `timesheet:${row.id}`,
        module: "timesheets" as const,
        title: row.description?.trim() || humanize(row.type),
        description: row.description?.trim() ? humanize(row.type) : null,
        actorName: actorName(row.actor),
        createdAt: row.createdAt,
      })),
    ];

    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({ ok: true, items: items.slice(0, 20) });
  } catch (error) {
    console.error("[admin/overview/activity]", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    if (error instanceof AuthorisationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json({ ok: false, error: "Unable to load activity right now." }, { status: 500 });
  }
}
