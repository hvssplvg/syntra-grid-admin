// lib/cloudinary-server.ts
//
// Signed, server-side Cloudinary uploads via the Node SDK.
//
// `lib/cloudinary.ts` covers unsigned browser uploads (project media). This
// file is the server-only counterpart for routes that must validate a file
// before it reaches Cloudinary, e.g. admin logo uploads.
//
// .env.local
//   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name   (already set, reused here)
//   CLOUDINARY_API_KEY=...
//   CLOUDINARY_API_SECRET=...

import { v2 as cloudinary } from 'cloudinary';

const CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const API_KEY = process.env.CLOUDINARY_API_KEY ?? '';
const API_SECRET = process.env.CLOUDINARY_API_SECRET ?? '';

export const cloudinaryServerReady = Boolean(CLOUD_NAME && API_KEY && API_SECRET);

if (cloudinaryServerReady) {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY,
    api_secret: API_SECRET,
    secure: true,
  });
}

export type ServerUploadResult = {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  duration?: number;
};

export function uploadBufferToCloudinary(
  buffer: Buffer,
  options: { folder: string; publicId?: string; resourceType?: 'image' | 'video' },
): Promise<ServerUploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: options.resourceType ?? 'image',
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload failed'));
          return;
        }
        resolve(result as ServerUploadResult);
      },
    );

    stream.end(buffer);
  });
}

export async function destroyCloudinaryAsset(publicId: string, resourceType: 'image' | 'video' = 'image') {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

// Folder every managed client logo lives under. Exported so the upload
// route and the derivation below always agree on it.
export const LOGO_FOLDER = 'syntragrid/clients/logos';

// Folder every Overview wallpaper upload lives under. Each admin's
// wallpaper is uploaded with publicId === their adminUserId, so a new
// upload overwrites the previous one instead of accumulating orphans.
export const OVERVIEW_WALLPAPER_FOLDER = 'syntragrid/overview/wallpapers';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Recovers the Cloudinary public_id from one of our own client-logo URLs,
 * so a persisted logo can be cleaned up later without having to store its
 * public_id on the Client row.
 *
 * Only matches our own cloud, the managed logo folder, and the exact shape
 * Cloudinary's secure_url has for a plain (untransformed) upload. Anything
 * else — a hand-edited URL, a different asset, a transformed delivery URL —
 * returns null, which callers must treat as "do not attempt deletion."
 */
export function derivePublicIdFromLogoUrl(url: string): string | null {
  if (!CLOUD_NAME) return null;

  const pattern = new RegExp(
    `^https://res\\.cloudinary\\.com/${escapeRegExp(CLOUD_NAME)}/image/upload/v\\d+/(${escapeRegExp(LOGO_FOLDER)}/[^./]+)\\.[a-zA-Z0-9]+$`,
  );

  const match = url.match(pattern);
  return match ? match[1] : null;
}

/**
 * Confirms a wallpaper URL a client is trying to save actually points at an
 * asset this server could have uploaded (our cloud, the wallpaper folder) —
 * never an arbitrary external URL, since it gets rendered back as a CSS
 * background-image for every visit to that admin's Overview.
 */
export function isOwnWallpaperUrl(url: string): boolean {
  if (!CLOUD_NAME) return false;

  const pattern = new RegExp(
    `^https://res\\.cloudinary\\.com/${escapeRegExp(CLOUD_NAME)}/image/upload/v\\d+/${escapeRegExp(OVERVIEW_WALLPAPER_FOLDER)}/[^./]+\\.[a-zA-Z0-9]+$`,
  );

  return pattern.test(url);
}
