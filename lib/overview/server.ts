// lib/overview/server.ts
//
// Server-side aggregation for the Admin Overview dashboard. Every query
// here reads existing tables only — nothing here writes application data.
// Counts and sums use Prisma aggregations (never "load everything and
// count in JS"); the one place a raw query is used (monthly series) is a
// read-only, non-interpolated SELECT grouped by a literal table name.

import { prisma } from "@/lib/prisma";

/* ============================================================================
   SUMMARY
============================================================================ */

export type OverviewSummary = {
  clients: { active: number };
  projects: { active: number };
  tickets: { open: number; urgent: number };
  employees: { total: number };
  recruitment: { pendingApplications: number; upcomingInterviews: number };
  leave: { pending: number };
  timesheets: { awaitingApproval: number };
  workload: { active: number };
  finance: {
    revenueThisMonth: number;
    receivables: number;
    currency: string;
    monzo: { connected: boolean; balanceMinor: number | null; currency: string | null };
  };
};

/** Unwraps a Promise.allSettled result, logging and falling back to a
 *  safe default on rejection — so one failed count (e.g. a Monzo query
 *  timing out) never zeroes out every other real number in the summary. */
function settleOrDefault<T>(result: PromiseSettledResult<T>, fallback: T, label: string): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`[overview] ${label} query failed:`, result.reason);
  return fallback;
}

