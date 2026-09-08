import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createFetchWithTimeout,
  createFetchWithTransientRetry,
  isTransientSupabaseSchemaCacheError,
  retryTransientSupabaseResult,
} from "./fetch-with-timeout";
import {
  getSupabaseCircuitBreaker,
  type SupabaseCircuitBreaker,
} from "./circuit-breaker";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function uniqueScope(): string {
  return `fetch-with-timeout-test-${crypto.randomUUID()}`;
}

function openCircuit(scope: string): SupabaseCircuitBreaker {
  vi.useFakeTimers();
  const circuit = getSupabaseCircuitBreaker(scope);
  for (let attempt = 0; attempt < 5; attempt += 1) circuit.recordFailure();
  expect(circuit.snapshot().state).toBe("open");
  vi.advanceTimersByTime(20_000);
  expect(circuit.snapshot().state).toBe("half_open");
  return circuit;
}

function pendingFetchThatRejectsOnAbort(reason: unknown) {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(reason), { once: true });
    }),
  );
}

function pendingFetchThatRejectsWithSignal() {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  );
}

function requestWithSignal(url: string, signal: AbortSignal): Request {
  const request = new Request(url);
  Object.defineProperty(request, "signal", { configurable: true, value: signal });
  return request;
}

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

  it("keeps an upstream abort connected to the response body after headers arrive", async () => {
    const controller = new AbortController();
    const reason = new Error("request cancelled while reading body");
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(streamController) {
          init?.signal?.addEventListener(
            "abort",
            () => streamController.error(init.signal?.reason),
            { once: true },
          );
        },
      });
      return Promise.resolve(new Response(body));
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await createFetchWithTimeout(1_000)("https://example.test", {
      signal: controller.signal,
    });
    const body = response.text();
    controller.abort(reason);

    await expect(body).rejects.toBe(reason);
  });

  it("preserves per-call cancellation when AbortSignal.any is unavailable", async () => {
    const anyDescriptor = Object.getOwnPropertyDescriptor(AbortSignal, "any");
    Object.defineProperty(AbortSignal, "any", { configurable: true, value: undefined });
    try {
      const controller = new AbortController();
      const reason = new DOMException("cancelled", "AbortError");
      const fetchMock = pendingFetchThatRejectsWithSignal();
      vi.stubGlobal("fetch", fetchMock);
      const pending = createFetchWithTimeout(1_000)("https://example.test", {
        signal: controller.signal,
      });

      controller.abort(reason);
      await expect(pending).rejects.toBe(reason);
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      if (anyDescriptor) Object.defineProperty(AbortSignal, "any", anyDescriptor);
    }
  });

  it("honors a pre-aborted Request signal without invoking fetch", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("cancelled", "AbortError"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createFetchWithTimeout(1_000)(requestWithSignal("https://example.test", controller.signal)),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("honors a Request object's signal through timeout and retry wrappers", async () => {
    const reason = new DOMException("cancelled", "AbortError");
    const fetchMock = pendingFetchThatRejectsOnAbort(reason);
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const request = requestWithSignal("https://example.test/rest/v1/applications", controller.signal);
    const pending = createFetchWithTransientRetry({
      requestTimeoutMs: 1_000,
      retryDelaysMs: [],
      circuitBreakerScope: null,
    })(request);

    expect(fetchMock).toHaveBeenCalledOnce();
    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);
  });

  it("aborts all requests from a request-wide signal, including an auth request", async () => {
    const controller = new AbortController();
    const reason = new DOMException("request cancelled", "AbortError");
    const fetchMock = pendingFetchThatRejectsWithSignal();
    vi.stubGlobal("fetch", fetchMock);
    const resilientFetch = createFetchWithTransientRetry({
      requestSignal: controller.signal,
      retryDelaysMs: [],
      circuitBreakerScope: null,
    });

    const dataRequest = resilientFetch("https://example.test/rest/v1/applications");
    const authRequest = resilientFetch("https://example.test/auth/v1/token", { method: "POST" });
    const dataRejected = expect(dataRequest).rejects.toBe(reason);
    const authRejected = expect(authRequest).rejects.toBe(reason);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    controller.abort(reason);
    await Promise.all([dataRejected, authRejected]);
  });

  it("keeps per-call cancellation local while preserving the request-wide signal for siblings", async () => {
    const requestController = new AbortController();
    const globalController = new AbortController();
    const requestReason = new DOMException("one request cancelled", "AbortError");
    const globalReason = new DOMException("request scope cancelled", "AbortError");
    const fetchMock = pendingFetchThatRejectsWithSignal();
    vi.stubGlobal("fetch", fetchMock);
    const resilientFetch = createFetchWithTransientRetry({
      requestSignal: globalController.signal,
      retryDelaysMs: [],
      circuitBreakerScope: null,
    });

    const request = resilientFetch("https://example.test/rest/v1/first", {
      signal: requestController.signal,
    });
    const sibling = resilientFetch("https://example.test/rest/v1/second");
    const requestRejected = expect(request).rejects.toBe(requestReason);
    const siblingRejected = expect(sibling).rejects.toBe(globalReason);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    requestController.abort(requestReason);
    await requestRejected;
    expect(globalController.signal.aborted).toBe(false);

    globalController.abort(globalReason);
    await siblingRejected;
  });

  it("composes a Request object's signal with the request-wide signal", async () => {
    const globalController = new AbortController();
    const requestController = new AbortController();
    const reason = new DOMException("request scope cancelled", "AbortError");
    const fetchMock = pendingFetchThatRejectsWithSignal();
    vi.stubGlobal("fetch", fetchMock);
    const resilientFetch = createFetchWithTransientRetry({
      requestSignal: globalController.signal,
      retryDelaysMs: [],
      circuitBreakerScope: null,
    });
    const request = requestWithSignal("https://example.test/rest/v1/applications", requestController.signal);
    const pending = resilientFetch(request);
    const rejected = expect(pending).rejects.toBe(reason);

    globalController.abort(reason);
    await rejected;
    expect(requestController.signal.aborted).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not invoke fetch for a pre-aborted request-wide signal", async () => {
    const controller = new AbortController();
    const reason = new DOMException("request scope cancelled", "AbortError");
    controller.abort(reason);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createFetchWithTransientRetry({
        requestSignal: controller.signal,
        circuitBreakerScope: null,
      })("https://example.test/rest/v1/applications"),
    ).rejects.toBe(reason);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not start another attempt when a request-wide signal aborts during retry wait", async () => {
    const controller = new AbortController();
    const reason = new DOMException("request scope cancelled", "AbortError");
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const resilientFetch = createFetchWithTransientRetry({
      requestSignal: controller.signal,
      retryDelaysMs: [20_000],
      circuitBreakerScope: null,
    });

    const pending = resilientFetch("https://example.test/rest/v1/applications");
    const rejected = expect(pending).rejects.toBe(reason);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledOnce();
    controller.abort(reason);

    await rejected;
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    new DOMException("deadline", "TimeoutError"),
    new TypeError("request cancelled"),
  ])("does not convert external cancellation (%s) into a circuit failure or 503", async (reason) => {
    const scope = uniqueScope();
    const circuit = getSupabaseCircuitBreaker(scope);
    const controller = new AbortController();
    const fetchMock = pendingFetchThatRejectsOnAbort(reason);
    vi.stubGlobal("fetch", fetchMock);
    const pending = createFetchWithTransientRetry({
      retryDelaysMs: [],
      circuitBreakerScope: scope,
      returnUnavailableResponse: true,
    })("https://example.test/rest/v1/applications", { signal: controller.signal });

    expect(fetchMock).toHaveBeenCalledOnce();
    controller.abort(reason);
    await expect(pending).rejects.toBe(reason);
    expect(circuit.snapshot()).toMatchObject({ state: "closed", consecutiveFailures: 0 });
  });

  it("releases a cancelled half-open fetch permit for the next probe", async () => {
    const scope = uniqueScope();
    const circuit = openCircuit(scope);
    const controller = new AbortController();
    const firstReason = new DOMException("cancelled", "AbortError");
    const firstFetch = deferred<Response>();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (fetchMock.mock.calls.length === 1) {
        init?.signal?.addEventListener("abort", () => firstFetch.reject(firstReason), { once: true });
        return firstFetch.promise;
      }
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const resilientFetch = createFetchWithTransientRetry({
      retryDelaysMs: [],
      circuitBreakerScope: scope,
    });

    const firstProbe = resilientFetch("https://example.test/rest/v1/applications", {
      signal: controller.signal,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    controller.abort(firstReason);
    await expect(firstProbe).rejects.toBe(firstReason);
    expect(circuit.snapshot().state).toBe("half_open");

    await expect(resilientFetch("https://example.test/rest/v1/applications")).resolves.toMatchObject({
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(circuit.snapshot().state).toBe("closed");
  });

  it("releases a half-open permit when cancellation interrupts a 503 retry delay", async () => {
    const scope = uniqueScope();
    const circuit = openCircuit(scope);
    const controller = new AbortController();
    const reason = new DOMException("cancelled", "AbortError");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const resilientFetch = createFetchWithTransientRetry({
      retryDelaysMs: [20_000],
      circuitBreakerScope: scope,
    });

    const firstProbe = resilientFetch("https://example.test/rest/v1/applications", {
      signal: controller.signal,
    });
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledOnce();
    controller.abort(reason);
    await expect(firstProbe).rejects.toBe(reason);
    expect(circuit.snapshot().state).toBe("half_open");

    await expect(resilientFetch("https://example.test/rest/v1/applications")).resolves.toMatchObject({
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(circuit.snapshot().state).toBe("closed");
  });

  it("releases a half-open permit for a non-network error without recording a circuit failure", async () => {
    const scope = uniqueScope();
    const circuit = openCircuit(scope);
    const error = new Error("unexpected application error");
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const resilientFetch = createFetchWithTransientRetry({
      retryDelaysMs: [],
      circuitBreakerScope: scope,
    });

    await expect(resilientFetch("https://example.test/rest/v1/applications")).rejects.toBe(error);
    expect(circuit.snapshot()).toMatchObject({ state: "half_open", consecutiveFailures: 5 });

    await expect(resilientFetch("https://example.test/rest/v1/applications")).resolves.toMatchObject({
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(circuit.snapshot().state).toBe("closed");
  });

  it("allows one half-open probe from a 100-request burst, then admits a replacement after cancellation", async () => {
    const scope = uniqueScope();
    const circuit = openCircuit(scope);
    const controller = new AbortController();
    const firstReason = new DOMException("cancelled", "AbortError");
    const firstFetch = deferred<Response>();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (fetchMock.mock.calls.length === 1) {
        init?.signal?.addEventListener("abort", () => firstFetch.reject(firstReason), { once: true });
        return firstFetch.promise;
      }
      return Promise.resolve(new Response("ok", { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const resilientFetch = createFetchWithTransientRetry({
      retryDelaysMs: [],
      circuitBreakerScope: scope,
      returnUnavailableResponse: true,
    });

    const firstProbe = resilientFetch("https://example.test/rest/v1/applications", {
      signal: controller.signal,
    });
    const burst = Array.from({ length: 99 }, () => resilientFetch("https://example.test/rest/v1/applications"));
    expect(fetchMock).toHaveBeenCalledOnce();
    const blocked = await Promise.all(burst);
    expect(blocked).toHaveLength(99);
    expect(blocked.every((response) => response.status === 503)).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();

    controller.abort(firstReason);
    await expect(firstProbe).rejects.toBe(firstReason);
    expect(circuit.snapshot().state).toBe("half_open");

    await expect(resilientFetch("https://example.test/rest/v1/applications")).resolves.toMatchObject({
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(circuit.snapshot().state).toBe("closed");
  });

  it.each(["success", "failure"] as const)(
    "holds a cancelled probe until its late %s settles before admitting a replacement",
    async (lateOutcome) => {
      const scope = uniqueScope();
      const circuit = openCircuit(scope);
      const controller = new AbortController();
      const reason = new DOMException("cancelled", "AbortError");
      const lateProbe = deferred<Response>();
      const activeProbe = deferred<Response>();
      let callCount = 0;
      const fetchMock = vi.fn(() => {
        callCount += 1;
        return callCount === 1 ? lateProbe.promise : activeProbe.promise;
      });
      vi.stubGlobal("fetch", fetchMock);
      const resilientFetch = createFetchWithTransientRetry({
        retryDelaysMs: [],
        circuitBreakerScope: scope,
        returnUnavailableResponse: true,
      });

      const cancelledProbe = resilientFetch("https://example.test/rest/v1/applications", {
        signal: controller.signal,
      });
      expect(fetchMock).toHaveBeenCalledOnce();
      controller.abort(reason);

      await expect(resilientFetch("https://example.test/rest/v1/applications")).resolves.toMatchObject({
        status: 503,
      });
      expect(fetchMock).toHaveBeenCalledOnce();
      if (lateOutcome === "success") {
        lateProbe.resolve(new Response("late", { status: 200 }));
      } else {
        lateProbe.reject(new TypeError("late network failure"));
      }
      await expect(cancelledProbe).rejects.toBe(reason);
      expect(circuit.snapshot().state).toBe("half_open");

      const activeRequest = resilientFetch("https://example.test/rest/v1/applications");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      activeProbe.resolve(new Response("ok", { status: 200 }));
      await expect(activeRequest).resolves.toMatchObject({ status: 200 });
      expect(circuit.snapshot().state).toBe("closed");
    },
  );

  it("returns a retryable 503 instead of throwing a terminal browser network error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await createFetchWithTransientRetry({
      retryDelaysMs: [],
      circuitBreakerScope: null,
      returnUnavailableResponse: true,
    })("https://example.test/auth/v1/token", { method: "POST" });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: "VIZA_SUPABASE_UNAVAILABLE",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("can disable the shared circuit for browser auth's own retry loop", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    const resilientFetch = createFetchWithTransientRetry({
      retryDelaysMs: [],
      circuitBreakerScope: null,
      returnUnavailableResponse: true,
    });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await expect(
        resilientFetch("https://example.test/auth/v1/token", { method: "POST" }),
      ).resolves.toMatchObject({ status: 503 });
    }

    expect(fetchMock).toHaveBeenCalledTimes(6);
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
