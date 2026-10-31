// lib/ai/generateGraphicImage.ts
//
// Orchestration for "Mode A — complete AI-generated image" (Content
// Studio Phase D). Same shape as generateGraphicContent.ts/
// generateGraphicDesign.ts (validate → configured check → rate-limit
// → daily usage/spend cap → provider call → log → return), plus the
// one thing those two don't need: a real money cost, so the usage/cap
// check in imageUsage.ts runs before every single provider call, for
// both a fresh generation and a revision.

import { PLATFORMS } from "@/app/components/admin/tabs/social-media/shared/constants";
import { buildBackgroundPrompt, buildImagePrompt } from "./imagePrompt";
import { getBrandContext } from "./brand";
import "./providers/openaiImage"; // registers the provider as a side effect — see registry.ts
import { checkRateLimit } from "./rateLimit";
import { getAiImageProvider, isAiImageConfigured, requiredAiImageEnvVars } from "./registry";
import { checkImageUsageAllowed, getImageUsageSnapshot, recordImageUsage, type ImageUsageSnapshot } from "./imageUsage";
import { AI_IMAGE_QUALITIES, AI_IMAGE_SIZES, type AiImageQuality, type AiImageSize } from "./imageTypes";
import { AiProviderError } from "./types";

const MAX_INPUT_LENGTH = 2000;
const PLATFORM_IDS = new Set(PLATFORMS.map((platform) => platform.id));
const SIZE_SET = new Set<string>(AI_IMAGE_SIZES);
const QUALITY_SET = new Set<string>(AI_IMAGE_QUALITIES);

export type GenerateGraphicImageResult =
  | { ok: true; base64: string; mimeType: string; usage: ImageUsageSnapshot }
  | { ok: false; status: 400 | 429 | 502 | 503; error: string; missingEnvVars?: string[] };

type GenerateInput = {
  brief: string;
  platform?: string;
  style?: string;
  size: AiImageSize;
  quality: AiImageQuality;
  background: boolean;
  /** An admin-uploaded, authorised reference image's stable URL —
   *  when set, generation runs through the provider's edits/revision
   *  path using this image as the base (see fetchReferenceAsBase64
   *  below), rather than text-to-image alone. */
  referenceImageUrl?: string;
  referenceAnalysis?: string;
  /** A complete, ready-to-send prompt from a selected creative-
   *  direction concept (see generateCreativeDirection.ts) — when set,
   *  sent to the provider verbatim instead of rebuilding one from
   *  brief/platform/style/background, since the concept's prompt is
   *  already the complete thing. */
  promptOverride?: string;
};
type ReviseInput = { feedback: string; currentImageBase64: string; size: AiImageSize; quality: AiImageQuality; background: boolean };

function validateCommon(input: Record<string, unknown>): { size: AiImageSize; quality: AiImageQuality; background: boolean } | { error: string } {
  if (typeof input.size !== "string" || !SIZE_SET.has(input.size)) return { error: "Unsupported image size." };
  if (typeof input.quality !== "string" || !QUALITY_SET.has(input.quality)) return { error: "Unsupported image quality." };
  return { size: input.size as AiImageSize, quality: input.quality as AiImageQuality, background: Boolean(input.background) };
}

function validateGenerate(body: unknown): { request: GenerateInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const input = body as Record<string, unknown>;

  if (typeof input.brief !== "string" || !input.brief.trim()) return { error: "Describe what you'd like this image to show." };
  if (input.brief.length > MAX_INPUT_LENGTH) return { error: `Keep the brief under ${MAX_INPUT_LENGTH} characters.` };
  if (input.platform !== undefined && (typeof input.platform !== "string" || !PLATFORM_IDS.has(input.platform as never))) return { error: "Unknown platform." };
  if (input.referenceImageUrl !== undefined) {
    if (typeof input.referenceImageUrl !== "string") return { error: "referenceImageUrl must be a URL." };
    try {
      const parsed = new URL(input.referenceImageUrl);
      if (parsed.protocol !== "https:") return { error: "referenceImageUrl must be an https URL." };
    } catch {
      return { error: "referenceImageUrl must be a valid URL." };
    }
  }
  if (input.promptOverride !== undefined && (typeof input.promptOverride !== "string" || !input.promptOverride.trim())) {
    return { error: "promptOverride must be non-empty text." };
  }

  const common = validateCommon(input);
  if ("error" in common) return common;

  return {
    request: {
      brief: input.brief.trim(),
      platform: typeof input.platform === "string" ? input.platform : undefined,
      style: typeof input.style === "string" ? input.style : undefined,
      referenceImageUrl: typeof input.referenceImageUrl === "string" ? input.referenceImageUrl : undefined,
      referenceAnalysis: typeof input.referenceAnalysis === "string" ? input.referenceAnalysis.slice(0, 1500) : undefined,
      promptOverride: typeof input.promptOverride === "string" ? input.promptOverride.trim().slice(0, 4000) : undefined,
      ...common,
    },
  };
}

