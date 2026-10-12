// lib/brand-assets/media.ts
//
// Upload/validate/delete for the Brand Assets library. Same shape as
// lib/social-media/media.ts: real Cloudinary-hosted files, never binary
// data in Postgres, server-side MIME + magic-byte validation before
// anything reaches Cloudinary, never exposing Cloudinary's API secret to
// the browser (the upload itself happens here, server-side, via the
// signed Node SDK in lib/cloudinary-server.ts — the browser only ever
// sees the resulting hosted URL).

import { AuthorisationError } from "@/lib/auth/current-admin";
import { BrandAssetType } from "@/app/generated/prisma/enums";
import {
  BRAND_ASSETS_FOLDER,
  cloudinaryServerReady,
  destroyCloudinaryAsset,
  uploadBufferToCloudinary,
} from "@/lib/cloudinary-server";

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300MB
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_DESIGN_FILE_BYTES = 150 * 1024 * 1024; // 150MB
export const MAX_FONT_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_OTHER_BYTES = 50 * 1024 * 1024; // 50MB

type TypeRule = {
  mimeTypes: Set<string>;
  extensions: Set<string>;
  maxBytes: number;
  resourceType: "image" | "video" | "raw";
  /** Magic-byte check, given the buffer and the file's lowercased
   *  extension. Not every format here has a reliable signature (e.g.
   *  Sketch/Figma exports) — return true for those rather than reject a
   *  legitimate file this check can't actually verify. */
  sniff?: (buffer: Buffer, ext: string) => boolean;
};

function hasBytes(buffer: Buffer, offset: number, bytes: number[]): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function sniffImage(buffer: Buffer): boolean {
  if (hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47])) return true; // PNG
  if (hasBytes(buffer, 0, [0xff, 0xd8, 0xff])) return true; // JPEG
  if (hasBytes(buffer, 0, [0x52, 0x49, 0x46, 0x46]) && hasBytes(buffer, 8, [0x57, 0x45, 0x42, 0x50])) return true; // WEBP
  if (hasBytes(buffer, 0, [0x47, 0x49, 0x46, 0x38])) return true; // GIF
  return false;
}

function sniffSvg(buffer: Buffer): boolean {
  // SVG is XML text, not a fixed binary signature — look for either
  // marker within the first kilobyte rather than requiring it at offset 0
  // (a leading XML declaration or BOM is common).
  const head = buffer.subarray(0, 1024).toString("utf8").toLowerCase();
  return head.includes("<svg") || (head.includes("<?xml") && head.includes("svg"));
}

function sniffVideo(buffer: Buffer): boolean {
  if (hasBytes(buffer, 4, [0x66, 0x74, 0x79, 0x70])) return true; // MP4/MOV "ftyp"
  if (hasBytes(buffer, 0, [0x1a, 0x45, 0xdf, 0xa3])) return true; // WebM/Matroska
  return false;
}

function sniffPdf(buffer: Buffer): boolean {
  return hasBytes(buffer, 0, [0x25, 0x50, 0x44, 0x46]); // "%PDF"
}

function sniffZipBased(buffer: Buffer): boolean {
  // docx/pptx/xlsx are all ZIP containers — "PK\x03\x04".
  return hasBytes(buffer, 0, [0x50, 0x4b, 0x03, 0x04]);
}

function sniffPsd(buffer: Buffer): boolean {
  return hasBytes(buffer, 0, [0x38, 0x42, 0x50, 0x53]); // "8BPS"
}

function sniffAiOrEps(buffer: Buffer): boolean {
  // Modern .ai files are PDF-based; legacy .ai/.eps are PostScript.
  return sniffPdf(buffer) || hasBytes(buffer, 0, [0x25, 0x21, 0x50, 0x53]); // "%!PS"
}

function sniffFont(buffer: Buffer): boolean {
  if (hasBytes(buffer, 0, [0x00, 0x01, 0x00, 0x00])) return true; // TTF
  if (hasBytes(buffer, 0, [0x4f, 0x54, 0x54, 0x4f])) return true; // OTF "OTTO"
  if (hasBytes(buffer, 0, [0x77, 0x4f, 0x46, 0x46])) return true; // WOFF
  if (hasBytes(buffer, 0, [0x77, 0x4f, 0x46, 0x32])) return true; // WOFF2
  return false;
}

