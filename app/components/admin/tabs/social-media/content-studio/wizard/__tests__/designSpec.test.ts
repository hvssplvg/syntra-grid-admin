import { describe, expect, it } from "vitest";
import { withBrandLogo } from "@/app/components/admin/tabs/social-media/content-studio/wizard/designSpec";
import { imageLayer, textLayer, type CanvasData, type CanvasLayer, type ImageLayer } from "@/app/components/admin/tabs/social-media/content-studio/wizard/canvas";

const BASE: CanvasData = { width: 1080, height: 1080, background: "#FFFFFF", layers: [textLayer({ x: 100, y: 100, width: 400, text: "Hello", fontSize: 40, color: "#111", align: "center", bold: true })] };

function isImageLayer(layer: CanvasLayer): layer is ImageLayer {
  return layer.type === "image";
}

describe("withBrandLogo", () => {
  it("fills an empty logo-labelled placeholder rather than appending a new layer", () => {
    const placeholder = imageLayer({ x: 20, y: 20, width: 100, height: 100, src: "", placeholderLabel: "Company logo" });
    const data: CanvasData = { ...BASE, layers: [...BASE.layers, placeholder] };
    const result = withBrandLogo(data, "https://example.com/logo.png");
    expect(result.layers).toHaveLength(2);
    const logoLayer = result.layers.find(isImageLayer);
    expect(logoLayer?.src).toBe("https://example.com/logo.png");
  });

  it("appends a small corner logo layer when no placeholder exists", () => {
    const result = withBrandLogo(BASE, "https://example.com/logo.png");
    expect(result.layers).toHaveLength(2);
    const logoLayer = result.layers.filter(isImageLayer).find((l) => l.src === "https://example.com/logo.png");
    expect(logoLayer).toBeDefined();
  });

  it("never fills a non-logo image placeholder (e.g. a product photo spot)", () => {
    const productPlaceholder = imageLayer({ x: 20, y: 20, width: 100, height: 100, src: "", placeholderLabel: "Product screenshot" });
    const data: CanvasData = { ...BASE, layers: [...BASE.layers, productPlaceholder] };
    const result = withBrandLogo(data, "https://example.com/logo.png");
    // Untouched product placeholder, plus a new appended corner logo.
    expect(result.layers).toHaveLength(3);
    const untouched = result.layers.filter(isImageLayer).find((l) => l.placeholderLabel === "Product screenshot");
    expect(untouched?.src).toBe("");
  });

  it("keeps the appended logo inside the canvas bounds", () => {
    const result = withBrandLogo(BASE, "https://example.com/logo.png");
    const logoLayer = result.layers.filter(isImageLayer).find((l) => l.src === "https://example.com/logo.png");
    expect(logoLayer).toBeDefined();
    if (logoLayer) {
      expect(logoLayer.x + logoLayer.width).toBeLessThanOrEqual(BASE.width);
      expect(logoLayer.y + logoLayer.height).toBeLessThanOrEqual(BASE.height);
    }
  });
});
