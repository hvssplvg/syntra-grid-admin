// lib/ai/generateCreativeDirection.ts
//
// Orchestration for Mode A's "3 creative directions" planning step —
// same shape as generateGraphicDesign.ts/generateVideoConcepts.ts
// (validate → configured check → rate-limit → prompt → provider call
// → strict parse/clamp → return). Text-only, no image spend, nothing
// persisted — this is cheap exploration before the one paid call.

import { PLATFORMS } from "@/app/components/admin/tabs/social-media/shared/constants";
import { buildCreativeDirectionPrompt } from "./creativeDirection";
import { getBrandContext } from "./brand";
import "./providers/openai"; // registers the provider as a side effect — see registry.ts
import { checkRateLimit } from "./rateLimit";
import { getAiTextProvider, isAiTextConfigured, requiredAiTextEnvVars } from "./registry";
import { AiProviderError, type GraphicCreativeConcept, type GraphicCreativeDirectionRequest } from "./types";

const MAX_INPUT_LENGTH = 2000;
const MAX_TEXT_LENGTH = 2000;
const MAX_LABEL_LENGTH = 80;
const MAX_HEADLINE_LENGTH = 120;
const REQUIRED_CONCEPTS = 3;

const PLATFORM_IDS = new Set(PLATFORMS.map((platform) => platform.id));

export type GenerateCreativeDirectionResult =
  | { ok: true; concepts: GraphicCreativeConcept[] }
  | { ok: false; status: 400 | 429 | 502 | 503; error: string; missingEnvVars?: string[] };

function validate(body: unknown): { request: GraphicCreativeDirectionRequest } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const input = body as Record<string, unknown>;

  if (typeof input.brief !== "string" || !input.brief.trim()) return { error: "Describe what you'd like this image to show." };
  if (input.brief.length > MAX_INPUT_LENGTH) return { error: `Keep the brief under ${MAX_INPUT_LENGTH} characters.` };
  if (input.platform !== undefined && (typeof input.platform !== "string" || !PLATFORM_IDS.has(input.platform as never))) {
    return { error: "Unknown platform." };
  }
  if (input.referenceAnalysis !== undefined && typeof input.referenceAnalysis !== "string") {
    return { error: "referenceAnalysis must be text." };
  }

  return {
    request: {
      brief: input.brief.trim(),
      platform: input.platform as GraphicCreativeDirectionRequest["platform"],
      style: typeof input.style === "string" ? input.style : undefined,
      referenceAnalysis: typeof input.referenceAnalysis === "string" ? input.referenceAnalysis.slice(0, 1500) : undefined,
    },
  };
}

function clampText(value: unknown, maxLength = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, maxLength);
}

/** Parses the provider's response — rejects the WHOLE response unless
 *  exactly 3 well-formed concepts survive, rather than padding or
 *  trimming to 3 (a count the model got wrong is a sign the rest of
 *  its output isn't trustworthy either). */
export function parseCreativeDirection(raw: string): GraphicCreativeConcept[] | null {
  let parsed: unknown;
  try {
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const data = parsed as Record<string, unknown>;
  if (!Array.isArray(data.concepts)) return null;

  const concepts: GraphicCreativeConcept[] = [];
  for (const rawConcept of data.concepts) {
    if (!rawConcept || typeof rawConcept !== "object") continue;
    const item = rawConcept as Record<string, unknown>;
    const label = clampText(item.label, MAX_LABEL_LENGTH);
    const description = clampText(item.description);
    const imagePrompt = clampText(item.imagePrompt, 4000);
    const headline = clampText(item.headline, MAX_HEADLINE_LENGTH);
    if (!label || !description || !imagePrompt || !headline) continue;

    concepts.push({
      label,
      description,
      imagePrompt,
      headline,
      supportingText: clampText(item.supportingText, MAX_HEADLINE_LENGTH) ?? undefined,
      callToAction: clampText(item.callToAction, 60) ?? undefined,
    });
  }

  return concepts.length === REQUIRED_CONCEPTS ? concepts : null;
}

export async function generateCreativeDirection(adminUserId: string, body: unknown): Promise<GenerateCreativeDirectionResult> {
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
    const prompt = buildCreativeDirectionPrompt(validated.request, brand);
    const raw = await provider.generate(prompt);
    const concepts = parseCreativeDirection(raw);

    console.log(
      JSON.stringify({
        scope: "ai_creative_direction",
        adminUserId,
        platform: validated.request.platform ?? null,
        latencyMs: Date.now() - started,
        ok: Boolean(concepts),
      }),
    );

    if (!concepts) {
      return { ok: false, status: 502, error: "The AI provider didn't return 3 usable concepts. Try again, or generate directly from your brief." };
    }

    return { ok: true, concepts };
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "ai_creative_direction",
        adminUserId,
        latencyMs: Date.now() - started,
        ok: false,
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      }),
    );

    if (error instanceof AiProviderError) {
      return { ok: false, status: 502, error: error.message };
    }
    return { ok: false, status: 502, error: "Couldn't generate creative directions. Try again." };
  }
}
