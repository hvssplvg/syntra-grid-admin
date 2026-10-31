// lib/ai/imageQualityStandards.ts
//
// The premium-visual-quality bar for AI-generated marketing imagery —
// defined once, imported by both imagePrompt.ts (the direct/skip-
// concepts/revision/reference path) and creativeDirection.ts (the new
// 3-concepts planning step), so the standard is identical regardless
// of which path a generation takes.

export const IMAGE_QUALITY_STANDARDS = `
This must look like a professionally art-directed commercial campaign image, not a generic AI poster. Prioritise:
- Photorealistic commercial rendering where the subject calls for it (real-world products, environments, devices).
- High-quality 3D visualisation where the subject calls for it (abstract software/data concepts, floating interface panels).
- Realistic devices and product mock-ups (laptops, phones, monitors, vehicles, physical environments) rendered with real-world proportions and materials.
- Sophisticated, directional lighting; natural shadows and reflections; strong depth and perspective.
- Professional composition with genuine visual hierarchy and balanced negative space — not a centred subject on a flat background.
- Premium materials and environments (studio, architectural, or location-appropriate settings) and cohesive colour grading across the whole image.
- Any interface/dashboard/screen content shown must read as a realistic STYLISED representation (abstract panels, soft UI shapes, blurred/illustrative content) — never a claimed-authentic screenshot, and never inventing real statistics, chart values, or data.

Avoid entirely: generic gradient-background posters, random unrelated floating objects, excessive glow/bloom effects, overcrowded layouts, unreadable or garbled interface text, inconsistent or mismatched branding, a repetitive "laptop + floating dashboard" formula applied regardless of topic, and unnecessary decorative clutter.

The specific composition — realism level, environment, which objects/devices/interfaces appear, how many elements — must be chosen to fit THIS topic, not forced into one fixed template. Not every subject needs a laptop, a floating dashboard, or a 3D server.`.trim();
