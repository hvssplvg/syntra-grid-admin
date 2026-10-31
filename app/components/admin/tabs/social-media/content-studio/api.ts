// Content Studio's own fetch helper — intentionally self-contained
// (does not import SocialMediaTab.tsx's private apiRequest(), to keep
// the one-directional SocialMediaTab.tsx → content-studio → shared
// dependency graph established in the circular-import cleanup).

import type { AiTextAction, AiTone, GraphicContent, GraphicCreativeConcept, GraphicDesignSpec, VideoConcept } from "@/lib/ai/types";
import type { AiImageQuality, AiImageSize } from "@/lib/ai/imageTypes";
import type { AiVideoConcept } from "@/lib/ai/aiVideoTypes";
import type { AiVideoDurationSeconds, AiVideoResolution } from "@/lib/ai/videoGenTypes";
import type { SocialPlatform } from "../shared/types";

export class AiApiError extends Error {
  constructor(
    message: string,
    public readonly missingEnvVars?: string[],
  ) {
    super(message);
  }
}

export type GenerateAiTextInput = {
  action: AiTextAction;
  brief?: string;
  currentText?: string;
  platform?: SocialPlatform;
  targetPlatform?: SocialPlatform;
  tone?: AiTone;
  feedback?: string;
};

export type UploadedAsset = { id: string; url: string; type: "IMAGE" | "VIDEO" };

/** Uploads through the exact existing /media/upload route the regular
 *  composer already uses — no second upload pipeline. */
export async function uploadMediaAssetApi(blob: Blob, filename: string): Promise<UploadedAsset> {
  const body = new FormData();
  body.append("file", blob, filename);

  const response = await fetch("/api/admin/social-media/media/upload", { method: "POST", credentials: "include", body });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new AiApiError(payload?.error || `Upload failed (${response.status}).`);
  }

  return payload.asset as UploadedAsset;
}

export type MediaLibraryAsset = {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  width: number | null;
  height: number | null;
  createdAt: string;
};

/** Wraps the existing, previously-unused `GET /api/admin/social-media/media`
 *  list endpoint — the Media Library picker (Graphic Studio's "Animate
 *  with AI" and Video Studio's Image-to-Video mode) is its first
 *  caller. No new upload/listing logic; this is purely a client for
 *  what `lib/social-media/media.ts`'s `listSocialMediaAssets` already
 *  does. */
export async function listMediaAssetsApi(page: number, pageSize: number, type?: "IMAGE" | "VIDEO"): Promise<{ assets: MediaLibraryAsset[]; pagination: { page: number; pageSize: number; total: number; pages: number } }> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (type) params.set("type", type);
  const response = await fetch(`/api/admin/social-media/media?${params.toString()}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Request failed (${response.status}).`);
  return { assets: payload.assets as MediaLibraryAsset[], pagination: payload.pagination };
}

export type CompanyBrandKit = {
  name: string;
  logoUrl: string | null;
  primaryColors: string[];
  secondaryColors: string[];
};

export async function getBrandKitApi(): Promise<CompanyBrandKit | null> {
  const response = await fetch("/api/admin/social-media/brand-kit", { credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) return null;
  return payload.brandKit as CompanyBrandKit | null;
}

export type ContentProjectRecord = { id: string; title: string; type: "GRAPHIC" | "VIDEO"; canvasData: unknown };

export async function createContentProjectApi(title: string, canvasData: unknown, type?: "GRAPHIC" | "VIDEO"): Promise<ContentProjectRecord> {
  const response = await fetch("/api/admin/social-media/content-projects", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, canvasData, type }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Save failed (${response.status}).`);
  return payload.project as ContentProjectRecord;
}

export async function updateContentProjectApi(id: string, patch: { title?: string; canvasData?: unknown }): Promise<ContentProjectRecord> {
  const response = await fetch(`/api/admin/social-media/content-projects/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Save failed (${response.status}).`);
  return payload.project as ContentProjectRecord;
}

export type ContentProjectSummary = { id: string; title: string; type: string; updatedAt: string; socialPostId: string | null };

export async function listContentProjectsApi(): Promise<ContentProjectSummary[]> {
  const response = await fetch("/api/admin/social-media/content-projects", { credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) return [];
  return payload.projects as ContentProjectSummary[];
}

export async function getContentProjectApi(id: string): Promise<ContentProjectRecord | null> {
  const response = await fetch(`/api/admin/social-media/content-projects/${id}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) return null;
  return payload.project as ContentProjectRecord;
}