export async function getOverviewSummary(): Promise<OverviewSummary> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    activeClientsResult,
    activeProjectsResult,
    openTicketsResult,
    urgentTicketsResult,
    employeesTotalResult,
    pendingApplicationsResult,
    upcomingInterviewsResult,
    pendingLeaveResult,
    timesheetsAwaitingApprovalResult,
    activeWorkloadResult,
    revenueAggregateResult,
    receivablesAggregateResult,
    monzoConnectionResult,
  ] = await Promise.allSettled([
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_CLIENT"] } } }),
    prisma.supportTicket.count({
      where: { priority: "URGENT", status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_CLIENT"] } },
    }),
    prisma.employee.count({ where: { status: { not: "FORMER" } } }),
    prisma.jobApplication.count({ where: { status: "ACTIVE" } }),
    prisma.interview.count({ where: { status: "SCHEDULED", scheduledAt: { gte: now } } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.timesheet.count({ where: { status: "SUBMITTED" } }),
    prisma.workloadAllocation.count({ where: { status: "ACTIVE" } }),
    prisma.clientInvoice.aggregate({ _sum: { paid: true }, where: { paidAt: { gte: monthStart } } }),
    prisma.clientBilling.aggregate({ _sum: { outstandingAmount: true } }),
    prisma.monzoConnection.findFirst({
      where: { active: true },
      orderBy: { connectedAt: "desc" },
      select: { availableBalanceMinor: true, currency: true },
    }),
  ]);

  const activeClients = settleOrDefault(activeClientsResult, 0, "activeClients");
  const activeProjects = settleOrDefault(activeProjectsResult, 0, "activeProjects");
  const openTickets = settleOrDefault(openTicketsResult, 0, "openTickets");
  const urgentTickets = settleOrDefault(urgentTicketsResult, 0, "urgentTickets");
  const employeesTotal = settleOrDefault(employeesTotalResult, 0, "employeesTotal");
  const pendingApplications = settleOrDefault(pendingApplicationsResult, 0, "pendingApplications");
  const upcomingInterviews = settleOrDefault(upcomingInterviewsResult, 0, "upcomingInterviews");
  const pendingLeave = settleOrDefault(pendingLeaveResult, 0, "pendingLeave");
  const timesheetsAwaitingApproval = settleOrDefault(timesheetsAwaitingApprovalResult, 0, "timesheetsAwaitingApproval");
  const activeWorkload = settleOrDefault(activeWorkloadResult, 0, "activeWorkload");
  const revenueAggregate = settleOrDefault(revenueAggregateResult, { _sum: { paid: null } }, "revenueAggregate");
  const receivablesAggregate = settleOrDefault(
    receivablesAggregateResult,
    { _sum: { outstandingAmount: null } },
    "receivablesAggregate",
  );
  const monzoConnection = settleOrDefault(monzoConnectionResult, null, "monzoConnection");

  return {
    clients: { active: activeClients },
    projects: { active: activeProjects },
    tickets: { open: openTickets, urgent: urgentTickets },
    employees: { total: employeesTotal },
    recruitment: { pendingApplications, upcomingInterviews },
    leave: { pending: pendingLeave },
    timesheets: { awaitingApproval: timesheetsAwaitingApproval },
    workload: { active: activeWorkload },
    finance: {
      revenueThisMonth: Number(revenueAggregate._sum.paid ?? 0),
      receivables: Number(receivablesAggregate._sum.outstandingAmount ?? 0),
      currency: "NGN",
      monzo: {
        connected: Boolean(monzoConnection),
        balanceMinor: monzoConnection?.availableBalanceMinor != null ? Number(monzoConnection.availableBalanceMinor) : null,
        currency: monzoConnection?.currency ?? null,
      },
    },
  };
}

/* ============================================================================
   ANALYTICS SERIES — monthly new-Client + new-Project counts

   There is no historical "active projects over time" snapshot table, so
   this uses the one thing that genuinely is real history: creation dates.
   Raw SQL only for the date_trunc grouping; table names are literal, not
   interpolated from any request input.
============================================================================ */

export type AnalyticsPoint = { month: string; clients: number; projects: number; total: number };

export async function getAnalyticsSeries(months = 12): Promise<AnalyticsPoint[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const [clientRows, projectRows] = await Promise.all([
    prisma.$queryRaw<{ month: Date; count: bigint }[]>`
      SELECT date_trunc('month', "createdAt") AS month, count(*)::bigint AS count
      FROM "Client"
      WHERE "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.$queryRaw<{ month: Date; count: bigint }[]>`
      SELECT date_trunc('month', "createdAt") AS month, count(*)::bigint AS count
      FROM "Project"
      WHERE "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const byMonth = new Map<string, { clients: number; projects: number }>();

  const cursor = new Date(since);
  for (let i = 0; i < months; i += 1) {
    byMonth.set(cursor.toISOString().slice(0, 7), { clients: 0, projects: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const row of clientRows) {
    const key = row.month.toISOString().slice(0, 7);
    const entry = byMonth.get(key);
    if (entry) entry.clients = Number(row.count);
  }

  for (const row of projectRows) {
    const key = row.month.toISOString().slice(0, 7);
    const entry = byMonth.get(key);
    if (entry) entry.projects = Number(row.count);
  }

  return Array.from(byMonth.entries()).map(([month, { clients, projects }]) => ({
    month,
    clients,
    projects,
    total: clients + projects,
  }));
}

/* ============================================================================
   RECENT ACTIVITY — merges AuditLog + the 4 domain Activity tables
============================================================================ */

export type ActivityItem = {
  id: string;
  module: "contracts" | "recruitment" | "leave" | "timesheets" | "audit";
  title: string;
  description: string | null;
  actorName: string | null;
  createdAt: Date;
};

type ActorLike = { firstName: string | null; lastName: string | null } | null;

function actorFullName(actor: ActorLike): string | null {
  if (!actor) return null;
  const name = `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim();
  return name.length > 0 ? name : null;
}

function humanizeType(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const ACTOR_SELECT = { firstName: true, lastName: true } as const;

export async function getRecentActivity(limit = 20): Promise<ActivityItem[]> {
  const perSource = Math.min(limit, 15);

  // Promise.allSettled: one source table having an issue (e.g. a lock)
  // should never blank out the other four — each is independent.
  const [contractResult, recruitmentResult, leaveResult, timesheetResult, auditResult] = await Promise.allSettled([
    prisma.contractActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: perSource,
      include: { actor: { select: ACTOR_SELECT } },
    }),
    prisma.recruitmentActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: perSource,
      include: { actor: { select: ACTOR_SELECT } },
    }),
    prisma.leaveActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: perSource,
      include: { actor: { select: ACTOR_SELECT } },
    }),
    prisma.timesheetActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: perSource,
      include: { actor: { select: ACTOR_SELECT } },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: perSource,
      include: { actor: { select: ACTOR_SELECT } },
    }),
  ]);

  const contractRows = settleOrDefault(contractResult, [], "recentActivity.contracts");
  const recruitmentRows = settleOrDefault(recruitmentResult, [], "recentActivity.recruitment");
  const leaveRows = settleOrDefault(leaveResult, [], "recentActivity.leave");
  const timesheetRows = settleOrDefault(timesheetResult, [], "recentActivity.timesheets");
  const auditRows = settleOrDefault(auditResult, [], "recentActivity.audit");

  const items: ActivityItem[] = [
    ...contractRows.map((row) => ({
      id: `contract:${row.id}`,
      module: "contracts" as const,
      title: row.description?.trim() || humanizeType(row.type),
      description: row.description?.trim() ? humanizeType(row.type) : null,
      actorName: actorFullName(row.actor),
      createdAt: row.createdAt,
    })),
    ...recruitmentRows.map((row) => ({
      id: `recruitment:${row.id}`,
      module: "recruitment" as const,
      title: row.description?.trim() || humanizeType(row.type),
      description: row.description?.trim() ? humanizeType(row.type) : null,
      actorName: actorFullName(row.actor),
      createdAt: row.createdAt,
    })),
    ...leaveRows.map((row) => ({
      id: `leave:${row.id}`,
      module: "leave" as const,
      title: row.description?.trim() || humanizeType(row.type),
      description: row.description?.trim() ? humanizeType(row.type) : null,
      actorName: actorFullName(row.actor),
      createdAt: row.createdAt,
    })),
    ...timesheetRows.map((row) => ({
      id: `timesheet:${row.id}`,
      module: "timesheets" as const,
      title: row.description?.trim() || humanizeType(row.type),
      description: row.description?.trim() ? humanizeType(row.type) : null,
      actorName: actorFullName(row.actor),
      createdAt: row.createdAt,
    })),
    ...auditRows.map((row) => ({
      id: `audit:${row.id}`,
      module: "audit" as const,
      title: row.action,
      description: row.entityType,
      actorName: actorFullName(row.actor),
      createdAt: row.createdAt,
    })),
  ];

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return items.slice(0, limit);
}

/* ============================================================================
   ATTENTION — real, rule-based "needs attention" rows

   Each item is a genuine overdue/urgent/expiring record, never a
   fabricated figure. Empty when nothing qualifies.
============================================================================ */

export type AttentionItem = {
  id: string;
  kind: "overdue_invoice" | "urgent_ticket" | "expiring_offer" | "contract_renewal";
  title: string;
  detail: string;
  dueAt: Date | null;
};

export async function getAttentionItems(limit = 6): Promise<AttentionItem[]> {
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [overdueInvoices, urgentTickets, expiringOffers, renewingContracts] = await Promise.all([
    prisma.clientInvoice.findMany({
      where: { status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] }, dueAt: { lt: now } },
      orderBy: { dueAt: "asc" },
      take: limit,
      include: { client: { select: { name: true } } },
    }),
    prisma.supportTicket.findMany({
      where: { priority: "URGENT", status: { in: ["OPEN", "IN_PROGRESS", "WAITING_FOR_CLIENT"] } },
      orderBy: { createdAt: "asc" },
      take: limit,
      include: { client: { select: { name: true } } },
    }),
    prisma.recruitmentOffer.findMany({
      where: { status: { in: ["SENT", "VIEWED"] }, expiresAt: { gte: now, lte: soon } },
      orderBy: { expiresAt: "asc" },
      take: limit,
    }),
    prisma.contract.findMany({
      where: { status: "ACTIVE", renewalAt: { gte: now, lte: soon } },
      orderBy: { renewalAt: "asc" },
      take: limit,
      include: { client: { select: { name: true } } },
    }),
  ]);

  const items: AttentionItem[] = [
    ...overdueInvoices.map((invoice) => ({
      id: `overdue_invoice:${invoice.id}`,
      kind: "overdue_invoice" as const,
      title: `Overdue invoice — ${invoice.client.name}`,
      detail: `${invoice.invoiceRef} is past due`,
      dueAt: invoice.dueAt,
    })),
    ...urgentTickets.map((ticket) => ({
      id: `urgent_ticket:${ticket.id}`,
      kind: "urgent_ticket" as const,
      title: `Urgent ticket — ${ticket.client.name}`,
      detail: ticket.title,
      dueAt: null,
    })),
    ...expiringOffers.map((offer) => ({
      id: `expiring_offer:${offer.id}`,
      kind: "expiring_offer" as const,
      title: `Offer expiring — ${offer.jobTitle}`,
      detail: "Candidate has not responded yet",
      dueAt: offer.expiresAt,
    })),
    ...renewingContracts.map((contract) => ({
      id: `contract_renewal:${contract.id}`,
      kind: "contract_renewal" as const,
      title: `Renewal due — ${contract.client.name}`,
      detail: contract.title,
      dueAt: contract.renewalAt,
    })),
  ];

  items.sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));

  return items.slice(0, limit);
}

/* ============================================================================
   DELIVERY — real Project rows (no fabricated progress percentage)
============================================================================ */

export type DeliveryProject = {
  id: string;
  name: string;
  status: string;
  clientName: string;
};

export async function getDeliveryProjects(limit = 6): Promise<DeliveryProject[]> {
  const projects = await prisma.project.findMany({
    where: { status: { in: ["DEVELOPMENT", "TESTING", "ACTIVE", "MAINTENANCE"] } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: { client: { select: { name: true } } },
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    clientName: project.client.name,
  }));
}

export type WorkspaceSummary = {
  clientId: string;
  clientName: string;
  activeProjects: number;
};

export async function getActiveWorkspaces(limit = 6): Promise<WorkspaceSummary[]> {
  const grouped = await prisma.project.groupBy({
    by: ["clientId"],
    where: { status: { in: ["DEVELOPMENT", "TESTING", "ACTIVE", "MAINTENANCE"] } },
    _count: { _all: true },
    orderBy: { _count: { clientId: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const clients = await prisma.client.findMany({
    where: { id: { in: grouped.map((row) => row.clientId) } },
    select: { id: true, name: true },
  });

  const nameById = new Map(clients.map((client) => [client.id, client.name]));

  return grouped.map((row) => ({
    clientId: row.clientId,
    clientName: nameById.get(row.clientId) ?? "Unknown client",
    activeProjects: row._count._all,
  }));
}

/* ============================================================================
   TEAM — small real sample of department colleagues (beyond the viewer)
============================================================================ */

export type TeammateSample = { id: string; name: string; jobTitle: string | null; departmentName: string | null };

export async function getTeamSample(excludeAdminUserId: string | null, limit = 4): Promise<TeammateSample[]> {
  const employees = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      ...(excludeAdminUserId ? { adminUserId: { not: excludeAdminUserId } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, firstName: true, lastName: true, jobTitle: true, department: { select: { name: true } } },
  });

  return employees.map((employee) => ({
    id: employee.id,
    name: `${employee.firstName} ${employee.lastName}`.trim(),
    jobTitle: employee.jobTitle,
    departmentName: employee.department?.name ?? null,
  }));
}
