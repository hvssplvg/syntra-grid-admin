import { describe, expect, it } from "vitest";
import {
  blankVideoCanvasDataForPlatform,
  conceptToAiVideoCanvasData,
  conceptToVideoCanvasData,
  newScene,
  textLayerOf,
  VIDEO_BACKGROUND_SWATCHES,
  withLogo,
  withoutLogo,
  withSceneText,
} from "@/app/components/admin/tabs/social-media/content-studio/wizard/videoCanvas";
import { CANVAS_SIZE_BY_PLATFORM } from "@/app/components/admin/tabs/social-media/content-studio/wizard/canvas";

describe("blankVideoCanvasDataForPlatform", () => {
  it("matches canvasSizeForPlatform for every known platform", () => {
    for (const platform of Object.keys(CANVAS_SIZE_BY_PLATFORM)) {
      const data = blankVideoCanvasDataForPlatform(platform);
      expect(data.width).toBe(CANVAS_SIZE_BY_PLATFORM[platform].width);
      expect(data.height).toBe(CANVAS_SIZE_BY_PLATFORM[platform].height);
      expect(data.scenes).toEqual([]);
    }
  });

  it("falls back to GENERAL for an unknown platform", () => {
    const data = blankVideoCanvasDataForPlatform("NOT_A_PLATFORM");
    expect(data.width).toBe(CANVAS_SIZE_BY_PLATFORM.GENERAL.width);
    expect(data.height).toBe(CANVAS_SIZE_BY_PLATFORM.GENERAL.height);
  });
});

describe("conceptToVideoCanvasData", () => {
  const concept = {
    scenes: [
      { text: "Hook", durationSeconds: 3, backgroundStyle: "color" as const },
      { text: "Scene 2", durationSeconds: 4, backgroundStyle: "ai-image" as const, imagePrompt: "a cozy office" },
    ],
  };

  it("creates one scene per concept scene, never auto-spending on ai-image", () => {
    const data = conceptToVideoCanvasData(concept, 1080, 1920, 30);
    expect(data.scenes).toHaveLength(2);
    expect(data.scenes[0].background.kind).toBe("color");
    expect(data.scenes[1].background.kind).toBe("color"); // stays color even though the concept asked for ai-image
    expect(data.scenes[1].pendingImagePrompt).toBe("a cozy office");
    expect(data.scenes[0].pendingImagePrompt).toBeUndefined();
  });

  it("uses the default swatches when none are passed", () => {
    const data = conceptToVideoCanvasData(concept, 1080, 1920, 30);
    const colors = data.scenes.map((s) => (s.background.kind === "color" ? s.background.value : null));
    expect(colors[0]).toBe(VIDEO_BACKGROUND_SWATCHES[0]);
  });

  it("uses brand swatches when provided", () => {
    const brandSwatches = ["#111111", "#222222"];
    const data = conceptToVideoCanvasData(concept, 1080, 1920, 30, brandSwatches);
    expect(data.scenes[0].background).toEqual({ kind: "color", value: "#111111" });
    expect(data.scenes[1].background).toEqual({ kind: "color", value: "#222222" });
  });
});

describe("withLogo / withoutLogo", () => {
  it("adds exactly one logo image layer alongside the text layer", () => {
    const scene = newScene({ text: "Hello", durationSeconds: 3, width: 1080, height: 1920 });
    const withLogoScene = withLogo(scene, "https://example.com/logo.png", 1080, 1920);
    expect(withLogoScene.layers).toHaveLength(2);
    expect(textLayerOf(withLogoScene)?.text).toBe("Hello");
    const imageLayers = withLogoScene.layers.filter((l) => l.type === "image");
    expect(imageLayers).toHaveLength(1);
  });

  it("replacing the logo never duplicates it", () => {
    const scene = newScene({ text: "Hello", durationSeconds: 3, width: 1080, height: 1920 });
    const once = withLogo(scene, "https://example.com/logo.png", 1080, 1920);
    const twice = withLogo(once, "https://example.com/logo2.png", 1080, 1920);
    expect(twice.layers.filter((l) => l.type === "image")).toHaveLength(1);
  });

  it("strips the logo back out, leaving the text layer intact", () => {
    const scene = newScene({ text: "Hello", durationSeconds: 3, width: 1080, height: 1920 });
    const withLogoScene = withLogo(scene, "https://example.com/logo.png", 1080, 1920);
    const stripped = withoutLogo(withLogoScene);
    expect(stripped.layers).toHaveLength(1);
    expect(textLayerOf(stripped)?.text).toBe("Hello");
  });

  it("is a no-op when there's no logo to remove", () => {
    const scene = newScene({ text: "Hello", durationSeconds: 3, width: 1080, height: 1920 });
    expect(withoutLogo(scene).layers).toHaveLength(1);
  });
});

describe("withSceneText", () => {
  // Regression test for a real bug found via browser export testing:
  // every AI Video scene (and any manually-added blank scene) starts
  // with zero layers, since newScene({text: "", ...}) never creates a
  // TextLayer for empty text. The "On screen text" field used to only
  // ever UPDATE an existing TextLayer, so typing into it on such a
  // scene was a silent no-op — confirmed in a real exported video that
  // had no text overlay at all despite text being typed in the UI.
  it("creates a new text layer when the scene has none yet", () => {
    const blank = conceptToAiVideoCanvasData({ scenes: [{ suggestedVisual: "A desk", cameraMovement: "static", durationSeconds: 5 }] }, 1080, 1920, 30).scenes[0];
    expect(textLayerOf(blank)).toBeUndefined();

    const withText = withSceneText(blank, "Run your business, not your spreadsheets.", 1080, 1920);
    expect(textLayerOf(withText)?.text).toBe("Run your business, not your spreadsheets.");
    expect(withText.layers).toHaveLength(1);
  });

  it("updates the existing text layer in place rather than adding a second one", () => {
    const scene = newScene({ text: "Original", durationSeconds: 3, width: 1080, height: 1920 });
    const updated = withSceneText(scene, "Replaced", 1080, 1920);
    expect(updated.layers).toHaveLength(1);
    expect(textLayerOf(updated)?.text).toBe("Replaced");
  });

  it("stays a true no-op for empty text on a scene with no layer yet", () => {
    const blank = conceptToAiVideoCanvasData({ scenes: [{ suggestedVisual: "A desk", cameraMovement: "static", durationSeconds: 5 }] }, 1080, 1920, 30).scenes[0];
    expect(withSceneText(blank, "", 1080, 1920).layers).toHaveLength(0);
  });

  it("preserves other layers (e.g. a logo) untouched", () => {
    const scene = newScene({ text: "Hello", durationSeconds: 3, width: 1080, height: 1920 });
    const withLogoScene = withLogo(scene, "https://example.com/logo.png", 1080, 1920);
    const updated = withSceneText(withLogoScene, "Updated", 1080, 1920);
    expect(updated.layers).toHaveLength(2);
    expect(updated.layers.filter((l) => l.type === "image")).toHaveLength(1);
  });
});
