// lib/ai/providers/openaiImage.ts
//
// Real OpenAI-backed image provider ("Mode A — complete AI-generated
// image", Content Studio Phase D). Plain fetch, no SDK — same
// convention as providers/openai.ts.
//
// Model/endpoint/parameters verified directly against OpenAI's own
// documentation on 2026-10-14 (developers.openai.com/api/docs/guides/
// image-generation and .../api/docs/pricing), not third-party sources:
//   - Current recommended models: gpt-image-2.5-sunburst (best for
//     revision/editing precision — what this app needs for "Request
//     revisions") and gpt-image-2.5-flare (faster, same price).
//   - Generation: POST /v1/images/generations (JSON body).
//   - Revision: POST /v1/images/edits (multipart form — image + prompt).
//   - Response: base64 only, at data[0].b64_json — no hosted-URL option.
//   - Pricing is identical between gpt-image-2, gpt-image-2.5-sunburst
//     and gpt-image-2.5-flare ($8/1M image input tokens, $30/1M image
//     output tokens) — see imageCost.ts for the worked per-image figures
//     this was derived from.
//
// The model id is NOT hardcoded as the only option — OPENAI_IMAGE_MODEL
// overrides it, same pattern as OPENAI_MODEL for text, so a future model
// change (or this account only having access to a different one) is a
// config change, not a code change.

import { AiProviderError } from "../types";
import { registerAiImageProvider } from "../registry";
import type { AiImageProvider, AiImageRequest, AiImageResult } from "../imageTypes";

const GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const EDITS_URL = "https://api.openai.com/v1/images/edits";

/** Verified current/recommended model as of 2026-10-14 — see the file
 *  header. Override via OPENAI_IMAGE_MODEL without a code change if
 *  this account only has access to a different GPT Image model, or if
 *  OpenAI supersedes this one later. */
const DEFAULT_MODEL = "gpt-image-2.5-sunburst";

/** OpenAI's own guide: "Complex prompts may take up to 2 minutes to
 *  process" — a 30s timeout (the text provider's value) would false-
 *  positive on normal, successful image generations. */
const REQUEST_TIMEOUT_MS = 150_000;

type OpenAiImagesResponse = { data?: Array<{ b64_json?: string }> };
type OpenAiErrorBody = { error?: { type?: string; code?: string; message?: string } };

class OpenAiImageProvider implements AiImageProvider {
  id = "openai";

  async generate(request: AiImageRequest): Promise<AiImageResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      // Should never actually be reached — the route checks
      // isAiImageConfigured() first — but never silently proceeds
      // without a key if it somehow is.
      throw new AiProviderError("OpenAI is not configured.");
    }

    const model = process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
    const isRevision = Boolean(request.editOfBase64);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      if (isRevision) {
        const form = new FormData();
        form.append("model", model);
        form.append("prompt", request.prompt);
        form.append("size", request.size);
        form.append("quality", request.quality);
        const bytes = Buffer.from(request.editOfBase64 as string, "base64");
        form.append("image", new Blob([bytes], { type: "image/png" }), "image.png");

        response = await fetch(EDITS_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal: controller.signal,
        });
      } else {
        response = await fetch(GENERATIONS_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt: request.prompt, size: request.size, quality: request.quality, n: 1 }),
          signal: controller.signal,
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new AiProviderError("The image provider took too long to respond. Try again.");
      }
      throw new AiProviderError("Could not reach the image provider. Try again.");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as OpenAiErrorBody | null;
      // Safe, non-leaking: never include the request body/key/raw
      // provider payload in what's thrown or logged.
      console.error(JSON.stringify({ scope: "ai_image_provider_error", provider: "openai", status: response.status, code: errorBody?.error?.code ?? null }));

      if (response.status === 401) throw new AiProviderError("The configured OpenAI API key was rejected.", 401);
      if (response.status === 429) throw new AiProviderError("OpenAI rate-limited this request. Try again shortly.", 429);
      if (errorBody?.error?.code === "moderation_blocked") {
        throw new AiProviderError("That request was blocked by OpenAI's content policy. Try a different description.", response.status);
      }
      throw new AiProviderError("The image provider returned an error.", response.status);
    }

    const data = (await response.json()) as OpenAiImagesResponse;
    const base64 = data.data?.[0]?.b64_json;
    if (!base64) throw new AiProviderError("The image provider returned an empty response.");

    return { base64, mimeType: "image/png" };
  }
}

export const openAiImageProvider = new OpenAiImageProvider();
registerAiImageProvider(openAiImageProvider);
