import { NextRequest, NextResponse } from 'next/server';

import {
  AuthenticationError,
  AuthorisationError,
  requireClientEditor,
} from '@/lib/auth/current-admin';
import {
  LOGO_FOLDER,
  cloudinaryServerReady,
  destroyCloudinaryAsset,
  uploadBufferToCloudinary,
} from '@/lib/cloudinary-server';

export const runtime = 'nodejs';

/* ============================================================================
   CONSTANTS
============================================================================ */

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB

// SVG is deliberately excluded: an uploaded SVG can carry scripts/event
// handlers and this logo is rendered back with a plain <img src>.
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

/* ============================================================================
   HELPERS
============================================================================ */

function errorResponse(error: unknown) {
  console.error('[admin/uploads/client-logo]', error);

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
   POST /api/admin/uploads/client-logo
============================================================================ */

export async function POST(request: NextRequest) {
  try {
    await requireClientEditor();

    if (!cloudinaryServerReady) {
      return NextResponse.json(
        { ok: false, error: 'Logo uploads are not configured on this server.' },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file was provided.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: 'Logos must be a PNG, JPEG or WebP image.' },
        { status: 415 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ ok: false, error: 'The file is empty.' }, { status: 400 });
    }

    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Logos must be 5MB or smaller.' },
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

    const result = await uploadBufferToCloudinary(buffer, { folder: LOGO_FOLDER });

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
   DELETE /api/admin/uploads/client-logo

   Cleans up a logo uploaded during the "add client" flow but replaced or
   removed before the client record was ever created.
============================================================================ */

export async function DELETE(request: NextRequest) {
  try {
    await requireClientEditor();

    if (!cloudinaryServerReady) {
      return NextResponse.json({ ok: true });
    }

    const body = await request.json().catch(() => ({}));
    const publicId = typeof body.publicId === 'string' ? body.publicId.trim() : '';

    if (!publicId) {
      return NextResponse.json({ ok: false, error: 'No publicId was provided.' }, { status: 400 });
    }

    // Only ever let this endpoint delete assets it could have created.
    if (!publicId.startsWith(`${LOGO_FOLDER}/`)) {
      return NextResponse.json({ ok: false, error: 'That asset is not a client logo.' }, { status: 400 });
    }

    await destroyCloudinaryAsset(publicId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
