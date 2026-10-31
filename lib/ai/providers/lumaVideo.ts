// lib/ai/providers/lumaVideo.ts
//
// Real Luma AI (Ray3.2) video-generation provider. Plain fetch, no SDK —
// same convention as providers/openai.ts / providers/openaiImage.ts.
//
// Every field below was verified live against docs.agents.lumalabs.ai
// (not secondary sources) before writing this file:
//   - Base URL: https://agents.lumalabs.ai/v1
//   - Auth: `Authorization: Bearer <LUMA_API_KEY>`
//   - Model id: "ray-3.2" (the only value Luma's docs currently accept)
//   - POST /v1/generations: { model, type: "video", prompt, aspect_ratio?,
//     video?: { resolution?, duration? } }. Image-to-video adds
//     video.start_frame / video.end_frame (an ImageRef) — NOT supported
//     together with duration "10s" (image-to-video is 5s-only; enforced
//     by the orchestrator before this provider is ever called, since
//     this is a request-shape constraint, not a provider implementation
//     detail).
//   - GET /v1/generations/{id}: { state: "queued"|...|"completed"|"failed",
//     failure_reason?, failure_code?, output?: [{ url }] }. The output
//     url is a presigned MP4 link that expires in 1 hour — callers must
//     download and persist it (Cloudinary) promptly, never store it
//     long-term.

import { AiProviderError } from "../types";
import { registerAiVideoProvider } from "../registry";
import type { AiVideoGenerationRequest, AiVideoProvider, AiVideoStatusResult, AiVideoSubmitResult } from "../videoGenTypes";

const BASE_URL = "https://agents.lumalabs.ai/v1";
const MODEL = "ray-3.2";

type LumaGenerationResponse = {
  id?: string;
  state?: string;
  failure_reason?: string | null;
  failure_code?: string | null;
  output?: Array<{ url?: string }>;
};

function apiKey(): string {
  const value = process.env.LUMA_API_KEY?.trim();
  if (!value) {
    // Should never be reached — the route checks isAiVideoConfigured()
    // first — but never silently proceeds without a key if it somehow is.
    throw new AiProviderError("Luma is not configured.");
  }
  return value;
}

async function lumaFetch(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new AiProviderError("Could not reach the Luma video provider. Try again.");
  }
  return response;
}

async function throwForError(response: Response): Promise<never> {
  const body = (await response.json().catch(() => null)) as { detail?: string } | null;
  // Safe, non-leaking: never include the request body/key/raw provider
  // payload in what's thrown or logged.
  console.error(JSON.stringify({ scope: "ai_video_provider_error", provider: "luma", status: response.status, detail: body?.detail ?? null }));

  if (response.status === 401) throw new AiProviderError("The configured Luma API key was rejected.", 401);
  if (response.status === 429) throw new AiProviderError("Luma rate-limited this request. Try again shortly.", 429);
  throw new AiProviderError("The video provider returned an error.", response.status);
}

class LumaVideoProvider implements AiVideoProvider {
  id = "luma";

  async submit(request: AiVideoGenerationRequest): Promise<AiVideoSubmitResult> {
    const video: Record<string, unknown> = { resolution: request.resolution, duration: `${request.durationSeconds}s` };
    if (request.startFrameUrl) video.start_frame = { type: "image", url: request.startFrameUrl };
    if (request.endFrameUrl) video.end_frame = { type: "image", url: request.endFrameUrl };

    const response = await lumaFetch("/generations", {
      method: "POST",
      body: JSON.stringify({ model: MODEL, type: "video", prompt: request.prompt, aspect_ratio: request.aspectRatio, video }),
    });

    if (!response.ok) await throwForError(response);

    const data = (await response.json()) as LumaGenerationResponse;
    if (!data.id) throw new AiProviderError("The video provider returned an empty response.");

    return { providerJobId: data.id };
  }

  async checkStatus(providerJobId: string): Promise<AiVideoStatusResult> {
    const response = await lumaFetch(`/generations/${providerJobId}`, { method: "GET" });
    if (!response.ok) await throwForError(response);

    const data = (await response.json()) as LumaGenerationResponse;

    if (data.state === "completed") {
      const outputUrl = data.output?.[0]?.url;
      if (!outputUrl) throw new AiProviderError("Luma reported completion with no output video.");
      return { state: "completed", outputUrl };
    }
    if (data.state === "failed") {
      return { state: "failed", errorMessage: data.failure_reason ?? "The video provider reported a failure with no further detail." };
    }
    return { state: data.state === "processing" ? "processing" : "queued" };
  }
}

export const lumaVideoProvider = new LumaVideoProvider();
registerAiVideoProvider(lumaVideoProvider);
