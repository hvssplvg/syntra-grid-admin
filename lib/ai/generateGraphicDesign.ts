// lib/ai/generateGraphicDesign.ts
//
// Orchestration for "Mode B — AI-designed editable graphic" (Content
// Studio round 3). Same shape as generateGraphicContent.ts (validate →
// configured check → rate-limit → prompt → provider call → strict
// parse/validate → log → return) — reusing the registry/rateLimit/
// brand pieces, not duplicating them.
//
// The parser below is the actual security/safety boundary, not the
// prompt text: it never executes anything from the AI's response (pure
// JSON.parse + field checks), rejects any element whose "type" isn't
// one of the three known kinds, clamps every numeric field into the
// canvas bounds, validates every colour against a strict hex regex,
// and reads no url/src/href/image field from the AI's output at all —
// there is no code path through which an AI-supplied URL could ever
// reach a layer.

import { PLATFORMS } from "@/app/components/admin/tabs/social-media/shared/constants";
import { buildGraphicDesignPrompt, MAX_DESIGN_ELEMENTS } from "./graphicDesign";
import { getBrandContext } from "./brand";
import "./providers/openai"; // registers the provider as a side effect — see registry.ts
import { checkRateLimit } from "./rateLimit";
import { getAiTextProvider, isAiTextConfigured, requiredAiTextEnvVars } from "./registry";
import { AiProviderError, type GraphicDesignElement, type GraphicDesignRequest, type GraphicDesignSpec } from "./types";

const MAX_INPUT_LENGTH = 2000;
const MIN_CANVAS_SIZE = 1080;
const MAX_CANVAS_SIZE = 1920;

const PLATFORM_IDS = new Set(PLATFORMS.map((platform) => platform.id));

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export type CanvasSize = { width: number; height: number };

export type GenerateGraphicDesignResult =
  | { ok: true; design: GraphicDesignSpec }
  | { ok: false; status: 400 | 429 | 502 | 503; error: string; missingEnvVars?: string[] };

function validate(body: unknown): { request: GraphicDesignRequest; size: CanvasSize } | { error: string } {
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

  const rawSize = input.canvasSize as { width?: unknown; height?: unknown } | undefined;
  const width = typeof rawSize?.width === "number" ? rawSize.width : 1080;
  const height = typeof rawSize?.height === "number" ? rawSize.height : 1080;
  const size: CanvasSize = {
    width: Math.min(MAX_CANVAS_SIZE, Math.max(MIN_CANVAS_SIZE, Math.round(width))),
    height: Math.min(MAX_CANVAS_SIZE, Math.max(MIN_CANVAS_SIZE, Math.round(height))),
  };

  return {
    request: {
      brief: input.brief.trim(),
      platform: input.platform as GraphicDesignRequest["platform"],
      style: typeof input.style === "string" ? input.style : undefined,
      feedback: typeof input.feedback === "string" ? input.feedback.trim() : undefined,
    },
    size,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function validColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

/** Parses + strictly validates/clamps the provider's response. Never
 *  trusts a single field at face value — every element that survives
 *  has been coerced into safe, in-bounds values; anything unsalvageable
 *  (wrong type, missing required field) is dropped, not defaulted into
 *  something fabricated. */
function parseGraphicDesign(raw: string, size: CanvasSize): GraphicDesignSpec | null {
  let parsed: unknown;
  try {
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const data = parsed as Record<string, unknown>;

  const background = validColor(data.background, "#FFFFFF");
  if (!Array.isArray(data.elements)) return null;

  const elements: GraphicDesignElement[] = [];
  for (const rawElement of data.elements.slice(0, MAX_DESIGN_ELEMENTS)) {
    if (!rawElement || typeof rawElement !== "object") continue;
    const item = rawElement as Record<string, unknown>;

    const x = clamp(Number(item.x), 0, size.width);
    const y = clamp(Number(item.y), 0, size.height);
    const width = clamp(Number(item.width), 20, size.width);
    const rotation = Number.isFinite(Number(item.rotation)) ? clamp(Number(item.rotation), -45, 45) : 0;

    if (item.type === "text") {
      if (typeof item.text !== "string" || !item.text.trim()) continue;
      const roles = ["headline", "subheadline", "body", "feature", "callToAction", "brand"] as const;
      const role = roles.includes(item.role as (typeof roles)[number]) ? (item.role as (typeof roles)[number]) : "body";
      elements.push({
        type: "text",
        role,
        text: item.text.trim().slice(0, 300),
        x,
        y,
        width,
        fontSize: clamp(Number(item.fontSize), 10, size.height * 0.25),
        color: validColor(item.color, "#111827"),
        align: item.align === "center" || item.align === "right" ? item.align : "left",
        bold: Boolean(item.bold),
        rotation,
      });
      continue;
    }

    if (item.type === "shape") {
      if (item.shape !== "rect" && item.shape !== "circle") continue;
      elements.push({
        type: "shape",
        shape: item.shape,
        x,
        y,
        width,
        height: clamp(Number(item.height), 20, size.height),
        fill: validColor(item.fill, "#E5E7EB"),
        rotation,
        cornerRadius: item.shape === "rect" && Number.isFinite(Number(item.cornerRadius)) ? clamp(Number(item.cornerRadius), 0, 80) : undefined,
      });
      continue;
    }

    if (item.type === "image-placeholder") {
      elements.push({
        type: "image-placeholder",
        x,
        y,
        width,
        height: clamp(Number(item.height), 20, size.height),
        rotation,
        label: typeof item.label === "string" ? item.label.trim().slice(0, 60) : undefined,
      });
      continue;
    }
    // Unknown/unsupported element type — silently dropped, never
    // executed or passed through.
  }

  if (elements.length === 0) return null;
  return { background, elements };
}

export async function generateGraphicDesign(adminUserId: string, body: unknown): Promise<GenerateGraphicDesignResult> {
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
    const prompt = buildGraphicDesignPrompt(validated.request, brand, validated.size);
    const raw = await provider.generate(prompt);
    const design = parseGraphicDesign(raw, validated.size);

    console.log(
      JSON.stringify({
        scope: "ai_graphic_design_generation",
        adminUserId,
        platform: validated.request.platform ?? null,
        latencyMs: Date.now() - started,
        ok: Boolean(design),
        elementCount: design?.elements.length ?? 0,
      }),
    );

    if (!design) {
      return { ok: false, status: 502, error: "The AI provider didn't return a usable design. Try again, or use a text template instead." };
    }

    return { ok: true, design };
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "ai_graphic_design_generation",
        adminUserId,
        latencyMs: Date.now() - started,
        ok: false,
        message: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      }),
    );

    if (error instanceof AiProviderError) {
      return { ok: false, status: 502, error: error.message };
    }
    return { ok: false, status: 502, error: "AI generation failed. Try again, or use a text template instead." };
  }
}
