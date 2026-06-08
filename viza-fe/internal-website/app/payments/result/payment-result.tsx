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
  const [attemptStatus, setAttemptStatus] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setStatus("failed");
      return;
    }

    let cancelled = false;
    async function poll() {
      const response = await fetch(`/api/payments/airwallex/${paymentId}/status`, { cache: "no-store" });
      const body = (await response.json()) as {
        status?: Status;
        providerStatus?: string;
        attemptStatus?: string | null;
        expiresAt?: string | null;
      };
      if (cancelled) return;
      setStatus(body.status ?? "failed");
      setProviderStatus(body.providerStatus ?? null);
      setAttemptStatus(body.attemptStatus ?? null);
      setExpiresAt(body.expiresAt ?? null);
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
              ? "VIZA 已记录这笔人民币服务费，月付方案会同步到你的订阅状态。"
              : failed
                ? expiresAt
                  ? "这次扫码支付没有在二维码有效期内完成，你可以返回订阅页面重新生成订单。"
                  : "在线支付服务未能确认本次支付，你可以返回订阅页面重新选择支付方式。"
                : "如果你刚完成扫码或验证，页面会自动刷新最终状态。"}
          </p>
          {providerStatus ? (
            <p className="mt-5 text-xs font-medium text-muted-foreground">支付服务状态：{providerStatus}</p>
          ) : null}
          {attemptStatus ? (
            <p className="mt-2 text-xs font-medium text-muted-foreground">支付尝试状态：{attemptStatus}</p>
          ) : null}
          {paid ? (
            <Link
              href="/client/settings/subscription"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              管理订阅方案
            </Link>
          ) : null}
        </section>
      </div>
    </main>
  );
}
