// lib/ai/generateVideoConcepts.ts
//
// Orchestration for Content Studio's Video Studio concept step — same
// shape as generateGraphicContent.ts (validate → configured check →
// rate-limit → brand+platform-aware prompt → provider call →
// parse+validate → log → return). Text-only: no image is generated
// here, so this call itself never spends more than one text-provider
// request regardless of how many "ai-image" scenes a concept proposes.

import { PLATFORMS } from "@/app/components/admin/tabs/social-media/shared/constants";
import { buildVideoConceptPrompt } from "./videoConcepts";
import { getBrandContext } from "./brand";
import "./providers/openai"; // registers the provider as a side effect — see registry.ts
import { checkRateLimit } from "./rateLimit";
import { getAiTextProvider, isAiTextConfigured, requiredAiTextEnvVars } from "./registry";
import { estimateImageCostUsd } from "./imageCost";
import { VIDEO_SCENE_IMAGE_QUALITY, VIDEO_SCENE_IMAGE_SIZE } from "./videoImageDefaults";
import { AiProviderError, type VideoConcept, type VideoConceptRequest, type VideoConceptScene } from "./types";

const MAX_INPUT_LENGTH = 2000;
const MIN_SCENES = 1;
const MAX_SCENES = 8;
const MIN_SCENE_SECONDS = 1;
const MAX_SCENE_SECONDS = 12;
const MAX_SCENE_TEXT_LENGTH = 200;
const REQUIRED_CONCEPTS = 3;

const PLATFORM_IDS = new Set(PLATFORMS.map((platform) => platform.id));

export type GenerateVideoConceptsResult =
  | { ok: true; concepts: VideoConcept[] }
  | { ok: false; status: 400 | 429 | 502 | 503; error: string; missingEnvVars?: string[] };

function validate(body: unknown): { request: VideoConceptRequest } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const input = body as Record<string, unknown>;

  if (typeof input.brief !== "string" || !input.brief.trim()) {
    return { error: "Describe what you'd like this video to be about." };
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
      platform: input.platform as VideoConceptRequest["platform"],
      feedback: typeof input.feedback === "string" ? input.feedback.trim() : undefined,
    },
  };
}

function parseScene(raw: unknown): VideoConceptScene | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

  if (typeof data.text !== "string" || !data.text.trim()) return null;
  const text = data.text.trim().slice(0, MAX_SCENE_TEXT_LENGTH);

  const duration = typeof data.durationSeconds === "number" ? data.durationSeconds : Number(data.durationSeconds);
  if (!Number.isFinite(duration)) return null;
  const durationSeconds = Math.min(MAX_SCENE_SECONDS, Math.max(MIN_SCENE_SECONDS, Math.round(duration)));

  const backgroundStyle = data.backgroundStyle === "ai-image" ? "ai-image" : "color";
  const scene: VideoConceptScene = { text, durationSeconds, backgroundStyle };

  if (backgroundStyle === "ai-image") {
    if (typeof data.imagePrompt !== "string" || !data.imagePrompt.trim()) return null; // an ai-image scene the model gave no real prompt for isn't usable
    scene.imagePrompt = data.imagePrompt.trim();
  }

  return scene;
}

/** Parses the provider's response as 3 VideoConcepts — rejects
 *  anything that doesn't match rather than ever inventing a concept
 *  from the raw brief. Computes estimatedCostUsd itself from
 *  imageCost.ts; never trusts a cost figure from the model. */
function parseVideoConcepts(raw: string): VideoConcept[] | null {
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

  const concepts: VideoConcept[] = [];
  for (const rawConcept of data.concepts) {
    if (!rawConcept || typeof rawConcept !== "object") continue;
    const conceptData = rawConcept as Record<string, unknown>;
    if (typeof conceptData.hook !== "string" || !conceptData.hook.trim()) continue;
    if (typeof conceptData.caption !== "string" || !conceptData.caption.trim()) continue;
    if (!Array.isArray(conceptData.scenes)) continue;

    const scenes = conceptData.scenes.map(parseScene).filter((scene): scene is VideoConceptScene => scene !== null).slice(0, MAX_SCENES);
    if (scenes.length < MIN_SCENES) continue;

    const estimatedCostUsd = scenes.reduce(
      (total, scene) => (scene.backgroundStyle === "ai-image" ? total + estimateImageCostUsd(VIDEO_SCENE_IMAGE_SIZE, VIDEO_SCENE_IMAGE_QUALITY) : total),
      0,
    );

    concepts.push({ hook: conceptData.hook.trim(), caption: conceptData.caption.trim(), scenes, estimatedCostUsd: Math.round(estimatedCostUsd * 1000) / 1000 });
  }

  return concepts.length > 0 ? concepts : null;
}

export async function generateVideoConcepts(adminUserId: string, body: unknown): Promise<GenerateVideoConceptsResult> {
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
    const prompt = buildVideoConceptPrompt(validated.request, brand);
    const raw = await provider.generate(prompt);
    const concepts = parseVideoConcepts(raw);

    console.log(
      JSON.stringify({
        scope: "ai_video_concept_generation",
        adminUserId,
        platform: validated.request.platform ?? null,
        latencyMs: Date.now() - started,
        ok: Boolean(concepts),
        conceptCount: concepts?.length ?? 0,
      }),
    );

    if (!concepts) {
      return { ok: false, status: 502, error: "The AI provider didn't return usable video concepts. Try again, or describe the brief differently." };
    }

    return { ok: true, concepts: concepts.slice(0, REQUIRED_CONCEPTS) };
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
    return { ok: false, status: 502, error: "AI generation failed. Try again, or build a video manually." };
  }
}
