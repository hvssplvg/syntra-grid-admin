import { NextRequest, NextResponse } from 'next/server';

import { AuthenticationError, AuthorisationError } from '@/lib/auth/current-admin';
import {
  AccessAction,
  requireRestaurantPlatformPermission,
} from '@/lib/restaurant-platform/permissions';
import {
  RESTAURANT_LOGO_FOLDER,
  RESTAURANT_COVER_FOLDER,
  cloudinaryServerReady,
  destroyCloudinaryAsset,
  uploadBufferToCloudinary,
} from '@/lib/cloudinary-server';

export const runtime = 'nodejs';

/* ============================================================================
   CONSTANTS

   Mirrors app/api/admin/uploads/client-logo/route.ts's validation shape,
   scoped to the Restaurant Platform onboarding flow (new restaurant has no
   id yet — these assets are uploaded ahead of creation, same abandoned-
   upload lifecycle as a client logo: upload now, best-effort delete if the
   dialog is discarded before the restaurant is actually created).
============================================================================ */

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB, matches Restaurant Admin's restaurant-logos bucket limit.
const MAX_COVER_BYTES = 8 * 1024 * 1024; // 8MB, matches its restaurant-covers bucket limit.

// SVG is deliberately excluded: an uploaded SVG can carry scripts/event
// handlers and this is rendered back with a plain <img src>.
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

type AssetKind = 'logo' | 'cover';

function folderFor(kind: AssetKind): string {
  return kind === 'cover' ? RESTAURANT_COVER_FOLDER : RESTAURANT_LOGO_FOLDER;
}

function maxBytesFor(kind: AssetKind): number {
  return kind === 'cover' ? MAX_COVER_BYTES : MAX_LOGO_BYTES;
}

/* ============================================================================
   HELPERS
============================================================================ */

function errorResponse(error: unknown) {
  console.error('[admin/uploads/restaurant-asset]', error);

  if (error instanceof AuthenticationError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }

  if (error instanceof AuthorisationError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 403 });
  }

  return NextResponse.json(
    { ok: false, error: 'Something went wrong while processing the upload.' },
    { status: 500 },
  );
}

/** Confirms the file's bytes actually match an allowed image format, since a
 *  client-supplied MIME string is trivially spoofable. */
function sniffAllowedImage(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true; // PNG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true; // JPEG
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
    return true; // WEBP
  }

  return false;
}

/* ============================================================================
   POST /api/admin/uploads/restaurant-asset
   multipart/form-data: file, kind ("logo" | "cover")
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    await requireRestaurantPlatformPermission(AccessAction.CREATE);

    if (!cloudinaryServerReady) {
      return NextResponse.json(
        { ok: false, error: 'Uploads are not configured on this server.' },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const kindRaw = formData.get('kind');
    const kind: AssetKind = kindRaw === 'cover' ? 'cover' : 'logo';

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file was provided.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: 'Images must be a PNG, JPEG or WebP file.' },
        { status: 415 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ ok: false, error: 'The file is empty.' }, { status: 400 });
    }

    const maxBytes = maxBytesFor(kind);
    if (file.size > maxBytes) {
      return NextResponse.json(
        { ok: false, error: `${kind === 'cover' ? 'Cover images' : 'Logos'} must be ${Math.round(maxBytes / (1024 * 1024))}MB or smaller.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!sniffAllowedImage(buffer)) {
      return NextResponse.json(
        { ok: false, error: 'The file does not look like a valid PNG, JPEG or WebP image.' },
        { status: 415 },
      );
    }

    const result = await uploadBufferToCloudinary(buffer, { folder: folderFor(kind) });

    return NextResponse.json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/* ============================================================================
   DELETE /api/admin/uploads/restaurant-asset

   Cleans up a logo/cover uploaded during onboarding but replaced or
   abandoned before the restaurant was actually created.
============================================================================ */

export async function DELETE(request: NextRequest) {
  try {
    await requireRestaurantPlatformPermission(AccessAction.CREATE);

    if (!cloudinaryServerReady) {
      return NextResponse.json({ ok: true });
    }

    const body = await request.json().catch(() => ({}));
    const publicId = typeof body.publicId === 'string' ? body.publicId.trim() : '';

    if (!publicId) {
      return NextResponse.json({ ok: false, error: 'No publicId was provided.' }, { status: 400 });
    }

    // Only ever let this endpoint delete assets it could have created.
    if (!publicId.startsWith(`${RESTAURANT_LOGO_FOLDER}/`) && !publicId.startsWith(`${RESTAURANT_COVER_FOLDER}/`)) {
      return NextResponse.json({ ok: false, error: 'That asset is not a restaurant platform upload.' }, { status: 400 });
    }

    await destroyCloudinaryAsset(publicId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
