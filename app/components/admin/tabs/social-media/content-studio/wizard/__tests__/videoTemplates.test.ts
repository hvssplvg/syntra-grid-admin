import { describe, expect, it } from "vitest";
import { applyVideoTemplate, VIDEO_TEMPLATE_IDS } from "@/app/components/admin/tabs/social-media/content-studio/wizard/videoTemplates";
import { newScene, textLayerOf } from "@/app/components/admin/tabs/social-media/content-studio/wizard/videoCanvas";

const CANVAS = { width: 1080, height: 1920 };

describe("applyVideoTemplate", () => {
  for (const id of VIDEO_TEMPLATE_IDS) {
    it(`${id}: keeps the text layer's bounds inside the canvas and preserves the text`, () => {
      const scene = newScene({ text: "Some hook text", durationSeconds: 4, width: CANVAS.width, height: CANVAS.height });
      const styled = applyVideoTemplate(scene, id, CANVAS);
      const text = textLayerOf(styled);
      expect(text).toBeDefined();
      expect(text!.text).toBe("Some hook text");
      expect(text!.x).toBeGreaterThanOrEqual(0);
      expect(text!.x + text!.width).toBeLessThanOrEqual(CANVAS.width);
      expect(text!.y).toBeGreaterThanOrEqual(0);
      expect(text!.y).toBeLessThanOrEqual(CANVAS.height);
    });

    it(`${id}: sets a transition and textEntrance`, () => {
      const scene = newScene({ text: "Hook", durationSeconds: 4, width: CANVAS.width, height: CANVAS.height });
      const styled = applyVideoTemplate(scene, id, CANVAS);
      expect(["cut", "fade", "slide", "zoom"]).toContain(styled.transition);
      expect(["none", "slide-up-fade", "pop", undefined]).toContain(styled.textEntrance);
    });
  }

  it("professional-brief clears any pending AI-image prompt", () => {
    const scene = { ...newScene({ text: "Hook", durationSeconds: 4, width: CANVAS.width, height: CANVAS.height }), pendingImagePrompt: "a photo" };
    const styled = applyVideoTemplate(scene, "professional-brief", CANVAS);
    expect(styled.pendingImagePrompt).toBeUndefined();
  });

  it("preserves non-text layers (e.g. a logo) untouched", () => {
    const scene = newScene({ text: "Hook", durationSeconds: 4, width: CANVAS.width, height: CANVAS.height });
    const withExtra = { ...scene, layers: [...scene.layers, { id: "logo-1", type: "image" as const, x: 10, y: 10, width: 50, height: 50, rotation: 0, src: "logo.png" }] };
    const styled = applyVideoTemplate(withExtra, "bold-hook", CANVAS);
    expect(styled.layers.some((l) => l.id === "logo-1")).toBe(true);
    expect(styled.layers).toHaveLength(2);
  });
});
