// lib/ai/visionTypes.ts
//
// A deliberately separate interface from AiTextProvider, same reason
// imageTypes.ts gives for AiImageProvider: the request/response shape
// genuinely differs (an image in, a description out), so this is a
// parallel abstraction, not an overload of the text-only one. Backed
// by the SAME OpenAI account/key as text generation — this is one
// more capability on an existing paid relationship, not a new
// provider/company.

export type AiVisionRequest = {
  /** A stable, public HTTPS URL — e.g. the Cloudinary secure_url this
   *  app's existing upload pipeline already returns. */
  imageUrl: string;
  /** What to look for — kept separate from a hardcoded prompt so the
   *  same provider can serve different analysis instructions later. */
  instruction: string;
};

export type AiVisionResult = { description: string };

export interface AiVisionProvider {
  id: string;
  analyze(request: AiVisionRequest): Promise<AiVisionResult>;
}
