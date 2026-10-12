import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireBrandAssetsPermission } from "@/lib/brand-assets/permissions";
import { createBrandRequest, listBrandRequests } from "@/lib/brand-assets/server";
import { BrandRequestPriority, BrandRequestStatus, BrandRequestType } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/brand-assets/requests]", error);
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

    const { requests, pagination } = await listBrandRequests(identity, {
      status: parseEnum(params.get("status"), Object.values(BrandRequestStatus)),
      type: parseEnum(params.get("type"), Object.values(BrandRequestType)),
      priority: parseEnum(params.get("priority"), Object.values(BrandRequestPriority)),
      assignedToId: params.get("assignedToId"),
      requestedById: params.get("requestedById"),
      brandKitId: params.get("brandKitId"),
      search: params.get("search"),
      page: params.get("page") ? Number(params.get("page")) : null,
      pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : null,
    });

    return NextResponse.json({ ok: true, requests, pagination });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireBrandAssetsPermission(AccessAction.CREATE);

    const body = await request.json().catch(() => null);

    if (!body || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ ok: false, error: "A title is required." }, { status: 400 });
    }
    if (typeof body.description !== "string" || !body.description.trim()) {
      return NextResponse.json({ ok: false, error: "A description is required." }, { status: 400 });
    }
    if (typeof body.type !== "string" || !(Object.values(BrandRequestType) as string[]).includes(body.type)) {
      return NextResponse.json({ ok: false, error: "A valid request type is required." }, { status: 400 });
    }

    const dueDate = typeof body.dueDate === "string" ? new Date(body.dueDate) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid due date." }, { status: 400 });
    }

    const request_ = await createBrandRequest(identity, {
      title: body.title,
      description: body.description,
      type: body.type,
      priority: parseEnum(typeof body.priority === "string" ? body.priority : null, Object.values(BrandRequestPriority)) ?? undefined,
      brandKitId: typeof body.brandKitId === "string" ? body.brandKitId : null,
      dueDate,
      assignedToId: typeof body.assignedToId === "string" ? body.assignedToId : null,
    });

    return NextResponse.json({ ok: true, request: request_ }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
