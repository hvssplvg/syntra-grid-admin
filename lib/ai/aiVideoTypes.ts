// lib/ai/aiVideoTypes.ts
//
// Types for the AI Video concept/storyboard planning step (text-tier,
// free — no provider/video spend happens until a storyboard scene is
// confirmed and submitted to Luma). Deliberately a richer shape than
// VideoConcept (lib/ai/types.ts), which drives the existing free
// Standard-Video text/motion-graphics flow — AI Video's output scenes
// each become one real paid Luma generation, so each scene needs the
// fuller creative-direction fields (camera movement, suggested visual,
// voiceover) a motion-graphics scene never did.

import type { SocialPlatform } from "@/app/components/admin/tabs/social-media/shared/types";
import type { AiVideoDurationSeconds } from "./videoGenTypes";

export type AiVideoStoryboardScene = {
  sceneNumber: number;
  description: string;
  suggestedVisual: string;
  durationSeconds: AiVideoDurationSeconds;
  cameraMovement: string;
  voiceoverText?: string;
  brandElements?: string;
};

export type AiVideoConcept = {
  title: string;
  creativeDirection: string;
  hook: string;
  storyline: string;
  scenes: AiVideoStoryboardScene[];
  targetPlatform: SocialPlatform;
  suggestedVoiceover: string;
  suggestedCaption: string;
  callToAction: string;
};

export type AiVideoConceptRequest = {
  brief: string;
  platform?: SocialPlatform;
  /** e.g. "9:16" — informs scene/camera guidance (a vertical phone-in-
   *  hand shot reads differently than a 16:9 desktop demo), never
   *  trusted as the literal generation parameter (that's chosen
   *  separately, per scene, in the storyboard editor). */
  aspectRatio?: string;
  /** The vision provider's description of an admin-uploaded, authorised
   *  reference image (see analyzeReferenceImageApi) — same idiom as
   *  Graphic Studio's creativeDirection.ts. Informs all 3 concepts'
   *  visual direction without forcing them to be 3 copies of the same
   *  reference, and is never treated as proof the reference video's own
   *  motion/camera work/editing was analysed — only a still image was. */
  referenceAnalysis?: string;
};
