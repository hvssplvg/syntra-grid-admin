// lib/ai/imagePrompt.ts
//
// Builds the text prompt sent to the image provider for "Mode A —
// complete AI-generated image" and for the hybrid "AI-generated
// background" case. Two distinct instruction sets, not one:
//   - buildImagePrompt: a complete, standalone promotional image.
//   - buildBackgroundPrompt: explicitly instructs the model NOT to
//     render any text/words, so the real headline/body/CTA stay in
//     editable TextLayers on top (see GraphicWorkspace.tsx) — the same
//     architectural decision the earlier Phase D investigation
//     recommended, now actually applied, because GPT Image models are
//     documented as unreliable at rendering accurate text.
// Both forbid inventing dashboards/interfaces/statistics — authentic
// screenshots are a completely separate, never-generated image layer.

import type { BrandContext } from "./brand";
import type { AiImageRequest } from "./imageTypes";
import { IMAGE_QUALITY_STANDARDS } from "./imageQualityStandards";

export type ImagePromptRequest = {
  brief: string;
  platform?: string;
  style?: string;
  /** Free-text refinement instruction for a revision — same idiom as
   *  every other AI feature's `feedback` field. */
  feedback?: string;
  /** The vision provider's description of an admin-uploaded,
   *  authorised reference image — present only when generation is
   *  running through the edits/revision endpoint with that image as
   *  the base (see generateGraphicImage.ts). When set, the rules below
   *  explicitly require an ORIGINAL adaptation, never a copy. */
  referenceAnalysis?: string;
};

function referenceRules(referenceAnalysis: string | undefined): string[] {
  if (!referenceAnalysis) return [];
  return [
    `You have been given a reference image (supplied directly as the edit base) with this visual composition: ${referenceAnalysis}`,
    "Produce an ORIGINAL image only inspired by that reference's broad composition, layout, colour treatment, and creative format. Use entirely new subjects, scenes, and elements tied to THIS business. Never reproduce the reference's specific people, logos, text, brands, or copyrighted content — adapt the format, not the content.",
  ];
}

function sharedRules(brand: BrandContext): string[] {
  const lines = [
    `Promotional visual for ${brand.company}. Positioning: ${brand.positioning}`,
    "Photographic or illustrative style, professional and credible — never a cartoonish or low-quality AI look.",
  ];
  if (brand.industry) lines.push(`Industry: ${brand.industry}`);
  if (brand.targetAudience) lines.push(`Target audience: ${brand.targetAudience}`);
  if (brand.personality) lines.push(`Brand personality: ${brand.personality}`);
  if (brand.services.length > 0) lines.push(`Services/products: ${brand.services.join(", ")}.`);
  if (brand.primaryColors.length > 0 || brand.secondaryColors.length > 0) {
    lines.push(`Brand colours — reflect these in the composition's palette where appropriate: ${[...brand.primaryColors, ...brand.secondaryColors].join(", ")}.`);
  }
  lines.push(IMAGE_QUALITY_STANDARDS);
  lines.push(
    "Never render a fabricated software interface, dashboard, chart, or screenshot as though it were an authentic product screenshot — authentic screenshots are added separately by the admin, never generated.",
  );
  lines.push("Never depict a specific statistic, chart value, or claim as if it were real data.");
  lines.push(`Write any in-image text in ${brand.preferredLanguage}.`);
  return lines;
}

export function buildImagePrompt(request: ImagePromptRequest, brand: BrandContext): Pick<AiImageRequest, "prompt"> {
  const parts = [
    ...sharedRules(brand),
    ...referenceRules(request.referenceAnalysis),
    "Prefer carrying the message through the visual composition alone, with no embedded marketing copy — the real headline/supporting text/call-to-action are added afterwards as separate, editable, reliably-rendered text layers. Only include in-image text if it is a small, incidental part of a device/interface mock-up (e.g. a label on a screen) — never a large headline, since AI-rendered text is not always accurate.",
    `Creative brief: ${request.brief}`,
  ];
  if (request.platform) parts.push(`Platform: ${request.platform}.`);
  if (request.style) parts.push(`Visual style: ${request.style}.`);
  if (request.feedback) parts.push(`Revision instruction: ${request.feedback}.`);
  return { prompt: parts.join("\n") };
}

/** For the hybrid workflow — a decorative/background visual with real
 *  headline/body text added afterwards as editable layers. */
export function buildBackgroundPrompt(request: ImagePromptRequest, brand: BrandContext): Pick<AiImageRequest, "prompt"> {
  const parts = [
    ...sharedRules(brand),
    ...referenceRules(request.referenceAnalysis),
    "This is a BACKGROUND visual only — real text will be placed on top of it afterwards as separate, editable layers. Do NOT render any words, letters, numbers, or typography of any kind in the image itself, even stylised or decorative — leave clear, uncluttered areas where text can sit on top with strong contrast.",
    `Creative brief: ${request.brief}`,
  ];
  if (request.platform) parts.push(`Platform: ${request.platform}.`);
  if (request.style) parts.push(`Visual style: ${request.style}.`);
  if (request.feedback) parts.push(`Revision instruction: ${request.feedback}.`);
  return { prompt: parts.join("\n") };
}
