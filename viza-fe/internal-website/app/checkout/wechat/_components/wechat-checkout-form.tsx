"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { startWechatCheckout } from "@/app/actions/wechat-checkout";
import { SmoothProgressBar } from "@/components/smooth-progress";
import { useSmoothProgress } from "@/hooks/use-smooth-progress";

interface Props {
  country: string;
  visaType: string;
  locale: "en" | "zh-CN";
  amountFen: number;
  /** Prefill collected by the marketing /apply wizard (optional). */
  initialEmail?: string;
  initialName?: string;
  /** Opaque wizard payload, forwarded to the server action verbatim. */
  prefill?: string;
  betaLinkToken?: string;
}

type Step = "form" | "qr" | "paid" | "error";

const COPY = {
  en: {
    title: "Pay with WeChat",
    subtitle: "Pay for your visa in your WeChat app — we'll email you a sign-in link.",
    nameLabel: "Full name (as in passport)",
    emailLabel: "Email",
    submit: "Generate WeChat QR",
    qrTitle: "Scan with WeChat",
    qrHint: "Open WeChat → Discover → Scan. The page updates automatically after payment.",
    waiting: "Waiting for payment…",
    emailFootnote: "We'll email a sign-in link to",
    paidTitle: "Payment received",
    paidBody: "Check your inbox for a sign-in link.",
    error: "Something went wrong. Try again.",
    promoLabel: "Beta promo code (optional)",
    promoPlaceholder: "Enter your one-time code",
    linkOffer: "Your private beta invitation is attached to this link.",
    betaInvalid: "This beta invitation is invalid, already used, expired, or belongs to the other test group.",
  },
  "zh-CN": {
    title: "微信支付",
    subtitle: "在微信里扫码支付，付款后我们会向您的邮箱发送登录链接。",
    nameLabel: "姓名（与护照一致）",
    emailLabel: "邮箱",
    submit: "生成微信支付二维码",
    qrTitle: "请使用微信扫码",
    qrHint: "打开微信 → 发现 → 扫一扫。付款后页面会自动更新。",
    waiting: "正在等待付款…",
    emailFootnote: "登录链接将发送至：",
    paidTitle: "支付成功",
    paidBody: "请前往邮箱查收登录链接。",
    error: "出错了，请重试。",
    promoLabel: "内测优惠码（选填）",
    promoPlaceholder: "输入一次性优惠码",
    linkOffer: "此链接已包含您的专属内测资格。",
    betaInvalid: "该内测资格无效、已使用、已过期，或不属于当前测试组。",
  },
} as const;

const CNY_FORMAT = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
});

export function WechatCheckoutForm({
  country,
  visaType,
  locale,
  amountFen,
  initialEmail = "",
  initialName = "",
  prefill = "",
  betaLinkToken = "",
}: Props) {
  const t = COPY[locale];
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const {
    displayedProgress,
    isVisuallyComplete,
  } = useSmoothProgress({
    serverProgress: step === "paid" ? 100 : step === "qr" ? 92 : 0,
    status: step === "paid" ? "completed" : step === "error" ? "failed" : step === "qr" ? "running" : "waiting_for_user",
    intervalMs: 120,
  });

  // Poll the status endpoint while waiting for the WeChat notify
  // callback to flip the order to paid. Stop polling on paid / error.
  useEffect(() => {
    if (step !== "qr" || !orderId) return;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/wechat-pay/status/${orderId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { status: string };
        if (stopped) return;
        if (body.status === "paid") {
          setStep("paid");
        }
      } catch {
        // swallow — try again next tick
      }
    };
    const id = window.setInterval(tick, 2000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [step, orderId]);

  useEffect(() => {
    if (step !== "paid" || !isVisuallyComplete) return;
    router.push(`/checkout/wechat/check-your-email?locale=${locale}`);
  }, [isVisuallyComplete, locale, router, step]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    try {
      const out = await startWechatCheckout({
        country,
        visaType,
        email,
        fullName: name,
        locale,
        prefill: prefill || undefined,
        betaToken: betaLinkToken || promoCode || undefined,
        betaDeliveryMethod: betaLinkToken ? "link_suffix" : promoCode ? "promo_code" : undefined,
      });
      if (out.errorCode) {
        setErrMsg(t.betaInvalid);
        setStep("error");
        return;
      }
      // Free demo package: the order is already paid — no QR to scan.
      if (out.redirectUrl) {
        router.push(out.redirectUrl);
        return;
      }
      const dataUrl = await QRCode.toDataURL(out.codeUrl, {
        margin: 1,
        width: 256,
      });
      setOrderId(out.orderId);
      setQrDataUrl(dataUrl);
      setStep("qr");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setErrMsg(["invalid", "used", "wrong_channel"].includes(message) ? t.betaInvalid : message || t.error);
      setStep("error");
    }
  };

  const amount =
    amountFen === 0
      ? locale === "zh-CN"
        ? "免费"
        : "Free"
      : CNY_FORMAT.format(amountFen / 100);

  if (step === "paid") {
    return (
      <Shell>
        <h1 className="text-xl font-medium text-foreground">{t.paidTitle}</h1>
        <p className="text-sm text-muted-foreground mt-2">{t.paidBody}</p>
        <SmoothProgressBar
          displayedProgress={displayedProgress}
          label={t.paidTitle}
          className="mt-5"
          transitionMs={760}
        />
      </Shell>
    );
  }

  if (step === "qr" && qrDataUrl) {
    return (
      <Shell>
        <h1 className="text-xl font-medium text-foreground">{t.qrTitle}</h1>
        <div className="mt-4 flex justify-center">
          <img
            src={qrDataUrl}
            alt="WeChat Pay QR"
            width={256}
            height={256}
            className="border border-border rounded-lg p-2 bg-white"
          />
        </div>
        <p className="text-sm text-muted-foreground mt-4 text-center">
          {t.qrHint}
        </p>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {t.waiting}
        </p>
        <SmoothProgressBar
          displayedProgress={displayedProgress}
          label={t.waiting}
          className="mt-5"
          transitionMs={760}
        />
        <p className="text-xs text-muted-foreground mt-4 text-center">
          {t.emailFootnote} <span className="font-medium">{email}</span>
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-medium text-foreground">{t.title}</h1>
      <p className="text-sm text-muted-foreground mt-2">{t.subtitle}</p>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">
          {country} · {visaType}
        </span>
        <span className="text-lg font-medium text-brand-500">{amount}</span>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-foreground">{t.nameLabel}</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        {betaLinkToken ? (
          <p className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm leading-6 text-brand-700">{t.linkOffer}</p>
        ) : (
          <label className="block">
            <span className="text-sm text-foreground">{t.promoLabel}</span>
            <input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase())} placeholder={t.promoPlaceholder} autoComplete="off" className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase tracking-[0.12em] focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
        )}
        <label className="block">
          <span className="text-sm text-foreground">{t.emailLabel}</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-400 disabled:opacity-50"
        >
          {t.submit}
        </button>
        {errMsg && (
          <p className="text-sm text-destructive" role="alert">
            {errMsg}
          </p>
        )}
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md mt-6 rounded-2xl border border-brand-100 bg-white p-7 shadow-[0_8px_30px_rgba(3,52,110,0.08)]">
      {children}
    </div>
  );
}
