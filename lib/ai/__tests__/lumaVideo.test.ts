import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiProviderError } from "@/lib/ai/types";
import { lumaVideoProvider as provider } from "@/lib/ai/providers/lumaVideo";

const ORIGINAL_ENV = process.env.LUMA_API_KEY;

describe("lumaVideoProvider", () => {
  beforeEach(() => {
    process.env.LUMA_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.LUMA_API_KEY = ORIGINAL_ENV;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("submit() posts the correct endpoint, model and body shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "gen-123", state: "queued" }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.submit({ prompt: "A cinematic shot", aspectRatio: "9:16", resolution: "360p", durationSeconds: 5 });

    expect(result).toEqual({ providerJobId: "gen-123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://agents.lumalabs.ai/v1/generations");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      model: "ray-3.2",
      type: "video",
      prompt: "A cinematic shot",
      aspect_ratio: "9:16",
      video: { resolution: "360p", duration: "5s" },
    });
  });

  it("submit() includes start_frame/end_frame only when supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "gen-456", state: "queued" }) });
    vi.stubGlobal("fetch", fetchMock);

    await provider.submit({ prompt: "x", aspectRatio: "9:16", resolution: "540p", durationSeconds: 5, startFrameUrl: "https://example.com/a.png" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.video.start_frame).toEqual({ type: "image", url: "https://example.com/a.png" });
    expect(body.video.end_frame).toBeUndefined();
  });

  it("checkStatus() maps a completed response to { state: 'completed', outputUrl }", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "gen-1", state: "completed", output: [{ url: "https://cdn.example.com/out.mp4" }] }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.checkStatus("gen-1");

    expect(result).toEqual({ state: "completed", outputUrl: "https://cdn.example.com/out.mp4" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://agents.lumalabs.ai/v1/generations/gen-1");
  });

  it("checkStatus() maps a failed response to { state: 'failed', errorMessage }", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "gen-2", state: "failed", failure_reason: "Content policy violation." }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.checkStatus("gen-2");

    expect(result).toEqual({ state: "failed", errorMessage: "Content policy violation." });
  });

  it("checkStatus() maps an in-progress response to 'queued' or 'processing'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "gen-3", state: "dreaming" }) });
    vi.stubGlobal("fetch", fetchMock);

    expect(await provider.checkStatus("gen-3")).toEqual({ state: "queued" });
  });

  it("throws AiProviderError(401) on an unauthorized response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: "Invalid API key" }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(provider.submit({ prompt: "x", aspectRatio: "9:16", resolution: "360p", durationSeconds: 5 })).rejects.toBeInstanceOf(AiProviderError);
  });

  it("throws AiProviderError when LUMA_API_KEY is missing", async () => {
    delete process.env.LUMA_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(provider.submit({ prompt: "x", aspectRatio: "9:16", resolution: "360p", durationSeconds: 5 })).rejects.toBeInstanceOf(AiProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
