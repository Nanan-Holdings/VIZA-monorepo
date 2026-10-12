import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WaitingCard } from "../WaitingCard";

vi.mock("next-intl", () => ({ useLocale: () => "en" }));
vi.mock("@/hooks/use-smooth-progress", () => ({
  useSmoothProgress: () => ({ displayedProgress: 34, isVisuallyComplete: false }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

function response(body: unknown) {
  return { ok: true, json: async () => body };
}

function setVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function advance(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

const account = {
  email: "synthetic@viza.test",
  password: null,
  portalUrl: "https://example.test/official-portal",
  updatedAt: null,
};

describe("WaitingCard France account polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("keeps one request through slow fetch and body reads despite repeated visibility resume", async () => {
    const headers = deferred<ReturnType<typeof response>>();
    const body = deferred<unknown>();
    const fetchMock = vi.fn().mockReturnValueOnce(headers.promise)
      .mockResolvedValue(response({ account: null }));
    vi.stubGlobal("fetch", fetchMock);
    render(<WaitingCard status="processing" applicationId="synthetic-fr" country="FR" />);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    for (let index = 0; index < 3; index += 1) {
      setVisibility("hidden");
      setVisibility("visible");
      await advance();
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    headers.resolve(response(body.promise));
    await advance();
    setVisibility("hidden");
    setVisibility("visible");
    await advance();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    body.resolve({ account: null });
    await advance();
    await advance(9_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cancels the pending request at its deadline and ignores late completion after unmount", async () => {
    const pending = deferred<ReturnType<typeof response>>();
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<WaitingCard status="processing" applicationId="synthetic-fr" country="france" />);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    await advance(4_000);
    setVisibility("hidden");
    setVisibility("visible");
    await advance();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1_000);
    expect(signal?.aborted).toBe(true);
    view.unmount();
    pending.resolve(response({ account }));
    await advance(60_000);
    setVisibility("visible");
    await advance();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(account.email)).not.toBeInTheDocument();
  });

  it("aborts on cleanup before the deadline and clears scheduled polls", async () => {
    const body = deferred<unknown>();
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(response(body.promise)));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<WaitingCard status="processing" applicationId="synthetic-fr" country="FR" />);
    await advance();
    const signal = fetchMock.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    body.resolve({ account: null });
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("pauses while hidden, refreshes on return, and stops once the account is available", async () => {
    setVisibility("hidden");
    const fetchMock = vi.fn().mockResolvedValue(response({ account }));
    vi.stubGlobal("fetch", fetchMock);
    render(<WaitingCard status="processing" applicationId="synthetic-fr" country="FR" />);
    await advance(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
    setVisibility("visible");
    await advance();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(account.email)).toBeInTheDocument();
    setVisibility("hidden");
    setVisibility("visible");
    await advance(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not load an account outside the France application context", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<WaitingCard status="processing" applicationId="synthetic-vn" country="VN" />);
    await advance(60_000);
    view.rerender(<WaitingCard status="processing" country="FR" />);
    await advance(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
