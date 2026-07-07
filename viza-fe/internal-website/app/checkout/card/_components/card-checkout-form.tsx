"use client";

import { useState } from "react";
import { startCardCheckout } from "@/app/actions/card-checkout";

interface Props {
  country: string;
  visaType: string;
  locale: "en" | "zh-CN";
  amountCents: number;
  currency: string;
  /** Prefill collected by the marketing /apply wizard (optional). */
  initialEmail?: string;
  initialName?: string;
  /** Opaque wizard payload, forwarded to the server action verbatim. */
  prefill?: string;
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
  initialEmail = "",
  initialName = "",
  prefill = "",
}: Props) {
  const t = COPY[locale];
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
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
        prefill: prefill || undefined,
      });
      // Hand off to Stripe's hosted checkout page.
      window.location.href = out.url;
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : t.error);
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mt-6 rounded-2xl border border-brand-100 bg-white shadow-[0_8px_30px_rgba(3,52,110,0.08)] overflow-hidden">
      <div className="px-7 pt-7">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-500">
          {t.title}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground mt-2">
          {t.subtitle}
        </p>
      </div>
      <div className="mx-7 mt-5 flex items-center justify-between rounded-xl bg-brand-50/70 border border-brand-100 px-4 py-3">
        <span className="text-sm font-medium text-foreground capitalize">
          {country.replace(/_/g, " ")} · {visaType}
        </span>
        <span className="text-lg font-semibold text-brand-500">{amount}</span>
      </div>
      <form onSubmit={handleSubmit} className="px-7 pb-7 mt-5 space-y-4">
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
          className="w-full rounded-full bg-brand-500 px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-400 disabled:opacity-50"
        >
          {submitting ? t.submitting : t.submit}
        </button>
        {errMsg && (
          <p className="text-sm text-destructive" role="alert">
            {errMsg}
          </p>
        )}
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground text-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {t.secure}
        </p>
      </form>
    </div>
  );
}
