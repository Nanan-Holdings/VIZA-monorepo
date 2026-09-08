import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubmissionStatusStep } from "../SubmissionStatusStep";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

// The polling contract is independent of the animated progress UI. Keeping the
// card inert makes timer assertions cover only the status request effect.
vi.mock("../WaitingCard", () => ({
  WaitingCard: () => <div data-testid="waiting-card" />,
}));

type Snapshot = {
  status: string;
  stage: string;
  progress: number;
  result: unknown;
  error: string | null;
  message: string;
  updatedAt: string;
  applicationStatus: string;
  country: string;
  visaType: string;
  queue: {
    id: string;
    status: string;
    mode: string;
    provider: string;
    currentStage: string;
    heartbeatAt: string;
    fieldFallbacks: unknown[];
    createdAt: string;
    updatedAt: string;
  } | null;
};

function createSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    status: "running",
    stage: "filling_form",
    progress: 50,
    result: null,
    error: null,
    message: "The worker is filling the official form.",
    updatedAt: "2026-09-08T00:00:00.000Z",
    applicationStatus: "processing",
    country: "france",
    visaType: "FR_SCHENGEN_C_SHORT_STAY",
    queue: null,
    ...overrides,
  };
}

function createQueue(overrides: Partial<NonNullable<Snapshot["queue"]>> = {}) {
  return {
    id: "queue-1",
    status: "processing",
    mode: "live_assisted",
    provider: "france_visas_live",
    currentStage: "filling_form",
    heartbeatAt: "2026-09-08T00:00:00.000Z",
    fieldFallbacks: [],
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
    ...overrides,
  };
}

function createResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function statusRequestCount(fetchMock: ReturnType<typeof vi.fn>): number {
  return fetchMock.mock.calls.filter(([input]) =>
    String(input).endsWith("/submission-status"),
  ).length;
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

function setVisibility(value: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
}

function renderActiveSubmission() {
  return render(
    <SubmissionStatusStep
      applicationId="application-id"
      country="france"
      visaType="FR_SCHENGEN_C_SHORT_STAY"
      status="waiting"
      result={null}
    />,
  );
}

describe("SubmissionStatusStep status polling", () => {
  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(document, "visibilityState");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("backs off unchanged successful snapshots at 5, 10, 20, then 30 seconds", async () => {
    vi.useFakeTimers();
    const snapshot = createSnapshot();
    const fetchMock = vi.fn().mockResolvedValue(createResponse(snapshot));
    vi.stubGlobal("fetch", fetchMock);

    renderActiveSubmission();
    await flushEffects();
    expect(statusRequestCount(fetchMock)).toBe(1);

    for (const [delay, expectedCalls] of [
      [5_000, 2],
      [10_000, 3],
      [20_000, 4],
      [30_000, 5],
    ] as const) {
      await advanceAndFlush(delay);
      expect(statusRequestCount(fetchMock)).toBe(expectedCalls);
    }

    await advanceAndFlush(29_999);
    expect(statusRequestCount(fetchMock)).toBe(5);
    await advanceAndFlush(1);
    expect(statusRequestCount(fetchMock)).toBe(6);
  });

  const resetCases: Array<[string, (snapshot: Snapshot) => Snapshot]> = [
    ["status", (snapshot) => ({ ...snapshot, status: "queued" })],
    ["stage", (snapshot) => ({ ...snapshot, stage: "submitting_form" })],
    ["progress", (snapshot) => ({ ...snapshot, progress: 51 })],
    ["message", (snapshot) => ({ ...snapshot, message: "A new worker stage started." })],
    ["result", (snapshot) => ({ ...snapshot, result: { marker: "new-result" } })],
    ["error", (snapshot) => ({ ...snapshot, error: "temporary provider warning" })],
    ["applicationStatus", (snapshot) => ({ ...snapshot, applicationStatus: "waiting" })],
    ["country", (snapshot) => ({ ...snapshot, country: "germany" })],
    ["visaType", (snapshot) => ({ ...snapshot, visaType: "DE_SCHENGEN_C_SHORT_STAY" })],
    ["queue identity", (snapshot) => ({ ...snapshot, queue: createQueue({ id: "queue-2" }) })],
    ["queue status", (snapshot) => ({ ...snapshot, queue: createQueue({ status: "done" }) })],
    ["queue mode", (snapshot) => ({ ...snapshot, queue: createQueue({ mode: "dry_run" }) })],
    ["queue provider", (snapshot) => ({ ...snapshot, queue: createQueue({ provider: "other_provider" }) })],
    ["queue currentStage", (snapshot) => ({ ...snapshot, queue: createQueue({ currentStage: "confirming_result" }) })],
    ["queue fieldFallbacks", (snapshot) => ({ ...snapshot, queue: createQueue({ fieldFallbacks: ["field_a"] }) })],
  ];

  for (const [label, mutate] of resetCases) {
    it(`resets the next poll to five seconds when ${label} changes`, async () => {
      vi.useFakeTimers();
      const initial = createSnapshot({ queue: createQueue() });
      const changedSnapshot = mutate(initial);
      let returnChangedSnapshot = false;
      const fetchMock = vi.fn().mockImplementation(() => {
        return Promise.resolve(
          createResponse(returnChangedSnapshot ? changedSnapshot : initial),
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      renderActiveSubmission();
      await flushEffects();
      expect(statusRequestCount(fetchMock)).toBeGreaterThanOrEqual(1);

      // Warm the adaptive backoff before changing the snapshot. This keeps the
      // assertion meaningful even while the component's first queue snapshot
      // is being adopted by the effect.
      await advanceAndFlush(5_000);
      await advanceAndFlush(10_000);
      const callsBeforeChange = statusRequestCount(fetchMock);
      expect(callsBeforeChange).toBeGreaterThanOrEqual(3);

      // The first response after the warm-up is the changed snapshot. Keep the
      // sequence explicit so the test proves a 5-second reset after a stable
      // 20-second interval, instead of passing on the initial 5-second delay.
      returnChangedSnapshot = true;

      await advanceAndFlush(20_000);
      expect(statusRequestCount(fetchMock)).toBe(callsBeforeChange + 1);
      await advanceAndFlush(4_999);
      expect(statusRequestCount(fetchMock)).toBe(callsBeforeChange + 1);
      await advanceAndFlush(1);
      expect(statusRequestCount(fetchMock)).toBe(callsBeforeChange + 2);
    });
  }

  it("does not reset stable backoff for heartbeat and updated timestamp changes alone", async () => {
    vi.useFakeTimers();
    const initial = createSnapshot({ queue: createQueue() });
    const timestampOnly = createSnapshot({
      updatedAt: "2026-09-08T00:00:01.000Z",
      queue: createQueue({
        heartbeatAt: "2026-09-08T00:00:01.000Z",
        updatedAt: "2026-09-08T00:00:01.000Z",
      }),
    });
    let changed = false;
    const fetchMock = vi.fn().mockImplementation(() => {
      const body = changed ? timestampOnly : initial;
      return Promise.resolve(createResponse(body));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderActiveSubmission();
    await flushEffects();
    await advanceAndFlush(5_000);
    await advanceAndFlush(10_000);
    const callsBeforeTimestampChange = statusRequestCount(fetchMock);
    changed = true;
    await advanceAndFlush(20_000);
    expect(statusRequestCount(fetchMock)).toBe(callsBeforeTimestampChange + 1);
    await advanceAndFlush(29_999);
    expect(statusRequestCount(fetchMock)).toBe(callsBeforeTimestampChange + 1);
    await advanceAndFlush(1);
    expect(statusRequestCount(fetchMock)).toBe(callsBeforeTimestampChange + 2);
  });

  it("does not start status requests while hidden and refreshes immediately on visibility resume", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(createResponse(createSnapshot()));
    vi.stubGlobal("fetch", fetchMock);
    setVisibility("visible");

    renderActiveSubmission();
    await flushEffects();
    expect(statusRequestCount(fetchMock)).toBe(1);

    setVisibility("hidden");
    await advanceAndFlush(60_000);
    expect(statusRequestCount(fetchMock)).toBe(1);

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await flushEffects();
    expect(statusRequestCount(fetchMock)).toBe(2);

    // The timer that was pending before the tab resumed must be cleared; it
    // must not cause a second request one millisecond later.
    await advanceAndFlush(1);
    expect(statusRequestCount(fetchMock)).toBe(2);
  });

  it("keeps one request in flight at a time", async () => {
    vi.useFakeTimers();
    let resolveRequest: ((response: unknown) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderActiveSubmission();
    expect(statusRequestCount(fetchMock)).toBe(1);
    await advanceAndFlush(60_000);
    expect(statusRequestCount(fetchMock)).toBe(1);

    resolveRequest?.(createResponse(createSnapshot()));
    await flushEffects();
    await advanceAndFlush(5_000);
    expect(statusRequestCount(fetchMock)).toBe(2);
    await advanceAndFlush(60_000);
    expect(statusRequestCount(fetchMock)).toBe(2);
  });

  it("coalesces a visibility resume behind an in-flight request and refreshes after it settles", async () => {
    vi.useFakeTimers();
    const resolvers: Array<(response: unknown) => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderActiveSubmission();
    expect(statusRequestCount(fetchMock)).toBe(1);

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await flushEffects();
    expect(statusRequestCount(fetchMock)).toBe(1);

    resolvers.shift()?.(createResponse(createSnapshot()));
    await flushEffects();
    expect(statusRequestCount(fetchMock)).toBe(2);

    // The immediate refresh is now the only in-flight request; the resumed
    // tab must not create another request while it remains unresolved.
    await advanceAndFlush(60_000);
    expect(statusRequestCount(fetchMock)).toBe(2);
  });

  it("aborts the pending request on unmount and does not schedule another one", async () => {
    vi.useFakeTimers();
    let abortCount = 0;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          abortCount += 1;
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const view = renderActiveSubmission();
    expect(statusRequestCount(fetchMock)).toBe(1);
    view.unmount();
    await flushEffects();
    await advanceAndFlush(60_000);

    expect(abortCount).toBe(1);
    expect(statusRequestCount(fetchMock)).toBe(1);
  });

  it("keeps authentication failure stopped across visibility changes", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(createResponse({ error: "Not authenticated" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    renderActiveSubmission();
    await flushEffects();
    expect(statusRequestCount(fetchMock)).toBe(1);

    setVisibility("hidden");
    await advanceAndFlush(30_000);
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await flushEffects();
    await advanceAndFlush(30_000);

    expect(statusRequestCount(fetchMock)).toBe(1);
  });
});
