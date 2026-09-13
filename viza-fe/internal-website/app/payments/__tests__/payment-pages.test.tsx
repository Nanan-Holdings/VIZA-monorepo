import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAttemptStatusLabel, getProviderStatusLabel } from "../payment-copy";
import { AirwallexCheckout } from "../checkout/airwallex-checkout";
import { PaymentResult } from "../result/payment-result";

let currentLocale: "en" | "zh" = "en";

vi.mock("next-intl", () => ({
  useLocale: () => currentLocale,
}));

vi.mock("next/script", () => ({
  default: () => null,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children?: ReactNode; href?: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/smooth-progress", () => ({
  SmoothProgressMeter: ({ label }: { label: string }) => <div data-testid="progress">{label}</div>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  currentLocale = "en";
});

async function flushEffects() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

describe("payment page locale copy", () => {
  it("rerenders checkout copy in the selected language without recreating the payment intent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: "payment-1",
        intentId: "intent-1",
        clientSecret: null,
        amountFen: 17900,
        currency: "CNY",
        status: "pending",
        providerStatus: "REQUIRES_PAYMENT_METHOD",
        environment: "demo",
        productId: "monthly_access",
        productName: "VIZA Access 月付方案",
        productKind: "monthly",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(
      <AirwallexCheckout
        paymentId="payment-1"
        productId={null}
        preferredMethod={null}
        billing="monthly"
        backHref="/client/subscription"
      />,
    );
    await flushEffects();

    expect(screen.getByText("VIZA online payment")).toBeInTheDocument();
    expect(screen.getByText("Amount due")).toBeInTheDocument();
    expect(screen.getByText("CN¥179")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      currentLocale = "zh";
      view.rerender(
        <AirwallexCheckout
          paymentId="payment-1"
          productId={null}
          preferredMethod={null}
          billing="monthly"
          backHref="/client/subscription"
        />,
      );
    });

    expect(screen.getByText("VIZA 在线支付")).toBeInTheDocument();
    expect(screen.getByText("应付金额")).toBeInTheDocument();
    expect(screen.getByText("¥179")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("localizes result status text and never exposes raw provider codes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "paid",
        providerStatus: "SUCCEEDED",
        attemptStatus: "CAPTURED",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const view = render(<PaymentResult paymentId="payment-1" />);
    await flushEffects();

    expect(screen.getByText("Payment confirmed")).toBeInTheDocument();
    expect(screen.getByText("Payment service status: Paid")).toBeInTheDocument();
    expect(screen.getByText("Payment attempt status: Paid")).toBeInTheDocument();
    expect(screen.queryByText(/SUCCEEDED|CAPTURED/)).not.toBeInTheDocument();

    await act(async () => {
      currentLocale = "zh";
      view.rerender(<PaymentResult paymentId="payment-1" />);
    });

    expect(screen.getByText("支付已确认")).toBeInTheDocument();
    expect(screen.getByText("支付服务状态：已支付")).toBeInTheDocument();
    expect(screen.getByText("支付尝试状态：已支付")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("passes the selected locale to the hosted card SDK without recreating the intent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        paymentId: "payment-1",
        intentId: "intent-1",
        clientSecret: "secret-1",
        amountFen: 13900,
        currency: "CNY",
        status: "pending",
        providerStatus: "REQUIRES_PAYMENT_METHOD",
        environment: "demo",
        productId: "pay_singapore_visit",
        productName: "Singapore visit",
        productKind: "pay_per_application",
      }),
    });
    const cardElement = {
      mount: vi.fn(),
      on: vi.fn(),
    };
    const sdk = {
      init: vi.fn().mockResolvedValue(undefined),
      createElement: vi.fn().mockResolvedValue(cardElement),
    };
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("AirwallexComponentsSDK", sdk);

    const view = render(
      <AirwallexCheckout
        paymentId="payment-1"
        productId={null}
        preferredMethod="card"
        billing="pay_per_application"
        backHref="/client/subscription"
      />,
    );
    await flushEffects();
    await flushEffects();

    expect(sdk.init).toHaveBeenCalledWith({
      env: "demo",
      enabledElements: ["payments"],
      locale: "en",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      currentLocale = "zh";
      view.rerender(
        <AirwallexCheckout
          paymentId="payment-1"
          productId={null}
          preferredMethod="card"
          billing="pay_per_application"
          backHref="/client/subscription"
        />,
      );
    });
    await flushEffects();
    await flushEffects();

    expect(sdk.init).toHaveBeenLastCalledWith({
      env: "demo",
      enabledElements: ["payments"],
      locale: "zh",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses localized safe labels for unknown provider statuses", () => {
    expect(getProviderStatusLabel("UNRECOGNIZED_PROVIDER_CODE", "en")).toBe("Status unavailable");
    expect(getAttemptStatusLabel("UNRECOGNIZED_ATTEMPT_CODE", "zh")).toBe("状态暂不可用");
  });
});
