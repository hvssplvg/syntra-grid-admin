import { describe, expect, it } from "vitest";
import { computeClientHealth, type ClientHealthComputeInput } from "@/lib/client-health/compute";

const NOW = new Date("2026-10-31T12:00:00Z");

const EMPTY_INPUT: ClientHealthComputeInput = {
  endpoints: [],
  tickets: [],
  projects: [],
  contracts: [],
  invoices: [],
  billing: null,
  now: NOW,
};

describe("computeClientHealth — applicability (service-aware health)", () => {
  it("a client with absolutely nothing configured is UNKNOWN, never HEALTHY — missing data is never treated as evidence of health", () => {
    const result = computeClientHealth(EMPTY_INPUT);
    expect(result.status).toBe("UNKNOWN");
    expect(result.applicableDimensions).toEqual(["support"]);
  });

  it("monitoring is excluded entirely when no endpoints are configured — a social-media-only client isn't penalised for having no website to monitor", () => {
    const result = computeClientHealth({ ...EMPTY_INPUT, tickets: [{ status: "RESOLVED", priority: "LOW", createdAt: NOW }] });
    expect(result.applicableDimensions).not.toContain("monitoring");
  });

  it("monitoring becomes applicable the moment at least one endpoint exists", () => {
    const result = computeClientHealth({ ...EMPTY_INPUT, endpoints: [{ id: "e1", label: "Website", latestCheckStatus: "HEALTHY", latestCheckAt: NOW }] });
    expect(result.applicableDimensions).toContain("monitoring");
  });

  it("delivery applies only with at least one project; commercial applies only with a contract or billing row", () => {
    const noDeliveryNoCommercial = computeClientHealth(EMPTY_INPUT);
    expect(noDeliveryNoCommercial.applicableDimensions).not.toContain("delivery");
    expect(noDeliveryNoCommercial.applicableDimensions).not.toContain("commercial");

    const withBoth = computeClientHealth({ ...EMPTY_INPUT, projects: [{ status: "ACTIVE" }], contracts: [{ status: "ACTIVE", renewalAt: null, endDate: null, autoRenew: true }] });
    expect(withBoth.applicableDimensions).toContain("delivery");
    expect(withBoth.applicableDimensions).toContain("commercial");
  });
});

describe("computeClientHealth — monitoring", () => {
  it("one offline endpoint is AT_RISK", () => {
    const result = computeClientHealth({ ...EMPTY_INPUT, endpoints: [{ id: "e1", label: "Production site", latestCheckStatus: "OFFLINE", latestCheckAt: NOW }] });
    expect(result.status).toBe("AT_RISK");
    expect(result.reasons.some((r) => r.dimension === "monitoring" && r.severity === "risk")).toBe(true);
  });

  it("a degraded (but not offline) endpoint is NEEDS_ATTENTION, not AT_RISK", () => {
    const result = computeClientHealth({ ...EMPTY_INPUT, endpoints: [{ id: "e1", label: "Production site", latestCheckStatus: "DEGRADED", latestCheckAt: NOW }] });
    expect(result.status).toBe("NEEDS_ATTENTION");
  });

  it("all endpoints healthy contributes no reasons and no penalty", () => {
    const result = computeClientHealth({ ...EMPTY_INPUT, endpoints: [{ id: "e1", label: "Site", latestCheckStatus: "HEALTHY", latestCheckAt: NOW }] });
    expect(result.status).toBe("HEALTHY");
    expect(result.reasons).toHaveLength(0);
  });

  it("a pending endpoint (never checked) is never Healthy — not even when another dimension also applies", () => {
    // Regression: with only `monitoring` applicable, the pre-existing
    // UNKNOWN-fallback condition (support-only + zero tickets) never
    // fired here since monitoring is a second applicable dimension, so
    // this fell through to the HEALTHY default — silently laundering
    // "awaiting first check" into "Healthy" the moment any other
    // dimension (even the always-applicable, data-free `support`) was
    // present. Caught via Playwright e2e against the real admin UI.
    const result = computeClientHealth({ ...EMPTY_INPUT, endpoints: [{ id: "e1", label: "Production site", latestCheckStatus: null, latestCheckAt: null }] });
    expect(result.status).toBe("UNKNOWN");
    expect(result.status).not.toBe("HEALTHY");
    expect(result.reasons.some((r) => r.dimension === "monitoring" && r.severity === "info")).toBe(true);
  });

  it("a pending endpoint still blocks Healthy even alongside a genuinely fine support ticket", () => {
    const result = computeClientHealth({
      ...EMPTY_INPUT,
      endpoints: [{ id: "e1", label: "Production site", latestCheckStatus: null, latestCheckAt: null }],
      tickets: [{ status: "RESOLVED", priority: "LOW", createdAt: NOW }],
    });
    expect(result.status).toBe("UNKNOWN");
  });

  it("an open-but-not-overdue support ticket on its own (no monitoring) still reports HEALTHY — only monitoring's own pending reason blocks it", () => {
    const result = computeClientHealth({ ...EMPTY_INPUT, tickets: [{ status: "OPEN", priority: "LOW", createdAt: NOW }] });
    expect(result.status).toBe("HEALTHY");
  });
});

