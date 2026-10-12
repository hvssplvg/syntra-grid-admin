import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { createBrandAsset, listBrandAssets } from "@/lib/brand-assets/server";
import { BrandAssetStatus, BrandAssetType } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/brand-assets/assets]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

function parseEnum<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  if (!value) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export async function GET(request: NextRequest) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;

    const { assets, pagination } = await listBrandAssets(identity, {
      type: parseEnum(params.get("type"), Object.values(BrandAssetType)),
      status: parseEnum(params.get("status"), Object.values(BrandAssetStatus)),
      category: params.get("category"),
      tag: params.get("tag"),
      brandKitId: params.get("brandKitId"),
      search: params.get("search"),
      page: params.get("page") ? Number(params.get("page")) : null,
      pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : null,
      sort: (params.get("sort") as "newest" | "oldest" | "name" | "size" | null) ?? undefined,
    });

    return NextResponse.json({ ok: true, assets, pagination });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.CREATE);

    const formData = await request.formData();
    const file = formData.get("file");
    const name = formData.get("name");
    const type = formData.get("type");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file was provided." }, { status: 400 });
    }
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ ok: false, error: "A name is required." }, { status: 400 });
    }
    if (typeof type !== "string" || !(Object.values(BrandAssetType) as string[]).includes(type)) {
      return NextResponse.json({ ok: false, error: "A valid asset type is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const tags = formData.get("tags");
    const category = formData.get("category");
    const description = formData.get("description");
    const brandKitId = formData.get("brandKitId");
    const usageRights = formData.get("usageRights");

    const asset = await createBrandAsset(identity, {
      name,
      description: typeof description === "string" && description ? description : null,
      type: type as BrandAssetType,
      category: typeof category === "string" && category ? category : null,
      tags: typeof tags === "string" && tags ? tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      brandKitId: typeof brandKitId === "string" && brandKitId ? brandKitId : null,
      usageRights:
        typeof usageRights === "string" && ["INTERNAL_ONLY", "CLIENT_APPROVED", "PUBLIC", "UNRESTRICTED"].includes(usageRights)
          ? (usageRights as "INTERNAL_ONLY" | "CLIENT_APPROVED" | "PUBLIC" | "UNRESTRICTED")
          : undefined,
      buffer,
      mimeType: file.type,
      filename: file.name,
    });

    return NextResponse.json({ ok: true, asset }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
