// lib/client-health/compute.ts
//
// The actual Client Health rollup — a pure function, no DB/HTTP access,
// fully unit-testable in isolation. Computed fresh on every read from
// the real underlying rows (tickets, contracts, billing, health
// checks) — never stored, so it can never go stale or drift from what
// those rows actually say.
//
// SERVICE-AWARE HEALTH: no "services a client receives" concept exists
// anywhere in this schema (audited, not assumed — see the Client Health
// plan). Applicability is derived from real DATA PRESENCE instead:
// - monitoring only applies if the client has >=1 enabled endpoint —
//   missing monitoring data is NEVER treated as evidence of health.
// - support always applies (any client can raise a ticket; zero tickets
//   is a neutral signal, not unhealthy).
// - delivery applies if the client has >=1 project.
// - commercial applies if the client has >=1 contract or a billing row.
// The overall status is the worst case across APPLICABLE dimensions
// only. UNKNOWN means literally no dimension has any applicable data.
//
// "Overdue ticket" and "renewal approaching" are documented heuristics,
// not ground truth — SupportTicket has no SLA/due-date field in this
// schema, so age-by-priority thresholds stand in for it. Adjust the
// constants below if the real policy differs; nothing else depends on
// their exact values.

export type ClientHealthStatus = "HEALTHY" | "NEEDS_ATTENTION" | "AT_RISK" | "UNKNOWN";

export type HealthDimension = "monitoring" | "support" | "delivery" | "commercial";

export type HealthReasonSeverity = "info" | "attention" | "risk";

export type HealthReason = {
  dimension: HealthDimension;
  severity: HealthReasonSeverity;
  summary: string;
};

export type ClientHealthResult = {
  status: ClientHealthStatus;
  reasons: HealthReason[];
  applicableDimensions: HealthDimension[];
};

export type MonitoringEndpointInput = {
  id: string;
  label: string;
  latestCheckStatus: "HEALTHY" | "DEGRADED" | "OFFLINE" | "UNKNOWN" | null;
  latestCheckAt: Date | null;
};

export type SupportTicketInput = {
  status: "OPEN" | "IN_PROGRESS" | "WAITING_FOR_CLIENT" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  createdAt: Date;
};

export type ProjectInput = {
  status: "DEVELOPMENT" | "TESTING" | "ACTIVE" | "MAINTENANCE" | "PAUSED" | "ARCHIVED";
};

export type ContractInput = {
  status: "DRAFT" | "PENDING_SIGNATURE" | "ACTIVE" | "EXPIRED" | "TERMINATED" | "CANCELLED";
  renewalAt: Date | null;
  endDate: Date | null;
  autoRenew: boolean;
};

export type InvoiceInput = {
  status: "DRAFT" | "SENT" | "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "CANCELLED";
  balance: number;
  dueAt: Date | null;
};

export type BillingInput = {
  outstandingAmount: number;
} | null;

export type ClientHealthComputeInput = {
  endpoints: MonitoringEndpointInput[];
  tickets: SupportTicketInput[];
  projects: ProjectInput[];
  contracts: ContractInput[];
  invoices: InvoiceInput[];
  billing: BillingInput;
  now?: Date;
};

// Exported so lib/client-health/server.ts's summary counts (openTicketCount/
// overdueTicketCount) use this exact same heuristic rather than keeping a
// second copy that could silently drift out of sync with it.
export const OVERDUE_TICKET_THRESHOLD_DAYS: Record<SupportTicketInput["priority"], number> = {
  URGENT: 1,
  HIGH: 3,
  MEDIUM: 7,
  LOW: 14,
};

const RENEWAL_WARNING_WINDOW_DAYS = 30;
const INVOICE_AT_RISK_OVERDUE_DAYS = 14;

export const OPEN_TICKET_STATUSES = new Set<SupportTicketInput["status"]>(["OPEN", "IN_PROGRESS", "WAITING_FOR_CLIENT"]);

function daysBetween(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / 86_400_000;
}

