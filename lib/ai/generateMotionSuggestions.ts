// lib/ai/generateMotionSuggestions.ts
//
// Orchestration for "Suggest Motion" — two real AI calls, both free
// relative to the paid Luma tier: (1) reuses the existing vision
// orchestrator (analyzeReferenceImage.ts) to actually look at the
// attached image, then (2) the existing text provider turns that
// description into 3 motion directions (motionSuggestions.ts). Same
// validate → configured-check → rate-limit → provider → strict parse
// (exactly 3) → return shape as every other free-tier AI feature here.
// Rate-limited like every other text/vision call — this isn't the paid
// image/video tier, so no dollar-spend cap applies (same posture as
// creativeDirection.ts/aiVideoConcepts.ts).

import { analyzeReferenceImage } from "./analyzeReferenceImage";
import { buildMotionSuggestionsPrompt } from "./motionSuggestions";
import { getBrandContext } from "./brand";
import "./providers/openai"; // registers the text provider as a side effect — see registry.ts
import { checkRateLimit } from "./rateLimit";
import { getAiTextProvider, isAiTextConfigured, requiredAiTextEnvVars } from "./registry";
import { AiProviderError } from "./types";

const MAX_LABEL_LENGTH = 60;
const MAX_TEXT_LENGTH = 300;
const MAX_PROMPT_LENGTH = 1500;
const REQUIRED_SUGGESTIONS = 3;

export type MotionSuggestion = { label: string; description: string; motionPrompt: string };

export type GenerateMotionSuggestionsResult =
  | { ok: true; suggestions: MotionSuggestion[] }
  | { ok: false; status: 400 | 429 | 502 | 503; error: string; missingEnvVars?: string[] };

function validate(body: unknown): { imageUrl: string; userContext?: string } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const input = body as Record<string, unknown>;
  if (typeof input.imageUrl !== "string" || !input.imageUrl.trim()) return { error: "imageUrl is required." };
  try {
    const parsed = new URL(input.imageUrl);
    if (parsed.protocol !== "https:") return { error: "imageUrl must be an https URL." };
  } catch {
    return { error: "imageUrl must be a valid URL." };
  }
  if (input.userContext !== undefined && typeof input.userContext !== "string") return { error: "userContext must be text." };
  return { imageUrl: input.imageUrl.trim(), userContext: typeof input.userContext === "string" ? input.userContext.trim().slice(0, 500) : undefined };
}

function clampText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, maxLength);
}

/** Rejects the whole response unless exactly 3 well-formed suggestions
 *  survive — same "a count the model got wrong means the rest isn't
 *  trustworthy either" posture as parseAiVideoConcepts/parseCreativeDirection. */
export function parseMotionSuggestions(raw: string): MotionSuggestion[] | null {
  let parsed: unknown;
  try {
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const data = parsed as Record<string, unknown>;
  if (!Array.isArray(data.suggestions)) return null;

  const suggestions: MotionSuggestion[] = [];
  for (const rawSuggestion of data.suggestions) {
    if (!rawSuggestion || typeof rawSuggestion !== "object") continue;
    const item = rawSuggestion as Record<string, unknown>;
    const label = clampText(item.label, MAX_LABEL_LENGTH);
    const description = clampText(item.description, MAX_TEXT_LENGTH);
    const motionPrompt = clampText(item.motionPrompt, MAX_PROMPT_LENGTH);
    if (!label || !description || !motionPrompt) continue;
    suggestions.push({ label, description, motionPrompt });
  }

  return suggestions.length === REQUIRED_SUGGESTIONS ? suggestions : null;
}

export async function generateMotionSuggestions(adminUserId: string, body: unknown): Promise<GenerateMotionSuggestionsResult> {
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
    const analysis = await analyzeReferenceImage(adminUserId, { imageUrl: validated.imageUrl });
    if (!analysis.ok) return analysis;

    const brand = await getBrandContext();
    const prompt = buildMotionSuggestionsPrompt({ imageAnalysis: analysis.analysis, userContext: validated.userContext }, brand);
    const raw = await provider.generate(prompt);
    const suggestions = parseMotionSuggestions(raw);

    console.log(JSON.stringify({ scope: "ai_motion_suggestions", adminUserId, latencyMs: Date.now() - started, ok: Boolean(suggestions) }));

    if (!suggestions) {
      return { ok: false, status: 502, error: "The AI provider didn't return 3 usable motion suggestions. Try again." };
    }

    return { ok: true, suggestions };
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "ai_motion_suggestions",
        adminUserId,
        latencyMs: Date.now() - started,
        ok: false,
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      }),
    );

    if (error instanceof AiProviderError) return { ok: false, status: 502, error: error.message };
    return { ok: false, status: 502, error: "Couldn't generate motion suggestions. Try again." };
  }
}