export async function deleteContentProjectApi(id: string): Promise<void> {
  const response = await fetch(`/api/admin/social-media/content-projects/${id}`, { method: "DELETE", credentials: "include" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Delete failed (${response.status}).`);
}

export async function duplicateContentProjectApi(id: string): Promise<ContentProjectRecord> {
  const response = await fetch(`/api/admin/social-media/content-projects/${id}/duplicate`, { method: "POST", credentials: "include" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Duplicate failed (${response.status}).`);
  return payload.project as ContentProjectRecord;
}

export type GenerateGraphicContentInput = {
  brief: string;
  platform?: SocialPlatform;
  style?: string;
  templateId?: string;
  feedback?: string;
};

/** Interprets a Graphic Studio brief into structured copy
 *  (headline/subheadline/features/…) — never the raw brief pasted
 *  verbatim. See lib/ai/generateGraphicContent.ts. */
export async function generateGraphicContentApi(input: GenerateGraphicContentInput): Promise<GraphicContent> {
  const response = await fetch("/api/admin/social-media/ai/generate-graphic-content", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new AiApiError(payload?.error || `AI request failed (${response.status}).`, payload?.missingEnvVars);
  }

  return payload.content as GraphicContent;
}

export type GenerateGraphicDesignInput = {
  brief: string;
  platform?: SocialPlatform;
  style?: string;
  feedback?: string;
  canvasSize?: { width: number; height: number };
};

/** "Mode B — AI-designed editable graphic": a full AI-composed layout
 *  (text + decorative shapes + image placeholders), strictly validated
 *  and clamped server-side. See lib/ai/generateGraphicDesign.ts. */
export async function generateGraphicDesignApi(input: GenerateGraphicDesignInput): Promise<GraphicDesignSpec> {
  const response = await fetch("/api/admin/social-media/ai/generate-graphic-design", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new AiApiError(payload?.error || `AI request failed (${response.status}).`, payload?.missingEnvVars);
  }

  return payload.design as GraphicDesignSpec;
}

export type GenerateCreativeDirectionInput = { brief: string; platform?: SocialPlatform; style?: string; referenceAnalysis?: string };

/** Mode A's "3 creative directions" planning step — text-only, no
 *  image spend, nothing persisted. Exactly 3 concepts, each already
 *  carrying a complete, ready-to-send imagePrompt (see
 *  lib/ai/generateCreativeDirection.ts). */
export async function generateCreativeDirectionApi(input: GenerateCreativeDirectionInput): Promise<GraphicCreativeConcept[]> {
  const response = await fetch("/api/admin/social-media/ai/creative-direction", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Request failed (${response.status}).`, payload?.missingEnvVars);
  return payload.concepts as GraphicCreativeConcept[];
}

/** Describes an admin-uploaded, authorised reference image (layout,
 *  colour, subject arrangement, typography, creative/meme format) —
 *  text-tier cost, no image-generation spend, no cost-confirm dialog
 *  needed (see lib/ai/analyzeReferenceImage.ts). */
export async function analyzeReferenceImageApi(imageUrl: string): Promise<string> {
  const response = await fetch("/api/admin/social-media/ai/analyze-reference", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Request failed (${response.status}).`, payload?.missingEnvVars);
  return payload.analysis as string;
}

export type ImageUsageSnapshot = { generations: number; maxGenerations: number; revisions: number; maxRevisions: number; spentUsd: number; capUsd: number };

/** Read-only usage/estimate check — safe to call freely, never calls
 *  the paid provider. See app/api/.../ai/image-usage/route.ts. */
export async function getImageUsageApi(size: AiImageSize, quality: AiImageQuality, kind: "generate" | "revision"): Promise<{ usage: ImageUsageSnapshot; estimatedCostUsd: number }> {
  const params = new URLSearchParams({ size, quality, kind });
  const response = await fetch(`/api/admin/social-media/ai/image-usage?${params.toString()}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Request failed (${response.status}).`);
  return { usage: payload.usage as ImageUsageSnapshot, estimatedCostUsd: payload.estimatedCostUsd as number };
}

export type GeneratedImageResult = { base64: string; mimeType: string; usage: ImageUsageSnapshot };

export type GenerateGraphicImageInput = {
  brief: string;
  platform?: SocialPlatform;
  style?: string;
  size: AiImageSize;
  quality: AiImageQuality;
  /** True for the hybrid "AI-generated background" path — instructs
   *  the model to render no text/words at all. See imagePrompt.ts. */
  background?: boolean;
  /** An admin-uploaded, authorised reference image (its stable public
   *  URL) — when set, generation runs through OpenAI's /v1/images/edits
   *  using this image as the base, producing something inspired by its
   *  composition rather than a blind text-to-image guess. */
  referenceImageUrl?: string;
  /** The vision provider's description of that same reference image
   *  (see analyzeReferenceImageApi) — passed alongside the URL so the
   *  text prompt and the actual image input agree on what to adapt. */
  referenceAnalysis?: string;
  /** A complete, ready-to-send prompt from a selected creative-
   *  direction concept (see generateCreativeDirectionApi) — when set,
   *  the server sends it verbatim instead of rebuilding one from
   *  brief/platform/style, since the concept's prompt already is the
   *  complete thing. */
  promptOverride?: string;
};

/** "Mode A — complete AI-generated image". This is the one call in
 *  Content Studio that spends real money — the server enforces the
 *  daily generation/spend caps before ever calling the provider; see
 *  lib/ai/generateGraphicImage.ts. */
export async function generateGraphicImageApi(input: GenerateGraphicImageInput): Promise<GeneratedImageResult> {
  const response = await fetch("/api/admin/social-media/ai/generate-graphic-image", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Image request failed (${response.status}).`, payload?.missingEnvVars);
  return { base64: payload.base64 as string, mimeType: payload.mimeType as string, usage: payload.usage as ImageUsageSnapshot };
}

export type ReviseGraphicImageInput = {
  feedback: string;
  currentImageBase64: string;
  size: AiImageSize;
  quality: AiImageQuality;
  background?: boolean;
};

export async function reviseGraphicImageApi(input: ReviseGraphicImageInput): Promise<GeneratedImageResult> {
  const response = await fetch("/api/admin/social-media/ai/revise-graphic-image", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Image request failed (${response.status}).`, payload?.missingEnvVars);
  return { base64: payload.base64 as string, mimeType: payload.mimeType as string, usage: payload.usage as ImageUsageSnapshot };
}

export type GenerateVideoConceptsInput = { brief: string; platform?: SocialPlatform; feedback?: string };

/** 3 candidate short-video concepts (text/structure only — no image is
 *  generated by this call). See lib/ai/generateVideoConcepts.ts. */
export async function generateVideoConceptsApi(input: GenerateVideoConceptsInput): Promise<VideoConcept[]> {
  const response = await fetch("/api/admin/social-media/ai/generate-video-concepts", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new AiApiError(payload?.error || `AI request failed (${response.status}).`, payload?.missingEnvVars);
  }
  return payload.concepts as VideoConcept[];
}

export type GenerateAiVideoConceptsInput = { brief: string; platform?: SocialPlatform; aspectRatio?: string; referenceAnalysis?: string };

/** AI Video's "3 concepts" planning step — text-only, no video spend.
 *  Each concept's scenes become real paid Luma generations only once
 *  individually confirmed in the storyboard editor. See
 *  lib/ai/generateAiVideoConcepts.ts. */
export async function generateAiVideoConceptsApi(input: GenerateAiVideoConceptsInput): Promise<AiVideoConcept[]> {
  const response = await fetch("/api/admin/social-media/ai/ai-video-concepts", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `AI request failed (${response.status}).`, payload?.missingEnvVars);
  return payload.concepts as AiVideoConcept[];
}

export type AiVideoJobView = {
  id: string;
  status: "DRAFT" | "AWAITING_CONFIRMATION" | "QUEUED" | "GENERATING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  sceneId: string | null;
  outputVideoUrl: string | null;
  errorMessage: string | null;
  estimatedCostUsd: number;
  actualCostUsd: number | null;
  generationMethod: "TEXT_TO_VIDEO" | "IMAGE_TO_VIDEO";
  durationSeconds: number;
};

export type CreateAiVideoJobInput = {
  prompt: string;
  aspectRatio: string;
  resolution: AiVideoResolution;
  durationSeconds: AiVideoDurationSeconds;
  contentProjectId?: string;
  sceneId?: string;
  /** Untrusted source descriptors for image-to-video — the server
   *  resolves the real URL itself (see resolveTrustedStartFrame in
   *  lib/ai/aiVideoJobs.ts), never trusting either of these directly.
   *  Prefer sourceImageAssetId (a real SocialMediaAsset id) whenever
   *  one is known; sourceImageUrl is only for reusing a canvas's
   *  already-known own-Cloudinary background image URL. */
  sourceImageAssetId?: string;
  sourceImageUrl?: string;
};

/** Creates AND submits one real, paid Luma video-generation job. Only
 *  ever called after the admin has already seen and confirmed the cost
 *  dialog — the server re-derives and re-checks that cost regardless.
 *  See lib/ai/aiVideoJobs.ts. */
export async function createAiVideoJobApi(input: CreateAiVideoJobInput): Promise<{ id: string; estimatedCostUsd: number }> {
  const response = await fetch("/api/admin/social-media/ai/ai-video-jobs", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Video request failed (${response.status}).`, payload?.missingEnvVars);
  return payload.job as { id: string; estimatedCostUsd: number };
}

/** Advances and returns one job's current status — the live-tab
 *  polling path. */
export async function getAiVideoJobApi(id: string): Promise<AiVideoJobView> {
  const response = await fetch(`/api/admin/social-media/ai/ai-video-jobs?id=${encodeURIComponent(id)}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `Request failed (${response.status}).`);
  return payload.job as AiVideoJobView;
}

/** Every job tied to a project — the "resume on reopen" path, for any
 *  job that finished while the tab was closed. */
export async function listAiVideoJobsApi(projectId: string): Promise<AiVideoJobView[]> {
  const response = await fetch(`/api/admin/social-media/ai/ai-video-jobs?projectId=${encodeURIComponent(projectId)}`, { credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) return [];
  return payload.jobs as AiVideoJobView[];
}

export type MotionSuggestion = { label: string; description: string; motionPrompt: string };

/** "Suggest Motion" — free (two text/vision-tier calls, no paid Luma
 *  spend). See lib/ai/generateMotionSuggestions.ts. */
export async function generateMotionSuggestionsApi(input: { imageUrl: string; userContext?: string }): Promise<MotionSuggestion[]> {
  const response = await fetch("/api/admin/social-media/ai/motion-suggestions", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new AiApiError(payload?.error || `AI request failed (${response.status}).`, payload?.missingEnvVars);
  return payload.suggestions as MotionSuggestion[];
}

export async function generateAiTextApi(input: GenerateAiTextInput): Promise<string> {
  const response = await fetch("/api/admin/social-media/ai/generate", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new AiApiError(payload?.error || `AI request failed (${response.status}).`, payload?.missingEnvVars);
  }

  return payload.text as string;
}