export function isTicketOverdue(ticket: SupportTicketInput, now: Date): boolean {
  if (!OPEN_TICKET_STATUSES.has(ticket.status)) return false;
  return daysBetween(now, ticket.createdAt) >= OVERDUE_TICKET_THRESHOLD_DAYS[ticket.priority];
}

// Exported so lib/systems/server.ts can derive a ManagedSystem's own
// aggregate monitoring status from its linked endpoints using this exact,
// already-correct logic — rather than a second, parallel copy of it.
export function computeMonitoring(endpoints: MonitoringEndpointInput[]): { applicable: boolean; reasons: HealthReason[] } {
  if (endpoints.length === 0) return { applicable: false, reasons: [] };

  const reasons: HealthReason[] = [];
  const offline = endpoints.filter((endpoint) => endpoint.latestCheckStatus === "OFFLINE");
  const degraded = endpoints.filter((endpoint) => endpoint.latestCheckStatus === "DEGRADED");
  const pending = endpoints.filter((endpoint) => endpoint.latestCheckStatus === null);

  if (offline.length > 0) {
    reasons.push({ dimension: "monitoring", severity: "risk", summary: `${offline.length} monitored endpoint${offline.length > 1 ? "s" : ""} offline (${offline.map((endpoint) => endpoint.label).join(", ")}).` });
  }
  if (degraded.length > 0) {
    reasons.push({ dimension: "monitoring", severity: "attention", summary: `${degraded.length} monitored endpoint${degraded.length > 1 ? "s" : ""} degraded.` });
  }
  if (pending.length > 0 && offline.length === 0 && degraded.length === 0) {
    reasons.push({ dimension: "monitoring", severity: "info", summary: `${pending.length} endpoint${pending.length > 1 ? "s" : ""} awaiting first check.` });
  }

  return { applicable: true, reasons };
}

function computeSupport(tickets: SupportTicketInput[], now: Date): { applicable: true; reasons: HealthReason[] } {
  const reasons: HealthReason[] = [];
  const overdue = tickets.filter((ticket) => isTicketOverdue(ticket, now));
  const overdueUrgent = overdue.filter((ticket) => ticket.priority === "URGENT");
  const open = tickets.filter((ticket) => OPEN_TICKET_STATUSES.has(ticket.status));

  if (overdueUrgent.length > 0) {
    reasons.push({ dimension: "support", severity: "risk", summary: `${overdueUrgent.length} overdue urgent support ticket${overdueUrgent.length > 1 ? "s" : ""}.` });
  } else if (overdue.length > 0) {
    reasons.push({ dimension: "support", severity: "attention", summary: `${overdue.length} overdue support ticket${overdue.length > 1 ? "s" : ""}.` });
  } else if (open.length > 0) {
    reasons.push({ dimension: "support", severity: "info", summary: `${open.length} open support ticket${open.length > 1 ? "s" : ""}, none overdue.` });
  }

  return { applicable: true, reasons };
}

function computeDelivery(projects: ProjectInput[]): { applicable: boolean; reasons: HealthReason[] } {
  if (projects.length === 0) return { applicable: false, reasons: [] };

  const reasons: HealthReason[] = [];
  const paused = projects.filter((project) => project.status === "PAUSED");
  if (paused.length > 0) {
    reasons.push({ dimension: "delivery", severity: "attention", summary: `${paused.length} project${paused.length > 1 ? "s" : ""} paused.` });
  }
  // Deliberately not computing anything beyond real Project.status here —
  // this schema has no milestone/task-deadline data yet (adminNav.ts
  // marks that whole module PLANNED), so "milestone missed" has no
  // ground truth to compute from and isn't fabricated.

  return { applicable: true, reasons };
}

