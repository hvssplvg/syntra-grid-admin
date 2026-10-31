import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { AuthenticationError, AuthorisationError, requireAdmin } from "@/lib/auth/current-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================================
   PATCH /api/admin/social-media/accounts/[id]
   body: { clientId: string | null }

   The smallest safe ownership model for Growth (task spec §9): explicit,
   manual, one account at a time — never automatic, never bulk, never
   inferred from the header's client-context switcher. Full-access only:
   reassigning which client an account belongs to is itself a company-
   wide administrative action, not something a restricted employee
   (even one with social_media:MANAGE) can do — letting a CLIENT-scoped
   restricted caller re-point ownership would let them unlock an account
   by assigning it to their own client, defeating the whole boundary.
============================================================================ */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin();

    const { id } = await params;

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !("clientId" in body)) {
      return NextResponse.json({ ok: false, error: "clientId is required (a client id, or null for Syntra Grid's own)." }, { status: 400 });
    }

    const { clientId } = body as { clientId: unknown };

    if (clientId !== null && typeof clientId !== "string") {
      return NextResponse.json({ ok: false, error: "clientId must be a string or null." }, { status: 400 });
    }

    const account = await prisma.socialAccount.findUnique({ where: { id }, select: { id: true, clientId: true, accountName: true, platform: true } });
    if (!account) {
      return NextResponse.json({ ok: false, error: "Account could not be found." }, { status: 404 });
    }

    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
      if (!client) {
        return NextResponse.json({ ok: false, error: "That client could not be found." }, { status: 404 });
      }
    }

    const updated = await prisma.socialAccount.update({
      where: { id },
      data: { clientId },
      select: { id: true, clientId: true, accountName: true, platform: true },
    });

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "SOCIAL_ACCOUNT_OWNERSHIP_CHANGED",
        entityType: "SocialAccount",
        entityId: id,
        clientId: clientId ?? null,
        metadata: { accountName: account.accountName, platform: account.platform, previousClientId: account.clientId, clientId },
      },
    });

    return NextResponse.json({ ok: true, account: updated });
  } catch (error) {
    console.error("[admin/social-media/accounts/:id PATCH]", error);
    if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
