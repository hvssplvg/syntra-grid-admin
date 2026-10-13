import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { requireMessagingIdentity } from "@/lib/messaging/permissions";
import { discardPendingAttachment, resolveAttachmentDownload } from "@/lib/messaging/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Membership-checked, then redirects to a freshly signed, short-lived
 * Cloudinary URL — the response itself never carries a reusable public
 * link, and nothing here is cached.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireMessagingIdentity();
    const { id } = await params;

    const { url } = await resolveAttachmentDownload(identity, id);

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[admin/chat/attachments/:id]", error);

    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });

    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireMessagingIdentity();
    const { id } = await params;

    await discardPendingAttachment(identity, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/chat/attachments/:id]", error);

    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });

    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
