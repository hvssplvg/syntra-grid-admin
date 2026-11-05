/*
  Client-side helpers for POST/DELETE /api/admin/uploads/restaurant-asset —
  mirrors lib/clients/uploadClientLogo.ts's shape and lifecycle (upload now,
  best-effort delete if the New Restaurant dialog is discarded before the
  restaurant is actually created).
*/

export const MAX_RESTAURANT_LOGO_MB = 5;
export const MAX_RESTAURANT_COVER_MB = 8;

export type RestaurantAssetKind = 'logo' | 'cover';

export type RestaurantAssetUploadResult = {
  url: string;
  publicId: string;
};

export function uploadRestaurantAsset(
  file: File,
  kind: RestaurantAssetKind,
  onProgress?: (percent: number) => void,
): Promise<RestaurantAssetUploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/uploads/restaurant-asset');
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && body.ok) {
          resolve({ url: body.url, publicId: body.publicId });
        } else {
          reject(new Error(body?.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error('The server returned an unreadable response.'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.send(form);
  });
}

export async function deleteRestaurantAsset(publicId: string): Promise<void> {
  try {
    await fetch('/api/admin/uploads/restaurant-asset', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ publicId }),
    });
  } catch {
    // Best-effort cleanup only; an orphaned asset is not user-visible.
  }
}
