import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { getImageUsageSnapshot } from "@/lib/ai/imageUsage";
import { estimateImageCostUsd, estimateRevisionCostUsd } from "@/lib/ai/imageCost";
import { AI_IMAGE_QUALITIES, AI_IMAGE_SIZES, type AiImageQuality, type AiImageSize } from "@/lib/ai/imageTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   GET /api/admin/social-media/ai/image-usage?size=...&quality=...&kind=...

   Read-only — lets the UI show "you've used X/5 generations today,
   $Y.YY of $2.00 spent" and the estimated cost of the NEXT generation
   BEFORE the admin commits to it, using the exact same pricing table
   the real spend-cap enforcement uses (imageUsage.ts/imageCost.ts) —
   never a separate, possibly-drifted number.
============================================================================ */

export async function GET(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const { searchParams } = new URL(request.url);
    const size = searchParams.get("size");
    const quality = searchParams.get("quality");
    const kind = searchParams.get("kind") === "revision" ? "revision" : "generate";

    const validSize = (AI_IMAGE_SIZES as readonly string[]).includes(size ?? "") ? (size as AiImageSize) : "1024x1024";
    const validQuality = (AI_IMAGE_QUALITIES as readonly string[]).includes(quality ?? "") ? (quality as AiImageQuality) : "medium";

    const usage = getImageUsageSnapshot(identity.admin.id);
    const estimatedCostUsd = kind === "revision" ? estimateRevisionCostUsd(validSize, validQuality) : estimateImageCostUsd(validSize, validQuality);

    return NextResponse.json({ ok: true, usage, estimatedCostUsd });
  } catch (error) {
    console.error("[admin/social-media/ai/image-usage]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
