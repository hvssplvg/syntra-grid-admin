import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("assertSafeMonitoringUrl — SSRF guard", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("node:dns/promises");
  });

  it("rejects a non-http(s) scheme", async () => {
    const { assertSafeMonitoringUrl, UnsafeUrlError } = await import("@/lib/monitoring/safeFetch");
    await expect(assertSafeMonitoringUrl("file:///etc/passwd")).rejects.toBeInstanceOf(UnsafeUrlError);
    await expect(assertSafeMonitoringUrl("ftp://example.com")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects an unparseable URL", async () => {
    const { assertSafeMonitoringUrl, UnsafeUrlError } = await import("@/lib/monitoring/safeFetch");
    await expect(assertSafeMonitoringUrl("not a url")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects a hostname that resolves to a loopback address — the literal localhost case", async () => {
    vi.doMock("node:dns/promises", () => ({ default: { lookup: vi.fn().mockResolvedValue([{ address: "127.0.0.1", family: 4 }]) } }));
    const { assertSafeMonitoringUrl, UnsafeUrlError } = await import("@/lib/monitoring/safeFetch");
    await expect(assertSafeMonitoringUrl("http://localhost/admin")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects a hostname that LOOKS external but resolves to a private address — the real DNS-rebinding case this guard exists for", async () => {
    vi.doMock("node:dns/promises", () => ({ default: { lookup: vi.fn().mockResolvedValue([{ address: "10.0.0.5", family: 4 }]) } }));
    const { assertSafeMonitoringUrl, UnsafeUrlError } = await import("@/lib/monitoring/safeFetch");
    await expect(assertSafeMonitoringUrl("http://totally-looks-external.example.com/")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects link-local (169.254.x.x, the cloud-metadata range) and IPv6 unique-local addresses", async () => {
    vi.doMock("node:dns/promises", () => ({ default: { lookup: vi.fn().mockResolvedValue([{ address: "169.254.169.254", family: 4 }]) } }));
    const { assertSafeMonitoringUrl, UnsafeUrlError } = await import("@/lib/monitoring/safeFetch");
    await expect(assertSafeMonitoringUrl("http://metadata.internal/")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects when ANY resolved address (out of several) is private — fails closed, not on the first-seen address only", async () => {
    vi.doMock("node:dns/promises", () => ({
      default: { lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "192.168.1.1", family: 4 }]) },
    }));
    const { assertSafeMonitoringUrl, UnsafeUrlError } = await import("@/lib/monitoring/safeFetch");
    await expect(assertSafeMonitoringUrl("http://mixed-resolution.example.com/")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("rejects a hostname that fails to resolve at all", async () => {
    vi.doMock("node:dns/promises", () => ({ default: { lookup: vi.fn().mockRejectedValue(new Error("ENOTFOUND")) } }));
    const { assertSafeMonitoringUrl, UnsafeUrlError } = await import("@/lib/monitoring/safeFetch");
    await expect(assertSafeMonitoringUrl("http://does-not-exist.invalid/")).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("accepts a hostname that resolves to an ordinary public address", async () => {
    vi.doMock("node:dns/promises", () => ({ default: { lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) } }));
    const { assertSafeMonitoringUrl } = await import("@/lib/monitoring/safeFetch");
    const url = await assertSafeMonitoringUrl("https://example.com/health");
    expect(url.hostname).toBe("example.com");
  });
});

describe("performMonitoringCheck", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("node:dns/promises", () => ({ default: { lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]) } }));
  });

  afterEach(() => {
    vi.doUnmock("node:dns/promises");
    vi.unstubAllGlobals();
  });

  it("reports OFFLINE for an unsafe URL without ever calling fetch", async () => {
    vi.doMock("node:dns/promises", () => ({ default: { lookup: vi.fn().mockResolvedValue([{ address: "127.0.0.1", family: 4 }]) } }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { performMonitoringCheck } = await import("@/lib/monitoring/safeFetch");
    const result = await performMonitoringCheck("http://localhost/");

    expect(result.healthy).toBe(false);
    expect(result.status).toBe("OFFLINE");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports HEALTHY for a fast 2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const { performMonitoringCheck } = await import("@/lib/monitoring/safeFetch");
    const result = await performMonitoringCheck("https://example.com/");

    expect(result.healthy).toBe(true);
    expect(result.status).toBe("HEALTHY");
    expect(result.statusCode).toBe(200);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.redirect).toBe("manual");
  });

  it("reports DEGRADED (not followed) for a redirect response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 302 });
    vi.stubGlobal("fetch", fetchMock);

    const { performMonitoringCheck } = await import("@/lib/monitoring/safeFetch");
    const result = await performMonitoringCheck("https://example.com/");

    expect(result.status).toBe("DEGRADED");
    expect(result.healthy).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports OFFLINE for a non-2xx, non-redirect response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const { performMonitoringCheck } = await import("@/lib/monitoring/safeFetch");
    const result = await performMonitoringCheck("https://example.com/");

    expect(result.status).toBe("OFFLINE");
    expect(result.statusCode).toBe(500);
  });

  it("reports OFFLINE with a timeout message when the request is aborted", async () => {
    const fetchMock = vi.fn().mockImplementation(() => {
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      return Promise.reject(error);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { performMonitoringCheck } = await import("@/lib/monitoring/safeFetch");
    const result = await performMonitoringCheck("https://example.com/", { timeoutMs: 50 });

    expect(result.status).toBe("OFFLINE");
    expect(result.message).toMatch(/timed out/i);
  });
});
