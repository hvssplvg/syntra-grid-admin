import { NextRequest, NextResponse } from "next/server";

import { AuthenticationError, getCurrentAdmin } from "@/lib/auth/current-admin";
import { prisma } from "@/lib/prisma";
import {
  derivePublicIdFromEmployeeAvatarUrl,
  destroyCloudinaryAsset,
  EMPLOYEE_AVATAR_FOLDER,
  uploadBufferToCloudinary,
} from "@/lib/cloudinary-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Format-signature check on the real bytes — a renamed .exe can't pass
 *  as a .jpg just because its declared MIME type says so. */
function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (bytes.length >= 12) {
    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  }

  return null;
}

/* ============================================================================
   POST /api/admin/me/avatar

   Self-service only — getCurrentAdmin() resolves the caller from the
   session; this never accepts a target employee/admin id. Only ever
   updates Employee.avatarUrl (never AdminUser.avatarUrl, which belongs
   to the auth-provider identity, not the employee photo).
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin();

    const employee = await prisma.employee.findUnique({ where: { adminUserId: admin.id }, select: { id: true, avatarUrl: true } });
    if (!employee) {
      return NextResponse.json({ ok: false, error: "No employment record is linked to this account." }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file was provided." }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: "Images must be 5MB or smaller." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Only JPEG, PNG or WebP images are supported." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedType = detectImageType(new Uint8Array(buffer));

    if (!detectedType || !ALLOWED_TYPES.has(detectedType)) {
      return NextResponse.json({ ok: false, error: "That file isn't a supported image." }, { status: 400 });
    }

    const uploaded = await uploadBufferToCloudinary(buffer, { folder: EMPLOYEE_AVATAR_FOLDER, resourceType: "image" });

    await prisma.employee.update({ where: { id: employee.id }, data: { avatarUrl: uploaded.secure_url } });

    // Best-effort cleanup of the previous photo — only if it's
    // unambiguously our own prior upload in this exact folder.
    if (employee.avatarUrl) {
      const previousPublicId = derivePublicIdFromEmployeeAvatarUrl(employee.avatarUrl);
      if (previousPublicId) {
        await destroyCloudinaryAsset(previousPublicId, "image").catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, avatarUrl: uploaded.secure_url });
  } catch (error) {
    console.error("[admin/me/avatar]", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    return NextResponse.json({ ok: false, error: "Unable to upload your photo right now." }, { status: 500 });
  }
}

/* ============================================================================
   DELETE /api/admin/me/avatar

   Removes the employee's photo (falls back to the initials avatar
   everywhere, already supported) — same best-effort own-asset cleanup.
============================================================================ */

export async function DELETE() {
  try {
    const admin = await getCurrentAdmin();

    const employee = await prisma.employee.findUnique({ where: { adminUserId: admin.id }, select: { id: true, avatarUrl: true } });
    if (!employee) {
      return NextResponse.json({ ok: false, error: "No employment record is linked to this account." }, { status: 404 });
    }

    await prisma.employee.update({ where: { id: employee.id }, data: { avatarUrl: null } });

    if (employee.avatarUrl) {
      const previousPublicId = derivePublicIdFromEmployeeAvatarUrl(employee.avatarUrl);
      if (previousPublicId) {
        await destroyCloudinaryAsset(previousPublicId, "image").catch(() => {});
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/me/avatar]", error);

    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    return NextResponse.json({ ok: false, error: "Unable to remove your photo right now." }, { status: 500 });
  }
}