const TYPE_RULES: Record<BrandAssetType, TypeRule> = {
  IMAGE: {
    mimeTypes: new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]),
    extensions: new Set(["png", "jpg", "jpeg", "webp", "gif"]),
    maxBytes: MAX_IMAGE_BYTES,
    resourceType: "image",
    sniff: sniffImage,
  },
  SVG: {
    mimeTypes: new Set(["image/svg+xml"]),
    extensions: new Set(["svg"]),
    maxBytes: MAX_IMAGE_BYTES,
    resourceType: "image",
    sniff: sniffSvg,
  },
  VIDEO: {
    mimeTypes: new Set(["video/mp4", "video/quicktime", "video/webm"]),
    extensions: new Set(["mp4", "mov", "webm"]),
    maxBytes: MAX_VIDEO_BYTES,
    resourceType: "video",
    sniff: sniffVideo,
  },
  DOCUMENT: {
    mimeTypes: new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
    ]),
    extensions: new Set(["pdf", "doc", "docx", "txt", "csv"]),
    maxBytes: MAX_DOCUMENT_BYTES,
    resourceType: "raw",
    // No single sniff covers this set (.doc/.txt/.csv have no reliable
    // magic number) — MIME type + extension are the real check here.
  },
  PRESENTATION: {
    mimeTypes: new Set([
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/pdf",
    ]),
    extensions: new Set(["ppt", "pptx", "pdf"]),
    maxBytes: MAX_DOCUMENT_BYTES,
    resourceType: "raw",
  },
  DESIGN_FILE: {
    mimeTypes: new Set([
      "application/postscript",
      "image/vnd.adobe.photoshop",
      "application/x-photoshop",
      "application/pdf",
      "application/octet-stream", // Sketch/Figma exports commonly arrive as this
    ]),
    extensions: new Set(["ai", "eps", "psd", "sketch", "fig", "xd"]),
    maxBytes: MAX_DESIGN_FILE_BYTES,
    resourceType: "raw",
    // Verified by content where a format has a real signature (PSD,
    // AI/EPS); Sketch/Figma/XD exports have none, so those pass on
    // extension + declared type alone rather than being wrongly rejected.
    sniff: (buffer, ext) => {
      if (ext === "psd") return sniffPsd(buffer);
      if (ext === "ai" || ext === "eps") return sniffAiOrEps(buffer);
      return true;
    },
  },
  FONT: {
    mimeTypes: new Set([
      "font/ttf",
      "font/otf",
      "font/woff",
      "font/woff2",
      "application/font-woff",
      "application/x-font-ttf",
      "application/octet-stream",
    ]),
    extensions: new Set(["ttf", "otf", "woff", "woff2"]),
    maxBytes: MAX_FONT_BYTES,
    resourceType: "raw",
    sniff: sniffFont,
  },
  OTHER: {
    mimeTypes: new Set(["application/zip", "application/x-zip-compressed", "text/plain", "text/csv"]),
    extensions: new Set(["zip", "txt", "csv"]),
    maxBytes: MAX_OTHER_BYTES,
    resourceType: "raw",
    sniff: (buffer, ext) => (ext === "zip" ? sniffZipBased(buffer) : true),
  },
};

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}

export function validateBrandAssetFile(params: {
  type: BrandAssetType;
  mimeType: string;
  filename: string;
  buffer: Buffer;
}): void {
  const rule = TYPE_RULES[params.type];
  const ext = extensionOf(params.filename);

  const mimeOk = rule.mimeTypes.has(params.mimeType.toLowerCase());
  const extOk = rule.extensions.has(ext);

  if (!mimeOk && !extOk) {
    throw new AuthorisationError(
      `This file doesn't look like a ${params.type.replace(/_/g, " ").toLowerCase()}. Expected one of: ${Array.from(rule.extensions).join(", ")}.`,
    );
  }

  if (params.buffer.length === 0) {
    throw new AuthorisationError("The file is empty.");
  }

  if (params.buffer.length > rule.maxBytes) {
    throw new AuthorisationError(`File is too large (max ${Math.round(rule.maxBytes / (1024 * 1024))}MB).`);
  }

  if (rule.sniff && !rule.sniff(params.buffer, ext)) {
    throw new AuthorisationError("The file's contents don't match its extension — upload may be corrupted or mislabelled.");
  }
}

export function resourceTypeFor(type: BrandAssetType): "image" | "video" | "raw" {
  return TYPE_RULES[type].resourceType;
}

export async function uploadBrandAssetFile(params: {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  type: BrandAssetType;
}) {
  if (!cloudinaryServerReady) {
    throw new AuthorisationError("Media uploads are not configured on this server.");
  }

  validateBrandAssetFile(params);

  const result = await uploadBufferToCloudinary(params.buffer, {
    folder: BRAND_ASSETS_FOLDER,
    resourceType: resourceTypeFor(params.type),
  });

  return {
    url: result.secure_url,
    cloudinaryPublicId: result.public_id,
    fileSizeBytes: result.bytes,
    width: result.width || null,
    height: result.height || null,
    durationSeconds: result.duration ?? null,
  };
}

/** Archiving (not deleting) is the normal "remove from active library"
 *  action — see archiveBrandAsset in server.ts. This is the real,
 *  irreversible delete: it also removes the Cloudinary file, and is
 *  blocked while the asset is still a brand kit's logo or referenced by
 *  a live (non-terminal) social media post. */
export async function deleteBrandAssetFiles(
  files: Array<{ cloudinaryPublicId: string; type: BrandAssetType }>,
): Promise<void> {
  if (!cloudinaryServerReady) return;

  for (const file of files) {
    await destroyCloudinaryAsset(file.cloudinaryPublicId, resourceTypeFor(file.type)).catch((error) => {
      console.error("[brand-assets] Failed to delete Cloudinary asset:", error);
    });
  }
}
