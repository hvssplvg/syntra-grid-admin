import { describe, expect, it } from "vitest";
import { VIDEO_JOB_LIST_SELECT, type VideoJobView } from "@/lib/ai/aiVideoJobs";

describe("VIDEO_JOB_LIST_SELECT", () => {
  // Regression test for a real bug found via browser export testing:
  // the job-list route's Prisma `select` clause was missing
  // `durationSeconds`, so the resume-on-reopen path applied
  // `durationSeconds: undefined` to a scene, which made the whole
  // timeline's total duration NaN and hung MediaRecorder forever (no
  // "stop" ever fired, so no export ever completed). The real fix is
  // the `satisfies Record<keyof VideoJobView, true>` constraint on the
  // constant itself (a missing field fails the build) — this test just
  // keeps that constraint's intent legible without reading the types.
  it("selects every field VideoJobView exposes to the client", () => {
    const viewKeys: Array<keyof VideoJobView> = ["id", "status", "sceneId", "outputVideoUrl", "errorMessage", "estimatedCostUsd", "actualCostUsd", "generationMethod", "durationSeconds"];
    for (const key of viewKeys) {
      expect(VIDEO_JOB_LIST_SELECT).toHaveProperty(key, true);
    }
  });

  it("includes durationSeconds specifically", () => {
    expect(VIDEO_JOB_LIST_SELECT.durationSeconds).toBe(true);
  });
});