/** Fetches a reference image (the admin's own authorised upload,
 *  already stored via the existing media pipeline) and converts it to
 *  the same base64 shape the provider's edits/revision path already
 *  expects — generalizing that existing self-revision-only mechanism
 *  into true reference-conditioned generation, with no new provider
 *  plumbing. A small, bounded server-side fetch; failures degrade to
 *  plain text-to-image rather than blocking generation outright. */
async function fetchReferenceAsBase64(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString("base64");
  } catch {
    return undefined;
  }
}

function validateRevise(body: unknown): { request: ReviseInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const input = body as Record<string, unknown>;

  if (typeof input.feedback !== "string" || !input.feedback.trim()) return { error: "Describe what you'd like changed." };
  if (input.feedback.length > MAX_INPUT_LENGTH) return { error: `Keep the feedback under ${MAX_INPUT_LENGTH} characters.` };
  if (typeof input.currentImageBase64 !== "string" || !input.currentImageBase64.trim()) return { error: "Missing the image to revise." };

  const common = validateCommon(input);
  if ("error" in common) return common;

  return { request: { feedback: input.feedback.trim(), currentImageBase64: input.currentImageBase64.trim(), ...common } };
}

async function runProviderCall(adminUserId: string, kind: "generate" | "revision", size: AiImageSize, quality: AiImageQuality, promptBuild: () => Promise<{ prompt: string }>, editOfBase64?: string): Promise<GenerateGraphicImageResult> {
  if (!isAiImageConfigured()) {
    return { ok: false, status: 503, error: "AI image generation isn't configured yet.", missingEnvVars: requiredAiImageEnvVars() };
  }

  // Secondary, defense-in-depth guard against rapid-fire clicking —
  // the real control is the daily generations/revisions/spend cap
  // below, which is far tighter than this sliding window.
  const rateLimit = checkRateLimit(`image:${adminUserId}`);
  if (!rateLimit.allowed) {
    return { ok: false, status: 429, error: "Too many AI requests — wait a few minutes and try again." };
  }

  const usageCheck = checkImageUsageAllowed(adminUserId, kind, size, quality);
  if (!usageCheck.allowed) {
    return { ok: false, status: 429, error: usageCheck.reason };
  }

  const provider = getAiImageProvider();
  if (!provider) {
    return { ok: false, status: 503, error: "No AI image provider is registered.", missingEnvVars: requiredAiImageEnvVars() };
  }

  const started = Date.now();
  try {
    const { prompt } = await promptBuild();
    const result = await provider.generate({ prompt, size, quality, editOfBase64 });

    recordImageUsage(adminUserId, kind, usageCheck.estimatedCostUsd);

    console.log(
      JSON.stringify({
        scope: "ai_image_generation",
        adminUserId,
        kind,
        size,
        quality,
        estimatedCostUsd: usageCheck.estimatedCostUsd,
        latencyMs: Date.now() - started,
        ok: true,
      }),
    );

    return { ok: true, base64: result.base64, mimeType: result.mimeType, usage: getImageUsageSnapshot(adminUserId) };
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "ai_image_generation",
        adminUserId,
        kind,
        size,
        quality,
        latencyMs: Date.now() - started,
        ok: false,
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      }),
    );

    if (error instanceof AiProviderError) return { ok: false, status: 502, error: error.message };
    return { ok: false, status: 502, error: "Image generation failed. Try again." };
  }
}

export async function generateGraphicImage(adminUserId: string, body: unknown): Promise<GenerateGraphicImageResult> {
  const validated = validateGenerate(body);
  if ("error" in validated) return { ok: false, status: 400, error: validated.error };
  const { brief, platform, style, size, quality, background, referenceImageUrl, referenceAnalysis, promptOverride } = validated.request;

  const editOfBase64 = referenceImageUrl ? await fetchReferenceAsBase64(referenceImageUrl) : undefined;

  return runProviderCall(
    adminUserId,
    "generate",
    size,
    quality,
    async () => {
      if (promptOverride) return { prompt: promptOverride };
      const brand = await getBrandContext();
      const promptRequest = { brief, platform, style, referenceAnalysis: editOfBase64 ? referenceAnalysis : undefined };
      return background ? buildBackgroundPrompt(promptRequest, brand) : buildImagePrompt(promptRequest, brand);
    },
    editOfBase64,
  );
}

export async function reviseGraphicImage(adminUserId: string, body: unknown): Promise<GenerateGraphicImageResult> {
  const validated = validateRevise(body);
  if ("error" in validated) return { ok: false, status: 400, error: validated.error };
  const { feedback, currentImageBase64, size, quality, background } = validated.request;

  return runProviderCall(
    adminUserId,
    "revision",
    size,
    quality,
    async () => {
      const brand = await getBrandContext();
      return background ? buildBackgroundPrompt({ brief: "(revision)", feedback }, brand) : buildImagePrompt({ brief: "(revision)", feedback }, brand);
    },
    currentImageBase64,
  );
}

export function getImageUsageForAdmin(adminUserId: string): ImageUsageSnapshot {
  return getImageUsageSnapshot(adminUserId);
}
