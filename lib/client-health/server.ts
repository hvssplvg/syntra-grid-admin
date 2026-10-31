// lib/client-health/server.ts
//
// Data-fetching + orchestration layer for Client Health — gathers the
// real rows (monitored endpoints + their latest check, support tickets,
// projects, contracts, invoices, billing) and hands them to the pure
// lib/client-health/compute.ts rollup. Nothing here fabricates a number:
// a client with nothing configured comes back with empty arrays, which
// compute.ts already turns into an honest UNKNOWN, not a fake HEALTHY.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { ClientPriority } from "@/app/generated/prisma/enums";
import {
  computeClientHealth,
  isTicketOverdue,
  OPEN_TICKET_STATUSES,
  type ClientHealthResult,
  type ClientHealthStatus,
  type HealthDimension,
} from "@/lib/client-health/compute";

export type ClientHealthListFilters = {
  status?: ClientHealthStatus;
  search?: string;
  dimension?: HealthDimension;
  priority?: ClientPriority;
  /** Narrows to exactly one client — e.g. when the header's
   *  client-context switcher (SelectedClientContext.tsx) has a client
   *  selected. Purely a convenience filter, same as every other filter
   *  here: it never substitutes for the module's own permission check,
   *  and ClientAssignment-based isolation still isn't enforced anywhere
   *  (see lib/client-health/permissions.ts's doc comment). */
  clientId?: string;
};

export type ClientHealthSummary = {
  client: {
    id: string;
    name: string;
    displayName: string | null;
    logoUrl: string | null;
    status: string;
    priority: ClientPriority;
  };
  health: ClientHealthResult;
  openTicketCount: number;
  overdueTicketCount: number;
  monitoredEndpointCount: number;
  lastCheckedAt: string | null;
  nextRenewalAt: string | null;
  outstandingAmount: number;
};

const CLIENT_HEALTH_SELECT = {
  id: true,
  name: true,
  displayName: true,
  logoUrl: true,
  status: true,
  priority: true,
  monitoredEndpoints: {
    where: { enabled: true },
    select: {
      id: true,
      label: true,
      healthChecks: { orderBy: { checkedAt: "desc" as const }, take: 1, select: { status: true, checkedAt: true } },
    },
  },
  // id/title aren't used by computeClientHealth itself (status/priority/
  // createdAt are) — included so the Support panel that reuses this same
  // fetch (see ClientWorkspace.tsx) can show which ticket is which,
  // rather than an anonymous list.
  tickets: { select: { id: true, title: true, status: true, priority: true, createdAt: true } },
  projects: { select: { status: true } },
  contracts: { select: { status: true, renewalAt: true, endDate: true, autoRenew: true } },
  invoices: { select: { status: true, balance: true, dueAt: true } },
  billing: { select: { outstandingAmount: true } },
} satisfies Prisma.ClientSelect;

type ClientHealthRow = Prisma.ClientGetPayload<{ select: typeof CLIENT_HEALTH_SELECT }>;

function toSummary(client: ClientHealthRow): ClientHealthSummary {
  const health = computeClientHealth({
    endpoints: client.monitoredEndpoints.map((endpoint) => ({
      id: endpoint.id,
      label: endpoint.label,
      latestCheckStatus: endpoint.healthChecks[0]?.status ?? null,
      latestCheckAt: endpoint.healthChecks[0]?.checkedAt ?? null,
    })),
    tickets: client.tickets,
    projects: client.projects,
    contracts: client.contracts,
    invoices: client.invoices.map((invoice) => ({ ...invoice, balance: Number(invoice.balance) })),
    billing: client.billing ? { outstandingAmount: Number(client.billing.outstandingAmount) } : null,
  });

  const now = Date.now();
  const nowDate = new Date(now);

  const openTicketCount = client.tickets.filter((ticket) => OPEN_TICKET_STATUSES.has(ticket.status)).length;
  const overdueTicketCount = client.tickets.filter((ticket) => isTicketOverdue(ticket, nowDate)).length;

  const lastCheckedAt = client.monitoredEndpoints
    .map((endpoint) => endpoint.healthChecks[0]?.checkedAt ?? null)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const upcomingRenewal = client.contracts
    .filter((contract) => contract.status === "ACTIVE" && !contract.autoRenew)
    .map((contract) => contract.renewalAt ?? contract.endDate)
    .filter((date): date is Date => date !== null && date.getTime() >= now)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return {
    client: {
      id: client.id,
      name: client.name,
      displayName: client.displayName,
      logoUrl: client.logoUrl,
      status: client.status,
      priority: client.priority,
    },
    health,
    openTicketCount,
    overdueTicketCount,
    monitoredEndpointCount: client.monitoredEndpoints.length,
    lastCheckedAt: lastCheckedAt ? lastCheckedAt.toISOString() : null,
    nextRenewalAt: upcomingRenewal ? upcomingRenewal.toISOString() : null,
    outstandingAmount: client.billing ? Number(client.billing.outstandingAmount) : 0,
  };
}

export async function listClientHealth(filters: ClientHealthListFilters = {}): Promise<ClientHealthSummary[]> {
  const clients = await prisma.client.findMany({
    where: {
      ...(filters.clientId ? { id: filters.clientId } : {}),
      ...(filters.search
        ? { OR: [{ name: { contains: filters.search, mode: "insensitive" } }, { displayName: { contains: filters.search, mode: "insensitive" } }] }
        : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
    },
    select: CLIENT_HEALTH_SELECT,
    orderBy: { name: "asc" },
  });

  let summaries = clients.map(toSummary);

  if (filters.status) {
    summaries = summaries.filter((summary) => summary.health.status === filters.status);
  }
  if (filters.dimension) {
    summaries = summaries.filter((summary) => summary.health.applicableDimensions.includes(filters.dimension as HealthDimension));
  }

  return summaries;
}

export async function getClientHealthDetail(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      ...CLIENT_HEALTH_SELECT,
      monitoredEndpoints: {
        select: {
          id: true,
          label: true,
          url: true,
          method: true,
          enabled: true,
          checkIntervalMinutes: true,
          createdAt: true,
          healthChecks: { orderBy: { checkedAt: "desc" as const }, take: 20, select: { status: true, healthy: true, responseTimeMs: true, statusCode: true, message: true, checkedAt: true } },
        },
      },
      incidents: {
        orderBy: { startedAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          description: true,
          severity: true,
          category: true,
          status: true,
          resolved: true,
          acknowledgedAt: true,
          startedAt: true,
          resolvedAt: true,
        },
      },
    },
  });

  if (!client) return null;

  const summary = toSummary(client as unknown as ClientHealthRow);

  return {
    ...summary,
    monitoredEndpoints: client.monitoredEndpoints,
    incidents: client.incidents,
    tickets: client.tickets,
    projects: client.projects,
    contracts: client.contracts,
    invoices: client.invoices,
  };
}
