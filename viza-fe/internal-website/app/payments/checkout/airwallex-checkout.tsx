"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, MessageCircle, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

interface AirwallexCheckoutProps {
  paymentId: string | null;
  productId: string | null;
  preferredMethod: string | null;
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
}

interface AirwallexDropInElement {
  mount(containerId: string): void;
  on(event: "ready" | "success" | "error", handler: (event?: unknown) => void): void;
}

interface AirwallexComponentsSdk {
  init(options: { env: "demo" | "prod"; enabledElements: string[]; locale: string }): Promise<void>;
  createElement(
    type: "dropIn",
    options: {
      intent_id: string;
      client_secret: string;
      currency: string;
      country_code: string;
      appearance: {
        mode: "light";
        variables: Record<string, string>;
      };
    },
  ): Promise<AirwallexDropInElement | null>;
}

declare global {
  interface Window {
    AirwallexComponentsSDK?: AirwallexComponentsSdk;
  }
}

const directMethods = [
  {
    id: "wechatpay_qrcode",
    label: "微信二维码",
    icon: MessageCircle,
  },
  {
    id: "alipaycn_mobile_web",
    label: "支付宝",
    icon: WalletCards,
  },
] as const;

function formatCny(amountFen: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: amountFen % 100 === 0 ? 0 : 2,
  }).format(amountFen / 100);
}

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

export function AirwallexCheckout({
  paymentId,
  productId,
  preferredMethod,
  backHref,
}: AirwallexCheckoutProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const [intent, setIntent] = useState<CreateIntentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropInReady, setDropInReady] = useState(false);
  const [confirmingMethod, setConfirmingMethod] = useState<string | null>(null);

  const createPayload = useMemo(
    () => (paymentId ? { paymentId } : productId ? { productId } : null),
    [paymentId, productId],
  );

  useEffect(() => {
    if (!createPayload) {
      setError("缺少支付订单，请从订阅页面重新选择方案。");
      return;
    }

    let cancelled = false;
    async function createIntent() {
      setError(null);
      const response = await fetch("/api/payments/airwallex/create-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createPayload),
      });
      const body = (await response.json()) as CreateIntentResponse | { error?: string };
      if (!response.ok) throw new Error("error" in body && body.error ? body.error : "创建支付订单失败。");
      if (!cancelled) setIntent(body as CreateIntentResponse);
    }

    createIntent().catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "创建支付订单失败。");
    });

    return () => {
      cancelled = true;
    };
  }, [createPayload]);

  useEffect(() => {
    if (!scriptReady || !intent?.clientSecret || !window.AirwallexComponentsSDK) return;

    const activeIntent = { ...intent, clientSecret: intent.clientSecret };
    let cancelled = false;
    async function mountDropIn() {
      setDropInReady(false);
      await window.AirwallexComponentsSDK?.init({
        env: "demo",
        enabledElements: ["payments"],
        locale: "zh",
      });
      const element = await window.AirwallexComponentsSDK?.createElement("dropIn", {
        intent_id: activeIntent.intentId,
        client_secret: activeIntent.clientSecret,
        currency: activeIntent.currency,
        country_code: "CN",
        appearance: {
          mode: "light",
          variables: {
            colorBrand: "#0b3f7c",
            colorText: "#111827",
            colorBackground: "#ffffff",
          },
        },
      });
      if (cancelled || !element) return;
      element.mount("airwallex-dropin");
      element.on("ready", () => setDropInReady(true));
      element.on("success", () => {
        window.location.assign(`/payments/result?paymentId=${encodeURIComponent(activeIntent.paymentId)}`);
      });
      element.on("error", () => setError("支付组件返回错误，请重试或换一种支付方式。"));
    }

    mountDropIn().catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "支付组件加载失败。");
    });

    return () => {
      cancelled = true;
    };
  }, [intent, scriptReady]);

  async function confirmMethod(methodType: string) {
    if (!intent) return;
    setConfirmingMethod(methodType);
    setError(null);
    try {
      const response = await fetch(`/api/payments/airwallex/${intent.paymentId}/confirm-method`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ methodType }),
      });
      const body = (await response.json()) as { nextAction?: unknown; status?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "确认支付方式失败。");

      const url = findRedirectUrl(body.nextAction);
      if (url) {
        window.location.assign(url);
        return;
      }
      window.location.assign(`/payments/result?paymentId=${encodeURIComponent(intent.paymentId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "确认支付方式失败。");
    } finally {
      setConfirmingMethod(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-6">
      <Script
        src="https://static.airwallex.com/components/sdk/v1/index.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setError("Airwallex 支付组件脚本加载失败。")}
      />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <Link
          href={backHref}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium text-brand-500 shadow-sm transition hover:border-brand-500"
        >
          <ArrowLeft className="h-4 w-4" />
          返回订阅页面
        </Link>

        <section className="rounded-xl border bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-brand-500">Airwallex sandbox checkout</p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">确认 VIZA 支付</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                本页仅收取 VIZA 服务费，官方签证费和第三方费用会单独展示。
              </p>
            </div>
            <div className="rounded-lg border bg-brand-50 px-4 py-3 text-right">
              <p className="text-xs font-medium text-muted-foreground">应付金额</p>
              <p className="mt-1 text-2xl font-semibold text-brand-500">
                {intent ? formatCny(intent.amountFen) : "准备中"}
              </p>
            </div>
          </div>

          {preferredMethod ? (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-500">
              <CheckCircle2 className="h-4 w-4" />
              已选择 {preferredMethod === "wechat" ? "微信" : preferredMethod === "alipay" ? "支付宝" : "银行卡"}
            </div>
          ) : null}

          {error ? (
            <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-h-[360px] rounded-lg border bg-background p-4">
              {!intent || !scriptReady ? (
                <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在准备安全支付组件
                </div>
              ) : null}
              <div id="airwallex-dropin" className={cn(!dropInReady && "min-h-[320px]")} />
            </div>

            <aside className="rounded-lg border bg-white p-4">
              <p className="text-sm font-semibold text-foreground">快捷方式</p>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => confirmMethod("card")}
                  disabled={!intent || confirmingMethod !== null}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-brand-500 px-4 text-sm font-semibold text-brand-500 transition hover:bg-brand-50 disabled:opacity-60"
                >
                  <CreditCard className="h-4 w-4" />
                  银行卡
                </button>
                {directMethods.map((method) => {
                  const Icon = method.icon;
                  const busy = confirmingMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => confirmMethod(method.id)}
                      disabled={!intent || confirmingMethod !== null}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                      {method.label}
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
