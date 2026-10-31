// lib/ai/analyzeReferenceImage.ts
//
// Orchestration for analysing an admin-uploaded reference image — same
// validate → configured-check → rate-limit → provider call → return
// shape as every other AI feature here, minus a parser (the vision
// provider's output is free text by design, not a JSON schema — there
// is nothing structured to validate beyond "non-empty").
//
// Deliberately NOT gated behind the paid-image usage/spend cap in
// imageUsage.ts — this is a text-tier vision call (the same cost class
// as trend analysis/adaptation), not an image-generation call.

import { REFERENCE_IMAGE_INSTRUCTION } from "./referenceAnalysis";
import "./providers/openaiVision"; // registers the provider as a side effect — see registry.ts
import { checkRateLimit } from "./rateLimit";
import { getAiVisionProvider, isAiVisionConfigured, requiredAiVisionEnvVars } from "./registry";
import { AiProviderError } from "./types";

const MAX_DESCRIPTION_LENGTH = 1500;

export type AnalyzeReferenceImageResult =
  | { ok: true; analysis: string }
  | { ok: false; status: 400 | 429 | 502 | 503; error: string; missingEnvVars?: string[] };

function validate(body: unknown): { imageUrl: string } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const input = body as Record<string, unknown>;
  if (typeof input.imageUrl !== "string" || !input.imageUrl.trim()) return { error: "imageUrl is required." };
  try {
    const parsed = new URL(input.imageUrl);
    if (parsed.protocol !== "https:") return { error: "imageUrl must be an https URL." };
  } catch {
    return { error: "imageUrl must be a valid URL." };
  }
  return { imageUrl: input.imageUrl.trim() };
}

export async function analyzeReferenceImage(adminUserId: string, body: unknown): Promise<AnalyzeReferenceImageResult> {
  const validated = validate(body);
  if ("error" in validated) return { ok: false, status: 400, error: validated.error };

  if (!isAiVisionConfigured()) {
    return { ok: false, status: 503, error: "Visual reference analysis isn't configured yet.", missingEnvVars: requiredAiVisionEnvVars() };
  }

  const rateLimit = checkRateLimit(`vision:${adminUserId}`);
  if (!rateLimit.allowed) {
    return { ok: false, status: 429, error: "Too many AI requests — wait a few minutes and try again." };
  }

  const provider = getAiVisionProvider();
  if (!provider) {
    return { ok: false, status: 503, error: "No vision provider is registered.", missingEnvVars: requiredAiVisionEnvVars() };
  }

  const started = Date.now();
  try {
    const result = await provider.analyze({ imageUrl: validated.imageUrl, instruction: REFERENCE_IMAGE_INSTRUCTION });
    const analysis = result.description.trim().slice(0, MAX_DESCRIPTION_LENGTH);

    console.log(JSON.stringify({ scope: "ai_reference_analysis", adminUserId, latencyMs: Date.now() - started, ok: true }));

    if (!analysis) return { ok: false, status: 502, error: "The vision provider didn't return a usable description. Try again." };
    return { ok: true, analysis };
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "ai_reference_analysis",
        adminUserId,
        latencyMs: Date.now() - started,
        ok: false,
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      }),
    );

    if (error instanceof AiProviderError) return { ok: false, status: 502, error: error.message };
    return { ok: false, status: 502, error: "Reference analysis failed. Try again." };
  }
}
