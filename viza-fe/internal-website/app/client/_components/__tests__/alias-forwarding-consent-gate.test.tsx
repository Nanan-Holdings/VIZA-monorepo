import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AliasForwardingConsentGate } from "../alias-forwarding-consent-gate";

const initializeInbox = vi.fn();
const authorizeForwarding = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

vi.mock("@/app/actions/applicant-inbox", () => ({
  initializeAuthenticatedApplicantInbox: () => initializeInbox(),
  authorizeAuthenticatedApplicantInboxForwarding: () => authorizeForwarding(),
}));

describe("AliasForwardingConsentGate", () => {
  beforeEach(() => {
    initializeInbox.mockReset();
    authorizeForwarding.mockReset();
  });

  it("does not interrupt users who already authorized account forwarding", async () => {
    initializeInbox.mockResolvedValue({
      ok: true,
      data: {
        alias: "appl-test@viza.it.com",
        destinationEmail: "user@example.com",
        forwardingAuthorized: true,
      },
    });

    render(<AliasForwardingConsentGate enabled />);

    await waitFor(() => {
      expect(initializeInbox).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("授权申请专属邮箱转发")).not.toBeInTheDocument();
  });

  it("requires an explicit checkbox before recording authorization", async () => {
    const pending = {
      alias: "appl-test@viza.it.com",
      destinationEmail: "user@example.com",
      forwardingAuthorized: false,
    };
    initializeInbox.mockResolvedValue({ ok: true, data: pending });
    authorizeForwarding.mockResolvedValue({
      ok: true,
      data: {
        ...pending,
        forwardingAuthorized: true,
      },
    });

    render(<AliasForwardingConsentGate enabled />);

    expect(await screen.findByText("授权申请专属邮箱转发")).toBeInTheDocument();
    expect(screen.getByText("appl-test@viza.it.com")).toBeInTheDocument();
    expect(screen.getByText("user@example.com")).toBeInTheDocument();

    const authorizeButton = screen.getByRole("button", { name: "授权并继续" });
    expect(authorizeButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(authorizeButton).toBeEnabled();
    fireEvent.click(authorizeButton);

    await waitFor(() => {
      expect(authorizeForwarding).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("授权申请专属邮箱转发")).not.toBeInTheDocument();
    });
  });

  it("shows localized copy instead of a production Server Action digest", async () => {
    const pending = {
      alias: "appl-test@viza.it.com",
      destinationEmail: "user@example.com",
      forwardingAuthorized: false,
    };
    initializeInbox.mockResolvedValue({ ok: true, data: pending });
    authorizeForwarding.mockRejectedValue(
      new Error(
        "An error occurred in the Server Components render. The specific message is omitted in production builds.",
      ),
    );

    render(<AliasForwardingConsentGate enabled />);

    await screen.findByText("授权申请专属邮箱转发");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "授权并继续" }));

    expect(
      await screen.findByText("邮箱授权服务暂时不可用，请稍后重试。你的申请资料不会丢失。"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Server Components render/u)).not.toBeInTheDocument();
  });

  it("renders typed authorization failures without closing the gate", async () => {
    const pending = {
      alias: "appl-test@viza.it.com",
      destinationEmail: "user@example.com",
      forwardingAuthorized: false,
    };
    initializeInbox.mockResolvedValue({ ok: true, data: pending });
    authorizeForwarding.mockResolvedValue({
      ok: false,
      error: { code: "AUTH_REQUIRED" },
    });

    render(<AliasForwardingConsentGate enabled />);

    await screen.findByText("授权申请专属邮箱转发");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "授权并继续" }));

    expect(await screen.findByText("登录状态已失效，请刷新页面后重新登录。")).toBeInTheDocument();
    expect(screen.getByText("授权申请专属邮箱转发")).toBeInTheDocument();
  });
});
