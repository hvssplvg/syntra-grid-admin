import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { deleteContentProject, getContentProject, isValidCanvasDataShapeForType, updateContentProject } from "@/lib/social-media/contentProjects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  console.error("[admin/social-media/content-projects/:id]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.VIEW);
    const { id } = await params;
    const project = await getContentProject(identity, id);
    if (!project) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.EDIT);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });

    if (body.canvasData !== undefined) {
      const existing = await getContentProject(identity, id);
      if (!existing) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
      if (!isValidCanvasDataShapeForType(existing.type, body.canvasData)) {
        return NextResponse.json({ ok: false, error: "canvasData is malformed." }, { status: 400 });
      }
    }

    const project = await updateContentProject(identity, id, {
      title: typeof body.title === "string" ? body.title.trim() : undefined,
      canvasData: body.canvasData,
    });
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.EDIT);
    const { id } = await params;
    await deleteContentProject(identity, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
