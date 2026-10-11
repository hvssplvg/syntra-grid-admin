/*
  Client-side helpers for POST/DELETE /api/admin/uploads/client-logo.

  Uses XHR rather than fetch for the upload, same reason as
  lib/cloudinary.ts: fetch gives no upload progress.
*/

export const MAX_LOGO_MB = 5;

export type ClientLogoUploadResult = {
  url: string;
  publicId: string;
};

export function uploadClientLogo(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ClientLogoUploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/uploads/client-logo');
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

export async function deleteClientLogo(publicId: string): Promise<void> {
  try {
    await fetch('/api/admin/uploads/client-logo', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ publicId }),
    });
  } catch {
    // Best-effort cleanup only; an orphaned logo asset is not user-visible.
  }
}
