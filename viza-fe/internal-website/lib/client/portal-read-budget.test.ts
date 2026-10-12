import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLIENT_PORTAL_READ_BUDGET_MS,
  createPortalReadBudget,
} from "./portal-read-budget.server";

afterEach(() => {
  vi.useRealTimers();
});

describe("portal read budget", () => {
  it("aborts at the configured deadline and reports a timeout", () => {
    vi.useFakeTimers();
    const budget = createPortalReadBudget(100);

    expect(CLIENT_PORTAL_READ_BUDGET_MS).toBe(8_000);
    expect(budget.signal.aborted).toBe(false);
    expect(budget.didTimeout()).toBe(false);

    vi.advanceTimersByTime(99);
    expect(budget.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);

    expect(budget.signal.aborted).toBe(true);
    expect(budget.signal.reason).toMatchObject({ name: "TimeoutError" });
    expect(budget.didTimeout()).toBe(true);
    budget.dispose();
  });

  it("removes the upstream listener and timer when disposed", () => {
    vi.useFakeTimers();
    const upstream = new AbortController();
    const budget = createPortalReadBudget(100, upstream.signal);

    budget.dispose();
    upstream.abort(new DOMException("caller cancelled", "AbortError"));
    vi.advanceTimersByTime(100);

    expect(budget.signal.aborted).toBe(false);
    expect(budget.didTimeout()).toBe(false);
    budget.dispose();
  });

  it("preserves an upstream cancellation cause without converting it to a timeout", () => {
    vi.useFakeTimers();
    const upstream = new AbortController();
    const budget = createPortalReadBudget(100, upstream.signal);

    upstream.abort(new DOMException("caller cancelled", "AbortError"));
    vi.advanceTimersByTime(100);

    expect(budget.signal.aborted).toBe(true);
    expect(budget.signal.reason).toMatchObject({ name: "AbortError" });
    expect(budget.didTimeout()).toBe(false);
    budget.dispose();
  });
});
