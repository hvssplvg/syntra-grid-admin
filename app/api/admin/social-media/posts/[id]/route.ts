import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import {
  AccessAction,
  assertSocialMediaRowAccess,
  requireSocialMediaPermission,
} from "@/lib/social-media/permissions";
import { deletePost, getPostOrThrow, updatePost, PostDeletionConflictError, type PostTargetInput } from "@/lib/social-media/server";
import { SocialMediaPlacement } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/social-media/posts/:id]", error);

  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  if (error instanceof PostDeletionConflictError) {
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 409 });
  }

  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.VIEW);
    const { id } = await params;

    const post = await getPostOrThrow(id);
    assertSocialMediaRowAccess(identity, AccessAction.VIEW, { createdById: post.createdById });

    return NextResponse.json({ ok: true, post });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.EDIT);
    const { id } = await params;

    const existing = await getPostOrThrow(id);
    assertSocialMediaRowAccess(identity, AccessAction.EDIT, { createdById: existing.createdById });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const placementValues = Object.values(SocialMediaPlacement) as string[];

    const targets: PostTargetInput[] | undefined = Array.isArray(body.targets)
      ? body.targets
          .filter((target: unknown): target is { accountId: string; caption?: string; placement?: string } =>
            Boolean(target && typeof (target as Record<string, unknown>).accountId === "string"),
          )
          .map((target: { accountId: string; caption?: string; placement?: string }) => ({
            accountId: target.accountId,
            caption: typeof target.caption === "string" ? target.caption : null,
            placement:
              typeof target.placement === "string" && placementValues.includes(target.placement)
                ? (target.placement as SocialMediaPlacement)
                : undefined,
          }))
      : undefined;

    const assetIds: string[] | undefined = Array.isArray(body.assetIds)
      ? body.assetIds.filter((assetId: unknown): assetId is string => typeof assetId === "string")
      : undefined;

    const post = await updatePost(identity, id, {
      ...(typeof body.title === "string" || body.title === null ? { title: body.title } : {}),
      ...(typeof body.caption === "string" ? { caption: body.caption } : {}),
      ...(typeof body.category === "string" || body.category === null ? { category: body.category } : {}),
      ...(typeof body.campaignId === "string" || body.campaignId === null ? { campaignId: body.campaignId } : {}),
      ...(targets ? { targets } : {}),
      ...(assetIds ? { assetIds } : {}),
    });

    return NextResponse.json({ ok: true, post });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.MANAGE);
    const { id } = await params;

    const existing = await getPostOrThrow(id);
    assertSocialMediaRowAccess(identity, AccessAction.MANAGE, { createdById: existing.createdById });

    const body = await request.json().catch(() => null);
    const confirmPublishedRemoval = Boolean(body && typeof body === "object" && (body as Record<string, unknown>).confirmPublishedRemoval === true);

    await deletePost(identity, id, { confirmPublishedRemoval });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
