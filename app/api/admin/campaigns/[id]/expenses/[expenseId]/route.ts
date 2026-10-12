import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, hasCampaignsPermission, isOwnAdminUser, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { updateCampaignExpense } from "@/lib/campaigns/budget";
import { CampaignBudgetCategory, CurrencyCode } from "@/app/generated/prisma/enums";
import { parseEnumValue, parseOptionalString } from "@/lib/campaigns/validation";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; expenseId: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id, expenseId } = await params;
    const campaign = await getCampaignOrThrow(id);
    const expense = await prisma.campaignExpense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.campaignId !== id) {
      return NextResponse.json({ ok: false, error: "This expense could not be found." }, { status: 404 });
    }

    // The person who recorded the expense can edit it (before it's
    // approved) without campaign-level EDIT access; anyone else needs it.
    if (!isOwnAdminUser(identity, expense.recordedById)) {
      if (!hasCampaignsPermission(identity, AccessAction.EDIT)) {
        return NextResponse.json({ ok: false, error: "You are not authorised to edit this expense." }, { status: 403 });
      }
      assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: campaign.createdById, departmentId: campaign.departmentId });
    }

    const body = await request.json().catch(() => ({}));

    const expenseDate = typeof body.expenseDate === "string" ? new Date(body.expenseDate) : undefined;
    if (expenseDate && Number.isNaN(expenseDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid expense date." }, { status: 400 });
    }

    const updated = await updateCampaignExpense(id, expenseId, {
      ...(typeof body.description === "string" ? { description: body.description.trim() } : {}),
      ...(body.category !== undefined ? { category: parseEnumValue(body.category, Object.values(CampaignBudgetCategory)) ?? undefined } : {}),
      ...(typeof body.amount === "number" && body.amount >= 0 ? { amount: body.amount } : {}),
      ...(body.currency !== undefined ? { currency: parseEnumValue(body.currency, Object.values(CurrencyCode)) ?? undefined } : {}),
      ...(expenseDate !== undefined ? { expenseDate } : {}),
      ...(body.vendor !== undefined ? { vendor: parseOptionalString(body.vendor) } : {}),
      ...(body.reference !== undefined ? { reference: parseOptionalString(body.reference) } : {}),
      ...(body.receiptUrl !== undefined ? { receiptUrl: parseOptionalString(body.receiptUrl) } : {}),
      ...(body.notes !== undefined ? { notes: parseOptionalString(body.notes) } : {}),
    });

    return NextResponse.json({ ok: true, expense: updated });
  } catch (error) {
    console.error("[admin/campaigns/:id/expenses/:expenseId]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
