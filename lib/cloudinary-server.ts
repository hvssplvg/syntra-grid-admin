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
  options: {
    folder: string;
    publicId?: string;
    resourceType?: 'image' | 'video' | 'raw';
    // 'authenticated' uploads are never reachable via a bare public URL —
    // every delivery requires a freshly server-signed URL. Used for private
    // attachments (see lib/messaging/attachments.ts). Omit for the default
    // public delivery every other caller of this helper relies on.
    type?: 'upload' | 'authenticated';
  },
): Promise<ServerUploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: options.resourceType ?? 'image',
        type: options.type ?? 'upload',
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

export async function destroyCloudinaryAsset(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image',
  type: 'upload' | 'authenticated' = 'upload',
) {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type });
}

/**
 * A short-lived, signed delivery URL for an 'authenticated' (private)
 * Cloudinary asset. Cloudinary rejects any request to such an asset
 * without a valid signature, so this must be generated fresh, server
 * side, only after the caller has been confirmed authorised to see the
 * underlying resource — never cached or returned ahead of that check.
 */
export function signedAuthenticatedAssetUrl(
  publicId: string,
  resourceType: 'image' | 'raw' = 'raw',
): string {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
  });
}

// Folder every managed client logo lives under. Exported so the upload
// route and the derivation below always agree on it.
export const LOGO_FOLDER = 'syntragrid/clients/logos';

// Folder every Overview wallpaper upload lives under. Each admin's
// wallpaper is uploaded with publicId === their adminUserId, so a new
// upload overwrites the previous one instead of accumulating orphans.
export const OVERVIEW_WALLPAPER_FOLDER = 'syntragrid/overview/wallpapers';

// Folders for the Brand Assets module — kept separate from the Social
// Media library's own folder even though both go through this same
// upload helper, so the two collections never collide in Cloudinary.
export const BRAND_ASSETS_FOLDER = 'syntragrid/brand-assets';
export const BRAND_TEMPLATES_FOLDER = 'syntragrid/brand-templates';
export const BRAND_REQUEST_ATTACHMENTS_FOLDER = 'syntragrid/brand-request-attachments';

// Same folder app/api/admin/team/avatar/route.ts (the HR-only upload
// path) already uses for employee photographs — kept as one constant so
// the self-service My Account avatar upload (app/api/admin/me/avatar)
// never drifts from it.
export const EMPLOYEE_AVATAR_FOLDER = 'syntragrid/employees';

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

/**
 * Same safety shape as derivePublicIdFromLogoUrl, scoped to the employee
 * avatar folder — only ever used to best-effort clean up an employee's
 * OWN previous self-uploaded photo when replacing/removing it. Returns
 * null (meaning "do not attempt deletion") for anything that isn't
 * unambiguously our own upload in this folder, e.g. a provider-supplied
 * OAuth picture URL that happened to land in AdminUser.avatarUrl.
 */
export function derivePublicIdFromEmployeeAvatarUrl(url: string): string | null {
  if (!CLOUD_NAME) return null;

  const pattern = new RegExp(
    `^https://res\\.cloudinary\\.com/${escapeRegExp(CLOUD_NAME)}/image/upload/v\\d+/(${escapeRegExp(EMPLOYEE_AVATAR_FOLDER)}/[^./]+)\\.[a-zA-Z0-9]+$`,
  );

  const match = url.match(pattern);
  return match ? match[1] : null;
}
