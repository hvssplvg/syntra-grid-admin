import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { createPost, listPosts, type PostTargetInput } from "@/lib/social-media/server";
import { SocialPostStatus, SocialPlatform } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/social-media/posts]", error);

  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });

  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

function parseEnum<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  if (!value) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/* ============================================================================
   GET /api/admin/social-media/posts
============================================================================ */

export async function GET(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;

    const status = parseEnum(params.get("status"), Object.values(SocialPostStatus));
    const platform = parseEnum(params.get("platform"), Object.values(SocialPlatform));
    const campaignId = params.get("campaignId");
    const search = params.get("search");
    const page = params.get("page") ? Number(params.get("page")) : null;
    const pageSize = params.get("pageSize") ? Number(params.get("pageSize")) : null;

    const { posts, pagination } = await listPosts(identity, { status, platform, campaignId, search, page, pageSize });

    return NextResponse.json({ ok: true, posts, pagination });
  } catch (error) {
    return errorResponse(error);
  }
}

/* ============================================================================
   POST /api/admin/social-media/posts
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    if (typeof body.caption !== "string" || body.caption.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "A caption is required." }, { status: 400 });
    }

    const targets: PostTargetInput[] = Array.isArray(body.targets)
      ? body.targets
          .filter((target: unknown): target is { accountId: string; caption?: string } => {
            return Boolean(target && typeof (target as Record<string, unknown>).accountId === "string");
          })
          .map((target: { accountId: string; caption?: string }) => ({
            accountId: target.accountId,
            caption: typeof target.caption === "string" ? target.caption : null,
          }))
      : [];

    const assetIds = Array.isArray(body.assetIds) ? body.assetIds.filter((id: unknown): id is string => typeof id === "string") : [];

    const post = await createPost(identity, {
      title: typeof body.title === "string" ? body.title : null,
      caption: body.caption,
      category: typeof body.category === "string" ? body.category : null,
      campaignId: typeof body.campaignId === "string" ? body.campaignId : null,
      targets,
      assetIds,
    });

    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
