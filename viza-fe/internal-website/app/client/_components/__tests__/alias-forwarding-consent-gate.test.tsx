import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AliasForwardingConsentGate } from "../alias-forwarding-consent-gate";

const localeState = vi.hoisted(() => ({ value: "zh" }));
const initializeInbox = vi.fn();
const authorizeForwarding = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => localeState.value,
}));

vi.mock("@/app/actions/applicant-inbox", () => ({
  initializeAuthenticatedApplicantInbox: () => initializeInbox(),
  authorizeAuthenticatedApplicantInboxForwarding: () => authorizeForwarding(),
}));

describe("AliasForwardingConsentGate", () => {
  beforeEach(() => {
    localeState.value = "zh";
    initializeInbox.mockReset();
    authorizeForwarding.mockReset();
  });

  it("keeps one pending initialization when the locale changes", async () => {
    const pendingSetup = {
      alias: "appl-test@viza.it.com",
      destinationEmail: "user@example.com",
      forwardingAuthorized: false,
    };
    let resolveInitialization!: (value: {
      ok: true;
      data: typeof pendingSetup;
    }) => void;
    initializeInbox.mockReturnValue(
      new Promise<{ ok: true; data: typeof pendingSetup }>((resolve) => {
        resolveInitialization = resolve;
      }),
    );

    const { rerender } = render(<AliasForwardingConsentGate enabled />);
    await waitFor(() => {
      expect(initializeInbox).toHaveBeenCalledTimes(1);
    });

    localeState.value = "en";
    rerender(<AliasForwardingConsentGate enabled />);
    localeState.value = "zh";
    rerender(<AliasForwardingConsentGate enabled />);
    localeState.value = "en";
    rerender(<AliasForwardingConsentGate enabled />);
    expect(initializeInbox).toHaveBeenCalledTimes(1);

    resolveInitialization({ ok: true, data: pendingSetup });
    expect(await screen.findByText("Authorize your VIZA application email")).toBeInTheDocument();
  });

  it("localizes a completed initialization error without retrying", async () => {
    initializeInbox.mockResolvedValue({
      ok: false,
      error: { code: "SERVICE_UNAVAILABLE" },
    });

    const { rerender } = render(<AliasForwardingConsentGate enabled />);
    expect(
      await screen.findByText("邮箱授权服务暂时不可用，请稍后重试。你的申请资料不会丢失。"),
    ).toBeInTheDocument();

    localeState.value = "en";
    rerender(<AliasForwardingConsentGate enabled />);
    expect(
      screen.getByText(
        "The email authorization service is temporarily unavailable. Please try again later; your application data is safe.",
      ),
    ).toBeInTheDocument();
    expect(initializeInbox).toHaveBeenCalledTimes(1);
  });

  it("reinitializes after being disabled and enabled again without accepting a stale result", async () => {
    const firstSetup = {
      alias: "appl-first@viza.it.com",
      destinationEmail: "first@example.com",
      forwardingAuthorized: true,
    };
    const secondSetup = {
      alias: "appl-second@viza.it.com",
      destinationEmail: "second@example.com",
      forwardingAuthorized: false,
    };
    let resolveFirst!: (value: { ok: true; data: typeof firstSetup }) => void;
    let resolveSecond!: (value: { ok: true; data: typeof secondSetup }) => void;
    initializeInbox
      .mockReturnValueOnce(
        new Promise<{ ok: true; data: typeof firstSetup }>((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<{ ok: true; data: typeof secondSetup }>((resolve) => {
          resolveSecond = resolve;
        }),
      );

    const { rerender } = render(<AliasForwardingConsentGate enabled={false} />);
    expect(initializeInbox).not.toHaveBeenCalled();

    rerender(<AliasForwardingConsentGate enabled />);
    await waitFor(() => {
      expect(initializeInbox).toHaveBeenCalledTimes(1);
    });

    rerender(<AliasForwardingConsentGate enabled={false} />);
    rerender(<AliasForwardingConsentGate enabled />);
    await waitFor(() => {
      expect(initializeInbox).toHaveBeenCalledTimes(2);
    });

    resolveFirst({ ok: true, data: firstSetup });
    await Promise.resolve();
    expect(screen.queryByText(firstSetup.alias)).not.toBeInTheDocument();

    resolveSecond({ ok: true, data: secondSetup });
    expect(await screen.findByText(secondSetup.alias)).toBeInTheDocument();
    expect(screen.queryByText(firstSetup.alias)).not.toBeInTheDocument();
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
