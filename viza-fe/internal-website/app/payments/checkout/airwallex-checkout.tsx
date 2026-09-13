"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from "lucide-react";
import { SmoothProgressMeter } from "@/components/smooth-progress";
import { cn } from "@/lib/utils";
import {
  getPaymentCopy,
  formatPaymentCny,
  toPaymentLocale,
  type PaymentErrorKey,
  type PaymentMethodId,
} from "../payment-copy";

interface AirwallexCheckoutProps {
  paymentId: string | null;
  productId: string | null;
  preferredMethod: string | null;
  billing: string | null;
  backHref: string;
}

interface CreateIntentResponse {
  paymentId: string;
  intentId: string;
  clientSecret: string | null;
  amountFen: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  providerStatus: string;
  environment?: "demo" | "prod";
  productId: string | null;
  productName: string | null;
  productKind: "monthly" | "pay_per_application" | null;
}

interface AirwallexCardElement {
  mount(containerId: string): void;
  confirm?: (options: { intent_id: string; client_secret: string }) => Promise<unknown>;
  createPaymentConsent?: (options: {
    client_secret: string;
    customer_id?: string;
    next_triggered_by?: "merchant" | "customer";
    merchant_trigger_reason?: "scheduled" | "unscheduled";
    metadata?: Record<string, unknown>;
  }) => Promise<{
    id?: string;
    client_secret?: string;
    customer_id?: string;
    payment_consent_id?: string;
    payment_method?: unknown;
  } | boolean>;
  verifyConsent?: (options: {
    client_secret: string;
    currency?: string;
    verification_options?: { card: { currency: string } };
    verificationOptions?: { card: { currency: string } };
  }) => Promise<{
    id?: string;
    customer_id?: string;
    payment_consent_id?: string;
    payment_method?: unknown;
  } | boolean>;
  on(event: "ready" | "success" | "error", handler: (event?: unknown) => void): void;
}

interface AirwallexComponentsSdk {
  init(options: { env: "demo" | "prod"; enabledElements: string[]; locale: string }): Promise<void>;
  createElement(
    type: "card",
    options: {
      intent_id?: string;
      client_secret: string;
      currency: string;
      style?: Record<string, unknown>;
    },
  ): Promise<AirwallexCardElement | null>;
}

declare global {
  interface Window {
    AirwallexComponentsSDK?: AirwallexComponentsSdk;
    ApplePaySession?: { canMakePayments?: () => boolean };
  }
}

function normalizePreferredMethod(value: string | null): PaymentMethodId | null {
  if (value === "card") return "card";
  if (value === "wechat" || value === "wechatpay_qrcode") return "wechatpay_qrcode";
  if (value === "alipay" || value === "alipaycn_qrcode" || value === "alipaycn_mobile_web") return "alipaycn_qrcode";
  return null;
}

const methodOptions: Array<{ id: PaymentMethodId; icon: typeof CreditCard }> = [
  { id: "card", icon: CreditCard },
  { id: "wechatpay_qrcode", icon: MessageCircle },
  { id: "alipaycn_qrcode", icon: WalletCards },
];

function findRedirectUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findRedirectUrl(item);
      if (url) return url;
    }
    return null;
  }

  const object = value as Record<string, unknown>;
  for (const key of ["url", "redirect_url", "href", "qr_code_url"]) {
    const candidate = object[key];
    if (typeof candidate === "string" && candidate.startsWith("http")) return candidate;
  }

  for (const nested of Object.values(object)) {
    const url = findRedirectUrl(nested);
    if (url) return url;
  }
  return null;
}

function findQrCodeValue(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const qrCode = findQrCodeValue(item);
      if (qrCode) return qrCode;
    }
    return null;
  }

  const object = value as Record<string, unknown>;
  for (const key of ["qrcode", "qrcode_url", "qr_code", "qr_code_url"]) {
    const candidate = object[key];
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }

  for (const nested of Object.values(object)) {
    const qrCode = findQrCodeValue(nested);
    if (qrCode) return qrCode;
  }
  return null;
}

