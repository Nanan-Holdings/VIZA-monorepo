import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFetchWithTimeout,
  createFetchWithTransientRetry,
  isTransientSupabaseSchemaCacheError,
  retryTransientSupabaseResult,
} from "./fetch-with-timeout";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createFetchWithTimeout", () => {
  it("returns a completed response before the deadline", async () => {
    const response = new Response("ok");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(createFetchWithTimeout(100)("https://example.test")).resolves.toBe(response);
  });

  it("aborts the underlying request when the deadline expires", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true }
          );
        })
      )
    );

    await expect(
      createFetchWithTimeout(5)("https://example.test")
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("forwards an upstream abort signal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason),
            { once: true }
          );
        })
      )
    );

    const controller = new AbortController();
    const request = createFetchWithTimeout(1_000)("https://example.test", {
      signal: controller.signal,
    });
    controller.abort(new DOMException("cancelled", "AbortError"));

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("createFetchWithTransientRetry", () => {
  it("retries a transient PostgREST 503 response for an idempotent read", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await createFetchWithTransientRetry({ retryDelaysMs: [0] })(
      "https://example.test/rest/v1/applications",
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network-level GET failure", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createFetchWithTransientRetry({ retryDelaysMs: [0] })("https://example.test/rest/v1/applications"),
    ).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns the final transient response after the retry budget is exhausted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("unavailable", { status: 520 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await createFetchWithTransientRetry({ retryDelaysMs: [0, 0, 0] })(
      "https://example.test/rest/v1/applications",
    );

    expect(response.status).toBe(520);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not retry mutations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await createFetchWithTransientRetry({ retryDelaysMs: [0, 0, 0] })(
      "https://example.test/rest/v1/applications",
      { method: "POST" },
    );

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not retry an explicitly aborted request", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("cancelled", "AbortError"));
    const fetchMock = vi.fn().mockRejectedValue(controller.signal.reason);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createFetchWithTransientRetry({ retryDelaysMs: [0, 0, 0] })(
        "https://example.test/rest/v1/applications",
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("retryTransientSupabaseResult", () => {
  it("recognizes the PostgREST schema-cache connection error", () => {
    expect(
      isTransientSupabaseSchemaCacheError(
        "Could not query the database for the schema cache. Retrying.",
      ),
    ).toBe(true);
    expect(isTransientSupabaseSchemaCacheError(new Error("PGRST002"))).toBe(true);
    expect(isTransientSupabaseSchemaCacheError("permission denied for table applications")).toBe(false);
  });

  it("retries an opted-in idempotent operation until it succeeds", async () => {
    const operation = vi
      .fn()
      .mockResolvedValueOnce({ error: "PGRST002: schema cache unavailable" })
      .mockResolvedValueOnce({ error: "Could not query the database for the schema cache. Retrying." })
      .mockResolvedValueOnce({ saved: true });

    await expect(retryTransientSupabaseResult(operation, [0, 0])).resolves.toEqual({ saved: true });
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-transient operation error", async () => {
    const operation = vi.fn().mockResolvedValue({ error: "permission denied" });

    await expect(retryTransientSupabaseResult(operation, [0, 0])).resolves.toEqual({ error: "permission denied" });
    expect(operation).toHaveBeenCalledOnce();
  });
});
