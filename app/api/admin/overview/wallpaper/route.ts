import { NextRequest, NextResponse } from "next/server";

import {
  AuthenticationError,
  AuthorisationError,
  getCurrentAdmin,
} from "@/lib/auth/current-admin";
import {
  OVERVIEW_WALLPAPER_FOLDER,
  cloudinaryServerReady,
  uploadBufferToCloudinary,
} from "@/lib/cloudinary-server";

export const runtime = "nodejs";

/* ============================================================================
   CONSTANTS
============================================================================ */

const MAX_WALLPAPER_BYTES = 12 * 1024 * 1024; // 12MB — matches the client-side cap.

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

/* ============================================================================
   HELPERS
============================================================================ */

function errorResponse(error: unknown) {
  console.error("[admin/overview/wallpaper]", error);

  if (error instanceof AuthenticationError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }

  if (error instanceof AuthorisationError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  }

  return NextResponse.json(
    { ok: false, error: "Something went wrong while uploading the wallpaper." },
    { status: 500 },
  );
}

/** Confirms the file's bytes actually match an allowed image format, since a
 *  client-supplied MIME string is trivially spoofable. */
function sniffAllowedImage(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // WEBP: "RIFF"...."WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true;
  }

  return false;
}

/* ============================================================================
   POST /api/admin/overview/wallpaper

   Any authenticated admin — full-access or restricted — can upload their
   own Overview wallpaper. Uploaded with publicId === adminUserId so a new
   upload overwrites the previous one instead of accumulating orphans.
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();

    if (!cloudinaryServerReady) {
      return NextResponse.json(
        { ok: false, error: "Wallpaper uploads are not configured on this server." },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file was provided." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Wallpapers must be a PNG, JPEG or WebP image." },
        { status: 415 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ ok: false, error: "The file is empty." }, { status: 400 });
    }

    if (file.size > MAX_WALLPAPER_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Wallpapers must be 12MB or smaller." },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!sniffAllowedImage(buffer)) {
      return NextResponse.json(
        { ok: false, error: "The file does not look like a valid PNG, JPEG or WebP image." },
        { status: 415 },
      );
    }

    const result = await uploadBufferToCloudinary(buffer, {
      folder: OVERVIEW_WALLPAPER_FOLDER,
      publicId: admin.id,
    });

    return NextResponse.json({ ok: true, url: result.secure_url });
  } catch (error) {
    return errorResponse(error);
  }
}
