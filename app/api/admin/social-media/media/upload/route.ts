import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { uploadSocialMediaAsset } from "@/lib/social-media/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file was provided." }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ ok: false, error: "The file is empty." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const asset = await uploadSocialMediaAsset({ buffer, mimeType: file.type, uploadedById: identity.admin.id });

    return NextResponse.json({ ok: true, asset }, { status: 201 });
  } catch (error) {
    console.error("[admin/social-media/media/upload]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong while uploading the file." }, { status: 500 });
  }
}
