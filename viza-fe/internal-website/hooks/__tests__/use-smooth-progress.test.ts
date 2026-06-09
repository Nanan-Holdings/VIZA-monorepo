import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSmoothProgress } from "../use-smooth-progress";

describe("useSmoothProgress", () => {
  afterEach(() => {
    vi.useRealTimers();
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
});
