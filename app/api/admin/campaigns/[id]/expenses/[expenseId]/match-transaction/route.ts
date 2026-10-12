import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { matchCampaignExpenseToMonzoTransaction } from "@/lib/campaigns/budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; expenseId: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.EDIT);
    const { id, expenseId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const body = await request.json().catch(() => null);
    const monzoTransactionId = typeof body?.monzoTransactionId === "string" ? body.monzoTransactionId : null;
    if (!monzoTransactionId) return NextResponse.json({ ok: false, error: "A bank transaction is required." }, { status: 400 });

    const expense = await matchCampaignExpenseToMonzoTransaction(id, expenseId, monzoTransactionId);
    return NextResponse.json({ ok: true, expense });
  } catch (error) {
    console.error("[admin/campaigns/:id/expenses/:expenseId/match-transaction]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
