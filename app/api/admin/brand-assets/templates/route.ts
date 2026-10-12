import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { createBrandTemplate, listBrandTemplates } from "@/lib/brand-assets/server";
import { BrandTemplateCategory, BrandTemplateStatus } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/brand-assets/templates]", error);
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
    await requireBrandAssetsPermission(AccessAction.VIEW);

    const params = request.nextUrl.searchParams;

    const { templates, pagination } = await listBrandTemplates({
      category: parseEnum(params.get("category"), Object.values(BrandTemplateCategory)),
      status: parseEnum(params.get("status"), Object.values(BrandTemplateStatus)),
      brandKitId: params.get("brandKitId"),
      search: params.get("search"),
      page: params.get("page") ? Number(params.get("page")) : null,
      pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : null,
    });

    return NextResponse.json({ ok: true, templates, pagination });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.MANAGE);

    const formData = await request.formData();
    const file = formData.get("file");
    const name = formData.get("name");
    const category = formData.get("category");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file was provided." }, { status: 400 });
    }
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ ok: false, error: "A name is required." }, { status: 400 });
    }
    if (typeof category !== "string" || !(Object.values(BrandTemplateCategory) as string[]).includes(category)) {
      return NextResponse.json({ ok: false, error: "A valid category is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const tags = formData.get("tags");
    const description = formData.get("description");
    const brandKitId = formData.get("brandKitId");

    const template = await createBrandTemplate(identity, {
      name,
      description: typeof description === "string" && description ? description : null,
      category: category as BrandTemplateCategory,
      tags: typeof tags === "string" && tags ? tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      brandKitId: typeof brandKitId === "string" && brandKitId ? brandKitId : null,
      buffer,
      mimeType: file.type,
      filename: file.name,
    });

    return NextResponse.json({ ok: true, template }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
