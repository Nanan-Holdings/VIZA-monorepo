import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WaitingCard } from "../WaitingCard";

const smoothProgress = vi.hoisted(() => ({ serverProgress: [] as number[] }));

vi.mock("next-intl", () => ({ useLocale: () => "en" }));
vi.mock("@/hooks/use-smooth-progress", () => ({
  useSmoothProgress: ({ serverProgress }: { serverProgress: number }) => {
    smoothProgress.serverProgress.push(serverProgress);
    return { displayedProgress: serverProgress, isVisuallyComplete: false };
  },
}));

describe("WaitingCard DS-160 checkpoints", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    smoothProgress.serverProgress = [];
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("names the CEAC page, estimates time left, and says leaving is safe", () => {
    render(
      <WaitingCard status="running" stage="filling_form" serverProgress={42} visaType="B1_B2" queueStage="ceac_page:passport" />,
    );
    expect(screen.getByText(/Filling: Passport \(step \d+ of \d+\)/)).toBeTruthy();
    expect(screen.getByText(/About \d+ min left/)).toBeTruthy();
    expect(screen.getByText(/You can close or leave this page/)).toBeTruthy();
  });

  it("creeps slowly from the checkpoint but never reaches the next one", async () => {
    render(
      <WaitingCard status="running" stage="filling_form" serverProgress={42} visaType="B1_B2" queueStage="ceac_page:passport" />,
    );
    expect(smoothProgress.serverProgress.at(-1)).toBe(42);

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(smoothProgress.serverProgress.at(-1)).toBe(44);

    await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60_000); });
    expect(smoothProgress.serverProgress.at(-1)).toBe(46);
  });

  it("shows no DS-160 notes for other visas", () => {
    render(<WaitingCard status="running" stage="filling_form" serverProgress={50} visaType="UK_STANDARD_VISITOR" />);
    expect(screen.queryByText(/You can close or leave this page/)).toBeNull();
  });
});
