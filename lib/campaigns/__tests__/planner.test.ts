import { describe, expect, it } from "vitest";
import { walkForDependencyCycle } from "@/lib/campaigns/planner";

/** Builds a fake chain lookup: task -> the task it depends on. */
function chainLookup(chain: Record<string, string | null>) {
  return async (id: string) => chain[id] ?? null;
}

describe("walkForDependencyCycle", () => {
  it("allows depending on a task with no further chain", async () => {
    const lookup = chainLookup({ b: null });
    await expect(walkForDependencyCycle("a", "b", lookup)).resolves.toBeUndefined();
  });

  it("rejects a task depending on itself", async () => {
    const lookup = chainLookup({});
    await expect(walkForDependencyCycle("a", "a", lookup)).rejects.toThrow();
  });

  it("rejects a direct two-task cycle (a depends on b, b already depends on a)", async () => {
    const lookup = chainLookup({ b: "a" });
    await expect(walkForDependencyCycle("a", "b", lookup)).rejects.toThrow();
  });

  it("rejects a longer cycle discovered several hops down the chain", async () => {
    // a -> b -> c -> d -> a (proposing a depends on b)
    const lookup = chainLookup({ b: "c", c: "d", d: "a" });
    await expect(walkForDependencyCycle("a", "b", lookup)).rejects.toThrow();
  });

  it("allows a long non-circular chain", async () => {
    const lookup = chainLookup({ b: "c", c: "d", d: null });
    await expect(walkForDependencyCycle("a", "b", lookup)).resolves.toBeUndefined();
  });

  it("terminates instead of looping forever on an already-corrupt chain unrelated to the new task", async () => {
    // x -> y -> x is already circular, but "a" (the task being saved) is
    // never part of that loop — the walk must still terminate.
    const lookup = chainLookup({ x: "y", y: "x" });
    await expect(walkForDependencyCycle("a", "x", lookup)).resolves.toBeUndefined();
  });

  it("is a no-op when no dependency is proposed", async () => {
    const lookup = chainLookup({});
    await expect(walkForDependencyCycle("a", null, lookup)).resolves.toBeUndefined();
  });
});