export function AirwallexCheckout({
  paymentId,
  productId,
  preferredMethod,
  billing,
  backHref,
}: AirwallexCheckoutProps) {
  const locale = useLocale();
  const paymentLocale = toPaymentLocale(locale);
  const copy = getPaymentCopy(locale);
  const [scriptReady, setScriptReady] = useState(false);
  const [intent, setIntent] = useState<CreateIntentResponse | null>(null);
  const [errorKey, setErrorKey] = useState<PaymentErrorKey | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId | null>(() =>
    normalizePreferredMethod(preferredMethod),
  );
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [cardElement, setCardElement] = useState<AirwallexCardElement | null>(null);
  const [confirmingMethod, setConfirmingMethod] = useState<PaymentMethodId | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrCodeValue, setQrCodeValue] = useState<string | null>(null);
  const [applePayAvailable, setApplePayAvailable] = useState(false);

  const createPayload = useMemo(
    () => (paymentId ? { paymentId } : productId ? { productId } : null),
    [paymentId, productId],
  );
  const isMonthly = billing === "monthly" || intent?.productKind === "monthly";
  const canChooseMethod = !isMonthly || agreementAccepted;
  const isAirwallexDemo = intent?.environment === "demo";
  const productNameMatchesLocale = intent?.productName
    ? paymentLocale === "zh"
      ? /[\u3400-\u9fff]/u.test(intent.productName)
      : !/[\u3400-\u9fff]/u.test(intent.productName)
    : false;
  const displayProductName =
    intent?.productName && productNameMatchesLocale
      ? intent.productName
      : isMonthly
        ? copy.monthlyPlan
        : copy.serviceFee;

  useEffect(() => {
    setApplePayAvailable(Boolean(window.ApplePaySession?.canMakePayments?.()));
    if (window.AirwallexComponentsSDK) setScriptReady(true);
  }, []);

  useEffect(() => {
    if (!createPayload) {
      setErrorKey("missingOrder");
      return;
    }

    let cancelled = false;
    async function createIntent() {
      setErrorKey(null);
      const response = await fetch("/api/payments/airwallex/create-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createPayload),
      });
      const body = (await response.json()) as CreateIntentResponse | { error?: string };
      if (!response.ok) {
        throw new Error("payment-intent-failed");
      }
      if (!cancelled) setIntent(body as CreateIntentResponse);
    }

    createIntent().catch(() => {
      if (!cancelled) setErrorKey("createOrderFailed");
    });

    return () => {
      cancelled = true;
    };
  }, [createPayload]);

  useEffect(() => {
    if (selectedMethod !== "card") {
      setCardElement(null);
      setCardReady(false);
      const container = document.getElementById("airwallex-card-element");
      if (container) container.innerHTML = "";
      return;
    }
    if (!canChooseMethod || !scriptReady || !intent?.clientSecret || !window.AirwallexComponentsSDK) return;
    if (intent.providerStatus !== "REQUIRES_PAYMENT_METHOD") {
      setCardElement(null);
      setCardReady(false);
      setErrorKey("cardOtherFlow");
      return;
    }

    const activeIntent = { ...intent, clientSecret: intent.clientSecret };
    let cancelled = false;
    async function mountCardElement() {
      setCardElement(null);
      setCardReady(false);
      const container = document.getElementById("airwallex-card-element");
      if (container) container.innerHTML = "";

      await window.AirwallexComponentsSDK?.init({
        env: activeIntent.environment ?? "demo",
        enabledElements: ["payments"],
        locale: paymentLocale,
      });
      const element = await window.AirwallexComponentsSDK?.createElement("card", {
        intent_id: activeIntent.intentId,
        client_secret: activeIntent.clientSecret,
        currency: activeIntent.currency,
        style: {
          base: {
            color: "#111827",
            fontSize: "16px",
            "::placeholder": { color: "#9ca3af" },
          },
        },
      });
      if (cancelled || !element) return;
      element.mount("airwallex-card-element");
      element.on("ready", () => {
        if (!cancelled) setCardReady(true);
      });
      element.on("success", () => {
        if (!cancelled) {
          window.location.assign(`/payments/result?paymentId=${encodeURIComponent(activeIntent.paymentId)}`);
        }
      });
      element.on("error", () => {
        if (!cancelled) setErrorKey("cardComponentError");
      });
      setCardElement(element);
    }

    mountCardElement().catch(() => {
      if (!cancelled) setErrorKey("cardComponentLoadFailed");
    });

    return () => {
      cancelled = true;
    };
  }, [canChooseMethod, intent, paymentLocale, scriptReady, selectedMethod]);

  function requireAgreement(): boolean {
    if (canChooseMethod) return true;
    setErrorKey("agreementRequired");
    return false;
  }

  async function confirmCardPayment() {
    if (!intent?.clientSecret || !cardElement?.confirm || !requireAgreement()) return;

    setConfirmingMethod("card");
    setErrorKey(null);
    try {
      await cardElement.confirm({
        intent_id: intent.intentId,
        client_secret: intent.clientSecret,
      });
      window.location.assign(`/payments/result?paymentId=${encodeURIComponent(intent.paymentId)}`);
    } catch {
      setErrorKey("cardPaymentFailed");
    } finally {
      setConfirmingMethod(null);
    }
  }

  async function confirmWalletMethod(methodType: Exclude<PaymentMethodId, "card">) {
    if (!intent || !requireAgreement()) return;
    setSelectedMethod(methodType);
    setConfirmingMethod(methodType);
    setErrorKey(null);
    setQrCodeDataUrl(null);
    setQrCodeValue(null);
    try {
      const response = await fetch(`/api/payments/airwallex/${intent.paymentId}/confirm-method`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ methodType }),
      });
      const body = (await response.json()) as {
        nextAction?: unknown;
        status?: string;
        environment?: "demo" | "prod";
        error?: string;
      };
      if (!response.ok) throw new Error("wallet-confirmation-failed");

      const qrCode = findQrCodeValue(body.nextAction);
      if (qrCode) {
        setQrCodeValue(qrCode);
        setQrCodeDataUrl(await QRCode.toDataURL(qrCode, { margin: 1, width: 240 }));
        return;
      }
      const url = findRedirectUrl(body.nextAction);
      if (url) {
        window.location.assign(url);
        return;
      }
      window.location.assign(`/payments/result?paymentId=${encodeURIComponent(intent.paymentId)}`);
    } catch {
      setErrorKey("walletConfirmationFailed");
    } finally {
      setConfirmingMethod(null);
    }
  }

  function selectMethod(method: PaymentMethodId) {
    if (!requireAgreement()) return;
    setErrorKey(null);
    setQrCodeDataUrl(null);
    setQrCodeValue(null);
    if (method === "card") {
      setSelectedMethod("card");
      return;
    }
    void confirmWalletMethod(method);
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-6">
      <Script
        src="https://static.airwallex.com/components/sdk/v1/index.js"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onLoad={() => setScriptReady(true)}
        onError={() => setErrorKey("scriptLoadFailed")}
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Link
          href={backHref}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium text-brand-500 shadow-sm transition hover:border-brand-500"
        >
          <ArrowLeft className="h-4 w-4" />
          {copy.backToSubscription}
        </Link>

        <section className="rounded-xl border bg-white p-5 shadow-sm sm:p-7">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-brand-500">{copy.brand}</p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">{copy.checkoutTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {copy.checkoutDescription}
              </p>
            </div>
            <div className="rounded-lg border bg-brand-50 px-4 py-3 text-right">
              <p className="text-xs font-medium text-muted-foreground">{copy.amountDue}</p>
              <p className="mt-1 text-2xl font-semibold text-brand-500">
                {intent ? formatPaymentCny(intent.amountFen, locale) : copy.preparing}
              </p>
              <p className="mt-1 text-xs leading-5 text-brand-700">
                {displayProductName}
              </p>
            </div>
          </div>

          {isMonthly ? (
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border bg-brand-50 p-4 text-sm leading-6 text-brand-900">
              <input
                type="checkbox"
                checked={agreementAccepted}
                onChange={(event) => {
                  setAgreementAccepted(event.target.checked);
                  if (event.target.checked) setErrorKey(null);
                }}
                className="mt-1 h-4 w-4 rounded border-brand-300 text-brand-500 focus:ring-brand-500"
              />
              <span>
                {copy.monthlyAgreement}
              </span>
            </label>
          ) : null}

          {errorKey ? (
            <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {copy.errors[errorKey]}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="rounded-lg border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">{copy.chooseMethod}</p>
              <div className="mt-3 grid gap-2">
                {methodOptions.map((method) => {
                  const Icon = method.icon;
                  const selected = selectedMethod === method.id;
                  const busy = confirmingMethod === method.id;
                  const methodCopy = copy.methods[method.id];
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => selectMethod(method.id)}
                      disabled={!intent || confirmingMethod !== null}
                      className={cn(
                        "flex min-h-[72px] w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60",
                        selected
                          ? "border-brand-500 bg-brand-50 text-brand-900"
                          : "border-border bg-white hover:border-brand-300 hover:bg-brand-50",
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-500 shadow-sm">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{methodCopy.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                          {methodCopy.description}
                        </span>
                      </span>
                      {selected ? <Check className="h-4 w-4 shrink-0 text-brand-500" /> : null}
                    </button>
                  );
                })}
              </div>
              {applePayAvailable ? (
                <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {copy.applePayUnavailable}
                </p>
              ) : null}
            </aside>

            <div className="min-h-[380px] rounded-lg border bg-background p-4">
              {!selectedMethod ? (
                <div className="flex min-h-[340px] flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                  <ShieldCheck className="h-8 w-8 text-brand-500" />
                  <p>{copy.chooseMethodPrompt}</p>
                </div>
              ) : null}

              {selectedMethod === "card" ? (
                <div className="grid min-h-[340px] content-center gap-4">
                  {!scriptReady || !intent ? (
                    <div className="mx-auto w-full max-w-sm space-y-3 text-sm text-muted-foreground">
                      <div className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {copy.cardPreparing}
                      </div>
                      <SmoothProgressMeter
                        serverProgress={62}
                        status="running"
                        intervalMs={120}
                        label={copy.progressPreparing}
                      />
                    </div>
                  ) : null}
                  <div id="airwallex-card-element" className="rounded-lg border bg-white p-4" />
                  <button
                    type="button"
                    onClick={confirmCardPayment}
                    disabled={!cardReady || confirmingMethod !== null}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-500 px-5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
                  >
                    {confirmingMethod === "card" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {isMonthly ? copy.authorizeAndPay : copy.pay}
                  </button>
                </div>
              ) : null}

              {qrCodeDataUrl && intent ? (
                <div className="flex min-h-[340px] flex-col items-center justify-center gap-4 text-center">
                  <img
                    src={qrCodeDataUrl}
                    alt={selectedMethod === "alipaycn_qrcode" ? copy.alipayQrAlt : copy.wechatQrAlt}
                    className="h-60 w-60 rounded-lg border bg-white p-3 shadow-sm"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedMethod === "alipaycn_qrcode" ? copy.alipayScanPrompt : copy.wechatScanPrompt}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {copy.qrStatusHint}
                    </p>
                    {isAirwallexDemo ? (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                        {copy.demoPaymentWarning}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/payments/result?paymentId=${encodeURIComponent(intent.paymentId)}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold text-brand-500 transition hover:bg-brand-50"
                  >
                    {copy.viewPaymentStatus}
                  </Link>
                  <span className="sr-only">{qrCodeValue}</span>
                </div>
              ) : null}

              {selectedMethod !== "card" && selectedMethod !== null && !qrCodeDataUrl ? (
                <div className="mx-auto flex min-h-[340px] w-full max-w-sm flex-col justify-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {copy.walletOpening}
                  </div>
                  <SmoothProgressMeter
                    serverProgress={88}
                    status="running"
                    intervalMs={120}
                    label={copy.progressProcessing}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
