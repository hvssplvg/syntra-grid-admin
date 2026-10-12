import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, assertCampaignRowAccess, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { getCampaignOrThrow } from "@/lib/campaigns/server";
import { createSocialPostFromContent } from "@/lib/campaigns/content";
import type { PostTargetInput } from "@/lib/social-media/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; contentId: string }> }) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.EDIT);
    const { id, contentId } = await params;
    const campaign = await getCampaignOrThrow(id);
    assertCampaignRowAccess(identity, AccessAction.EDIT, { createdById: campaign.createdById, departmentId: campaign.departmentId });

    const body = await request.json().catch(() => null);
    const rawTargets = Array.isArray(body?.targets) ? body.targets : [];
    const targets: PostTargetInput[] = rawTargets
      .filter((t: unknown): t is { accountId: string } => Boolean(t && typeof (t as { accountId?: unknown }).accountId === "string"))
      .map((t: { accountId: string; caption?: string }) => ({ accountId: t.accountId, caption: t.caption ?? null }));

    if (targets.length === 0) {
      return NextResponse.json({ ok: false, error: "At least one connected account is required." }, { status: 400 });
    }

    const post = await createSocialPostFromContent(identity, id, contentId, targets);
    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (error) {
    console.error("[admin/campaigns/:id/content/:contentId/publish]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
