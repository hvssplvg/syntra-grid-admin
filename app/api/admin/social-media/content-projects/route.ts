import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, AuthorisationError } from "@/lib/auth/current-admin";
import { AccessAction, requireSocialMediaPermission } from "@/lib/social-media/permissions";
import { createContentProject, isValidCanvasDataShapeForType, listContentProjects } from "@/lib/social-media/contentProjects";
import { ContentProjectType } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  console.error("[admin/social-media/content-projects]", error);
  if (error instanceof AuthenticationError) return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  if (error instanceof AuthorisationError) return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
}

export async function GET() {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.VIEW);
    const projects = await listContentProjects(identity);
    return NextResponse.json({ ok: true, projects });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await requireSocialMediaPermission(AccessAction.CREATE);
    const body = await request.json().catch(() => null);

    const type: ContentProjectType = body?.type === ContentProjectType.VIDEO ? ContentProjectType.VIDEO : ContentProjectType.GRAPHIC;

    if (!body || typeof body.title !== "string" || !body.title.trim() || !isValidCanvasDataShapeForType(type, body.canvasData)) {
      return NextResponse.json({ ok: false, error: "A title and a valid canvasData object are required." }, { status: 400 });
    }

    const project = await createContentProject(identity, { title: body.title.trim(), type, canvasData: body.canvasData });
    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
