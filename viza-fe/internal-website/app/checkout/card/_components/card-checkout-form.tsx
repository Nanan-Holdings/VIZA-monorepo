"use client";

import { useState } from "react";
import { startCardCheckout } from "@/app/actions/card-checkout";

interface Props {
  country: string;
  visaType: string;
  locale: "en" | "zh-CN";
  amountCents: number;
  currency: string;
}

const COPY = {
  en: {
    title: "Pay by card",
    subtitle:
      "Pay for your visa with any card — we'll email you a sign-in link to track your application.",
    nameLabel: "Full name (as in passport)",
    emailLabel: "Email",
    submit: "Continue to secure payment",
    submitting: "Redirecting to payment…",
    error: "Something went wrong. Try again.",
    secure: "Payments are processed securely by Stripe.",
  },
  "zh-CN": {
    title: "银行卡支付",
    subtitle:
      "使用任意银行卡支付签证费用，付款后我们会向您的邮箱发送登录链接以跟踪申请进度。",
    nameLabel: "姓名（与护照一致）",
    emailLabel: "邮箱",
    submit: "前往安全支付",
    submitting: "正在跳转至支付页面…",
    error: "出错了，请重试。",
    secure: "支付由 Stripe 安全处理。",
  },
} as const;

export function CardCheckoutForm({
  country,
  visaType,
  locale,
  amountCents,
  currency,
}: Props) {
  const t = COPY[locale];
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const amount = new Intl.NumberFormat(locale === "zh-CN" ? "zh-CN" : "en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    setSubmitting(true);
    try {
      const out = await startCardCheckout({
        country,
        visaType,
        email,
        fullName: name,
        locale,
      });
      // Hand off to Stripe's hosted checkout page.
      window.location.href = out.url;
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : t.error);
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-sm">
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
          disabled={submitting}
          className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-400 disabled:opacity-50"
        >
          {submitting ? t.submitting : t.submit}
        </button>
        {errMsg && (
          <p className="text-sm text-destructive" role="alert">
            {errMsg}
          </p>
        )}
        <p className="text-xs text-muted-foreground text-center">{t.secure}</p>
      </form>
    </div>
  );
}
