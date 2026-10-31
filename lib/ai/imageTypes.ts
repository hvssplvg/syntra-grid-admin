// lib/ai/imageTypes.ts
//
// "Mode A — complete AI-generated image" (Content Studio Phase D).
// A deliberately separate interface from AiTextProvider — confirmed
// earlier in this project that the existing text provider's
// generate(prompt): Promise<string> cannot be reused for images, so
// this is a parallel abstraction, not an overload of the old one.

export const AI_IMAGE_SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;
export type AiImageSize = (typeof AI_IMAGE_SIZES)[number];

/** Only "medium" (default) and "high" are exposed to the admin — "low"
 *  produces visibly weaker results for a promotional graphic, and
 *  "xhigh"/"max" (available on the current model but with no verified
 *  official per-image cost example) are deliberately left out rather
 *  than guessed at for budget-enforcement purposes. */
export const AI_IMAGE_QUALITIES = ["medium", "high"] as const;
export type AiImageQuality = (typeof AI_IMAGE_QUALITIES)[number];

export type AiImageRequest = {
  prompt: string;
  size: AiImageSize;
  quality: AiImageQuality;
  /** Present only for a revision — base64 of the current image to edit
   *  (OpenAI's /v1/images/edits). Absent for a fresh generation. */
  editOfBase64?: string;
};

export type AiImageResult = { base64: string; mimeType: string };

export interface AiImageProvider {
  id: string;
  generate(request: AiImageRequest): Promise<AiImageResult>;
}
