import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { requireMessagingIdentity } from "@/lib/messaging/permissions";
import { uploadMessageAttachment } from "@/lib/messaging/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const identity = await requireMessagingIdentity();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file was provided." }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ ok: false, error: "The file is empty." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const attachment = await uploadMessageAttachment(identity, {
      buffer,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    });

    return NextResponse.json(
      { ok: true, attachment: { id: attachment.id, originalFilename: attachment.originalFilename, mimeType: attachment.mimeType, size: attachment.size } },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin/chat/attachments]", error);

    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });

    return NextResponse.json({ ok: false, error: "Something went wrong while uploading the file." }, { status: 500 });
  }
}
