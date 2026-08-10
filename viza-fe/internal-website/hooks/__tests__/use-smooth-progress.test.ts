import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSmoothProgress } from "../use-smooth-progress";

describe("useSmoothProgress", () => {
  afterEach(() => {
    vi.useRealTimers();
    window.sessionStorage.clear();
  });

  it("walks from 0 to a jumped server progress one integer at a time", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ serverProgress }) =>
        useSmoothProgress({ serverProgress, status: "running", intervalMs: 16 }),
      { initialProps: { serverProgress: 0 } },
    );

    expect(result.current.displayedProgress).toBe(0);
    rerender({ serverProgress: 92 });

    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(result.current.displayedProgress).toBe(1);

    act(() => {
      vi.advanceTimersByTime(48);
    });
    expect(result.current.displayedProgress).toBe(4);
  });

  it("caps running visual progress at 99 even when the server reports 100", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useSmoothProgress({ serverProgress: 100, status: "running", intervalMs: 16, initialProgress: 98 }),
    );

    act(() => {
      vi.advanceTimersByTime(16);
    });

    expect(result.current.displayedProgress).toBe(99);
    expect(result.current.isVisuallyComplete).toBe(false);
  });

  it("moves to 100 and calls onVisualComplete only after completed status", () => {
    vi.useFakeTimers();
    const onVisualComplete = vi.fn();
    const { result } = renderHook(() =>
      useSmoothProgress({
        serverProgress: 80,
        status: "completed",
        intervalMs: 16,
        initialProgress: 98,
        onVisualComplete,
      }),
    );

    expect(result.current.displayedProgress).toBe(98);
    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(result.current.displayedProgress).toBe(99);
    expect(onVisualComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(16);
    });
    expect(result.current.displayedProgress).toBe(100);
    expect(result.current.isVisuallyComplete).toBe(true);
    expect(onVisualComplete).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5);
    });
    expect(onVisualComplete).toHaveBeenCalledTimes(1);
  });

  it("stops growth when status fails", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useSmoothProgress({ serverProgress: 92, status: "failed", intervalMs: 1, initialProgress: 12 }),
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.displayedProgress).toBe(12);
    expect(result.current.isFailed).toBe(true);
  });

  it("stops growth when user action is required", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useSmoothProgress({
        serverProgress: 92,
        status: "needs_user_action",
        intervalMs: 1,
        initialProgress: 27,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.displayedProgress).toBe(27);
    expect(result.current.isWaitingForUser).toBe(true);
  });

  it("preserves the highest displayed value when a progress view remounts", () => {
    const persistenceKey = "submission:progress-remount-test";
    const first = renderHook(() =>
      useSmoothProgress({
        serverProgress: 55,
        status: "running",
        initialProgress: 42,
        persistenceKey,
      }),
    );

    expect(first.result.current.displayedProgress).toBe(42);
    first.unmount();

    const second = renderHook(() =>
      useSmoothProgress({
        serverProgress: 12,
        status: "running",
        initialProgress: 0,
        persistenceKey,
      }),
    );

    expect(second.result.current.displayedProgress).toBe(42);
    second.unmount();
  });

  it("restores the high-water mark from session storage after a page reload", () => {
    const persistenceKey = "submission:progress-session-reload-test";
    window.sessionStorage.setItem(
      `viza:smooth-progress:${persistenceKey}`,
      "88",
    );

    const { result, unmount } = renderHook(() =>
      useSmoothProgress({
        serverProgress: 12,
        status: "running",
        initialProgress: 0,
        persistenceKey,
      }),
    );

    expect(result.current.displayedProgress).toBe(88);
    unmount();
  });

  it("immediately follows authoritative server progress without ever moving backward", () => {
    const persistenceKey = "submission:authoritative-progress-test";
    const { result, rerender, unmount } = renderHook(
      ({ serverProgress }) =>
        useSmoothProgress({
          serverProgress,
          status: "running",
          persistenceKey,
          syncToServerProgress: true,
        }),
      { initialProps: { serverProgress: 88 } },
    );

    expect(result.current.displayedProgress).toBe(88);

    rerender({ serverProgress: 12 });
    expect(result.current.displayedProgress).toBe(88);
    unmount();

    const remounted = renderHook(() =>
      useSmoothProgress({
        serverProgress: 12,
        status: "running",
        persistenceKey,
        syncToServerProgress: true,
      }),
    );
    expect(remounted.result.current.displayedProgress).toBe(88);
    remounted.unmount();
  });

  it("starts a different submission cycle at zero while preserving one cycle's high-water mark", () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(
      ({ persistenceKey, progressCycleKey }) =>
        useSmoothProgress({
          serverProgress: 88,
          status: "running",
          intervalMs: 16,
          initialProgress: 40,
          persistenceKey,
          progressCycleKey,
        }),
      {
        initialProps: {
          persistenceKey: "submission-run:first-queue",
          progressCycleKey: "first-queue",
        },
      },
    );

    expect(result.current.displayedProgress).toBe(40);

    rerender({
      persistenceKey: "submission-run:second-queue",
      progressCycleKey: "second-queue",
    });
    expect(result.current.displayedProgress).toBe(0);

    act(() => {
      vi.advanceTimersByTime(48);
    });
    expect(result.current.displayedProgress).toBe(3);

    rerender({
      persistenceKey: "submission-run:second-queue",
      progressCycleKey: "second-queue",
    });
    expect(result.current.displayedProgress).toBe(3);
    unmount();

    const remountedSecondCycle = renderHook(() =>
      useSmoothProgress({
        serverProgress: 88,
        status: "running",
        intervalMs: 16,
        persistenceKey: "submission-run:second-queue",
        progressCycleKey: "second-queue",
      }),
    );
    expect(remountedSecondCycle.result.current.displayedProgress).toBe(3);
    remountedSecondCycle.unmount();
  });

  it("restarts the timer when a new submission begins after the previous target was reached", () => {
    vi.useFakeTimers();
    const { result, rerender, unmount } = renderHook(
      ({ persistenceKey, progressCycleKey }) =>
        useSmoothProgress({
          serverProgress: 88,
          status: "running",
          intervalMs: 16,
          initialProgress: 88,
          persistenceKey,
          progressCycleKey,
        }),
      {
        initialProps: {
          persistenceKey: "submission-run:finished-stage",
          progressCycleKey: "finished-stage",
        },
      },
    );

    expect(result.current.displayedProgress).toBe(88);
    rerender({
      persistenceKey: "submission-run:fresh-stage",
      progressCycleKey: "fresh-stage",
    });
    expect(result.current.displayedProgress).toBe(0);

    act(() => {
      vi.advanceTimersByTime(48);
    });
    expect(result.current.displayedProgress).toBe(3);
    unmount();
  });
});
