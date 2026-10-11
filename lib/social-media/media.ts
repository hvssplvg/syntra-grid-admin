// lib/social-media/media.ts
//
// Media library backed by Cloudinary — reuses lib/cloudinary-server.ts
// (the SDK-based helper already shared by the client-logo upload route),
// never stores binary data in Postgres, only the URL/public_id/metadata.

import { prisma } from "@/lib/prisma";
import { AuthorisationError } from "@/lib/auth/current-admin";
import { SocialAssetType } from "@/app/generated/prisma/enums";
import {
  cloudinaryServerReady,
  destroyCloudinaryAsset,
  uploadBufferToCloudinary,
} from "@/lib/cloudinary-server";

export const SOCIAL_MEDIA_FOLDER = "syntragrid/social-media";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB

export const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
export const ALLOWED_VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

function sniffImage(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true; // PNG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true; // JPEG
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return true; // WEBP
  }
  return false;
}

function sniffVideo(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // MP4/MOV: "ftyp" box at offset 4.
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return true;
  // WebM/Matroska: EBML header.
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return true;
  return false;
}

export async function uploadSocialMediaAsset(params: {
  buffer: Buffer;
  mimeType: string;
  uploadedById: string;
}): Promise<{ id: string; url: string; type: SocialAssetType }> {
  if (!cloudinaryServerReady) {
    throw new AuthorisationError("Media uploads are not configured on this server.");
  }

  const isImage = ALLOWED_IMAGE_MIME_TYPES.has(params.mimeType);
  const isVideo = ALLOWED_VIDEO_MIME_TYPES.has(params.mimeType);

  if (!isImage && !isVideo) {
    throw new AuthorisationError("Files must be a PNG, JPEG, WebP image or an MP4, MOV or WebM video.");
  }

  const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (params.buffer.length > maxBytes) {
    throw new AuthorisationError(`File is too large (max ${Math.round(maxBytes / (1024 * 1024))}MB).`);
  }

  if (isImage && !sniffImage(params.buffer)) {
    throw new AuthorisationError("The file does not look like a valid image.");
  }

  if (isVideo && !sniffVideo(params.buffer)) {
    throw new AuthorisationError("The file does not look like a valid video.");
  }

  const result = await uploadBufferToCloudinary(params.buffer, {
    folder: SOCIAL_MEDIA_FOLDER,
    resourceType: isImage ? "image" : "video",
  });

  const type = isImage ? SocialAssetType.IMAGE : SocialAssetType.VIDEO;

  const asset = await prisma.socialMediaAsset.create({
    data: {
      url: result.secure_url,
      cloudinaryPublicId: result.public_id,
      type,
      fileSizeBytes: result.bytes,
      width: result.width || null,
      height: result.height || null,
      durationSeconds: result.duration ?? null,
      uploadedById: params.uploadedById,
    },
  });

  return { id: asset.id, url: asset.url, type: asset.type };
}

export async function listSocialMediaAssets(page: number, pageSize: number, type?: SocialAssetType | null) {
  const where = type ? { type } : undefined;

  const [total, assets] = await Promise.all([
    prisma.socialMediaAsset.count({ where }),
    prisma.socialMediaAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { assets, total };
}

/** Deleting media still referenced by a non-terminal post is blocked — a
 *  scheduled/pending post should never silently lose its media. */
export async function deleteSocialMediaAsset(assetId: string) {
  const asset = await prisma.socialMediaAsset.findUnique({
    where: { id: assetId },
    include: {
      postAssets: {
        include: { post: { select: { id: true, title: true, status: true } } },
      },
    },
  });

  if (!asset) {
    throw new AuthorisationError("Media item could not be found.");
  }

  const activeReference = asset.postAssets.find(
    (item) => !["CANCELLED", "FAILED", "PUBLISHED", "PARTIALLY_PUBLISHED"].includes(item.post.status),
  );

  if (activeReference) {
    throw new AuthorisationError(
      `This media is still used by "${activeReference.post.title ?? "an untitled post"}". Remove it from that post first.`,
    );
  }

  if (cloudinaryServerReady) {
    await destroyCloudinaryAsset(asset.cloudinaryPublicId, asset.type === "VIDEO" ? "video" : "image").catch((error) => {
      console.error("[social-media] Failed to delete Cloudinary asset:", error);
    });
  }

  await prisma.socialMediaAsset.delete({ where: { id: assetId } });
}
