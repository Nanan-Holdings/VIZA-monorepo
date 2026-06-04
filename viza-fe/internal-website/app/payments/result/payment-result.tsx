"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";

interface PaymentResultProps {
  paymentId: string | null;
}

type Status = "pending" | "paid" | "failed";

export function PaymentResult({ paymentId }: PaymentResultProps) {
  const [status, setStatus] = useState<Status>("pending");
  const [providerStatus, setProviderStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setStatus("failed");
      return;
    }

    let cancelled = false;
    async function poll() {
      const response = await fetch(`/api/payments/airwallex/${paymentId}/status`, { cache: "no-store" });
      const body = (await response.json()) as { status?: Status; providerStatus?: string };
      if (cancelled) return;
      setStatus(body.status ?? "failed");
      setProviderStatus(body.providerStatus ?? null);
    }

    poll().catch(() => setStatus("failed"));
    const interval = window.setInterval(() => {
      poll().catch(() => setStatus("failed"));
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [paymentId]);

  const paid = status === "paid";
  const failed = status === "failed";
  const Icon = paid ? CheckCircle2 : failed ? XCircle : Loader2;

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <Link
          href="/client/subscription"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium text-brand-500 shadow-sm transition hover:border-brand-500"
        >
          <ArrowLeft className="h-4 w-4" />
          返回订阅页面
        </Link>

        <section className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <Icon className={status === "pending" ? "h-6 w-6 animate-spin" : "h-6 w-6"} />
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">
            {paid ? "支付已确认" : failed ? "支付未完成" : "正在确认支付"}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {paid
              ? "VIZA 已记录这笔人民币服务费，权益开通逻辑已预留给后续账户体系。"
              : failed
                ? "Airwallex 未能确认本次支付，你可以返回订阅页面重新选择支付方式。"
                : "如果你刚完成扫码或验证，页面会自动刷新最终状态。"}
          </p>
          {providerStatus ? (
            <p className="mt-5 text-xs font-medium text-muted-foreground">Provider status: {providerStatus}</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
