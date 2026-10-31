// lib/ai/videoImageDefaults.ts
//
// The size/quality a video scene's "ai-image" background actually
// generates at. Deliberately its own zero-dependency module (no
// prisma, no provider imports) so it can be imported from BOTH
// generateVideoConcepts.ts (server — for the cost estimate) and
// VideoWorkspace.tsx (client — for the real generation call) without
// ever bundling server-only code into the client. Kept in one place so
// the estimate and the actual spend can never drift apart.

import type { AiImageQuality, AiImageSize } from "./imageTypes";

export const VIDEO_SCENE_IMAGE_SIZE: AiImageSize = "1024x1536";
export const VIDEO_SCENE_IMAGE_QUALITY: AiImageQuality = "medium";
