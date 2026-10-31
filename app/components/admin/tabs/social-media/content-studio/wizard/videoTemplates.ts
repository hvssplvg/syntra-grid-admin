// 4 named visual presets for a video scene's text treatment — modeled
// on the Graphic Studio's templates.ts pattern (a named id driving a
// pure layout function) but deliberately much smaller: just text
// position/size/weight/align, plus the scene's whole-scene transition
// and the text's own entrance style (see VideoWorkspace.tsx's
// sceneGroupTransform()/textEntranceTransform()). Logo visibility is a
// separate, project-wide toggle in VideoWorkspace — not part of a
// template, so a template never fights the admin's own logo choice.

import { textLayer } from "./canvas";
import { textLayerOf, type VideoScene } from "./videoCanvas";

export type VideoTemplateId = "bold-hook" | "minimal-caption" | "meme-punch" | "professional-brief";

export const VIDEO_TEMPLATE_LABELS: Record<VideoTemplateId, string> = {
  "bold-hook": "Bold Hook",
  "minimal-caption": "Minimal Caption",
  "meme-punch": "Meme Punch",
  "professional-brief": "Professional Brief",
};

export const VIDEO_TEMPLATE_IDS = Object.keys(VIDEO_TEMPLATE_LABELS) as VideoTemplateId[];

export function applyVideoTemplate(scene: VideoScene, templateId: VideoTemplateId, canvasSize: { width: number; height: number }): VideoScene {
  const { width, height } = canvasSize;
  const text = textLayerOf(scene)?.text ?? "";
  const otherLayers = scene.layers.filter((layer) => layer.type !== "text");

  switch (templateId) {
    case "bold-hook":
      return {
        ...scene,
        transition: "zoom",
        textEntrance: "slide-up-fade",
        layers: [
          textLayer({ x: Math.round(width * 0.08), y: Math.round(height * 0.38), width: Math.round(width * 0.84), fontSize: Math.round(width * 0.075), color: "#FFFFFF", align: "center", bold: true, text }),
          ...otherLayers,
        ],
      };
    case "minimal-caption":
      return {
        ...scene,
        transition: "fade",
        textEntrance: "none",
        layers: [
          textLayer({ x: Math.round(width * 0.1), y: Math.round(height * 0.82), width: Math.round(width * 0.8), fontSize: Math.round(width * 0.045), color: "#FFFFFF", align: "left", bold: false, text }),
          ...otherLayers,
        ],
      };
    case "meme-punch":
      return {
        ...scene,
        transition: "cut",
        textEntrance: "pop",
        layers: [
          textLayer({ x: Math.round(width * 0.06), y: Math.round(height * 0.06), width: Math.round(width * 0.88), fontSize: Math.round(width * 0.065), color: "#FFFFFF", align: "center", bold: true, text }),
          ...otherLayers,
        ],
      };
    case "professional-brief":
      // Brand-colour background only — never auto-spend on an AI image for this preset.
      return {
        ...scene,
        pendingImagePrompt: undefined,
        transition: "slide",
        textEntrance: "slide-up-fade",
        layers: [
          textLayer({ x: Math.round(width * 0.1), y: Math.round(height * 0.44), width: Math.round(width * 0.8), fontSize: Math.round(width * 0.06), color: "#FFFFFF", align: "center", bold: true, text }),
          ...otherLayers,
        ],
      };
    default:
      return scene;
  }
}
