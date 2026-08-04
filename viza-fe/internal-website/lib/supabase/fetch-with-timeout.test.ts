import { afterEach, describe, expect, it, vi } from "vitest";
import { createFetchWithTimeout } from "./fetch-with-timeout";

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
