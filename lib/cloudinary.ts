// src/lib/cloudinary.ts

/*
  Unsigned browser uploads.

  .env.local
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=syntra_media

  In Cloudinary → Settings → Upload → Upload presets, create `syntra_media`
  as an UNSIGNED preset and set its folder there. Unsigned presets reject a
  folder passed from the browser unless you've explicitly allowed it.
*/

export const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
export const UPLOAD_PRESET =
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "syntra_media";

export const cloudinaryReady = Boolean(CLOUD_NAME);

export const MAX_FILE_MB = 25;

export type CloudinaryResult = {
  secure_url: string;
  public_id: string;
  resource_type: "image" | "video" | "raw";
  format: string;
  width: number;
  height: number;
  bytes: number;
  original_filename: string;
};

/* XHR rather than fetch, because fetch gives no upload progress. */
export function uploadToCloudinary(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryResult> {
  return new Promise((resolve, reject) => {
    if (!cloudinaryReady) {
      reject(new Error("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set"));
      return;
    }

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as CloudinaryResult);
        } else {
          reject(new Error(body?.error?.message ?? `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error("Cloudinary returned an unreadable response"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(form);
  });
}

/* Deleting a file needs a signed request, so it can only happen server-side.
   Build app/api/media/delete/route.ts with the Cloudinary Node SDK and this
   starts working; until then it fails quietly and the file is orphaned. */
export async function requestCloudinaryDelete(publicId: string) {
  try {
    await fetch("/api/media/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId }),
    });
  } catch {
    /* route not built yet */
  }
}