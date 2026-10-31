import { describe, expect, it } from "vitest";
import { availableVideoOptions, estimateVideoCostUsd, nearestAvailableDuration } from "@/lib/ai/videoCost";

describe("estimateVideoCostUsd", () => {
  it("returns the officially verified price for a known resolution/duration combination", () => {
    expect(estimateVideoCostUsd("360p", 5)).toEqual({ available: true, estimatedCostUsd: 0.06 });
    expect(estimateVideoCostUsd("540p", 10)).toEqual({ available: true, estimatedCostUsd: 0.45 });
    expect(estimateVideoCostUsd("1080p", 10)).toEqual({ available: true, estimatedCostUsd: 3.6 });
  });

  it("refuses to invent a price for 360p at 10s (no officially verified figure)", () => {
    const result = estimateVideoCostUsd("360p", 10);
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toMatch(/no officially verified/i);
  });
});

describe("availableVideoOptions", () => {
  it("lists only combinations with a verified price, never 360p at 10s", () => {
    const options = availableVideoOptions();
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((option) => option.resolution === "360p" && option.durationSeconds === 10)).toBe(false);
    expect(options.some((option) => option.resolution === "360p" && option.durationSeconds === 5)).toBe(true);
  });
});

describe("nearestAvailableDuration", () => {
  // Regression test for a real bug found via Trend Intelligence browser
  // testing: a trend-adapted storyboard scene suggested a 10s duration,
  // but the cost-confirmation dialog's default resolution is 360p
  // (which only prices 5s) — the dialog silently failed to open at all
  // instead of falling back to something that actually works.
  it("falls back to 5s when the snapped duration has no price at this resolution", () => {
    expect(nearestAvailableDuration("360p", 10)).toBe(5);
    expect(nearestAvailableDuration("360p", 8)).toBe(5);
  });

  it("uses the snapped duration directly when it IS available at this resolution", () => {
    expect(nearestAvailableDuration("540p", 10)).toBe(10);
    expect(nearestAvailableDuration("540p", 9)).toBe(10);
    expect(nearestAvailableDuration("720p", 4)).toBe(5);
  });

  it("5s is always available regardless of resolution", () => {
    for (const resolution of ["360p", "540p", "720p", "1080p"] as const) {
      expect(estimateVideoCostUsd(resolution, nearestAvailableDuration(resolution, 5)).available).toBe(true);
    }
  });
});
