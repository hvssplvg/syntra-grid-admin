// lib/ai/generateGraphicContent.ts
//
// Orchestration for the Graphic Studio's content-interpretation step —
// same shape as generate.ts's generateAiText (validate → configured
// check → rate-limit → brand+platform-aware prompt → provider call →
// parse+validate → log → return), reusing every existing piece
// (registry.ts, brand.ts, rateLimit.ts) rather than duplicating them.

import { PLATFORMS } from "@/app/components/admin/tabs/social-media/shared/constants";
import { buildGraphicContentPrompt } from "./graphicContent";
import { getBrandContext } from "./brand";
import "./providers/openai"; // registers the provider as a side effect — see registry.ts
import { checkRateLimit } from "./rateLimit";
import { getAiTextProvider, isAiTextConfigured, requiredAiTextEnvVars } from "./registry";
import { AiProviderError, type GraphicContent, type GraphicContentRequest } from "./types";

const MAX_INPUT_LENGTH = 2000;
const MAX_FEATURES = 6;

const PLATFORM_IDS = new Set(PLATFORMS.map((platform) => platform.id));

export type GenerateGraphicContentResult =
  | { ok: true; content: GraphicContent }
  | { ok: false; status: 400 | 429 | 502 | 503; error: string; missingEnvVars?: string[] };

function validate(body: unknown): { request: GraphicContentRequest } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const input = body as Record<string, unknown>;

  if (typeof input.brief !== "string" || !input.brief.trim()) {
    return { error: "Describe what you'd like this graphic to say." };
  }
  if (input.brief.length > MAX_INPUT_LENGTH) {
    return { error: `Keep the brief under ${MAX_INPUT_LENGTH} characters.` };
  }
  if (typeof input.feedback === "string" && input.feedback.length > MAX_INPUT_LENGTH) {
    return { error: `Keep the feedback under ${MAX_INPUT_LENGTH} characters.` };
  }
  if (input.platform !== undefined && (typeof input.platform !== "string" || !PLATFORM_IDS.has(input.platform as never))) {
    return { error: "Unknown platform." };
  }

  return {
    request: {
      brief: input.brief.trim(),
      platform: input.platform as GraphicContentRequest["platform"],
      style: typeof input.style === "string" ? input.style : undefined,
      templateId: typeof input.templateId === "string" ? input.templateId : undefined,
      feedback: typeof input.feedback === "string" ? input.feedback.trim() : undefined,
    },
  };
}

/** Parses the provider's response as GraphicContent — rejects anything
 *  that doesn't match rather than ever falling back to the raw brief. */
function parseGraphicContent(raw: string): GraphicContent | null {
  let parsed: unknown;
  try {
    // Providers occasionally wrap JSON in a code fence despite
    // instructions not to — strip one if present before parsing.
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const data = parsed as Record<string, unknown>;

  if (typeof data.headline !== "string" || !data.headline.trim()) return null;

  const content: GraphicContent = { headline: data.headline.trim() };
  if (typeof data.subheadline === "string" && data.subheadline.trim()) content.subheadline = data.subheadline.trim();
  if (typeof data.description === "string" && data.description.trim()) content.description = data.description.trim();
  if (typeof data.callToAction === "string" && data.callToAction.trim()) content.callToAction = data.callToAction.trim();
  if (typeof data.brandName === "string" && data.brandName.trim()) content.brandName = data.brandName.trim();
  if (Array.isArray(data.features)) {
    const features = data.features.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, MAX_FEATURES);
    if (features.length > 0) content.features = features;
  }

  return content;
}

export async function generateGraphicContent(adminUserId: string, body: unknown): Promise<GenerateGraphicContentResult> {
  const validated = validate(body);
  if ("error" in validated) return { ok: false, status: 400, error: validated.error };

  if (!isAiTextConfigured()) {
    return { ok: false, status: 503, error: "AI generation isn't configured yet.", missingEnvVars: requiredAiTextEnvVars() };
  }

  const rateLimit = checkRateLimit(adminUserId);
  if (!rateLimit.allowed) {
    return { ok: false, status: 429, error: "Too many AI requests — wait a few minutes and try again." };
  }

  const provider = getAiTextProvider();
  if (!provider) {
    return { ok: false, status: 503, error: "No AI provider is registered.", missingEnvVars: requiredAiTextEnvVars() };
  }

  const started = Date.now();
  try {
    const brand = await getBrandContext();
    const prompt = buildGraphicContentPrompt(validated.request, brand);
    const raw = await provider.generate(prompt);
    const content = parseGraphicContent(raw);

    console.log(
      JSON.stringify({
        scope: "ai_graphic_content_generation",
        adminUserId,
        platform: validated.request.platform ?? null,
        latencyMs: Date.now() - started,
        ok: Boolean(content),
      }),
    );

    if (!content) {
      return { ok: false, status: 502, error: "The AI provider didn't return usable structured content. Try again, or fill it in manually." };
    }

    return { ok: true, content };
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "ai_graphic_content_generation",
        adminUserId,
        latencyMs: Date.now() - started,
        ok: false,
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      }),
    );

    if (error instanceof AiProviderError) {
      return { ok: false, status: 502, error: error.message };
    }
    return { ok: false, status: 502, error: "AI generation failed. Try again, or fill it in manually." };
  }
}
