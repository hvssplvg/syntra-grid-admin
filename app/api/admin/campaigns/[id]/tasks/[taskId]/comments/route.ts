import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireCampaignsPermission } from "@/lib/campaigns/permissions";
import { addCampaignTaskComment, listCampaignTaskComments } from "@/lib/campaigns/planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; taskId: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/campaigns/:id/tasks/:taskId/comments]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireCampaignsPermission(AccessAction.VIEW);
    const { id, taskId } = await params;
    const comments = await listCampaignTaskComments(id, taskId);
    return NextResponse.json({ ok: true, comments });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireCampaignsPermission(AccessAction.VIEW);
    const { id, taskId } = await params;

    const body = await request.json().catch(() => ({}));
    if (typeof body.body !== "string" || !body.body.trim()) {
      return NextResponse.json({ ok: false, error: "A comment body is required." }, { status: 400 });
    }

    const comment = await addCampaignTaskComment(identity, id, taskId, body.body.trim());
    return NextResponse.json({ ok: true, comment }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