function computeCommercial(contracts: ContractInput[], invoices: InvoiceInput[], billing: BillingInput, now: Date): { applicable: boolean; reasons: HealthReason[] } {
  if (contracts.length === 0 && invoices.length === 0 && !billing) return { applicable: false, reasons: [] };

  const reasons: HealthReason[] = [];

  const activeContracts = contracts.filter((contract) => contract.status === "ACTIVE");
  const expiredContracts = contracts.filter((contract) => contract.status === "EXPIRED");

  if (contracts.length > 0 && activeContracts.length === 0 && expiredContracts.length > 0) {
    reasons.push({ dimension: "commercial", severity: "risk", summary: "No active contract — last one has expired." });
  }

  for (const contract of activeContracts) {
    if (contract.autoRenew) continue;
    const renewalDate = contract.renewalAt ?? contract.endDate;
    if (!renewalDate) continue;
    const daysUntil = daysBetween(renewalDate, now);
    if (daysUntil >= 0 && daysUntil <= RENEWAL_WARNING_WINDOW_DAYS) {
      reasons.push({ dimension: "commercial", severity: "attention", summary: `Contract renews in ${Math.ceil(daysUntil)} day${Math.ceil(daysUntil) === 1 ? "" : "s"} (no auto-renew).` });
    }
  }

  const overdueInvoices = invoices.filter((invoice) => invoice.status === "OVERDUE" || (invoice.balance > 0 && invoice.dueAt !== null && invoice.dueAt < now));
  const severelyOverdue = overdueInvoices.filter((invoice) => invoice.dueAt !== null && daysBetween(now, invoice.dueAt) >= INVOICE_AT_RISK_OVERDUE_DAYS);

  if (severelyOverdue.length > 0) {
    reasons.push({ dimension: "commercial", severity: "risk", summary: `${severelyOverdue.length} invoice${severelyOverdue.length > 1 ? "s" : ""} overdue by ${INVOICE_AT_RISK_OVERDUE_DAYS}+ days.` });
  } else if (overdueInvoices.length > 0) {
    reasons.push({ dimension: "commercial", severity: "attention", summary: `${overdueInvoices.length} overdue invoice${overdueInvoices.length > 1 ? "s" : ""}.` });
  } else if (billing && billing.outstandingAmount > 0) {
    reasons.push({ dimension: "commercial", severity: "attention", summary: "Outstanding balance on file." });
  }

  return { applicable: true, reasons };
}

export function computeClientHealth(input: ClientHealthComputeInput): ClientHealthResult {
  const now = input.now ?? new Date();

  const monitoring = computeMonitoring(input.endpoints);
  const support = computeSupport(input.tickets, now);
  const delivery = computeDelivery(input.projects);
  const commercial = computeCommercial(input.contracts, input.invoices, input.billing, now);

  const applicableDimensions: HealthDimension[] = [];
  if (monitoring.applicable) applicableDimensions.push("monitoring");
  applicableDimensions.push("support");
  if (delivery.applicable) applicableDimensions.push("delivery");
  if (commercial.applicable) applicableDimensions.push("commercial");

  const reasons = [...monitoring.reasons, ...support.reasons, ...delivery.reasons, ...commercial.reasons];

  let status: ClientHealthStatus;
  if (reasons.some((reason) => reason.severity === "risk")) {
    status = "AT_RISK";
  } else if (reasons.some((reason) => reason.severity === "attention")) {
    status = "NEEDS_ATTENTION";
  } else if (reasons.some((reason) => reason.dimension === "monitoring" && reason.severity === "info")) {
    // At least one monitored endpoint has never completed a check —
    // computeMonitoring's only "info" reason is exactly this pending
    // case (confirmed above), never a confirmed-fine signal. Unconfirmed
    // must never be reported as Healthy on the strength of other
    // dimensions alone, regardless of how many other dimensions apply —
    // this was previously falling through to HEALTHY whenever more than
    // one dimension applied (e.g. monitoring + the always-applicable
    // support), which silently laundered "awaiting first check" into
    // "Healthy". Other dimensions' own "info" reasons (e.g. open-but-not-
    // overdue support tickets) are genuinely neutral/fine and don't hit
    // this branch, since this checks specifically for monitoring's info
    // reason, not any info reason.
    status = "UNKNOWN";
  } else if (applicableDimensions.length === 1 && applicableDimensions[0] === "support" && input.tickets.length === 0) {
    // The only always-applicable dimension has literally no data at all
    // (no tickets ever raised) and nothing else is configured — there is
    // genuinely nothing to assess yet.
    status = "UNKNOWN";
  } else {
    status = "HEALTHY";
  }

  return { status, reasons, applicableDimensions };
}
