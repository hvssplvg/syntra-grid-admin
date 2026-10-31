// lib/ai/generate.ts
//
// Orchestration the API route calls: validate → check configured →
// rate-limit → build prompt (brand + platform aware) → call the
// provider → log a safe, structured line → return. One path, shared by
// every AI entry point in Content Studio.

import { PLATFORMS } from "@/app/components/admin/tabs/social-media/shared/constants";
import { getBrandContext } from "./brand";
import "./providers/openai"; // registers the provider as a side effect — see registry.ts
import { buildPrompt } from "./promptBuilder";
import { checkRateLimit } from "./rateLimit";
import { getAiTextProvider, isAiTextConfigured, requiredAiTextEnvVars } from "./registry";
import { AI_TEXT_ACTIONS, AI_TONES, AiProviderError, type AiTextRequest } from "./types";

const MAX_INPUT_LENGTH = 2000;

const PLATFORM_IDS = new Set(PLATFORMS.map((platform) => platform.id));

export type GenerateResult =
  | { ok: true; text: string }
  | { ok: false; status: 400 | 429 | 502 | 503; error: string; missingEnvVars?: string[] };

function validate(body: unknown): { request: AiTextRequest } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const input = body as Record<string, unknown>;

  if (typeof input.action !== "string" || !AI_TEXT_ACTIONS.includes(input.action as AiTextRequest["action"])) {
    return { error: "Unknown or missing action." };
  }
  const action = input.action as AiTextRequest["action"];

  const needsCurrentText = action !== "GENERATE";
  if (needsCurrentText && (typeof input.currentText !== "string" || !input.currentText.trim())) {
    return { error: "This action needs the existing caption text." };
  }
  if (action === "GENERATE" && (typeof input.brief !== "string" || !input.brief.trim())) {
    return { error: "Describe what you'd like to create." };
  }

  if (typeof input.brief === "string" && input.brief.length > MAX_INPUT_LENGTH) {
    return { error: `Keep the brief under ${MAX_INPUT_LENGTH} characters.` };
  }
  if (typeof input.currentText === "string" && input.currentText.length > MAX_INPUT_LENGTH) {
    return { error: `Keep the caption under ${MAX_INPUT_LENGTH} characters.` };
  }
  if (typeof input.feedback === "string" && input.feedback.length > MAX_INPUT_LENGTH) {
    return { error: `Keep the feedback under ${MAX_INPUT_LENGTH} characters.` };
  }

  if (input.platform !== undefined && (typeof input.platform !== "string" || !PLATFORM_IDS.has(input.platform as never))) {
    return { error: "Unknown platform." };
  }
  if (action === "ADAPT_PLATFORM") {
    if (typeof input.targetPlatform !== "string" || !PLATFORM_IDS.has(input.targetPlatform as never)) {
      return { error: "Choose a target platform to adapt this caption for." };
    }
  }
  if (action === "CHANGE_TONE") {
    if (typeof input.tone !== "string" || !AI_TONES.includes(input.tone as NonNullable<AiTextRequest["tone"]>)) {
      return { error: "Choose a tone." };
    }
  }

  return {
    request: {
      action,
      brief: typeof input.brief === "string" ? input.brief.trim() : undefined,
      currentText: typeof input.currentText === "string" ? input.currentText.trim() : undefined,
      platform: input.platform as AiTextRequest["platform"],
      targetPlatform: input.targetPlatform as AiTextRequest["targetPlatform"],
      tone: input.tone as AiTextRequest["tone"],
      feedback: typeof input.feedback === "string" ? input.feedback.trim() : undefined,
    },
  };
}

export async function generateAiText(adminUserId: string, body: unknown): Promise<GenerateResult> {
  const validated = validate(body);
  if ("error" in validated) return { ok: false, status: 400, error: validated.error };

  if (!isAiTextConfigured()) {
    return {
      ok: false,
      status: 503,
      error: "AI generation isn't configured yet.",
      missingEnvVars: requiredAiTextEnvVars(),
    };
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
    const prompt = buildPrompt(validated.request, brand);
    const text = await provider.generate(prompt);

    console.log(
      JSON.stringify({
        scope: "ai_text_generation",
        adminUserId,
        action: validated.request.action,
        platform: validated.request.platform ?? null,
        latencyMs: Date.now() - started,
        ok: true,
      }),
    );

    return { ok: true, text };
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "ai_text_generation",
        adminUserId,
        action: validated.request.action,
        latencyMs: Date.now() - started,
        ok: false,
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      }),
    );

    if (error instanceof AiProviderError) {
      return { ok: false, status: 502, error: error.message };
    }
    return { ok: false, status: 502, error: "AI generation failed. Try again." };
  }
}
