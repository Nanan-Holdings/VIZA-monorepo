"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Loader2,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CurrentSubscriptionState } from "@/lib/payments/commercial-records";
import { cn } from "@/lib/utils";

function formatAmount(locale: string, amountFen: number) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: amountFen % 100 === 0 ? 0 : 2,
  }).format(amountFen / 100);
}

function formatDate(locale: string, value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function statusClass(status: CurrentSubscriptionState["status"]) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "cancelled" || status === "expired") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "incomplete") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-border bg-muted text-muted-foreground";
}

export function SubscriptionManagement({
  initialSubscription,
}: {
  initialSubscription: CurrentSubscriptionState;
}) {
  const t = useTranslations("subscriptionManagement");
  const locale = useLocale();
  const [subscription, setSubscription] = useState(initialSubscription);
  const [isSubmitting, setIsSubmitting] = useState<"cancel" | "resume" | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const amountLabel = useMemo(
    () => formatAmount(locale, subscription.amountFen),
    [locale, subscription.amountFen],
  );
  const periodStart = formatDate(locale, subscription.currentPeriodStart);
  const periodEnd = formatDate(locale, subscription.currentPeriodEnd);
  const canCancel = subscription.recordId && subscription.status === "active";
  const canResume = subscription.recordId && subscription.status === "cancelled";

  async function updateSubscription(action: "cancel" | "resume") {
    setMessage(null);
    if (action === "cancel" && !window.confirm(t("confirmCancel"))) return;

    setIsSubmitting(action);
    const response = await fetch(`/api/subscription/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    setIsSubmitting(null);

    const result = (await response.json().catch(() => null)) as
      | (CurrentSubscriptionState & { error?: string })
      | null;

    if (!response.ok || !result || result.error) {
      setMessage({
        tone: "error",
        text: result?.error ?? t(action === "cancel" ? "cancelFailed" : "resumeFailed"),
      });
      return;
    }

    setSubscription(result);
    setMessage({
      tone: "success",
      text: action === "cancel" ? t("cancelled") : t("resumed"),
    });
  }

  return (
    <main className="mx-auto w-full max-w-[1040px] pb-16 pt-4">
      <Button asChild variant="outline" className="h-10 rounded-full">
        <Link href="/client/settings">
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Link>
      </Button>

      <section className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="grid gap-6 bg-brand-50/80 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-brand-700">
                {t("eyebrow")}
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-foreground sm:text-4xl">
                {t("title")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {t("subtitle")}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "w-fit rounded-full border px-4 py-2 text-sm font-semibold",
              statusClass(subscription.status),
            )}
          >
            {subscription.statusLabel}
          </span>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-lg border p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t("currentPlan")}</p>
                <h2 className="mt-2 text-3xl font-semibold text-foreground">
                  {subscription.planName}
                </h2>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm font-medium text-muted-foreground">{t("price")}</p>
                <p className="mt-2 text-2xl font-semibold text-brand-700">
                  {subscription.amountFen > 0 ? t("monthlyPrice", { amount: amountLabel }) : amountLabel}
                </p>
              </div>
            </div>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/40 p-4">
                <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {t("period")}
                </dt>
                <dd className="mt-2 text-sm font-semibold text-foreground">
                  {periodStart && periodEnd ? `${periodStart} - ${periodEnd}` : t("notEnabled")}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <dt className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                  {t("paymentMethod")}
                </dt>
                <dd className="mt-2 text-sm font-semibold text-foreground">
                  {subscription.paymentMethodLabel}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <dt className="text-sm font-medium text-muted-foreground">{t("countryLimit")}</dt>
                <dd className="mt-2 text-sm font-semibold text-foreground">
                  {subscription.countryLimitPerMonth
                    ? t("countryLimitValue", { count: subscription.countryLimitPerMonth })
                    : t("notEnabled")}
                </dd>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <dt className="text-sm font-medium text-muted-foreground">{t("renewal")}</dt>
                <dd className="mt-2 text-sm font-semibold text-foreground">
                  {subscription.renewalLabel}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border p-5">
            <h2 className="text-xl font-semibold text-foreground">{t("actionsTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("actionsDescription")}</p>

            {message ? (
              <p
                className={cn(
                  "mt-4 rounded-lg border px-3 py-2 text-sm font-medium",
                  message.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700",
                )}
                role="status"
                aria-live="polite"
              >
                {message.text}
              </p>
            ) : null}

            <div className="mt-5 grid gap-3">
              {canCancel ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 justify-start rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => void updateSubscription("cancel")}
                  disabled={isSubmitting !== null}
                >
                  {isSubmitting === "cancel" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {t("cancel")}
                </Button>
              ) : null}
              {canResume ? (
                <Button
                  type="button"
                  className="h-11 justify-start rounded-full"
                  onClick={() => void updateSubscription("resume")}
                  disabled={isSubmitting !== null}
                >
                  {isSubmitting === "resume" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  {t("resume")}
                </Button>
              ) : null}
              {!canCancel && !canResume ? (
                <Button asChild className="h-11 justify-start rounded-full">
                  <Link href="/client/subscription">
                    <CheckCircle2 className="h-4 w-4" />
                    {subscription.status === "free" ? t("choosePlan") : t("changePlan")}
                  </Link>
                </Button>
              ) : null}
              {canCancel || canResume ? (
                <Button asChild variant="outline" className="h-11 justify-start rounded-full">
                  <Link href="/client/subscription">
                    <ShieldCheck className="h-4 w-4" />
                    {t("changePlan")}
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" className="h-11 justify-start rounded-full">
                <Link href="/client/settings/payment-methods">
                  <CreditCard className="h-4 w-4" />
                  {t("managePayment")}
                </Link>
              </Button>
              <Button asChild variant="ghost" className="h-11 justify-start rounded-full">
                <Link href="/client/billing">
                  <ReceiptText className="h-4 w-4" />
                  {t("billing")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
