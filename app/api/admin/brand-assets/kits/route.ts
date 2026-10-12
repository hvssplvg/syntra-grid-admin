import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { createBrandKit, listBrandKits } from "@/lib/brand-assets/server";
import { BrandKitStatus } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown, scope: string) {
  console.error(`[admin/brand-assets/${scope}]`, error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireBrandAssetsPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;
    const statusParam = params.get("status");
    const status = (Object.values(BrandKitStatus) as string[]).includes(statusParam ?? "") ? (statusParam as BrandKitStatus) : null;

    const kits = await listBrandKits({ status, clientId: params.get("clientId"), search: params.get("search") });

    return NextResponse.json({ ok: true, kits });
  } catch (error) {
    return errorResponse(error, "kits");
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.MANAGE);

    const body = await request.json().catch(() => null);
    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ ok: false, error: "A brand kit name is required." }, { status: 400 });
    }

    const kit = await createBrandKit(identity, {
      name: body.name,
      description: typeof body.description === "string" ? body.description : null,
      clientId: typeof body.clientId === "string" ? body.clientId : null,
      primaryColors: Array.isArray(body.primaryColors) ? body.primaryColors.filter((value: unknown) => typeof value === "string") : undefined,
      secondaryColors: Array.isArray(body.secondaryColors) ? body.secondaryColors.filter((value: unknown) => typeof value === "string") : undefined,
      typography: body.typography && typeof body.typography === "object" ? body.typography : null,
    });

    return NextResponse.json({ ok: true, kit }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "kits");
  }
}
