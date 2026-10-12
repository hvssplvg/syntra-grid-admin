import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { createCampaignExpense, listCampaignExpenses } from "@/lib/campaigns/budget";
import { CampaignBudgetCategory, CampaignExpenseApprovalStatus, CampaignExpensePaymentStatus, CurrencyCode } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalId, parseOptionalString, parseRequiredAmount } from "@/lib/campaigns/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/expenses]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.VIEW, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const sp = request.nextUrl.searchParams;
    const expenses = await listCampaignExpenses(id, {
      category: parseEnumValue(sp.get("category"), Object.values(CampaignBudgetCategory)),
      approvalStatus: parseEnumValue(sp.get("approvalStatus"), Object.values(CampaignExpenseApprovalStatus)),
      paymentStatus: parseEnumValue(sp.get("paymentStatus"), Object.values(CampaignExpensePaymentStatus)),
    });

    return NextResponse.json({ ok: true, expenses });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.CREATE);
    const { id } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.CREATE, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const body = await request.json().catch(() => null);

    const description = parseOptionalString(body?.description);
    if (!description) return NextResponse.json({ ok: false, error: "A description is required." }, { status: 400 });

    const category = parseEnumValue(body?.category, Object.values(CampaignBudgetCategory));
    if (!category) return NextResponse.json({ ok: false, error: "A valid expense category is required." }, { status: 400 });

    const amount = parseRequiredAmount(body?.amount);
    if (amount === null) return NextResponse.json({ ok: false, error: "A non-negative amount is required." }, { status: 400 });

    const expenseDate = typeof body?.expenseDate === "string" ? new Date(body.expenseDate) : null;
    if (!expenseDate || Number.isNaN(expenseDate.getTime())) {
      return NextResponse.json({ ok: false, error: "A valid expense date is required." }, { status: 400 });
    }

    const allocationId = parseOptionalId(body?.allocationId);
    if (allocationId === undefined) return NextResponse.json({ ok: false, error: "The selected allocation is invalid." }, { status: 400 });

    const expense = await createCampaignExpense(identity, id, {
      description,
      category,
      amount,
      currency: parseEnumValue(body?.currency, Object.values(CurrencyCode)) ?? undefined,
      expenseDate,
      vendor: parseOptionalString(body?.vendor),
      reference: parseOptionalString(body?.reference),
      allocationId,
      receiptUrl: parseOptionalString(body?.receiptUrl),
      notes: parseOptionalString(body?.notes),
    });

    return NextResponse.json({ ok: true, expense }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
