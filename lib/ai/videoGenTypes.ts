// lib/ai/videoGenTypes.ts
//
// AI VIDEO GENERATION — a fourth, deliberately separate provider
// interface (alongside text/image/vision). Unlike AiImageProvider's
// synchronous generate(), a real video-generation call is a real
// submit-then-poll job (Luma's own API is exactly this shape — POST
// /v1/generations returns a job id in "queued" state; the result comes
// back later from GET /v1/generations/{id}). The interface below
// reflects that real shape rather than faking a synchronous wrapper
// around an inherently asynchronous operation.

export const AI_VIDEO_RESOLUTIONS = ["360p", "540p", "720p", "1080p"] as const;
export type AiVideoResolution = (typeof AI_VIDEO_RESOLUTIONS)[number];

export const AI_VIDEO_DURATIONS = [5, 10] as const;
export type AiVideoDurationSeconds = (typeof AI_VIDEO_DURATIONS)[number];

export type AiVideoGenerationRequest = {
  prompt: string;
  /** e.g. "9:16", "16:9", "1:1" — passed straight through to the provider. */
  aspectRatio: string;
  resolution: AiVideoResolution;
  durationSeconds: AiVideoDurationSeconds;
  /** Starting/ending frame for image-to-video. Luma's own constraint:
   *  not supported together with a 10s duration — callers must enforce
   *  that before submitting, the provider itself only maps the fields
   *  through and lets the provider's own validation catch anything
   *  that slips past. */
  startFrameUrl?: string;
  endFrameUrl?: string;
};

export type AiVideoSubmitResult = { providerJobId: string };

export type AiVideoStatusResult =
  | { state: "queued" | "processing" }
  | { state: "completed"; outputUrl: string }
  | { state: "failed"; errorMessage: string };

export interface AiVideoProvider {
  id: string;
  submit(request: AiVideoGenerationRequest): Promise<AiVideoSubmitResult>;
  checkStatus(providerJobId: string): Promise<AiVideoStatusResult>;
}
