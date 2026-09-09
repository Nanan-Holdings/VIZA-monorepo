import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VnSubmissionResult } from "@/lib/submission-result";
import { VnResultCard } from "../VnResultCard";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function createResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const paymentResult: VnSubmissionResult = {
  country: "VN",
  status: "stopped_at_pay",
  mode: "live_assisted",
  provider: "vietnam_evisa_live",
  checkpoint: "payment_page_visible",
  portalUrl: "https://evisa.gov.vn/e-visa/foreigners",
  paymentStatus: "manual_required",
};

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function advanceAndFlush(milliseconds: number) {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);
    await Promise.resolve();
    await Promise.resolve();
  });
}

function setVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
}

function statusRequestCount(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([input]) =>
    String(input).endsWith("/official-fee/status"),
  ).length;
}

describe("VnResultCard payment status polling", () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(document, "visibilityState");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("coalesces visibility resume while fetch and its response body are pending", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const response = deferred<ReturnType<typeof createResponse>>();
    const body = deferred<Record<string, unknown>>();
    const fetchMock = vi.fn(() => response.promise);
    vi.stubGlobal("fetch", fetchMock);

    render(<VnResultCard applicationId="app-vn" result={paymentResult} />);
    expect(statusRequestCount(fetchMock)).toBe(1);

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await advanceAndFlush(0);
    expect(statusRequestCount(fetchMock)).toBe(1);

    response.resolve(createResponse(body.promise));
    await flushEffects();
    expect(statusRequestCount(fetchMock)).toBe(1);

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await advanceAndFlush(0);
    expect(statusRequestCount(fetchMock)).toBe(1);

    body.resolve({ paymentQueued: false });
    await flushEffects();
    await advanceAndFlush(4_999);
    expect(statusRequestCount(fetchMock)).toBe(1);
    await advanceAndFlush(1);
    expect(statusRequestCount(fetchMock)).toBe(2);
  });

  it("aborts the owned request at its deadline and does not schedule after cleanup", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const request = deferred<ReturnType<typeof createResponse>>();
    let signal: AbortSignal | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return request.promise;
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(<VnResultCard applicationId="app-vn" result={paymentResult} />);
    expect(signal).toBeDefined();
    await advanceAndFlush(5_000);
    expect(signal?.aborted).toBe(true);

    view.unmount();
    request.resolve(createResponse({ paymentQueued: false }));
    await flushEffects();
    await advanceAndFlush(60_000);
    expect(statusRequestCount(fetchMock)).toBe(1);
  });

  it("stops polling after a paid status response", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        paymentQueued: false,
        receipt: { receipt_number: "VN-PAID-1" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<VnResultCard applicationId="app-vn" result={paymentResult} />);
    await flushEffects();
    expect(statusRequestCount(fetchMock)).toBe(1);
    await advanceAndFlush(60_000);
    expect(statusRequestCount(fetchMock)).toBe(1);
  });
});
