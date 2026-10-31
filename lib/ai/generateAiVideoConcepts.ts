// lib/ai/generateAiVideoConcepts.ts
//
// Orchestration for the AI Video concept/storyboard step — same shape
// as generateVideoConcepts.ts/generateCreativeDirection.ts (validate →
// configured check → rate-limit → brand-aware prompt → provider call →
// strict parse/clamp → log → return). Uses the existing TEXT provider
// only — no video spend happens here regardless of how many scenes a
// concept proposes; that only happens once the admin edits/confirms a
// storyboard scene and submits it to Luma separately.

import { PLATFORMS } from "@/app/components/admin/tabs/social-media/shared/constants";
import { buildAiVideoConceptPrompt } from "./aiVideoConcepts";
import { getBrandContext } from "./brand";
import "./providers/openai"; // registers the text provider as a side effect — see registry.ts
import { checkRateLimit } from "./rateLimit";
import { getAiTextProvider, isAiTextConfigured, requiredAiTextEnvVars } from "./registry";
import { AI_VIDEO_DURATIONS } from "./videoGenTypes";
import { AiProviderError, type BuiltPrompt } from "./types";
import type { AiVideoConcept, AiVideoConceptRequest, AiVideoStoryboardScene } from "./aiVideoTypes";

const MAX_INPUT_LENGTH = 2000;
const MAX_SCENES = 3;
const MAX_TEXT_LENGTH = 400;
const MAX_TITLE_LENGTH = 100;
const REQUIRED_CONCEPTS = 3;

const PLATFORM_IDS = new Set(PLATFORMS.map((platform) => platform.id));

export type GenerateAiVideoConceptsResult =
  | { ok: true; concepts: AiVideoConcept[] }
  | { ok: false; status: 400 | 429 | 502 | 503; error: string; missingEnvVars?: string[] };

function validate(body: unknown): { request: AiVideoConceptRequest } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const input = body as Record<string, unknown>;

  if (typeof input.brief !== "string" || !input.brief.trim()) return { error: "Describe what you'd like this video to show." };
  if (input.brief.length > MAX_INPUT_LENGTH) return { error: `Keep the brief under ${MAX_INPUT_LENGTH} characters.` };
  if (input.platform !== undefined && (typeof input.platform !== "string" || !PLATFORM_IDS.has(input.platform as never))) {
    return { error: "Unknown platform." };
  }
  if (input.aspectRatio !== undefined && typeof input.aspectRatio !== "string") return { error: "aspectRatio must be text." };
  if (input.referenceAnalysis !== undefined && typeof input.referenceAnalysis !== "string") return { error: "referenceAnalysis must be text." };

  return {
    request: {
      brief: input.brief.trim(),
      platform: input.platform as AiVideoConceptRequest["platform"],
      aspectRatio: typeof input.aspectRatio === "string" ? input.aspectRatio.trim().slice(0, 10) : undefined,
      referenceAnalysis: typeof input.referenceAnalysis === "string" ? input.referenceAnalysis.slice(0, 1500) : undefined,
    },
  };
}

function clampText(value: unknown, maxLength = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, maxLength);
}

function nearestValidDuration(value: unknown): 5 | 10 {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 5;
  return AI_VIDEO_DURATIONS.reduce((closest, candidate) => (Math.abs(candidate - num) < Math.abs(closest - num) ? candidate : closest), 5 as 5 | 10);
}

function parseScene(raw: unknown, index: number): AiVideoStoryboardScene | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

  const description = clampText(data.description);
  const suggestedVisual = clampText(data.suggestedVisual, 800);
  const cameraMovement = clampText(data.cameraMovement, 120);
  if (!description || !suggestedVisual || !cameraMovement) return null;

  const sceneNumber = typeof data.sceneNumber === "number" && Number.isFinite(data.sceneNumber) ? Math.round(data.sceneNumber) : index + 1;

  return {
    sceneNumber,
    description,
    suggestedVisual,
    durationSeconds: nearestValidDuration(data.durationSeconds),
    cameraMovement,
    voiceoverText: clampText(data.voiceoverText) ?? undefined,
    brandElements: clampText(data.brandElements, 200) ?? undefined,
  };
}

/** Parses the provider's response — rejects the WHOLE response unless
 *  exactly 3 well-formed concepts survive, same "a count the model got
 *  wrong means the rest isn't trustworthy either" posture already used
 *  by parseCreativeDirection (lib/ai/generateCreativeDirection.ts). */
export function parseAiVideoConcepts(raw: string, platformFallback: AiVideoConcept["targetPlatform"]): AiVideoConcept[] | null {
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

  const concepts: AiVideoConcept[] = [];
  for (const rawConcept of data.concepts) {
    if (!rawConcept || typeof rawConcept !== "object") continue;
    const item = rawConcept as Record<string, unknown>;

    const title = clampText(item.title, MAX_TITLE_LENGTH);
    const creativeDirection = clampText(item.creativeDirection);
    const hook = clampText(item.hook, 200);
    const storyline = clampText(item.storyline, 800);
    const suggestedVoiceover = clampText(item.suggestedVoiceover, 800);
    const suggestedCaption = clampText(item.suggestedCaption, 300);
    const callToAction = clampText(item.callToAction, 60);
    if (!title || !creativeDirection || !hook || !storyline || !suggestedVoiceover || !suggestedCaption || !callToAction) continue;

    if (!Array.isArray(item.scenes)) continue;
    const scenes = item.scenes
      .map((scene, index) => parseScene(scene, index))
      .filter((scene): scene is AiVideoStoryboardScene => scene !== null)
      .slice(0, MAX_SCENES);
    if (scenes.length === 0) continue;

    concepts.push({ title, creativeDirection, hook, storyline, scenes, targetPlatform: platformFallback, suggestedVoiceover, suggestedCaption, callToAction });
  }

  return concepts.length === REQUIRED_CONCEPTS ? concepts : null;
}

export async function generateAiVideoConcepts(adminUserId: string, body: unknown): Promise<GenerateAiVideoConceptsResult> {
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
    const prompt: BuiltPrompt = buildAiVideoConceptPrompt(validated.request, brand);
    const raw = await provider.generate(prompt);
    const platformFallback = validated.request.platform ?? "TIKTOK";
    const concepts = parseAiVideoConcepts(raw, platformFallback);

    console.log(
      JSON.stringify({
        scope: "ai_video_concept_generation",
        adminUserId,
        platform: validated.request.platform ?? null,
        latencyMs: Date.now() - started,
        ok: Boolean(concepts),
      }),
    );

    if (!concepts) {
      return { ok: false, status: 502, error: "The AI provider didn't return 3 usable video concepts. Try again, or describe the brief differently." };
    }

    return { ok: true, concepts };
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "ai_video_concept_generation",
        adminUserId,
        latencyMs: Date.now() - started,
        ok: false,
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      }),
    );

    if (error instanceof AiProviderError) {
      return { ok: false, status: 502, error: error.message };
    }
    return { ok: false, status: 502, error: "Couldn't generate video concepts. Try again." };
  }
}
