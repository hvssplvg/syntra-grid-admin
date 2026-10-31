// lib/ai/types.ts
//
// Shared types for the AI text-generation feature (Content Studio Phase 2).
// Server-only — never imported into a "use client" component directly;
// UI components import only the string literal unions they need to build
// a request body, never anything provider-specific.

import type { SocialPlatform } from "@/app/components/admin/tabs/social-media/shared/types";

export type AiTextAction =
  | "GENERATE"
  | "IMPROVE"
  | "SHORTEN"
  | "LENGTHEN"
  | "MORE_PROFESSIONAL"
  | "MORE_ENGAGING"
  | "CHANGE_TONE"
  | "GENERATE_HASHTAGS"
  | "ADAPT_PLATFORM"
  | "REGENERATE";

export const AI_TEXT_ACTIONS: AiTextAction[] = [
  "GENERATE",
  "IMPROVE",
  "SHORTEN",
  "LENGTHEN",
  "MORE_PROFESSIONAL",
  "MORE_ENGAGING",
  "CHANGE_TONE",
  "GENERATE_HASHTAGS",
  "ADAPT_PLATFORM",
  "REGENERATE",
];

export type AiTone = "PROFESSIONAL" | "FRIENDLY" | "CONFIDENT" | "EDUCATIONAL" | "CONVERSATIONAL" | "PROMOTIONAL";

export const AI_TONES: AiTone[] = ["PROFESSIONAL", "FRIENDLY", "CONFIDENT", "EDUCATIONAL", "CONVERSATIONAL", "PROMOTIONAL"];

/**
 * What the API route accepts from the client. `brief` seeds a fresh
 * GENERATE; `currentText` is required for every action that edits
 * existing text (IMPROVE/SHORTEN/.../REGENERATE). `platform` is the
 * caption's current/intended platform (steers tone+limit); `targetPlatform`
 * is only read for ADAPT_PLATFORM. `tone` is only read for CHANGE_TONE
 * (every other action keeps the brand's default voice).
 */
export type AiTextRequest = {
  action: AiTextAction;
  brief?: string;
  currentText?: string;
  platform?: SocialPlatform;
  targetPlatform?: SocialPlatform;
  tone?: AiTone;
  /** Free-text refinement instruction from the admin (e.g. "make this
   *  less promotional") — read alongside brief/currentText, never
   *  replaces them. */
  feedback?: string;
};

export type BuiltPrompt = {
  system: string;
  user: string;
};

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export interface AiTextProvider {
  id: string;
  generate(prompt: BuiltPrompt): Promise<string>;
}

/**
 * Structured graphic copy (Content Studio's Graphic Studio — "interpret
 * the brief, don't paste it"). Illustrative shape, not a mandatory
 * schema: every field but `headline` is optional, and a provider that
 * omits a field it has nothing truthful to say for is doing the right
 * thing, not failing.
 */
export type GraphicContent = {
  headline: string;
  subheadline?: string;
  description?: string;
  features?: string[];
  callToAction?: string;
  brandName?: string;
};

export type GraphicContentRequest = {
  brief: string;
  platform?: SocialPlatform;
  style?: string;
  templateId?: string;
  /** Free-text refinement instruction from the admin — same idiom as
   *  AiTextRequest.feedback. */
  feedback?: string;
};

/**
 * Structured graphic DESIGN specification (Content Studio round 3,
 * "Mode B — AI-designed editable graphic"). Unlike GraphicContent (text
 * fields a template then lays out), this is a full composition the AI
 * itself chooses — positions, sizes, colours, decorative shapes — which
 * generateGraphicDesign.ts validates and clamps strictly before it's
 * ever converted into real Konva layers (wizard/designSpec.ts).
 *
 * Deliberately excludes any URL/src/image field on any element —
 * "image-placeholder" elements are geometry only (x/y/width/height), so
 * there is no field for the AI to put an arbitrary external image URL
 * into even if it tried; the admin fills the placeholder with a real
 * uploaded image afterwards, exactly like any other image layer.
 */
export type GraphicDesignTextElement = {
  type: "text";
  /** What this text is for — read only to help the AI reason about
   *  hierarchy (headline bigger than body, etc.); never persisted or
   *  trusted beyond generation. */
  role: "headline" | "subheadline" | "body" | "feature" | "callToAction" | "brand";
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  color: string;
  align: "left" | "center" | "right";
  bold: boolean;
  rotation?: number;
};

export type GraphicDesignShapeElement = {
  type: "shape";
  shape: "rect" | "circle";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  rotation?: number;
  cornerRadius?: number;
};

export type GraphicDesignImagePlaceholderElement = {
  type: "image-placeholder";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  /** A short label shown inside the empty placeholder box, e.g. "Product
   *  photo" — purely descriptive, never a URL. */
  label?: string;
};

export type GraphicDesignElement = GraphicDesignTextElement | GraphicDesignShapeElement | GraphicDesignImagePlaceholderElement;

export type GraphicDesignSpec = {
  /** Hex colour only. */
  background: string;
  elements: GraphicDesignElement[];
};

export type GraphicDesignRequest = {
  brief: string;
  platform?: SocialPlatform;
  style?: string;
  /** Free-text refinement instruction from the admin — same idiom as
   *  AiTextRequest.feedback. */
  feedback?: string;
};

