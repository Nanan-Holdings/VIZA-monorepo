import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentStatusPoller } from "../payment-status-poller";

vi.mock("@/hooks/use-smooth-progress", () => ({
  useSmoothProgress: () => ({
    displayedProgress: 92,
    isVisuallyComplete: false,
    isComplete: false,
    isFailed: false,
    isWaitingForUser: false,
  }),
}));

type PollStatus = "pending" | "paid" | "failed";
type PollPayload = { status?: PollStatus };

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

function setVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
}

function dispatchVisibility(value: "visible" | "hidden") {
  setVisibility(value);
  document.dispatchEvent(new Event("visibilitychange"));
}

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

function statusRequestCount(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([input]) =>
    String(input).includes("/api/payments/status/"),
  ).length;
}

describe("PaymentStatusPoller", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it.each([
    ["paid", "paid", "支付已确认，可以返回订阅页查看状态。"],
    ["failed", "failed", "支付记录不可用，请返回订阅页重新发起。"],
  ] as const)(
    "latches a %s terminal response across visibility changes",
    async (_label, status, terminalMessage) => {
      vi.useFakeTimers();
      setVisibility("visible");
      const fetchMock = vi.fn().mockResolvedValue(createResponse({ status }));
      vi.stubGlobal("fetch", fetchMock);

      render(<PaymentStatusPoller paymentId="payment-terminal" />);
      await flushEffects();
      expect(statusRequestCount(fetchMock)).toBe(1);
      expect(screen.getByText(terminalMessage)).toBeInTheDocument();

      for (let index = 0; index < 3; index += 1) {
        dispatchVisibility("hidden");
        dispatchVisibility("visible");
        await advanceAndFlush(0);
      }
      await advanceAndFlush(60_000);

      expect(statusRequestCount(fetchMock)).toBe(1);
      expect(screen.getByText(terminalMessage)).toBeInTheDocument();
    },
  );

  it("continues pending polling every three seconds", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ status: "pending" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<PaymentStatusPoller paymentId="payment-pending" />);
    await flushEffects();
    expect(statusRequestCount(fetchMock)).toBe(1);

    await advanceAndFlush(2_999);
    expect(statusRequestCount(fetchMock)).toBe(1);
    await advanceAndFlush(1);
    expect(statusRequestCount(fetchMock)).toBe(2);
  });

  it("backs off failures at six, twelve, twenty-four, then thirty seconds", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const fetchMock = vi.fn().mockRejectedValue(new Error("synthetic network failure"));
    vi.stubGlobal("fetch", fetchMock);

    render(<PaymentStatusPoller paymentId="payment-retry" />);
    await flushEffects();
    expect(statusRequestCount(fetchMock)).toBe(1);

    const checkpoints = [
      [5_999, 1],
      [1, 2],
      [11_999, 2],
      [1, 3],
      [23_999, 3],
      [1, 4],
      [29_999, 4],
      [1, 5],
    ] as const;
    for (const [milliseconds, expectedRequests] of checkpoints) {
      await advanceAndFlush(milliseconds);
      expect(statusRequestCount(fetchMock)).toBe(expectedRequests);
    }
  });

  it("does not overlap a pending fetch or response body after visibility resume", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const response = deferred<ReturnType<typeof createResponse>>();
    const body = deferred<PollPayload>();
    const fetchMock = vi.fn(() => response.promise);
    vi.stubGlobal("fetch", fetchMock);

    render(<PaymentStatusPoller paymentId="payment-slow" />);
    expect(statusRequestCount(fetchMock)).toBe(1);

    dispatchVisibility("hidden");
    dispatchVisibility("visible");
    await advanceAndFlush(0);
    expect(statusRequestCount(fetchMock)).toBe(1);

    response.resolve(createResponse(body.promise));
    await flushEffects();
    dispatchVisibility("hidden");
    dispatchVisibility("visible");
    await advanceAndFlush(0);
    expect(statusRequestCount(fetchMock)).toBe(1);

    body.resolve({ status: "pending" });
    await flushEffects();
    await advanceAndFlush(2_999);
    expect(statusRequestCount(fetchMock)).toBe(1);
    await advanceAndFlush(1);
    expect(statusRequestCount(fetchMock)).toBe(2);
  });

  it("aborts on cleanup and ignores late completion without rescheduling", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const request = deferred<ReturnType<typeof createResponse>>();
    let requestSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return request.promise;
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(<PaymentStatusPoller paymentId="payment-cleanup" />);
    expect(statusRequestCount(fetchMock)).toBe(1);
    expect(requestSignal?.aborted).toBe(false);

    view.unmount();
    expect(requestSignal?.aborted).toBe(true);
    request.resolve(createResponse({ status: "pending" }));
    await flushEffects();
    dispatchVisibility("visible");
    await advanceAndFlush(60_000);

    expect(statusRequestCount(fetchMock)).toBe(1);
  });

  it("starts a fresh request for a new payment and ignores the old late response", async () => {
    vi.useFakeTimers();
    setVisibility("visible");
    const oldRequest = deferred<ReturnType<typeof createResponse>>();
    const newRequest = deferred<ReturnType<typeof createResponse>>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      return String(input).endsWith("payment-old") ? oldRequest.promise : newRequest.promise;
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(<PaymentStatusPoller paymentId="payment-old" />);
    expect(statusRequestCount(fetchMock)).toBe(1);

    view.rerender(<PaymentStatusPoller paymentId="payment-new" />);
    await flushEffects();
    expect(statusRequestCount(fetchMock)).toBe(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("payment-new");

    oldRequest.resolve(createResponse({ status: "paid" }));
    await flushEffects();
    expect(screen.getByText("等待微信支付确认，页面会自动刷新状态。")).toBeInTheDocument();

    newRequest.resolve(createResponse({ status: "pending" }));
    await flushEffects();
    expect(screen.getByText("等待微信支付确认，页面会自动刷新状态。")).toBeInTheDocument();

    view.unmount();
  });

  it.each(["paid", "failed"] as const)(
    "resets the %s terminal latch for a new payment ID",
    async (terminalStatus) => {
      vi.useFakeTimers();
      setVisibility("visible");
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(createResponse({ status: terminalStatus }))
        .mockResolvedValue(createResponse({ status: "pending" }));
      vi.stubGlobal("fetch", fetchMock);

      const view = render(<PaymentStatusPoller paymentId="payment-old" />);
      await flushEffects();
      expect(statusRequestCount(fetchMock)).toBe(1);

      dispatchVisibility("hidden");
      dispatchVisibility("visible");
      await advanceAndFlush(60_000);
      expect(statusRequestCount(fetchMock)).toBe(1);

      view.rerender(<PaymentStatusPoller paymentId="payment-new" />);
      await flushEffects();
      expect(statusRequestCount(fetchMock)).toBe(2);
      expect(String(fetchMock.mock.calls[1]?.[0])).toContain("payment-new");
      expect(screen.getByText("等待微信支付确认，页面会自动刷新状态。")).toBeInTheDocument();

      await advanceAndFlush(2_999);
      expect(statusRequestCount(fetchMock)).toBe(2);
      await advanceAndFlush(1);
      expect(statusRequestCount(fetchMock)).toBe(3);
    },
  );
});
