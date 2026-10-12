import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BetaOperatorState } from "@/app/actions/admin-beta";

const mocks = vi.hoisted(() => ({
  issue: vi.fn(),
  markDelivered: vi.fn(),
  cancel: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/app/actions/admin-beta", () => ({
  initializeSocialBetaCohort: vi.fn(),
  issueFriendBetaInvite: vi.fn(),
  issueNextSocialBetaInvite: mocks.issue,
  markSocialBetaInviteDelivered: mocks.markDelivered,
  cancelUndeliveredSocialInvite: mocks.cancel,
}));

import { BetaInviteManager } from "./beta-invite-manager";

function state(overrides: Partial<BetaOperatorState> = {}): BetaOperatorState {
  return {
    campaign: "launch-beta-2026",
    initialized: true,
    cohortState: "sealed",
    targetCount: 100,
    issued: 0,
    delivered: 0,
    remainingIssuable: 100,
    issuedUndelivered: [],
    friendInvitesIssued: 0,
    canInitialize: true,
    launchConfigReady: true,
    launchConfigIssues: [],
    metrics: [
      { deliveryMethod: "promo_code", delivered: 0, checkoutStarted: 0, converted: 0, submitted: 0 },
      { deliveryMethod: "link_suffix", delivered: 0, checkoutStarted: 0, converted: 0, submitted: 0 },
    ],
    ...overrides,
  };
}

describe("BetaInviteManager delivery controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.issue.mockResolvedValue({
      ok: true,
      data: {
        invite: {
          assignmentId: "assignment-17",
          slotNumber: 17,
          deliveryMethod: "link_suffix",
          value: "https://viza.it.com/apply?beta=secret",
        },
      },
    });
    mocks.markDelivered.mockResolvedValue({ ok: true, data: { assignmentId: "assignment-17" } });
    mocks.cancel.mockResolvedValue({ ok: true, data: { assignmentId: "assignment-17" } });
  });

  it("locks production issuance when the server-side beta preflight is incomplete", () => {
    render(<BetaInviteManager locale="en" state={state({
      launchConfigReady: false,
      launchConfigIssues: ["identity_hmac_key_missing", "checkout_handoff_key_missing"],
    })} />);

    expect(screen.getByText(/Invitation issuance is locked until/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Issue one friend promo code" })).toBeDisabled();
  });

  it("binds issuance to email and cannot dismiss plaintext before delivery or cancellation", async () => {
    render(<BetaInviteManager locale="en" state={state()} />);

    fireEvent.change(screen.getByLabelText("Platform"), { target: { value: "TikTok" } });
    fireEvent.change(screen.getByLabelText("Recipient reference"), { target: { value: "@person" } });
    fireEvent.change(screen.getByLabelText("Intended applicant email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Engagement proof reference"), { target: { value: "proof-42" } });
    fireEvent.click(screen.getByRole("button", { name: "Issue next social invite" }));

    await screen.findByText(/Do not close, refresh, or navigate away/);
    expect(mocks.issue).toHaveBeenCalledWith({
      platform: "TikTok",
      recipientReference: "@person",
      recipientEmail: "person@example.com",
      proofReference: "proof-42",
    });
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
    expect(screen.getByRole("button", { name: "Issue next social invite" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirm delivered" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Actual delivery reference"), {
      target: { value: "support-message-99" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm delivered" }));
    await waitFor(() => expect(mocks.markDelivered).toHaveBeenCalledWith({
      assignmentId: "assignment-17",
      deliveryReference: "support-message-99",
    }));
  });

  it("lets support cancel a lost issued invitation from the recovery list only with a reason", async () => {
    render(<BetaInviteManager locale="en" state={state({
      issued: 1,
      remainingIssuable: 99,
      issuedUndelivered: [{
        assignmentId: "assignment-17",
        slotNumber: 17,
        deliveryMethod: "link_suffix",
        platform: "TikTok",
        recipientReference: "@person",
        issuedAt: "2026-09-09T12:00:00Z",
      }],
    })} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel and release slot" });
    expect(cancelButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Cancellation reason"), {
      target: { value: "Plaintext was lost before it was sent" },
    });
    fireEvent.click(cancelButton);
    await waitFor(() => expect(mocks.cancel).toHaveBeenCalledWith({
      assignmentId: "assignment-17",
      reason: "Plaintext was lost before it was sent",
    }));
  });
});
