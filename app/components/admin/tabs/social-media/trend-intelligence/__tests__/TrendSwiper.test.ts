import { describe, expect, it } from "vitest";
import { isInteractiveDragTarget } from "@/app/components/admin/tabs/social-media/trend-intelligence/TrendSwiper";

// This project's vitest environment is Node, not jsdom, so these are
// duck-typed Element-like objects exercising the real selector logic
// (Element.prototype.closest's contract) rather than a fake DOM.
function fakeTarget(matches: boolean): EventTarget {
  return { closest: () => (matches ? {} : null) } as unknown as Element;
}

describe("isInteractiveDragTarget", () => {
  it("is true for a pointerdown on a button (or inside one)", () => {
    expect(isInteractiveDragTarget(fakeTarget(true))).toBe(true);
  });

  it("is false for a pointerdown on the plain card surface", () => {
    expect(isInteractiveDragTarget(fakeTarget(false))).toBe(false);
  });

  it("is false for a null target", () => {
    expect(isInteractiveDragTarget(null)).toBe(false);
  });

  it("is false for a target with no closest() method at all (defensive)", () => {
    expect(isInteractiveDragTarget({} as EventTarget)).toBe(false);
  });
});