describe("computeClientHealth — support (heuristic overdue thresholds)", () => {
  it("an overdue URGENT ticket is AT_RISK", () => {
    const createdAt = new Date(NOW.getTime() - 2 * 86_400_000); // 2 days old
    const result = computeClientHealth({ ...EMPTY_INPUT, tickets: [{ status: "OPEN", priority: "URGENT", createdAt }] });
    expect(result.status).toBe("AT_RISK");
  });

  it("a fresh URGENT ticket (under the 1-day threshold) is not yet overdue", () => {
    const createdAt = new Date(NOW.getTime() - 60 * 60 * 1000); // 1 hour old
    const result = computeClientHealth({ ...EMPTY_INPUT, tickets: [{ status: "OPEN", priority: "URGENT", createdAt }] });
    expect(result.status).toBe("HEALTHY");
  });

  it("a closed ticket is never counted as overdue regardless of age", () => {
    const createdAt = new Date(NOW.getTime() - 100 * 86_400_000);
    const result = computeClientHealth({ ...EMPTY_INPUT, tickets: [{ status: "CLOSED", priority: "URGENT", createdAt }] });
    expect(result.reasons.some((r) => r.dimension === "support" && r.severity !== "info")).toBe(false);
  });

  it("open tickets with none overdue is HEALTHY with an informational reason only", () => {
    const createdAt = new Date(NOW.getTime() - 60 * 60 * 1000);
    const result = computeClientHealth({ ...EMPTY_INPUT, tickets: [{ status: "OPEN", priority: "LOW", createdAt }] });
    expect(result.status).toBe("HEALTHY");
    expect(result.reasons[0].severity).toBe("info");
  });
});

describe("computeClientHealth — commercial", () => {
  it("a contract renewing within 30 days without auto-renew is NEEDS_ATTENTION", () => {
    const renewalAt = new Date(NOW.getTime() + 10 * 86_400_000);
    const result = computeClientHealth({ ...EMPTY_INPUT, contracts: [{ status: "ACTIVE", renewalAt, endDate: null, autoRenew: false }] });
    expect(result.status).toBe("NEEDS_ATTENTION");
  });

  it("an auto-renewing contract never triggers a renewal warning", () => {
    const renewalAt = new Date(NOW.getTime() + 5 * 86_400_000);
    const result = computeClientHealth({ ...EMPTY_INPUT, contracts: [{ status: "ACTIVE", renewalAt, endDate: null, autoRenew: true }] });
    expect(result.status).toBe("HEALTHY");
  });

  it("an expired contract with no active replacement is AT_RISK", () => {
    const result = computeClientHealth({ ...EMPTY_INPUT, contracts: [{ status: "EXPIRED", renewalAt: null, endDate: null, autoRenew: false }] });
    expect(result.status).toBe("AT_RISK");
  });

  it("an invoice overdue by 14+ days is AT_RISK; under that it's only NEEDS_ATTENTION", () => {
    const farPastDue = new Date(NOW.getTime() - 20 * 86_400_000);
    const atRisk = computeClientHealth({ ...EMPTY_INPUT, invoices: [{ status: "SENT", balance: 500, dueAt: farPastDue }] });
    expect(atRisk.status).toBe("AT_RISK");

    const recentlyPastDue = new Date(NOW.getTime() - 3 * 86_400_000);
    const attention = computeClientHealth({ ...EMPTY_INPUT, invoices: [{ status: "SENT", balance: 500, dueAt: recentlyPastDue }] });
    expect(attention.status).toBe("NEEDS_ATTENTION");
  });

  it("an outstanding billing balance with no overdue invoice is NEEDS_ATTENTION", () => {
    const result = computeClientHealth({ ...EMPTY_INPUT, billing: { outstandingAmount: 250 } });
    expect(result.status).toBe("NEEDS_ATTENTION");
  });
});

describe("computeClientHealth — delivery", () => {
  it("a paused project is NEEDS_ATTENTION", () => {
    const result = computeClientHealth({ ...EMPTY_INPUT, projects: [{ status: "PAUSED" }] });
    expect(result.status).toBe("NEEDS_ATTENTION");
  });

  it("an active project alone is HEALTHY — no fabricated milestone data is consulted", () => {
    const result = computeClientHealth({ ...EMPTY_INPUT, projects: [{ status: "ACTIVE" }] });
    expect(result.status).toBe("HEALTHY");
  });
});

describe("computeClientHealth — overall roll-up", () => {
  it("AT_RISK anywhere wins over NEEDS_ATTENTION elsewhere", () => {
    const result = computeClientHealth({
      ...EMPTY_INPUT,
      projects: [{ status: "PAUSED" }], // attention
      contracts: [{ status: "EXPIRED", renewalAt: null, endDate: null, autoRenew: false }], // risk
    });
    expect(result.status).toBe("AT_RISK");
  });
});
