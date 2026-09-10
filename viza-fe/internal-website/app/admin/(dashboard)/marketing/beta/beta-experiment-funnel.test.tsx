import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BetaOperatorState } from "@/app/actions/admin-beta";
import { BetaExperimentFunnel } from "./beta-experiment-funnel";

const state: BetaOperatorState = {
  campaign: "launch-beta-2026",
  initialized: true,
  cohortState: "active",
  targetCount: 100,
  issued: 4,
  delivered: 3,
  remainingIssuable: 96,
  issuedUndelivered: [{ assignmentId: "a4", slotNumber: 4, deliveryMethod: "promo_code", platform: "TikTok", recipientReference: "user-4", issuedAt: "2026-09-09" }],
  friendInvitesIssued: 4,
  canInitialize: true,
  launchConfigReady: true,
  launchConfigIssues: [],
  metrics: [
    { deliveryMethod: "promo_code", delivered: 2, checkoutStarted: 2, converted: 1, submitted: 1 },
    { deliveryMethod: "link_suffix", delivered: 1, checkoutStarted: 1, converted: 0, submitted: 0 },
  ],
};

describe("BetaExperimentFunnel", () => {
  it("uses delivered participants as the conversion denominator", () => {
    render(<BetaExperimentFunnel locale="en" state={state} />);
    expect(screen.getByText("Social cohort: 4/100 issued, 3 delivered, 96 issuable")).toBeTruthy();
    expect(screen.getByText("50.0%")).toBeTruthy();
  });

  it("renders the shared funnel in Chinese", () => {
    render(<BetaExperimentFunnel locale="zh" state={state} />);
    expect(screen.getByText("社交内测组：已生成 4/100，已送达 3，可发放 96")).toBeTruthy();
    expect(screen.getByText("提交转化率")).toBeTruthy();
  });
});