/**
 * One of exactly 3 proposed creative directions for Mode A's real AI
 * image (lib/ai/creativeDirection.ts). `imagePrompt` is the complete,
 * ready-to-send generation prompt for this specific composition —
 * already grounded in brand + the premium-quality standards — so
 * selecting a concept sends it to the image provider verbatim
 * (GraphicWorkspace's promptOverride), no second prompt-build pass.
 */
export type GraphicCreativeConcept = {
  label: string;
  description: string;
  imagePrompt: string;
  headline: string;
  supportingText?: string;
  callToAction?: string;
};

export type GraphicCreativeDirectionRequest = {
  brief: string;
  platform?: SocialPlatform;
  style?: string;
  referenceAnalysis?: string;
};

/**
 * One scene in an AI-generated short-video concept (Content Studio
 * Video). `backgroundStyle: "color"` is free — a flat brand-colour
 * background, no provider call. `"ai-image"` costs real money (one
 * generate-graphic-image call per such scene, same provider/pricing as
 * the Graphic Studio's Mode A) and only `imagePrompt` is ever used to
 * actually generate it, never fabricated by this type.
 */
export type VideoConceptScene = {
  text: string;
  durationSeconds: number;
  backgroundStyle: "color" | "ai-image";
  imagePrompt?: string;
};

export type VideoConcept = {
  hook: string;
  caption: string;
  scenes: VideoConceptScene[];
  /** Computed server-side from imageCost.ts against the scenes above —
   *  never provider-reported, never guessed by the AI itself. 0 for an
   *  all-color concept. */
  estimatedCostUsd: number;
};

export type VideoConceptRequest = {
  brief: string;
  platform?: SocialPlatform;
  feedback?: string;
};

/**
 * AI analysis of an already-discovered/imported Trend (Trend
 * Intelligence). Deliberately never invents the trend itself — the
 * title/platform/source/etc. are already verified data on the Trend
 * row before this ever runs; this type is purely the AI's reasoning
 * about WHY it works and HOW the business could adapt it, plus a
 * relevance estimate. `relevanceScore` is clamped 0-100 server-side;
 * `relevanceExplanation` must never phrase it as a guaranteed outcome.
 */
export type TrendAnalysisResult = {
  whyInteresting: string;
  hookEffectiveness: string;
  storytellingStructure: string;
  emotionalAppeal: string;
  adaptationIdea: string;
  suitableIndustries: string[];
  suitableAudiences: string[];
  suitablePlatforms: SocialPlatform[];
  recommendedFormats: string[];
  suggestedCaptions: string[];
  hashtags: string[];
  relevanceScore: number;
  relevanceExplanation: string;
};

export type TrendAnalysisRequest = {
  trendId: string;
  /** Re-run analysis even though aiAnalyzedAt is already set. Default
   *  behaviour (omitted/false) is cache-and-skip — see Trend.aiAnalyzedAt. */
  force?: boolean;
};

/**
 * The Trend Adaptation Engine's output (lib/ai/trendAdaptation.ts +
 * generateTrendAdaptation.ts) — takes a trend's EXISTING TrendAnalysisResult
 * (reused, never re-derived) plus the real BrandContext and turns it into
 * one business-specific, ready-to-generate creative brief. `basis` is
 * always metadata-grounded — this module never claims to have watched the
 * source video, only to have reasoned about its metadata/prior analysis/
 * any admin-provided context.
 */
export type TrendAdaptationMode = "meme" | "before_after" | "storytelling" | "educational" | "transition" | "professional" | "other";

export type TrendAdaptationBrief = {
  adaptationMode: TrendAdaptationMode;
  coreCreativeConcept: string;
  hook: string;
  humorOrEmotionalAppeal: string;
  storytellingStructure: string;
  visualFormat: string;
  pacing: string;
  intendedAudience: string;
  suitablePlatforms: SocialPlatform[];
  businessAdaptationOpportunities: string[];
  /** False when this trend's format is a poor fit for the business —
   *  surfaced to the admin as an explanation + alternative, never a
   *  silent block. */
  suitable: boolean;
  suitabilityReason: string;
  alternativeSuggestion?: string;
  /** The one ready-to-use brief string — fed straight into the existing
   *  generateVideoConcepts/generateGraphicDesign prompts as-is. */
  adaptedBrief: string;
  /** Server-computed from what was actually supplied — never trusted
   *  from the model's own claim. Visual reference implies the
   *  strongest grounding (a real, analysed image, not just text). */
  basis: "metadata_and_analysis" | "metadata_analysis_and_admin_context" | "metadata_analysis_and_visual_reference";
};

export type TrendAdaptationRequest = {
  trendId: string;
  /** Free text the admin typed describing the trend further — e.g. if
   *  they watched it and noticed something metadata alone can't show.
   *  Optional; omitting it is the normal path. */
  additionalContext?: string;
  /** An admin-uploaded, authorised reference image — its stable URL
   *  plus the vision provider's description of it (see
   *  analyzeReferenceImageApi). Optional; when present, the adapted
   *  brief grounds its visual description in this real reference
   *  rather than inferring purely from title/description. */
  referenceImage?: { url: string; analysis: string };
};
