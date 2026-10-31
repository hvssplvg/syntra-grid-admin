import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { TrendStatus } from "@/app/generated/prisma/enums";
import { deleteTrend, getTrend, promoteTrendToContentProject, updateTrendStatus } from "@/lib/trends/trends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// NEW is allowed here too, so the client's "Undo" toast can put a
// freshly-discovered trend back into triage after a Save/Skip.
const UPDATABLE_STATUSES = new Set<string>([TrendStatus.NEW, TrendStatus.SAVED, TrendStatus.DISMISSED, TrendStatus.ARCHIVED, TrendStatus.USED]);

function errorResponse(error: unknown) {
  console.error("[admin/social-media/trends/:id]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireSocialMediaPermission(AccessAction.VIEW);
    const { id } = await params;
    const trend = await getTrend(id);
    if (!trend) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, trend });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Two independent, mutually-exclusive actions:
 * - { status: "NEW" | "SAVED" | "DISMISSED" | "ARCHIVED" | "USED" } — swipe/save/skip/generate,
 *   and NEW to undo a save/skip back into triage.
 * - { contentProjectId } — promoting this trend into a real ContentProject (also sets USED).
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.EDIT);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });

    const existing = await getTrend(id);
    if (!existing) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

    if (typeof body.contentProjectId === "string" && body.contentProjectId.trim()) {
      const trend = await promoteTrendToContentProject(id, body.contentProjectId.trim());
      return NextResponse.json({ ok: true, trend });
    }

    if (typeof body.status === "string") {
      if (!UPDATABLE_STATUSES.has(body.status)) {
        return NextResponse.json({ ok: false, error: "status must be NEW, SAVED, DISMISSED, ARCHIVED or USED." }, { status: 400 });
      }
      const trend = await updateTrendStatus(identity.admin.id, id, body.status as TrendStatus);
      return NextResponse.json({ ok: true, trend });
    }

    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireSocialMediaPermission(AccessAction.EDIT);
    const { id } = await params;
    await deleteTrend(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
