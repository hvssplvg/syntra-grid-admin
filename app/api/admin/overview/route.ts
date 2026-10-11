import { NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError, requireAdmin } from "@/lib/auth/current-admin";
import {
  getActiveWorkspaces,
  getAnalyticsSeries,
  getAttentionItems,
  getDeliveryProjects,
  getOverviewSummary,
  getTeamSample,
  type OverviewSummary,
} from "@/lib/overview/server";

export const runtime = "nodejs";

/* ============================================================================
   SAFE DEFAULTS

   Every section below maps to its own widget. If one section's query
   fails, every OTHER widget must still render with real data — only the
   failed widget falls back to an honest empty state. Promise.allSettled
   (not Promise.all) is what makes that possible: one rejection never
   takes the whole response down.
============================================================================ */

const EMPTY_SUMMARY: OverviewSummary = {
  clients: { active: 0 },
  projects: { active: 0 },
  tickets: { open: 0, urgent: 0 },
  employees: { total: 0 },
  recruitment: { pendingApplications: 0, upcomingInterviews: 0 },
  leave: { pending: 0 },
  timesheets: { awaitingApproval: 0 },
  workload: { active: 0 },
  finance: {
    revenueThisMonth: 0,
    receivables: 0,
    currency: "NGN",
    monzo: { connected: false, balanceMinor: null, currency: null },
  },
};

function settle<T>(result: PromiseSettledResult<T>, fallback: T, label: string): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`[admin/overview] ${label} failed:`, result.reason);
  return fallback;
}

/* ============================================================================
   GET /api/admin/overview

   Full-access only. A restricted employee already has her own, real,
   per-module endpoints (/api/admin/me, /api/admin/leave/overview,
   /api/admin/team) feeding her Overview widgets — company-wide business
   figures are never relevant to her and are not exposed here.
============================================================================ */

export async function GET() {
  try {
    const admin = await requireAdmin();

    const [summaryResult, analyticsResult, attentionResult, deliveryResult, workspacesResult, teamResult] =
      await Promise.allSettled([
        getOverviewSummary(),
        getAnalyticsSeries(12),
        getAttentionItems(6),
        getDeliveryProjects(6),
        getActiveWorkspaces(6),
        getTeamSample(admin.id, 4),
      ]);

    return NextResponse.json({
      ok: true,
      summary: settle(summaryResult, EMPTY_SUMMARY, "summary"),
      analytics: settle(analyticsResult, [], "analytics"),
      attention: settle(attentionResult, [], "attention"),
      delivery: settle(deliveryResult, [], "delivery"),
      workspaces: settle(workspacesResult, [], "workspaces"),
      team: settle(teamResult, [], "team"),
    });
  } catch (error) {
    console.error("[admin/overview]", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    if (error instanceof AuthorisationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { ok: false, error: "Unable to load the Overview dashboard right now." },
      { status: 500 },
    );
  }
}
