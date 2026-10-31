// lib/ai/referenceAnalysis.ts
//
// The instruction sent to the vision provider for an admin-uploaded
// reference image (Trend Intelligence's "upload a reference you have
// the rights to use" path). Purely descriptive — this is a tool for
// understanding a real, authorised image, never a trigger to invent
// details beyond what's visible.

export const REFERENCE_IMAGE_INSTRUCTION = `
Describe this image's visual composition for a designer who will create an ORIGINAL image inspired by its format — not a copy.
Cover, in plain prose:
- Layout: how the frame is composed (centred subject, split-screen, grid, collage, etc).
- Perspective: camera angle/viewpoint, depth, and how foreground/background are used.
- Lighting: direction, quality (soft/hard, natural/studio), and how it shapes the subject.
- Colour treatment: the palette and overall tone (bright/muted, warm/cool, high-contrast, etc).
- Visual hierarchy: what the eye is drawn to first, second, third.
- Subject arrangement: what's placed where, and how the eye is led through the image.
- Typography: any visible text's style/placement (ignore this if there is none).
- Overall creative style: photographic, illustrated, meme-format, screenshot-style, etc.
- The underlying meme or design format this resembles, if you recognise one (e.g. "before/after split," "reaction-face overlay," "numbered list card") — say so only if it's actually recognisable, never guess one that doesn't fit.
Describe only what is actually visible. Do not invent people, text, logos, or details that aren't in the image, and do not identify or name any real person who may appear in it.`.trim();
